/** 四领域公开错误报告的消费矩阵；真实 OS 子进程不是专业原生软件验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {TaskLedger} from '../src/harness/task_ledger.ts';
import {LocalRunner} from '../src/harness/local_runner.ts';
import {planHash} from '../src/protocol/contracts.ts';
const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const publicCodes=['runtime_missing','capability_missing','revision_conflict','idempotency_conflict','outcome_unknown','artifact_invalid','budget_exhausted','authorization_required','budget_exceeded'];
for(const domain of ['filmcraft','effectcraft','photocraft','vectorcraft'])for(const code of publicCodes)test(domain+' consumes stopped public error '+code,async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-public-errors-'));const path=join(root,'tasks.sqlite');const ledger=new TaskLedger(path);
 try{
  const payload={schemaVersion:'error-matrix-fixture/v1',domain,code};
  const identity={pluginId:domain,pluginVersion:'fixture-not-native',cliVersion:process.version,sha256:sha(await readFile(process.execPath)),mode:'headless',capabilitySnapshotSha256:sha('fixture')};
  const request={protocolVersion:'craft-task/v1',taskId:'task',idempotencyKey:'fixed-key',planHash:planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:identity,authorizationRef:'fixture-scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+120000).toISOString(),payload};
  ledger.register('fixture',domain+'-project',request);ledger.ready('task');
  const message=code+': private-detail-must-not-be-persisted';const stdout=JSON.stringify({error:message})+'\n';const worker=join(root,'worker.mjs');
  await writeFile(worker,`process.stdout.write(${JSON.stringify(stdout)});process.exitCode=1;`);
  let preparations=0;const adapter={prepare:async()=>{preparations++;return {executable:process.execPath,args:[worker],cwd:root,actualRevision:null,budgetUsage:{minorUnits:0,externalCalls:0}};},verify:async()=>{throw new Error('failed native call must not publish outputs');}};
  const runner=new LocalRunner(ledger,async()=>{});const receipt=await runner.execute('task',adapter);const expected=code==='budget_exceeded'?'budget_exhausted':code;
  assert.equal(receipt.state,'failed');assert.equal((receipt.error as any).code,expected);
  assert.equal((receipt.error as any).diagnostics.domainCode,code);assert.equal((receipt.error as any).diagnostics.stdout.sha256,sha(stdout));
  assert.ok(receipt.attemptId);assert.deepEqual(receipt.runtimeIdentity,identity);assert.deepEqual(receipt.outputRefs,[]);assert.deepEqual(receipt.evidenceRefs,[]);
  const stopped=ledger.execution('task')!;assert.equal(stopped.groupStopped,true);assert.equal(stopped.status,'stopped');assert.equal(stopped.exitCode,1);assert.deepEqual(ledger.leases(),[]);
  const before={receipt,execution:stopped,events:ledger.events('task'),budgets:ledger.budgetAccounts()};
  assert.deepEqual(await runner.reconcile('task',adapter),receipt);assert.equal(preparations,1);
  const reopened=new TaskLedger(path);try{assert.deepEqual(reopened.status('task'),receipt);assert.deepEqual(reopened.execution('task'),before.execution);assert.deepEqual(reopened.events('task'),before.events);assert.deepEqual(reopened.budgetAccounts(),before.budgets);}finally{reopened.close();}
  assert.ok(!JSON.stringify(before).includes('private-detail-must-not-be-persisted'));
 }finally{ledger.close();await rm(root,{recursive:true,force:true});}
});
