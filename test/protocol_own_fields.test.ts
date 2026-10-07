/** 未声明的原型同名字段不能进入公共任务或素材协议。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { WorkflowEngine } from '../src/planning/workflow_engine.ts';
import { validateTask, validateArtifact, planHash } from '../src/protocol/contracts.ts';

const digest='a'.repeat(64);
const names=['constructor','toString','__proto__'];
function task():Record<string,any>{
 const payload={schemaVersion:'filmcraft-plan/v1',plan:{}};
 return {protocolVersion:'craft-task/v1',taskId:'first',idempotencyKey:'first-key',planHash:planHash(payload),inputRefs:[],expectedRevision:null,
  runtimeIdentity:{pluginId:'filmcraft',pluginVersion:'0.1.0',cliVersion:'0.2.0',sha256:digest,mode:'headless',capabilitySnapshotSha256:digest},
  authorizationRef:'already-authorized',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:'2030-01-01T00:00:00Z',payload};
}
function artifact():Record<string,any>{return {protocolVersion:'craft-artifact/v1',assetId:'logo',version:'v1',sha256:digest,bytes:5,mediaType:'application/octet-stream',producerTaskId:'first',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'logo.bin'};}
function extend(value:Record<string,any>,name:string):Record<string,any>{
 // JSON.parse 创建 __proto__ 自有属性，避免对象字面量的特殊原型语义。
 return JSON.parse(JSON.stringify({...value,[name]:{unexpected:true}}));
}
for(const name of names){
 for(const location of ['root','runtimeIdentity','budget','inputRef']){
  test(`task refuses undeclared ${name} at ${location}`,()=>{
   let value=task();
   if(location==='root')value=extend(value,name);
   else if(location==='inputRef')value.inputRefs=[extend({assetId:'input',version:'v1',sha256:digest},name)];
   else value[location]=extend(value[location],name);
   assert.throws(()=>validateTask(value),/protocol_invalid/);
  });
 }
 for(const location of ['root','technicalMetadata','sourceRef','nativeProjectRef','dependency']){
  test(`artifact refuses undeclared ${name} at ${location}`,()=>{
   let value=artifact();
   const reference={assetId:'source',version:'v1',sha256:digest};
   if(location==='root')value=extend(value,name);
   else if(location==='sourceRef')value.sourceRefs=[extend(reference,name)];
   else if(location==='nativeProjectRef')value.nativeProjectRef=extend({...reference,location:'project.bin'},name);
   else if(location==='dependency')value.dependencies=[extend({assetRef:reference,kind:'font',packaged:false,missingReason:'not-provided'},name)];
   else value[location]=extend(value[location],name);
   assert.throws(()=>validateArtifact(value),/protocol_invalid/);
  });
 }
 test(`workflow rejects undeclared ${name} runtime field before preparing native adapter`,async()=>{
  const ledger=new TaskLedger(':memory:');let preparations=0,authorizations=0;
  const runner=new LocalRunner(ledger,async()=>{authorizations++;});
  const engine=new WorkflowEngine(ledger,runner,{filmcraft:async()=>{preparations++;throw new Error('unexpected_native_preparation');}});
  const value=task(),plan={workflowId:'first-use',ownerId:'caller',revision:'v1',authorizationRef:value.authorizationRef,budget:value.budget,deadline:value.deadline,nodes:[{id:'film',dependsOn:[],projectKey:'film',runtimeIdentity:extend(value.runtimeIdentity,name),expectedRevision:null,payload:value.payload}]};
  try{
   await assert.rejects(engine.run(plan),/protocol_invalid/);
   assert.equal(preparations,0);assert.equal(authorizations,0);
   assert.deepEqual(ledger.list(),[]);assert.deepEqual(ledger.leases(),[]);assert.deepEqual(ledger.budgetAccounts(),[]);
  }finally{ledger.close();}
 });
 test(`ledger rejects undeclared ${name} before registration and budget allocation`,()=>{
  const ledger=new TaskLedger(':memory:');
  try{
   assert.throws(()=>ledger.register('caller','project',extend(task(),name)),/protocol_invalid/);
   assert.deepEqual(ledger.list(),[]);
   assert.deepEqual(ledger.leases(),[]);
   assert.deepEqual(ledger.budgetAccounts(),[]);
  }finally{ledger.close();}
 });
 for(const location of ['payload','plan'])test(`versioned domain ${location} preserves allowed ${name} JSON data`,()=>{
  const value=task();
  if(location==='payload')value.payload=extend(value.payload,name);
  else value.payload.plan=extend({content:'legitimate domain data'},name);
  value.planHash=planHash(value.payload);
  const accepted=validateTask(value);
  const target=location==='payload'?accepted.payload:accepted.payload.plan;
  assert.equal(Object.hasOwn(target,name),true);
  assert.deepEqual(target[name],{unexpected:true});
  const ledger=new TaskLedger(':memory:');
  try{assert.equal(ledger.register('caller','project',value).taskId,'first');}finally{ledger.close();}
 });
}
