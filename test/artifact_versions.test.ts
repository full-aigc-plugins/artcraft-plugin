/** 同一逻辑项目内素材版本不可改写；检查先于预算和副作用登记。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { validateArtifact } from '../src/protocol/contracts.ts';
import { planHash } from '../src/protocol/contracts.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { WorkflowEngine } from '../src/planning/workflow_engine.ts';

const sha='a'.repeat(64),other='b'.repeat(64);
function artifact(digest=sha,version='v1'):Record<string,any> {
 return {protocolVersion:'craft-artifact/v1',assetId:'brand',version,sha256:digest,bytes:5,mediaType:'application/octet-stream',producerTaskId:'import',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'brand.bin'};
}
function plan(revision='v1',digest=sha,version='v1'):Record<string,any> {
 return {workflowId:'campaign',ownerId:'owner',revision,authorizationRef:'scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:4,maxExternalCalls:0},deadline:'2030-01-01T00:00:00Z',nodes:[{id:'poster',dependsOn:[],externalInputs:[{root:'/fixture',artifact:artifact(digest,version)}]}]};
}
function fixture(work:(ledger:TaskLedger,path:string)=>void) {
 const root=mkdtempSync(join(tmpdir(),'craft-artifact-versions-'));const path=join(root,'ledger.sqlite');const ledger=new TaskLedger(path);
 try{work(ledger,path);}finally{ledger.close();rmSync(root,{recursive:true});}
}
for(const field of ['sourceRefs','renditions','evidenceRefs','nativeProjectRef','lossReportRef','dependencies'])test(`artifact refuses conflicting immutable identity in ${field}`,()=>{
 const value=artifact(),ref={assetId:'brand',version:'v1',sha256:other,location:'ref.bin'};
 if(field==='sourceRefs'){const {location,...source}=ref;value[field]=[source];}
 else if(field==='dependencies'){const {location,...assetRef}=ref;value[field]=[{assetRef,kind:'media',packaged:true,missingReason:null}];}
 else value[field]=['nativeProjectRef','lossReportRef'].includes(field) ? ref : [ref];
 assert.throws(()=>validateArtifact(value),/artifact_version_conflict/);
});
test('same asset with a new version and same-version matching references remain legal',()=>{
 const value=artifact();value.sourceRefs=[{assetId:'brand',version:'previous',sha256:other},{assetId:'brand',version:'v1',sha256:sha}];
 assert.deepEqual(validateArtifact(value),value);
});
test('changed content with same version refuses new workflow before revision budget allocation',()=>fixture((ledger,path)=>{
 const first=ledger.beginWorkflow(plan());const before=ledger.workflowBudget(first);
 const reopened=new TaskLedger(path);
 try{
  assert.throws(()=>reopened.beginWorkflow(plan('v2',other)),/artifact_version_conflict/);
  assert.deepEqual(reopened.workflowBudget(first),before);assert.deepEqual(reopened.list(),[]);assert.deepEqual(reopened.leases(),[]);
  // A correctly versioned request at the rejected revision must still be possible.
  const accepted=reopened.beginWorkflow(plan('v2',other,'v2'));
  assert.equal(reopened.workflowBudget(accepted).allocated.revisions,1);
 }finally{reopened.close();}
}));
test('two connections preserve immutable version even under a new authorization scope',()=>fixture((ledger,path)=>{
 ledger.beginWorkflow(plan());const second=new TaskLedger(path);
 try{const changed=plan('v2',other);changed.authorizationRef='scope-two';assert.throws(()=>second.beginWorkflow(changed),/artifact_version_conflict/);assert.equal(second.budgetAccounts().length,1);}finally{second.close();}
}));
test('replaying a frozen revision refuses conflicting legacy history without rewriting it',()=>fixture((ledger,path)=>{
 const first=ledger.beginWorkflow(plan());const second=ledger.beginWorkflow(plan('v2',other,'v2'));
 const legacy=plan('v2',other),database=new DatabaseSync(path);
 try{database.prepare('UPDATE workflow_runs SET plan_json=?,plan_hash=? WHERE run_key=?').run(JSON.stringify(legacy),planHash(legacy),second);}finally{database.close();}
 const before=ledger.workflowBudget(first);
 assert.throws(()=>ledger.beginWorkflow(plan()),/artifact_version_conflict/);assert.deepEqual(ledger.workflowBudget(first),before);
 const preserved=new DatabaseSync(path);
 try{assert.equal((preserved.prepare('SELECT plan_json FROM workflow_runs WHERE run_key=?').get(second) as any).plan_json,JSON.stringify(legacy));}finally{preserved.close();}
}));
test('unrelated owners and logical projects have separate version namespaces',()=>fixture(ledger=>{
 ledger.beginWorkflow(plan());const project=plan('v2',other);project.workflowId='other-project';ledger.beginWorkflow(project);
 const owner=plan('v2',other);owner.ownerId='other-owner';ledger.beginWorkflow(owner);assert.equal(ledger.budgetAccounts().length,3);
}));
test('one submitted graph cannot bind the same version to two contents',()=>fixture(ledger=>{
 const value=plan();value.nodes.push({...value.nodes[0],id:'cover',externalInputs:[{root:'/other',artifact:artifact(other)}]});
 assert.throws(()=>ledger.beginWorkflow(value),/artifact_version_conflict/);assert.deepEqual(ledger.budgetAccounts(),[]);
}));
test('new inputs cannot conflict with a previously delivered output version',()=>fixture(ledger=>{
 const first=ledger.beginWorkflow(plan());ledger.saveWorkflowNode(first,'poster',{status:'review_ready',outputs:[{...artifact(),assetId:'poster'}]});
 const changed=plan('v2');changed.nodes[0].externalInputs[0].artifact={...artifact(other),assetId:'poster'};
 assert.throws(()=>ledger.beginWorkflow(changed),/artifact_version_conflict/);
}));
test('node publication cannot overwrite an input or another node immutable version',()=>fixture(ledger=>{
 const first=ledger.beginWorkflow(plan());
 assert.throws(()=>ledger.saveWorkflowNode(first,'poster',{status:'review_ready',outputs:[artifact(other)]}),/artifact_version_conflict/);
 assert.equal(ledger.workflowNode(first,'poster').status,'pending');
}));

test('standalone input conflicts refuse task and budget registration while other projects remain independent',()=>fixture(ledger=>{
 const payload={schemaVersion:'fixture/v1',plan:{}};
 const request={protocolVersion:'craft-task/v1',taskId:'first',idempotencyKey:'first',planHash:planHash(payload),inputRefs:[{assetId:'brand',version:'v1',sha256:sha}],expectedRevision:null,runtimeIdentity:{pluginId:'fixture',pluginVersion:'1',cliVersion:'1',sha256:sha,mode:'headless',capabilitySnapshotSha256:sha},authorizationRef:'scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:'2030-01-01T00:00:00Z',payload};
 ledger.register('owner','project',request);const before=ledger.budgetAccounts();
 const changed={...request,taskId:'second',idempotencyKey:'second',inputRefs:[{assetId:'brand',version:'v1',sha256:other}]};
 assert.throws(()=>ledger.register('owner','project',changed),/artifact_version_conflict/);
 assert.deepEqual(ledger.budgetAccounts(),before);assert.equal(ledger.list().length,1);
 assert.equal(ledger.register('owner','other-project',changed).taskId,'second');
}));

test('real stopped tasks cannot publish changed bytes under a previously delivered version after reopen',async()=>{
 const root=mkdtempSync(join(tmpdir(),'craft-version-publication-'));const database=join(root,'ledger.sqlite');let ledger=new TaskLedger(database);
 const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
 const runtime=hash(readFileSync(process.execPath));
 const execute=async(id:string,content:string)=>{
  const output=join(root,id);mkdirSync(output);const file=join(output,'brand.bin');
  const payload={schemaVersion:'fixture/v1',content};
  const request={protocolVersion:'craft-task/v1',taskId:id,idempotencyKey:id,planHash:planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:{pluginId:'fixture',pluginVersion:'1',cliVersion:'1',sha256:runtime,mode:'headless',capabilitySnapshotSha256:runtime},authorizationRef:'scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:'2030-01-01T00:00:00Z',payload};
  ledger.register('owner','project',request);ledger.ready(id);
  return new LocalRunner(ledger,async()=>{}).execute(id,{prepare:async()=>({executable:process.execPath,args:['-e',`require('node:fs').writeFileSync(${JSON.stringify(file)},${JSON.stringify(content)})`],cwd:output,runtimeSha256:runtime,actualRevision:null,budgetUsage:{minorUnits:0,externalCalls:0}}),verify:async()=>({root:output,outputs:[{...artifact(hash(content)),bytes:Buffer.byteLength(content),producerTaskId:id}],evidenceRefs:[]})});
 };
 try{
  assert.equal((await execute('first','original')).state,'review_ready');ledger.close();ledger=new TaskLedger(database);
  const refused=await execute('second','changed');assert.equal(refused.state,'failed');assert.equal((refused.error as any).code,'artifact_version_conflict');
  assert.deepEqual(refused.outputRefs,[]);assert.equal(readFileSync(join(root,'first/brand.bin'),'utf8'),'original');assert.equal(ledger.status('first').state,'review_ready');assert.equal(ledger.leases().length,0);
 }finally{ledger.close();rmSync(root,{recursive:true});}
});

test('concurrent real producers publish at most one content for the same workflow version without replay',async()=>{
 const root=mkdtempSync(join(tmpdir(),'craft-version-producers-'));const ledger=new TaskLedger(join(root,'ledger.sqlite'));
 const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');const runtime=hash(readFileSync(process.execPath));let launches=0;
 const identity={pluginId:'fixture',pluginVersion:'1',cliVersion:'1',sha256:runtime,mode:'headless',capabilitySnapshotSha256:runtime};
 const node=(id:string)=>({id,dependsOn:[],projectKey:id,runtimeIdentity:identity,payload:{schemaVersion:'fixture/v1',text:id},expectedRevision:null});
 const value={...plan(),nodes:[node('one'),node('two')]};
 const factory=async(item:any,inputs:any[],taskId:string)=>{
  const output=join(root,item.id);mkdirSync(output);const file=join(output,'brand.bin');
  return {root:output,adapter:{prepare:async()=>{launches++;return {executable:process.execPath,args:['-e',`setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(file)},${JSON.stringify(item.id)}),50)`],cwd:output,runtimeSha256:runtime,actualRevision:null,budgetUsage:{minorUnits:0,externalCalls:0}};},verify:async()=>({root:output,outputs:[{...artifact(hash(item.id)),bytes:item.id.length,producerTaskId:taskId}],evidenceRefs:[]})}};
 };
 try{
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),{fixture:factory});const result=await engine.run(value,2);
  assert.equal(result.state,'failed');assert.equal(Object.values(result.nodes).filter(item=>item.status==='review_ready').length,1);assert.equal(Object.values(result.nodes).filter(item=>item.status==='failed').length,1);
  const refused=Object.values(result.nodes).find(item=>item.status==='failed')!;assert.equal((refused.failure as any).code,'artifact_version_conflict');assert.deepEqual(refused.outputs,[]);assert.equal(ledger.leases().length,0);assert.equal(launches,2);
  for(const id of ['one','two'])assert.equal(readFileSync(join(root,id,'brand.bin'),'utf8'),id);
  const before=ledger.list(),budget=result.budget;const repeated=await engine.run(value,2);assert.equal(repeated.state,'failed');assert.equal(launches,2);assert.deepEqual(ledger.list(),before);assert.deepEqual(repeated.budget,budget);
 }finally{ledger.close();rmSync(root,{recursive:true});}
});
