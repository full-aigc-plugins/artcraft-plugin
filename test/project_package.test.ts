/** 打包合同测试使用伪原生 fixture；实际工程移动重开由原生联调证明。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,rename,access,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {TaskLedger} from '../src/harness/task_ledger.ts';
import {LocalRunner} from '../src/harness/local_runner.ts';
import {WorkflowEngine} from '../src/planning/workflow_engine.ts';
import {packageProject,verifyProjectPackage} from '../src/artifacts/project_package.ts';
const hash=(x:Buffer|string)=>createHash('sha256').update(x).digest('hex');
async function fixture(font=false,publicNative=false){
 const root=await mkdtemp(join(tmpdir(),'craft-package-')),ledger=new TaskLedger(join(root,'tasks.sqlite'));
 const delivery=join(root,'source');await mkdir(delivery);
 const files={'project.fcproj':publicNative?JSON.stringify({format:'filmcraft.project',schema_version:12,project:{items:{}}}):'fixture native','render.bin':'fixture render','asset.bin':'fixture dependency','native.json':'{"layers":[]}'};
 for(const [name,data] of Object.entries(files))await writeFile(join(delivery,name),data);
 const manifest={schema:'filmcraft-delivery/v1',runtimeSha256:hash(await readFile(process.execPath)),files:Object.fromEntries(Object.entries(files).map(([name,data])=>[name,hash(data)])),assets:{media:{path:'asset.bin',sha256:hash(files['asset.bin'])}},bindings:{}};
 const text=JSON.stringify(manifest);await writeFile(join(delivery,'manifest.json'),text);
 const ref=(location:string,sha256:string)=>({assetId:location,location,sha256,version:sha256});
 const artifact={protocolVersion:'craft-artifact/v1',assetId:'film',location:'render.bin',version:hash(files['render.bin']),sha256:hash(files['render.bin']),bytes:files['render.bin'].length,mediaType:'application/octet-stream',producerTaskId:'placeholder',sourceRefs:[],nativeProjectRef:ref('project.fcproj',hash(files['project.fcproj'])),renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[ref('manifest.json',hash(text))]};
 if(font){
  const inspection=ref('native.json',hash(files['native.json']));
  artifact.evidenceRefs.push(inspection);
  (artifact.dependencies as any[]).push({assetRef:null,kind:'font',packaged:false,missingReason:'font_file_not_collected',fontRequirement:{family:'Arial',nativeProjectSha256:artifact.nativeProjectRef.sha256,inspectionRef:inspection}});
 }
 if(publicNative){
  const assetRef={assetId:'known-media',version:hash(files['asset.bin']),sha256:hash(files['asset.bin'])};
  (artifact.dependencies as any[]).push({assetRef,kind:'media',packaged:true,missingReason:null});artifact.evidenceRefs.push({...assetRef,location:'asset.bin'});
 }
 const identity={pluginId:'filmcraft',pluginVersion:'fixture',cliVersion:process.version,sha256:manifest.runtimeSha256,mode:'headless',capabilitySnapshotSha256:hash('fixture')};
 const plan={workflowId:'package-test',ownerId:'owner',revision:'v1',authorizationRef:'scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),nodes:[{id:'film',dependsOn:[],projectKey:'film-project',runtimeIdentity:identity,expectedRevision:null,payload:{schemaVersion:publicNative?'craft-skill-workflow/v1':'fixture/v1',plan:{text:'fixture'}}}]};
 const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),{filmcraft:async(_node,_inputs,taskId)=>({root:delivery,adapter:{prepare:async()=>({executable:process.execPath,args:['-e','process.exit(0)'],cwd:root,actualRevision:null,budgetUsage:{minorUnits:0,externalCalls:0}}),verify:async()=>({root:delivery,outputs:[{...artifact,producerTaskId:taskId}],evidenceRefs:[]})}})});
 return {root,ledger,delivery,plan,engine,artifact,cleanup:async()=>{ledger.close();await rm(root,{recursive:true});}};
}
test('ledger-backed package moves with all child files, plan, records and native references',async()=>{
 const f=await fixture();try{
  const result=await f.engine.run(f.plan),target=join(f.root,'package');await f.engine.run(f.plan);
  const receipt=await packageProject(f.ledger,result.runKey,'owner','scope',target);
  assert.equal(receipt.state,'review_ready');assert.equal(receipt.children.length,1);
  const moved=join(f.root,'moved');await rename(target,moved);await rm(f.delivery,{recursive:true});
  const verified=await verifyProjectPackage(moved,receipt.sha256);
  assert.equal(verified.children[0].root,join(moved,'children/'+hash('film')));
  assert.equal(await readFile(join(verified.children[0].root,'asset.bin'),'utf8'),'fixture dependency');
  assert.ok(JSON.parse(await readFile(join(moved,'workflow-record.json'),'utf8')).tasks.length);
  await writeFile(join(verified.children[0].root,'render.bin'),'replaced');
  await assert.rejects(verifyProjectPackage(moved,receipt.sha256),/package_file_digest_mismatch/);
 }finally{await f.cleanup();}
});
test('unfinished, unauthorized, corrupted or existing destinations never publish a package',async()=>{
 const f=await fixture();try{
  const key=f.ledger.beginWorkflow(f.plan),target=join(f.root,'package');
  await assert.rejects(packageProject(f.ledger,key,'other','scope',target),/authorization_scope_mismatch/);
  await assert.rejects(packageProject(f.ledger,key,'owner','scope',target),/package_workflow_not_ready/);
  await assert.rejects(access(target),/ENOENT/);
  await f.engine.run(f.plan);await mkdir(target);await writeFile(join(target,'user.txt'),'keep');
  await assert.rejects(packageProject(f.ledger,key,'owner','scope',target),/package_output_exists/);
  assert.equal(await readFile(join(target,'user.txt'),'utf8'),'keep');
  await writeFile(join(f.delivery,'project.fcproj'),'changed');
  await assert.rejects(packageProject(f.ledger,key,'owner','scope',join(f.root,'bad')),/artifact_reference_mismatch|artifact_digest_mismatch/);
  await assert.rejects(access(join(f.root,'bad')),/ENOENT/);
 }finally{await f.cleanup();}
});
test('package manifest digest protects file-table and child-root changes',async()=>{
 const f=await fixture();try{
  const result=await f.engine.run(f.plan),target=join(f.root,'package');const receipt=await packageProject(f.ledger,result.runKey,'owner','scope',target);
  const path=join(target,'project.json'),manifest=JSON.parse(await readFile(path,'utf8'));manifest.children[0].root='../escape';await writeFile(path,JSON.stringify(manifest));
  await assert.rejects(verifyProjectPackage(target,receipt.sha256),/package_manifest_digest_mismatch/);
  await assert.rejects(verifyProjectPackage(target,hash(JSON.stringify(manifest))),/package_location_invalid/);
 }finally{await f.cleanup();}
});

test('unlisted files and symlinks invalidate a moved package',async()=>{
 const f=await fixture();try{
  const result=await f.engine.run(f.plan),target=join(f.root,'package');const receipt=await packageProject(f.ledger,result.runKey,'owner','scope',target);
  const extra=join(target,'extra.bin');await writeFile(extra,'not registered');
  await assert.rejects(verifyProjectPackage(target,receipt.sha256),/package_unlisted_file/);await rm(extra);
  await symlink(join(f.delivery,'render.bin'),extra);
  await assert.rejects(verifyProjectPackage(target,receipt.sha256),/package_unlisted_file/);
 }finally{await f.cleanup();}
});
test('workflow records cannot substitute artifacts for the verified task receipt',async()=>{
 const f=await fixture();try{
  const result=await f.engine.run(f.plan),record=f.ledger.workflowNode(result.runKey,'film');record.outputs[0].assetId='substituted';f.ledger.saveWorkflowNode(result.runKey,'film',record);
  await assert.rejects(packageProject(f.ledger,result.runKey,'owner','scope',join(f.root,'package')),/package_artifact_binding_mismatch/);
 }finally{await f.cleanup();}
});
test('escaping delivery file tables never publish an output',async()=>{
 const f=await fixture();try{
  const path=join(f.delivery,'manifest.json'),manifest=JSON.parse(await readFile(path,'utf8'));manifest.files['../outside']=hash('outside');const text=JSON.stringify(manifest);await writeFile(path,text);
  f.artifact.evidenceRefs[0].sha256=hash(text);f.artifact.evidenceRefs[0].version=hash(text);
  const result=await f.engine.run(f.plan),target=join(f.root,'package');
  await assert.rejects(packageProject(f.ledger,result.runKey,'owner','scope',target),/package_location_invalid/);
  await assert.rejects(access(target),/ENOENT/);
 }finally{await f.cleanup();}
});
test('an active project writer prevents packaging a historical workflow',async()=>{
 const f=await fixture();try{
  const result=await f.engine.run(f.plan),request=f.ledger.request(result.nodes.film.taskId!);request.taskId='other-writer';request.idempotencyKey='other-writer';
  f.ledger.register('owner','film-project',request);f.ledger.ready('other-writer');f.ledger.claim('other-writer',null,{minorUnits:0,externalCalls:0});
  await assert.rejects(packageProject(f.ledger,result.runKey,'owner','scope',join(f.root,'package')),/package_workflow_busy/);
 }finally{await f.cleanup();}
});

test('moving a package preserves missing font requirements without claiming font bytes',async()=>{
 const f=await fixture(true);try{
  const result=await f.engine.run(f.plan),target=join(f.root,'package');
  const receipt=await packageProject(f.ledger,result.runKey,'owner','scope',target);
  const moved=join(f.root,'moved');await rename(target,moved);await rm(f.delivery,{recursive:true});
  const verified=await verifyProjectPackage(moved,receipt.sha256);
  const dep=verified.children[0].outputs[0].dependencies[0];
  assert.equal(dep.fontRequirement.family,'Arial');assert.equal(dep.assetRef,null);assert.equal(dep.packaged,false);
  assert.equal(dep.missingReason,'font_file_not_collected');
  await writeFile(join(verified.children[0].root,'native.json'),'{}');
  await assert.rejects(verifyProjectPackage(moved,receipt.sha256),/package_file_digest_mismatch/);
 }finally{await f.cleanup();}
});

test('legacy ready snapshot with missing collected dependencies cannot be published by direct packaging',async()=>{
 const f=await fixture(false,true);try{
  const result=await f.engine.run(f.plan);assert.equal(result.state,'review_ready');
  const snapshot=f.ledger.packageSnapshot.bind(f.ledger);
  // 受控旧快照夹具；真实账本和领域文件保持不变。
  f.ledger.packageSnapshot=(...args)=>{const value=snapshot(...args);value.nodes.film.outputs[0].dependencies=[];return value;};
  const target=join(f.root,'legacy-package');await assert.rejects(packageProject(f.ledger,result.runKey,'owner','scope',target),/dependency_manifest_mismatch/);
  await assert.rejects(access(target),/ENOENT/);
 }finally{await f.cleanup();}
});
test('moved public package with omitted collected dependencies is rejected even with its exact supplied manifest hash',async()=>{
 const f=await fixture(false,true);try{
  const result=await f.engine.run(f.plan),target=join(f.root,'package');assert.equal(result.state,'review_ready');
  const receipt=await packageProject(f.ledger,result.runKey,'owner','scope',target);await verifyProjectPackage(target,receipt.sha256);
  const path=join(target,'project.json'),manifest=JSON.parse(await readFile(path,'utf8'));manifest.children[0].outputs[0].dependencies=[];
  const text=JSON.stringify(manifest);await writeFile(path,text);
  await assert.rejects(verifyProjectPackage(target,hash(text)),/dependency_manifest_mismatch/);
 }finally{await f.cleanup();}
});
