/** 原生源版本冲突与普通素材损坏分开；字节夹具不代表GUI验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {TaskLedger} from '../src/harness/task_ledger.ts';
import {LocalRunner} from '../src/harness/local_runner.ts';
import {WorkflowEngine} from '../src/planning/workflow_engine.ts';
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
for(const domain of ['filmcraft','effectcraft','photocraft','vectorcraft'])for(const primaryNative of [false,true])for(const fault of ['native','manifest','unbound-native','valid','escaping-native',...(!primaryNative?['media']:[])])test(domain+' '+(primaryNative?'native-primary':'rendition-primary')+' source preflight '+fault,async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-source-revision-')),ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const native='registered native',media='registered media',manifest='registered manifest',nativeHash=sha(native);
  const nativeLocation='project.'+({filmcraft:'fcproj',effectcraft:'ecproj',photocraft:'pcraft',vectorcraft:'vectorcraft'} as Record<string,string>)[domain];
  await writeFile(join(root,nativeLocation),native);await writeFile(join(root,'media.bin'),media);await writeFile(join(root,'manifest.json'),manifest);
  const ref=(location:string,digest:string)=>({assetId:location,version:digest,sha256:digest,location});
  const artifact={protocolVersion:'craft-artifact/v1',assetId:'source',version:sha(primaryNative?native:media),sha256:sha(primaryNative?native:media),bytes:(primaryNative?native:media).length,mediaType:'application/octet-stream',producerTaskId:'provided',sourceRefs:[],nativeProjectRef:ref(nativeLocation,nativeHash),renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[ref('manifest.json',sha(manifest))],location:primaryNative?nativeLocation:'media.bin'};
  const identity={pluginId:domain,pluginVersion:'0.1.0',cliVersion:'0.1.0',sha256:sha('runtime'),mode:'headless',capabilitySnapshotSha256:sha('schema')};
  const node={id:'edit',dependsOn:[],projectKey:'project',expectedRevision:fault==='unbound-native'?null:nativeHash,runtimeIdentity:identity,externalInputs:[{root,artifact}],payload:{schemaVersion:'craft-skill-workflow/v1',...(fault==='unbound-native'?{}:{sourceProject:{assetId:'source'}}),plan:{operations:[]},assetBindings:[],outputs:[]}};
  const plan={workflowId:'revision-boundary',ownerId:'qa',revision:'v1',authorizationRef:'fixture',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:1,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),nodes:[node]};
  let factories=0;
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),{[domain]:async()=>{factories++;throw new Error('fixture_factory_reached');}});
  if(fault==='native'||fault==='unbound-native')await writeFile(join(root,nativeLocation),'changed native');
  if(fault==='manifest')await writeFile(join(root,'manifest.json'),'changed manifest');
  if(fault==='media')await writeFile(join(root,'media.bin'),'changed media');
  if(fault==='escaping-native'){
   const outside=await mkdtemp(join(tmpdir(),'art-source-outside-'));
   try{await writeFile(join(outside,'project'),native);await rm(join(root,nativeLocation));await symlink(join(outside,'project'),join(root,nativeLocation));
    const result=await engine.run(plan);assert.equal(result.nodes.preflight.errorDetail?.code,'location_invalid');assert.equal(factories,0);
   }finally{await rm(outside,{recursive:true,force:true});}
   return;
  }
  const before=await readFile(join(root,nativeLocation));
  const result=await engine.run(plan);
  if(fault==='valid'){assert.equal(factories,1);assert.equal(result.nodes.edit.error,'fixture_factory_reached');}
  else{
   const expected=fault==='native'?'revision_conflict':fault==='media'?'artifact_digest_mismatch':fault==='unbound-native'?(primaryNative?'artifact_digest_mismatch':'artifact_reference_mismatch'):'artifact_reference_mismatch';
   assert.equal(result.nodes.preflight.errorDetail?.code,expected,JSON.stringify(result));assert.equal(factories,0);assert.deepEqual(ledger.leases(),[]);
  }
  assert.deepEqual(await readFile(join(root,nativeLocation)),before);
 }finally{ledger.close();await rm(root,{recursive:true,force:true});}
});

test('cached upstream native source changes report revision conflict before generic cache checks without replay',async()=>{
 const {mkdir}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'art-cached-source-')),ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const native='cached original native',nativeHash=sha(native),runtimeHash=sha(await readFile(process.execPath));let launches=0;
  const identity={pluginId:'fixture',pluginVersion:'0.1.0',cliVersion:process.version,sha256:runtimeHash,mode:'headless',capabilitySnapshotSha256:sha('fixture')};
  const factory=async(node:any,inputs:any[],taskId:string)=>{
   launches++;const directory=join(root,taskId);await mkdir(directory,{recursive:true});const worker=join(directory,'worker.mjs');
   await writeFile(worker,"import{writeFileSync}from'node:fs';writeFileSync('output.bin','media');writeFileSync('native.ecproj',"+JSON.stringify(native)+");");
   return {root:directory,adapter:{prepare:async()=>({executable:process.execPath,args:[worker],cwd:directory,actualRevision:node.expectedRevision,budgetUsage:{minorUnits:0,externalCalls:0}}),verify:async()=>({root:directory,evidenceRefs:[],outputs:[{protocolVersion:'craft-artifact/v1',assetId:node.id==='source'?'source':'changed',version:sha('media'),sha256:sha('media'),bytes:5,mediaType:'application/octet-stream',producerTaskId:taskId,sourceRefs:inputs.map(input=>({assetId:input.artifact.assetId,version:input.artifact.version,sha256:input.artifact.sha256})),nativeProjectRef:node.id==='source'?{assetId:'native',version:nativeHash,sha256:nativeHash,location:'native.ecproj'}:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'output.bin'}]})}};
  };
  const nodes=[{id:'source',dependsOn:[],projectKey:'source',runtimeIdentity:identity,expectedRevision:null,payload:{schemaVersion:'fixture/v1',plan:{}}},{id:'edit',dependsOn:['source'],projectKey:'edit',runtimeIdentity:identity,expectedRevision:nativeHash,payload:{schemaVersion:'fixture/v1',sourceProject:{assetId:'source'},plan:{}}}];
  const plan={workflowId:'cached-revision',ownerId:'qa',revision:'v1',authorizationRef:'fixture',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:1,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),nodes};
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),{fixture:factory});
  const before=await engine.run(plan);assert.equal(before.state,'review_ready',JSON.stringify(before));assert.equal(launches,2);
  const changed=join(before.nodes.source.root!,'native.ecproj');await writeFile(changed,'GUI edited cached native');
  const after=await engine.run(plan);assert.equal(after.state,'blocked');assert.equal(after.nodes.preflight.errorDetail?.code,'revision_conflict');assert.equal(launches,2);assert.deepEqual(after.budget,before.budget);assert.equal(await readFile(changed,'utf8'),'GUI edited cached native');
 }finally{ledger.close();await rm(root,{recursive:true,force:true});}
});
