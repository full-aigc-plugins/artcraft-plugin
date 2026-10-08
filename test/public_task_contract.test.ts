/** 公共任务核心字段逐项核验；不把 schema 通过当作领域执行完成。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { planHash, validateTask } from '../src/protocol/contracts.ts';

const digest='a'.repeat(64);
function request():Record<string,any> {
 const payload={schemaVersion:'vectorcraft-plan/v1',plan:{command:'create-logo'}};
 return {protocolVersion:'craft-task/v1',taskId:'original',idempotencyKey:'same-key',planHash:planHash(payload),
  inputRefs:[{assetId:'brand',version:'v1',sha256:digest}],expectedRevision:'project-v1',
  runtimeIdentity:{pluginId:'vectorcraft',pluginVersion:'fixed-1',cliVersion:'native-1',sha256:digest,mode:'headless',capabilitySnapshotSha256:digest},
  authorizationRef:'authorized-plan',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:1,maxExternalCalls:0},
  deadline:'2030-01-01T00:00:00Z',payload};
}

for(const field of Object.keys(request()))test(`required public task field ${field} cannot be omitted`,()=>{
 const value=request();delete value[field];
 const ledger=new TaskLedger(':memory:');
 try{
  assert.throws(()=>ledger.register('owner','project',value),/protocol_invalid/);
  assert.deepEqual(ledger.list(),[]);assert.deepEqual(ledger.leases(),[]);assert.deepEqual(ledger.budgetAccounts(),[]);
 }finally{ledger.close();}
});

const mutations:Record<string,(value:Record<string,any>)=>void>={
 'input asset identity':value=>{value.inputRefs[0].assetId='other-brand';},
 'input version':value=>{value.inputRefs[0].version='v2';},
 'input content':value=>{value.inputRefs[0].sha256='b'.repeat(64);},
 'expected revision':value=>{value.expectedRevision='project-v2';},
 'plugin version':value=>{value.runtimeIdentity.pluginVersion='fixed-2';},
 'CLI version':value=>{value.runtimeIdentity.cliVersion='native-2';},
 'runtime bytes':value=>{value.runtimeIdentity.sha256='b'.repeat(64);},
 'execution mode':value=>{value.runtimeIdentity.mode='bridge';},
 'capability snapshot':value=>{value.runtimeIdentity.capabilitySnapshotSha256='b'.repeat(64);},
 'authorization':value=>{value.authorizationRef='another-scope';},
 'currency':value=>{value.budget.currency='CNY';},
 'money cap':value=>{value.budget.maxMinorUnits=1;},
 'revision cap':value=>{value.budget.maxRevisions=2;},
 'external call cap':value=>{value.budget.maxExternalCalls=1;},
 'deadline':value=>{value.deadline='2031-01-01T00:00:00Z';},
 'versioned payload':value=>{value.payload.plan.command='replace-logo';value.planHash=planHash(value.payload);},
};
for(const [name,mutate] of Object.entries(mutations))test(`same scoped key refuses changed ${name} without allocation`,()=>{
 const ledger=new TaskLedger(':memory:');
 try{
  const original=ledger.register('owner','project',request());
  const before={tasks:ledger.list(),leases:ledger.leases(),budget:ledger.budgetAccounts(),events:ledger.events(original.taskId)};
  const changed=request();changed.taskId='must-not-be-registered';mutate(changed);
  assert.throws(()=>ledger.register('owner','project',changed),/idempotency_conflict/);
  assert.deepEqual({tasks:ledger.list(),leases:ledger.leases(),budget:ledger.budgetAccounts(),events:ledger.events(original.taskId)},before);
  assert.throws(()=>ledger.status(changed.taskId),/task_missing/);
 }finally{ledger.close();}
});

test('schema preserves explicit unlimited budgets and versioned domain data',()=>{
 const value=request();value.inputRefs=[];value.expectedRevision=null;
 value.budget={currency:'USD',maxMinorUnits:null,maxRevisions:null,maxExternalCalls:null};
 value.payload.extension={version:'custom/v1',data:['retained']};value.planHash=planHash(value.payload);
 assert.deepEqual(validateTask(value),value);
 const ledger=new TaskLedger(':memory:');
 try{
  const first=ledger.register('owner','project',value);
  const repeated=ledger.register('owner','project',{...value,taskId:'ignored-id'});
  assert.deepEqual(repeated,first);assert.equal(first.state,'planned');assert.equal(first.attemptId,null);
  assert.deepEqual(first.runtimeIdentity,value.runtimeIdentity);assert.deepEqual(first.outputRefs,[]);
  assert.deepEqual(first.evidenceRefs,[]);assert.equal(first.error,null);
  assert.deepEqual(ledger.request(first.taskId),value);
 }finally{ledger.close();}
});
