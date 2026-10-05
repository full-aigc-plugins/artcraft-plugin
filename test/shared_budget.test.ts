/** 父子预算在真实 SQLite 中共享；未知执行和重开不能获得第二份额度。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { planHash } from '../src/protocol/contracts.ts';

const identity={pluginId:'fixture',pluginVersion:'0.1',cliVersion:'0.1',sha256:'a'.repeat(64),mode:'headless',capabilitySnapshotSha256:'a'.repeat(64)};
const budget={currency:'USD',maxMinorUnits:10,maxExternalCalls:2,maxRevisions:1};
const plan=(revision='v1')=>({ownerId:'user',workflowId:'campaign',revision,authorizationRef:'scope',budget,deadline:'2030-01-01T00:00:00Z',nodes:[]});
const request=(id:string)=>{const payload={schemaVersion:'fixture/v1'};return {protocolVersion:'craft-task/v1',taskId:id,idempotencyKey:id,planHash:planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:identity,authorizationRef:'scope',budget,deadline:'2030-01-01T00:00:00Z',payload};};
function fixture(work:(ledger:TaskLedger,path:string,root:string)=>void|Promise<void>){
 const root=mkdtempSync(join(tmpdir(),'craft-budget-')),path=join(root,'tasks.sqlite'),ledger=new TaskLedger(path);
 return Promise.resolve().then(()=>work(ledger,path,root)).finally(()=>{ledger.close();rmSync(root,{recursive:true});});
}
function register(ledger:TaskLedger,key:string,id:string){ledger.register('user','project-'+id,request(id),key);ledger.ready(id);}

test('siblings share one cap and insufficient allocation creates no execution or lease',()=>fixture(ledger=>{
 const key=ledger.beginWorkflow(plan());register(ledger,key,'one');register(ledger,key,'two');
 ledger.claim('one',null,{minorUnits:6,externalCalls:1});
 assert.throws(()=>ledger.claim('two',null,{minorUnits:5,externalCalls:1}),/budget_exceeded: minorUnits/);
 assert.equal(ledger.status('two').state,'ready');assert.equal(ledger.execution('two'),null);
 assert.equal(ledger.leases().length,1);
 assert.deepEqual(ledger.workflowBudget(key).allocated,{minorUnits:6,externalCalls:1,revisions:0});
}));
test('external call cap rejects even when monetary allocation is free',()=>fixture(ledger=>{
 const key=ledger.beginWorkflow(plan());register(ledger,key,'one');register(ledger,key,'two');
 ledger.claim('one',null,{minorUnits:0,externalCalls:2});
 assert.throws(()=>ledger.claim('two',null,{minorUnits:0,externalCalls:1}),/budget_exceeded: externalCalls/);
}));
test('same revision does not charge again; new revisions share a frozen policy and cap',()=>fixture(ledger=>{
 const key=ledger.beginWorkflow(plan());assert.equal(ledger.beginWorkflow(plan()),key);
 const second=ledger.beginWorkflow(plan('v2'));
 assert.deepEqual(ledger.workflowBudget(second).allocated,{minorUnits:0,externalCalls:0,revisions:1});
 assert.throws(()=>ledger.beginWorkflow(plan('v3')),/budget_exceeded: revisions/);
 assert.throws(()=>ledger.beginWorkflow({...plan('raised'),budget:{...budget,maxRevisions:9}}),/budget_policy_conflict/);
 assert.throws(()=>ledger.beginWorkflow({...plan('currency'),budget:{...budget,currency:'EUR'}}),/budget_policy_conflict/);
}));
test('unknown attempt allocation survives reopening and is not refunded or replayed',()=>fixture((ledger,path)=>{
 const key=ledger.beginWorkflow(plan());register(ledger,key,'one');register(ledger,key,'two');
 const receipt=ledger.claim('one',null,{minorUnits:10,externalCalls:2});ledger.unknown('one',receipt.epoch,'disconnect');
 const other=new TaskLedger(path);
 try{
  assert.deepEqual(other.workflowBudget(key).allocated,{minorUnits:10,externalCalls:2,revisions:0});
  assert.throws(()=>other.claim('one',null,{minorUnits:10,externalCalls:2}),/task_not_ready/);
  assert.throws(()=>other.claim('two',null,{minorUnits:1,externalCalls:0}),/budget_exceeded/);
 }finally{other.close();}
}));
test('usage must be explicit safe integers and malformed usage cannot allocate any resources',()=>fixture(ledger=>{
 const key=ledger.beginWorkflow(plan());register(ledger,key,'one');
 for(const usage of [undefined,{minorUnits:-1,externalCalls:0},{minorUnits:0.1,externalCalls:0},{minorUnits:0,externalCalls:NaN},{minorUnits:Number.MAX_SAFE_INTEGER+1,externalCalls:0},{minorUnits:0,externalCalls:0,extra:true}])assert.throws(()=>ledger.claim('one',null,usage),/budget_usage_invalid/);
 assert.deepEqual(ledger.workflowBudget(key).allocated,{minorUnits:0,externalCalls:0,revisions:0});assert.equal(ledger.leases().length,0);
}));
test('two OS processes cannot reserve more than the common budget for different projects',()=>fixture(async(ledger,path,root)=>{
 const key=ledger.beginWorkflow(plan());register(ledger,key,'one');register(ledger,key,'two');
 const module=new URL('../src/harness/task_ledger.ts',import.meta.url).href,script=join(root,'reserve.mjs');
 writeFileSync(script,`import {TaskLedger} from ${JSON.stringify(module)};const l=new TaskLedger(process.argv[2]);try{l.claim(process.argv[3],null,{minorUnits:6,externalCalls:0});console.log(JSON.stringify({ok:true}));}catch(e){console.log(JSON.stringify({ok:false,error:e.message}));}finally{l.close();}`);
 const claim=(id:string)=>new Promise<any>((resolve,reject)=>{const p=spawn(process.execPath,[script,path,id],{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('close',code=>code?reject(new Error(err)):resolve(JSON.parse(out)));});
 const results=await Promise.all([claim('one'),claim('two')]);
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).error,'budget_exceeded: minorUnits');
 assert.equal(ledger.workflowBudget(key).allocated.minorUnits,6);
}));
test('explicit unlimited policy still rejects safe integer accumulation overflow',()=>fixture(ledger=>{
 const unlimited={...budget,maxMinorUnits:null,maxExternalCalls:null};const key=ledger.beginWorkflow({...plan(),budget:unlimited});
 for(const id of ['one','two']){ledger.register('user','project-'+id,{...request(id),budget:unlimited},key);ledger.ready(id);}
 ledger.claim('one',null,{minorUnits:Number.MAX_SAFE_INTEGER,externalCalls:0});
 assert.throws(()=>ledger.claim('two',null,{minorUnits:1,externalCalls:0}),/budget_usage_overflow/);
}));
test('legacy ledger history stays readable but cannot invent a free past budget',()=>fixture((ledger,path)=>{
 ledger.beginWorkflow(plan());
 const raw=new DatabaseSync(path);
 try{for(const table of ['task_budget_links','workflow_budget_links','budget_reservations','budget_accounts'])raw.exec('DROP TABLE IF EXISTS '+table);raw.exec('PRAGMA user_version=1');}finally{raw.close();}
 const migrated=new TaskLedger(path);
 try{assert.deepEqual(migrated.list(),[]);assert.throws(()=>migrated.beginWorkflow(plan('v2')),/budget_history_untracked/);}
 finally{migrated.close();}
}));
