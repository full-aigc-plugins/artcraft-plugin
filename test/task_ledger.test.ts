/** 持久化、幂等、单写和不明确结果的真实 SQLite 边界测试。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { planHash } from '../src/protocol/contracts.ts';

const digest='a'.repeat(64);
function request(id='task1',key='key1') {
 const payload={schemaVersion:'filmcraft-plan/v1',plan:{command:'replace-shot'}};
 return {protocolVersion:'craft-task/v1',taskId:id,idempotencyKey:key,planHash:planHash(payload),inputRefs:[],expectedRevision:'revision1',runtimeIdentity:{pluginId:'filmcraft',pluginVersion:'0.1.0',cliVersion:'0.2.0',sha256:digest,mode:'headless',capabilitySnapshotSha256:digest},authorizationRef:'user-goal',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:2,maxExternalCalls:0},deadline:'2030-01-01T00:00:00Z',payload};
}
function fixture(work:(ledger:TaskLedger,path:string)=>void) {
 const root=mkdtempSync(join(tmpdir(),'craft-ledger-'));const path=join(root,'tasks.sqlite');const ledger=new TaskLedger(path);
 try {work(ledger,path);} finally {ledger.close();rmSync(root,{recursive:true});}
}

test('same scoped key returns original identity across reopen; changed plan conflicts',()=>fixture((ledger,path)=>{
 const first=ledger.register('caller','project',request());
 const repeated=ledger.register('caller','project',request('ignored-task-id'));
 assert.equal(repeated.taskId,first.taskId);
 const reopened=new TaskLedger(path);
 try {assert.equal(reopened.register('caller','project',request()).taskId,first.taskId);}finally{reopened.close();}
 const changed=request();changed.payload.plan.command='another-operation';changed.planHash=planHash(changed.payload);
 assert.throws(()=>ledger.register('caller','project',changed),/idempotency_conflict/);
}));
test('idempotency scope includes caller and target plugin; bindings cannot silently change',()=>fixture(ledger=>{
 ledger.register('caller','project',request());
 assert.equal(ledger.register('other-caller','other-project',request('task2')).taskId,'task2');
 const other=request('task3');other.runtimeIdentity.pluginId='photocraft';
 assert.equal(ledger.register('caller','other-project',other).taskId,'task3');
 assert.throws(()=>ledger.register('caller','different-project',request()),/idempotency_conflict/);
 assert.throws(()=>ledger.register('caller','project',{...request(),authorizationRef:'other-authorization'}),/idempotency_conflict/);
}));
test('plan hash must bind actual versioned payload before any registration',()=>fixture(ledger=>{
 assert.throws(()=>ledger.register('caller','project',{...request(),planHash:digest}),/plan_hash_mismatch/);
 assert.equal(ledger.list().length,0);
}));
test('two database connections cannot acquire the same native project',()=>fixture((ledger,path)=>{
 ledger.register('caller','project',request());ledger.ready('task1');const acquired=ledger.claim('task1','revision1');
 const second=new TaskLedger(path);
 try {
  second.register('caller','project',request('task2','key2'));second.ready('task2');
  assert.throws(()=>second.claim('task2','revision1'),/project_busy/);
  assert.equal(second.status('task2').state,'ready');
  assert.equal(second.status('task1').epoch,acquired.epoch);
 }finally{second.close();}
}));
test('stale GUI revision prevents claim and does not allocate a lease',()=>fixture(ledger=>{
 ledger.register('caller','project',request());ledger.ready('task1');
 assert.throws(()=>ledger.claim('task1','gui-revision2'),/revision_conflict/);
 assert.equal(ledger.status('task1').state,'ready');
 assert.equal(ledger.leases().length,0);
}));
test('unknown outcome survives reopen, retains writer ownership and is never automatically retried',()=>fixture((ledger,path)=>{
 ledger.register('caller','project',request());ledger.ready('task1');const acquired=ledger.claim('task1','revision1');
 ledger.unknown('task1',acquired.epoch,'stdio_disconnect');
 const reopened=new TaskLedger(path);
 try {
  assert.equal(reopened.status('task1').state,'reconciling');
  assert.throws(()=>reopened.claim('task1','revision1'),/task_not_ready/);
  assert.equal(reopened.leases()[0].taskId,'task1');
  assert.equal(reopened.events('task1').filter(x=>x.toState==='running').length,1);
 }finally{reopened.close();}
}));
test('cancellation of a live task records intent and retains lease; stale executor cannot change state',()=>fixture(ledger=>{
 ledger.register('caller','project',request());ledger.ready('task1');const acquired=ledger.claim('task1','revision1');
 assert.throws(()=>ledger.unknown('task1',acquired.epoch+1,'timeout'),/stale_executor/);
 assert.equal(ledger.cancel('task1').state,'cancel_requested');
 assert.equal(ledger.leases()[0].taskId,'task1');
 assert.equal(ledger.cancel('task1').state,'cancel_requested');
}));
test('cancel before any side effect is immediately terminal',()=>fixture(ledger=>{
 ledger.register('caller','project',request());assert.equal(ledger.cancel('task1').state,'cancelled');
 assert.throws(()=>ledger.ready('task1'),/invalid_transition/);
 assert.equal(ledger.leases().length,0);
}));

test('expired deadline cannot start a native task',()=>fixture(ledger=>{
 const expired={...request(),deadline:'2020-01-01T00:00:00Z'};
 ledger.register('caller','project',expired);ledger.ready('task1');
 assert.throws(()=>ledger.claim('task1','revision1'),/deadline_exceeded/);
 assert.equal(ledger.leases().length,0);
}));
test('foreign SQLite database is rejected without changing user data',async()=>{
 const {DatabaseSync}=await import('node:sqlite');
 const root=mkdtempSync(join(tmpdir(),'craft-foreign-db-'));const path=join(root,'foreign.sqlite');
 const foreign=new DatabaseSync(path);foreign.exec("CREATE TABLE user_data(value TEXT);INSERT INTO user_data VALUES('preserve');");
 try {
  assert.throws(()=>new TaskLedger(path),/ledger_schema_incompatible/);
  assert.equal((foreign.prepare('SELECT value FROM user_data').get() as {value:string}).value,'preserve');
  assert.equal(foreign.prepare("SELECT name FROM sqlite_master WHERE name='tasks'").get(),undefined);
 }finally{foreign.close();rmSync(root,{recursive:true});}
});
test('separate OS processes compete for one project without duplicate starts',async()=>{
 const {spawn}=await import('node:child_process');
 const {writeFileSync}=await import('node:fs');
 const root=mkdtempSync(join(tmpdir(),'craft-process-race-'));const path=join(root,'tasks.sqlite');
 const ledger=new TaskLedger(path);
 ledger.register('caller','project',request());ledger.ready('task1');
 ledger.register('caller','project',request('task2','key2'));ledger.ready('task2');
 const module=new URL('../src/harness/task_ledger.ts',import.meta.url).href;
 const script=join(root,'claim.mjs');
 writeFileSync(script,`import {TaskLedger} from ${JSON.stringify(module)};const ledger=new TaskLedger(process.argv[2]);try{console.log(JSON.stringify({ok:true,receipt:ledger.claim(process.argv[3],'revision1')}));}catch(error){console.log(JSON.stringify({ok:false,error:error.message}));}finally{ledger.close();}`);
 const claim=(id:string)=>new Promise<{ok:boolean,error?:string}>((resolve,reject)=>{
  const child=spawn(process.execPath,[script,path,id],{stdio:['ignore','pipe','pipe']});let output='',errors='';
  child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);
  child.on('error',reject);child.on('close',code=>{if(code)reject(new Error(errors));else resolve(JSON.parse(output));});
 });
 try {
  const results=await Promise.all([claim('task1'),claim('task2')]);
  assert.equal(results.filter(x=>x.ok).length,1);assert.equal(results.find(x=>!x.ok)?.error,'project_busy');
  assert.equal(ledger.leases().length,1);
  assert.equal(ledger.events('task1').filter(x=>x.toState==='running').length+ledger.events('task2').filter(x=>x.toState==='running').length,1);
 }finally{ledger.close();rmSync(root,{recursive:true});}
});

test('killed writer leaves durable intent and lease; restart never replays the task',async()=>{
 const {spawn}=await import('node:child_process');const {writeFileSync}=await import('node:fs');
 const root=mkdtempSync(join(tmpdir(),'craft-writer-crash-'));const path=join(root,'tasks.sqlite');const ledger=new TaskLedger(path);
 ledger.register('caller','project',request());ledger.ready('task1');
 const module=new URL('../src/harness/task_ledger.ts',import.meta.url).href;
 const script=join(root,'writer.mjs');
 writeFileSync(script,`import {TaskLedger} from ${JSON.stringify(module)};const ledger=new TaskLedger(process.argv[2]);console.log(JSON.stringify(ledger.claim('task1','revision1')));setInterval(()=>{},1000);`);
 const child=spawn(process.execPath,[script,path],{stdio:['ignore','pipe','pipe']});
 try {
  await new Promise<void>((resolve,reject)=>{
   let output='',errors='';
   child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('\n'))child.kill('SIGKILL');});
   child.stderr.on('data',chunk=>errors+=chunk);child.on('error',reject);
   child.on('close',(_code,signal)=>signal==='SIGKILL' ? resolve() : reject(new Error(errors)));
  });
  const restarted=new TaskLedger(path);
  try {
   const stored=restarted.status('task1');assert.equal(stored.state,'running');
   assert.equal(restarted.leases()[0].taskId,'task1');
   assert.throws(()=>restarted.claim('task1','revision1'),/task_not_ready/);
   assert.equal(restarted.unknown('task1',stored.epoch,'worker_exit_SIGKILL').state,'reconciling');
   assert.equal(restarted.events('task1').filter(x=>x.toState==='running').length,1);
  }finally{restarted.close();}
 }finally{child.kill('SIGKILL');ledger.close();rmSync(root,{recursive:true});}
});
