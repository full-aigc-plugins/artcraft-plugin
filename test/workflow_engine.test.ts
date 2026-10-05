/** 真实本地子进程组成的 DAG；验证依赖、重开和选择性复用。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { WorkflowEngine } from '../src/planning/workflow_engine.ts';

const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'craft-workflow-')),ledger=new TaskLedger(join(root,'ledger.sqlite'));
 const runtime=sha(await readFile(process.execPath));let launches:string[]=[];
 const identity={pluginId:'fixture',pluginVersion:'0.1.0',cliVersion:process.version,sha256:runtime,mode:'headless',capabilitySnapshotSha256:sha('fixture')};
 const factory=async(node:any,inputs:any[],taskId:string)=>{
  const directory=join(root,taskId);await mkdir(directory,{recursive:true});const script=join(directory,'worker.mjs'),output=join(directory,'output.bin');
  const content=node.payload.plan.text+'|'+inputs.map(item=>item.artifact.sha256).join('|');
  await writeFile(script,`import{writeFileSync}from'node:fs';setTimeout(()=>{writeFileSync(process.argv[2],${JSON.stringify(content)});},30);`);
  return {root:directory,adapter:{prepare:async()=>{launches.push(node.id);return {executable:process.execPath,args:[script,output],cwd:directory,actualRevision:null};},verify:async()=>{const bytes=await readFile(output);return {root:directory,evidenceRefs:[],outputs:[{protocolVersion:'craft-artifact/v1',assetId:node.id,version:sha(bytes),sha256:sha(bytes),bytes:bytes.length,mediaType:'application/octet-stream',producerTaskId:taskId,sourceRefs:inputs.map(item=>({assetId:item.artifact.assetId,version:item.artifact.version,sha256:item.artifact.sha256})),nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'output.bin'}]};}}};
 };
 const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),{fixture:factory});
 const node=(id:string,dependsOn:string[]=[])=>({id,dependsOn,projectKey:'project-'+id,runtimeIdentity:identity,payload:{schemaVersion:'fixture/v1',plan:{text:id}},expectedRevision:null});
 const plan={workflowId:'brand',ownerId:'user',revision:'v1',authorizationRef:'test-authority',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),nodes:[node('logo'),node('poster',['logo']),node('intro',['logo']),node('voice'),node('film',['intro','voice'])]};
 return {root,ledger,engine,factory,plan,get launches(){return launches;},clear(){launches=[];},cleanup:async()=>{ledger.close();await rm(root,{recursive:true});}};
}

test('DAG executes verified dependencies and joins independent branches',async()=>{
 const f=await fixture();try{
  const result=await f.engine.run(f.plan,2);assert.equal(result.state,'review_ready');assert.equal(f.launches.length,5);
  assert.ok(f.launches.indexOf('logo')<f.launches.indexOf('poster'));assert.ok(f.launches.indexOf('intro')<f.launches.indexOf('film'));assert.ok(f.launches.indexOf('voice')<f.launches.indexOf('film'));
  assert.equal(result.nodes.film.outputs[0].sourceRefs.length,2);
 }finally{await f.cleanup();}
});
test('same revision resumes from durable verified results without native replay',async()=>{
 const f=await fixture();try{
  const first=await f.engine.run(f.plan);f.clear();
  const restarted=new WorkflowEngine(f.ledger,new LocalRunner(f.ledger,async()=>{}),{fixture:f.factory});
  const second=await restarted.run(f.plan);assert.equal(second.state,'review_ready');assert.equal(f.launches.length,0);assert.equal(second.nodes.logo.taskId,first.nodes.logo.taskId);
 }finally{await f.cleanup();}
});
test('logo change rebuilds only transitive consumers and reuses voice',async()=>{
 const f=await fixture();try{
  const first=await f.engine.run(f.plan);f.clear();const revised=structuredClone(f.plan);revised.revision='v2';revised.nodes[0].payload.plan.text='blue logo';
  const result=await f.engine.run(revised);assert.equal(result.state,'review_ready');assert.deepEqual(f.launches.sort(),['film','intro','logo','poster']);assert.equal(result.nodes.voice.taskId,first.nodes.voice.taskId);
 }finally{await f.cleanup();}
});
test('cycle and unknown plugin reject the plan before child registration',async()=>{
 const f=await fixture();try{
  const cycle=structuredClone(f.plan);cycle.nodes[0].dependsOn=['poster'];await assert.rejects(f.engine.run(cycle),/dependency_cycle/);
  const missing=structuredClone(f.plan);missing.nodes[0].runtimeIdentity.pluginId='missing';await assert.rejects(f.engine.run(missing),/capability_missing/);
  assert.equal(f.ledger.list().length,0);assert.equal(f.launches.length,0);
 }finally{await f.cleanup();}
});
test('a cached file modified after verification blocks consumers instead of serving stale data',async()=>{
 const f=await fixture();try{
  const first=await f.engine.run(f.plan);f.clear();await writeFile(join(first.nodes.logo.root,'output.bin'),'changed');
  const resumed=await f.engine.run(f.plan);assert.equal(resumed.state,'blocked');assert.equal(f.launches.length,0);
 }finally{await f.cleanup();}
});

test('same project nodes serialize while independent projects can overlap',async()=>{
 const f=await fixture();try{
  let sharedActive=0,maxShared=0,allActive=0,maxAll=0;
  const factory=async(node:any,inputs:any[],taskId:string)=>{
   const compiled=await f.factory(node,inputs,taskId);const prepare=compiled.adapter.prepare,verify=compiled.adapter.verify;
   return {...compiled,adapter:{prepare:async()=>{allActive++;maxAll=Math.max(maxAll,allActive);if(node.projectKey==='shared'){sharedActive++;maxShared=Math.max(maxShared,sharedActive);}return prepare();},verify:async()=>{try{return await verify();}finally{allActive--;if(node.projectKey==='shared')sharedActive--;}}}};
  };
  f.plan.nodes[0].projectKey='shared';f.plan.nodes[3].projectKey='shared';
  const engine=new WorkflowEngine(f.ledger,new LocalRunner(f.ledger,async()=>{}),{fixture:factory});
  assert.equal((await engine.run(f.plan,3)).state,'review_ready');assert.equal(maxShared,1);assert.ok(maxAll>=2);
 }finally{await f.cleanup();}
});
test('parent cancellation stops new dependent scheduling and waits for actual child stops',async()=>{
 const f=await fixture();try{
  const key=f.ledger.beginWorkflow(f.plan),executing=f.engine.run(f.plan,2);
  for(let count=0;!f.ledger.list().some(task=>f.ledger.execution(task.taskId)?.pid) && count<100;count++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(f.ledger.list().some(task=>f.ledger.execution(task.taskId)?.pid));f.ledger.cancelWorkflow(key);
  const result=await executing;assert.equal(result.state,'cancelled');assert.equal(f.ledger.leases().length,0);assert.ok(!f.launches.includes('film'));
 }finally{await f.cleanup();}
});
test('changed plan under an existing workflow revision is rejected without replay',async()=>{
 const f=await fixture();try{
  await f.engine.run(f.plan);f.clear();const changed=structuredClone(f.plan);changed.nodes[0].payload.plan.text='modified';
  await assert.rejects(f.engine.run(changed),/workflow_revision_conflict/);assert.equal(f.launches.length,0);
 }finally{await f.cleanup();}
});
