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
import { planHash } from '../src/protocol/contracts.ts';

const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
async function fixture(plugin='fixture'){
 const root=await mkdtemp(join(tmpdir(),'craft-workflow-')),ledger=new TaskLedger(join(root,'ledger.sqlite'));
 const runtime=sha(await readFile(process.execPath));let launches:string[]=[];
 const identity={pluginId:plugin,pluginVersion:'0.1.0',cliVersion:process.version,sha256:runtime,mode:'headless',capabilitySnapshotSha256:sha('fixture')};
 const factory=async(node:any,inputs:any[],taskId:string)=>{
  const directory=join(root,taskId);await mkdir(directory,{recursive:true});const script=join(directory,'worker.mjs'),output=join(directory,'output.bin');
  const content=node.payload.plan.text+'|'+inputs.map(item=>item.artifact.sha256).join('|');
  await writeFile(script,`import{writeFileSync}from'node:fs';setTimeout(()=>{writeFileSync(process.argv[2],${JSON.stringify(content)});},30);`);
  return {root:directory,adapter:{prepare:async()=>{launches.push(node.id);return {executable:process.execPath,args:[script,output],cwd:directory,actualRevision:null,budgetUsage:{minorUnits:0,externalCalls:0}};},verify:async()=>{const bytes=await readFile(output);
   // 调度器单元夹具的摘要绑定元数据，不是实际 VectorCraft 工程验收。
   let nativeProjectRef:any=null,evidenceRefs:any[]=[],location='output.bin';
   if(plugin==='vectorcraft'){
    location='artboard-1.svg';await writeFile(join(directory,location),bytes);
    const projectBytes=Buffer.from('scheduler-unit-native'),nativeBytes=JSON.stringify({artboards:[{rect:{x0:0,y0:0,x1:node.payload.plan.document.width,y1:node.payload.plan.document.height}}]});
    await writeFile(join(directory,'project.vectorcraft'),projectBytes);await writeFile(join(directory,'native.json'),nativeBytes);
    const manifest=JSON.stringify({schema:'vectorcraft-delivery/v1',runtimeSha256:runtime,files:{'project.vectorcraft':sha(projectBytes),'native.json':sha(nativeBytes),[location]:sha(bytes)}});await writeFile(join(directory,'manifest.json'),manifest);
    nativeProjectRef={assetId:'unit-native',version:sha(projectBytes),sha256:sha(projectBytes),location:'project.vectorcraft'};
    evidenceRefs=[{assetId:'unit-manifest',version:sha(manifest),sha256:sha(manifest),location:'manifest.json'}];
   }
   return {root:directory,evidenceRefs:[],outputs:[{protocolVersion:'craft-artifact/v1',assetId:node.id,version:sha(bytes),sha256:sha(bytes),bytes:bytes.length,mediaType:'application/octet-stream',producerTaskId:taskId,sourceRefs:inputs.map(item=>({assetId:item.artifact.assetId,version:item.artifact.version,sha256:item.artifact.sha256})),nativeProjectRef,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs,location}]};}}};
 };
 const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),{[plugin]:factory});
 const node=(id:string,dependsOn:string[]=[])=>({id,dependsOn,projectKey:'project-'+id,runtimeIdentity:identity,payload:{schemaVersion:'fixture/v1',plan:{text:id}},expectedRevision:null});
 const plan={workflowId:'brand',ownerId:'user',revision:'v1',authorizationRef:'test-authority',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:1,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),nodes:[node('logo'),node('poster',['logo']),node('intro',['logo']),node('voice'),node('film',['intro','voice'])]};
 return {root,ledger,engine,factory,plan,get launches(){return launches;},clear(){launches=[];},cleanup:async()=>{ledger.close();await rm(root,{recursive:true});}};
}

