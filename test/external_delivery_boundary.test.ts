/** 外部 accepted 回执缺少产物时，不得成为交付或下游依赖证据。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {TaskLedger} from '../src/harness/task_ledger.ts';
import {LocalRunner} from '../src/harness/local_runner.ts';
import {WorkflowEngine} from '../src/planning/workflow_engine.ts';
import {packageProject} from '../src/artifacts/project_package.ts';

test('AC-DM-006-N accepted and exit zero without artifact evidence block delivery and descendants',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-external-accepted-'));
 const ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const digest=createHash('sha256').update(await readFile(process.execPath)).digest('hex');
  const identity={pluginId:'external-fixture',pluginVersion:'1.0.0',cliVersion:process.version,sha256:digest,mode:'headless',capabilitySnapshotSha256:digest};
  const launched:string[]=[];
  const factory=async(node:any,_inputs:any[],taskId:string)=>{
   const directory=join(root,taskId);await mkdir(directory,{recursive:true});
   return {root:directory,adapter:{prepare:async()=>{launched.push(node.id);return {executable:process.execPath,args:['-e','process.stdout.write(JSON.stringify({accepted:true}))'],cwd:directory,actualRevision:null,budgetUsage:{minorUnits:0,externalCalls:0}};},verify:async()=>({accepted:true,root:directory,outputs:[],evidenceRefs:[]})}};
  };
  const plan={workflowId:'accepted-is-not-evidence',ownerId:'test',revision:'v1',authorizationRef:'boundary-test',budget:{currency:'USD',maxMinorUnits:0,maxExternalCalls:0,maxRevisions:0},deadline:new Date(Date.now()+60000).toISOString(),nodes:[{id:'external',projectKey:'external',dependsOn:[],runtimeIdentity:identity,expectedRevision:null,payload:{schemaVersion:'external-fixture/v1'}},{id:'consumer',projectKey:'consumer',dependsOn:['external'],runtimeIdentity:identity,expectedRevision:null,payload:{schemaVersion:'external-fixture/v1'}}]};
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),{'external-fixture':factory});
  const result=await engine.run(plan);
  assert.equal(result.state,'failed');
  assert.equal(result.nodes.external.status,'failed');
  assert.notEqual(result.nodes.consumer.status,'review_ready');
  assert.deepEqual(launched,['external']);
  assert.deepEqual(ledger.status(result.nodes.external.taskId!).outputRefs,[]);
  assert.equal(ledger.execution(result.nodes.external.taskId!)!.exitCode,0);
  await assert.rejects(packageProject(ledger,result.runKey,'test','boundary-test',join(root,'package')));
  const again=await engine.run(plan);
  assert.equal(again.nodes.external.taskId,result.nodes.external.taskId);
  assert.deepEqual(launched,['external']);
 }finally{ledger.close();await rm(root,{recursive:true});}
});