test('DAG executes verified dependencies and joins independent branches',async()=>{
 const f=await fixture();try{
  const result=await f.engine.run(f.plan,2);assert.equal(result.state,'review_ready');assert.equal(f.launches.length,5);
  assert.ok(f.launches.indexOf('logo')<f.launches.indexOf('poster'));assert.ok(f.launches.indexOf('intro')<f.launches.indexOf('film'));assert.ok(f.launches.indexOf('voice')<f.launches.indexOf('film'));
  assert.equal(result.nodes.film.outputs[0].sourceRefs.length,2);
 }finally{await f.cleanup();}
});
test('Film duration requirement cannot publish ready output without native and export evidence',async()=>{
 const f=await fixture('filmcraft');try{
  f.plan.nodes=f.plan.nodes.slice(0,1);const node=f.plan.nodes[0] as any;
  node.payload.plan.document={name:'Film',width:320,height:180,frameRate:{num:12,den:1}};
  node.payload.plan.operations=[{command:'timeline.place',params:{time:'0',duration:'254016000000',insert:false}}];
  const plan={...f.plan,projectBrief:{schema:'craft-brief/v1',workflowId:'brand',revision:'brief-v1',ownerId:'user',authorizationRef:'test-authority',budget:f.plan.budget,brand:null,subjects:[],dataPolicy:{allowUpload:false},ambiguities:[],deliverables:[{id:'logo',nativeFormat:'.fcproj',width:320,height:180,dependsOn:[],execution:'local',durationSeconds:1}]}};
  const result=await f.engine.run(plan);assert.equal(result.state,'failed');
  assert.equal(f.ledger.status(result.nodes.logo.taskId!).state,'failed');assert.deepEqual(result.nodes.logo.outputs,[]);
  assert.equal(f.ledger.leases().length,0);
 }finally{await f.cleanup();}
});
test('failed node exposes durable reported code and blocks its consumers without replay',async()=>{
 const f=await fixture();try{
  f.plan.nodes=f.plan.nodes.slice(0,2);
  const factory=async(node:any,inputs:any[],taskId:string)=>{
   const compiled=await f.factory(node,inputs,taskId);
   if(node.id==='logo')await writeFile(join(compiled.root,'worker.mjs'),'process.stdout.write(JSON.stringify({error:"missing_fonts: private-font"}));process.exitCode=1;');
   return compiled;
  };
  const engine=new WorkflowEngine(f.ledger,new LocalRunner(f.ledger,async()=>{}),{fixture:factory});
  const result=await engine.run(f.plan);
  assert.equal(result.state,'failed');assert.equal(result.nodes.poster.status,'blocked');
  assert.equal((result.nodes.logo.failure as any).diagnostics.domainCode,'missing_fonts');
  assert.ok(!JSON.stringify(result).includes('private-font'));
  const before=f.ledger.execution(result.nodes.logo.taskId!)!.diagnostics;
  f.clear();const resumed=await engine.run(f.plan);assert.deepEqual(resumed.nodes.logo.failure,result.nodes.logo.failure);
  assert.deepEqual(f.ledger.execution(result.nodes.logo.taskId!)!.diagnostics,before);assert.equal(f.launches.length,0);
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

test('DAG reserves a shared cap before child spawn and resuming does not double allocate',async()=>{
 const f=await fixture();try{
  f.plan.budget={currency:'USD',maxMinorUnits:5,maxRevisions:1,maxExternalCalls:2};
  const factory=async(node:any,inputs:any[],taskId:string)=>{
   const compiled=await f.factory(node,inputs,taskId);
   return {...compiled,adapter:{...compiled.adapter,prepare:async()=>({...await compiled.adapter.prepare(),budgetUsage:{minorUnits:3,externalCalls:1}})}};
  };
  const engine=new WorkflowEngine(f.ledger,new LocalRunner(f.ledger,async()=>{}),{fixture:factory});
  const first=await engine.run(f.plan,2);assert.equal(first.state,'blocked');
  assert.deepEqual(first.budget.allocated,{minorUnits:3,externalCalls:1,revisions:0});
  assert.equal(f.ledger.list().filter(task=>f.ledger.execution(task.taskId)).length,1);
  assert.equal(f.ledger.leases().length,0);
  assert.ok(Object.values(first.nodes).some(node=>node.error?.includes('budget_exceeded')));
  const repeated=await engine.run(f.plan);assert.deepEqual(repeated.budget,first.budget);
  assert.equal(f.ledger.list().filter(task=>f.ledger.execution(task.taskId)).length,1);
 }finally{await f.cleanup();}
});
for(const cancel of [false,true])test((cancel ? 'cancel parent after scheduler SIGKILL: ' : '')+'DAG resumes a scheduler-crashed node from durable stop evidence without budget or native replay',async()=>{
 const f=await fixture();try{
  const {planHash}=await import('../src/protocol/contracts.ts');const {spawn}=await import('node:child_process');
  f.plan.nodes=[f.plan.nodes[0]];const node=f.plan.nodes[0],key=f.ledger.beginWorkflow(f.plan);
  const fingerprint=planHash({payload:node.payload,inputRefs:[],runtimeIdentity:node.runtimeIdentity,projectKey:node.projectKey,expectedRevision:null});
  const taskId='wf-'+planHash({owner:f.plan.ownerId,workflow:f.plan.workflowId,revision:f.plan.revision,node:node.id,fingerprint}).slice(0,48);
  const request={protocolVersion:'craft-task/v1',taskId,idempotencyKey:'wf-node:'+planHash({key,id:node.id,fingerprint}),planHash:planHash(node.payload),inputRefs:[],expectedRevision:null,runtimeIdentity:node.runtimeIdentity,authorizationRef:f.plan.authorizationRef,budget:f.plan.budget,deadline:f.plan.deadline,payload:node.payload};
  f.ledger.register(f.plan.ownerId,node.projectKey,request,key);f.ledger.ready(taskId);
  const compiled=await f.factory(node,[],taskId),executionPlan=await compiled.adapter.prepare();
  await writeFile(executionPlan.args[0],`import{appendFileSync,writeFileSync}from'node:fs';appendFileSync(process.argv[2]+'.starts','x');setTimeout(()=>writeFileSync(process.argv[2],'logo|'),350);`);
  f.ledger.saveWorkflowNode(key,node.id,{status:'running',taskId,root:compiled.root,fingerprint});
  const parentScript=join(f.root,'scheduler.mjs');
  await writeFile(parentScript,`import{TaskLedger}from${JSON.stringify(new URL('../src/harness/task_ledger.ts',import.meta.url).href)};import{LocalRunner}from${JSON.stringify(new URL('../src/harness/local_runner.ts',import.meta.url).href)};const ledger=new TaskLedger(${JSON.stringify(join(f.root,'ledger.sqlite'))});await new LocalRunner(ledger,async()=>{}).execute(${JSON.stringify(taskId)},{prepare:async()=>(${JSON.stringify(executionPlan)}),verify:async()=>{throw Error('scheduler_should_be_killed')}});`);
  const parent=spawn(process.execPath,[parentScript],{stdio:'ignore'}),closed=new Promise(resolve=>parent.once('close',resolve));
  for(let n=0;!f.ledger.execution(taskId)?.pid && n<300;n++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(f.ledger.execution(taskId)?.pid);parent.kill('SIGKILL');await closed;
  if(cancel)f.ledger.cancelWorkflow(key);
  const pending=await f.engine.run(f.plan);assert.equal(pending.state,cancel ? 'cancel_requested' : 'waiting');
  for(let n=0;f.ledger.execution(taskId)?.status!=='stopped' && n<300;n++)await new Promise(resolve=>setTimeout(resolve,10));
  const before=f.ledger.workflowBudget(key),attempt=f.ledger.status(taskId).attemptId;
  const result=await f.engine.run(f.plan);assert.equal(result.state,cancel ? 'cancelled' : 'review_ready');assert.equal(result.nodes.logo.taskId,taskId);
  assert.equal(f.ledger.status(taskId).attemptId,attempt);assert.deepEqual(result.budget,before);
  if(!cancel)assert.equal(await readFile(join(compiled.root,'output.bin.starts'),'utf8'),'x');assert.equal(f.ledger.leases().length,0);
 }finally{await f.cleanup();}
});

// 授权范围改变后，旧任务的授权不能作为新范围的执行或复用依据。
test('new authorization scope does not reuse tasks authorized under the previous scope',async()=>{
 const f=await fixture();try{
  const first=await f.engine.run(f.plan);f.clear();
  const revised=structuredClone(f.plan);revised.revision='v2';revised.authorizationRef='new-authority';
  const result=await f.engine.run(revised);assert.equal(result.state,'review_ready');
  assert.deepEqual(f.launches.sort(),['film','intro','logo','poster','voice']);
  for(const id of Object.keys(result.nodes)){
   assert.notEqual(result.nodes[id].taskId,first.nodes[id].taskId);
   assert.equal(f.ledger.request(result.nodes[id].taskId!).authorizationRef,'new-authority');
  }
 }finally{await f.cleanup();}
});

test('legacy cross-scope reuse record cannot authorize its original producer in a new scope',async()=>{
 const f=await fixture();try{
  const first=await f.engine.run(f.plan);f.clear();
  const revised=structuredClone(f.plan);revised.revision='v2';revised.authorizationRef='new-authority';revised.nodes=[revised.nodes[0]];
  const key=f.ledger.beginWorkflow(revised);
  f.ledger.saveWorkflowNode(key,'logo',{...first.nodes.logo,status:'reused'});
  const result=await f.engine.run(revised);assert.equal(result.state,'review_ready');
  assert.deepEqual(f.launches,['logo']);assert.notEqual(result.nodes.logo.taskId,first.nodes.logo.taskId);
  assert.equal(f.ledger.request(result.nodes.logo.taskId!).authorizationRef,'new-authority');
 }finally{await f.cleanup();}
});

test('changed authorization is evaluated before a cached node can bypass the authorizer',async()=>{
 const f=await fixture();try{
  await f.engine.run(f.plan);f.clear();
  const revised=structuredClone(f.plan);revised.revision='v2';revised.authorizationRef='denied-authority';revised.nodes=[revised.nodes[0]];
  let checked=0;
  const engine=new WorkflowEngine(f.ledger,new LocalRunner(f.ledger,async request=>{checked++;assert.equal(request.authorizationRef,'denied-authority');throw new Error('scope_denied');}),{fixture:f.factory});
  const result=await engine.run(revised);assert.equal(result.state,'blocked');assert.equal(checked,1);
  assert.deepEqual(f.launches,[]);assert.match(result.nodes.logo.error!,/scope_denied/);
 }finally{await f.cleanup();}
});

function attachBrief(plan:any){
 for(const node of plan.nodes)node.payload.plan.document={width:320,height:180};
 plan.projectBrief={schema:'craft-brief/v1',workflowId:plan.workflowId,revision:'brief-v1',ownerId:plan.ownerId,authorizationRef:plan.authorizationRef,budget:structuredClone(plan.budget),brand:{name:'NOVA',colors:['#ef5b36'],fonts:[],appliesTo:['logo','poster','intro','film'],referenceAssets:[]},subjects:[],ambiguities:[],dataPolicy:{allowUpload:false},deliverables:plan.nodes.map((node:any)=>({id:node.id,nativeFormat:'.vectorcraft',width:320,height:180,dependsOn:node.dependsOn,execution:'local'}))};
}
test('direct runtime blocks unresolved Brief before ledger registration or native preparation',async()=>{
 const f=await fixture('vectorcraft');try{
  const plan:any=structuredClone(f.plan);attachBrief(plan);plan.projectBrief.ambiguities=[{id:'name',question:'Confirm name',affects:['logo']}];
  await assert.rejects(f.engine.run(plan),/brief_plan_blocked/);assert.equal(f.ledger.list().length,0);assert.equal(f.launches.length,0);
 }finally{await f.cleanup();}
});
test('Brief brand change invalidates affected requirements and keeps independent voice reusable',async()=>{
 const f=await fixture('vectorcraft');try{
  const plan:any=structuredClone(f.plan);attachBrief(plan);const first=await f.engine.run(plan);assert.equal(first.state,'review_ready');f.clear();
  const revised=structuredClone(plan);revised.revision='v2';revised.projectBrief.revision='brief-v2';revised.projectBrief.brand.colors=['#2366e8'];
  const result=await f.engine.run(revised);assert.equal(result.state,'review_ready');assert.deepEqual(f.launches.sort(),['film','intro','logo','poster']);assert.equal(result.nodes.voice.taskId,first.nodes.voice.taskId);assert.notEqual(result.nodes.logo.taskId,first.nodes.logo.taskId);
 }finally{await f.cleanup();}
});

test('legacy cached Photo variant without geometry evidence is rejected without native replay',async()=>{
 const f=await fixture('photocraft');try{
  f.plan.nodes=f.plan.nodes.slice(0,1);
  const first=await f.engine.run(f.plan);assert.equal(first.state,'review_ready');f.clear();
  const node=f.plan.nodes[0] as any;node.payload.plan.variant={width:120,height:80,safeArea:[0,0,120,80],roles:{background:1,product:2,text:3}};
  // 模拟旧技能忽略 variant 但曾写入 ready 的历史缓存；非原生验收。
  const fingerprint=planHash({payload:node.payload,inputRefs:[],runtimeIdentity:node.runtimeIdentity,projectKey:node.projectKey,expectedRevision:node.expectedRevision});
  f.ledger.saveWorkflowNode(first.runKey,node.id,{...first.nodes[node.id],fingerprint});
  const revised={...f.plan,revision:'v2'};const result=await f.engine.run(revised);
  assert.equal(result.state,'blocked');assert.match(result.nodes[node.id].error!,/photo_variant_evidence_missing/);assert.equal(f.launches.length,0);
 }finally{await f.cleanup();}
});

test('Photo variant without Brief cannot publish a fresh delivery lacking geometry evidence',async()=>{
 const f=await fixture('photocraft');try{
  f.plan.nodes=f.plan.nodes.slice(0,1);const node=f.plan.nodes[0] as any;
  node.payload.plan.variant={width:120,height:80,safeArea:[0,0,120,80],roles:{background:1,product:2,text:3}};
  const result=await f.engine.run(f.plan);assert.equal(result.state,'failed');
  assert.equal(f.ledger.status(result.nodes.logo.taskId!).state,'failed');assert.deepEqual(result.nodes.logo.outputs,[]);assert.equal(f.ledger.leases().length,0);
 }finally{await f.cleanup();}
});
