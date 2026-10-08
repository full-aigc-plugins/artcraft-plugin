import {lockNativeSchema} from './fixtures/native_schema_lock.ts';
/** 仅通过技能公开脚本运行原生合成，不导入独立技能私有模块。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { publicSkillFactory } from '../src/adapters/public_skill.ts';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { WorkflowEngine } from '../src/planning/workflow_engine.ts';
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const cli=process.env.CRAFT_EFFECTCRAFT_CLI;
const skill=process.env.CRAFT_EFFECTCRAFT_SKILL;
test('public skill refuses a launcher lock that omits failed-stage preservation',()=>{
 const root=join(tmpdir(),'craft-missing-preservation');
 const files=['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py'].map(name=>({path:join(root,'scripts',name),sha256:'0'.repeat(64)}));
 assert.throws(()=>publicSkillFactory({pluginId:'filmcraft',skillRoot:root,python:process.execPath,pythonSha256:'0'.repeat(64),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'output')}),/skill_lock_incomplete/);
});
test('public VectorCraft binding forwards registered input and rejects unbound or inline paths',async()=>{
 const {writeFile,mkdir}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'craft-vector-binding-'));
 try{
  const skillRoot=join(root,'skill');await mkdir(join(skillRoot,'scripts'),{recursive:true});
  const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(skillRoot,'scripts',name);await writeFile(path,'contract fixture');return {path,sha256:hash('contract fixture')};}));
  await lockNativeSchema(files,true);
  const factory=publicSkillFactory({pluginId:'vectorcraft',skillRoot,python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'output')});
  const data=Buffer.from('registered fixture; no native format acceptance');await writeFile(join(root,'input.bin'),data);
  const digest=hash(data);
  const input={root,artifact:{protocolVersion:'craft-artifact/v1',assetId:'image',version:digest,sha256:digest,bytes:data.length,mediaType:'application/octet-stream',producerTaskId:'provided',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'input.bin'}};
  const node={id:'brand',dependsOn:[],projectKey:'brand',runtimeIdentity:{pluginId:'vectorcraft'},expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{operations:[{command:'asset.place',params:{asset:'product'}}]},assetBindings:[{name:'product',assetId:'image'}],outputs:[{assetId:'brand',location:'project.vectorcraft',mediaType:'application/octet-stream'}]}};
  const made=await factory(node,[input],'new');
  const prepared=await made.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:null} as any);
  assert.deepEqual(prepared.args.slice(-2),['--asset','product='+join(root,'input.bin')]);
  const preserved=files.find(file=>file.path.endsWith('/preserved_stage.py'))!;
  assert.ok(prepared.launcherIdentity!.files.some(file=>file.path===preserved.path && file.sha256===preserved.sha256));
  const tampered=publicSkillFactory({pluginId:'vectorcraft',skillRoot,python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:'/usr/bin/true',runtimeHome:root,files:files.map(file=>file.path===preserved.path?{...file,sha256:'0'.repeat(64)}:file),outputRoot:join(root,'tampered')});
  await assert.rejects(tampered(node,[input],'tampered'),/launcher_file_identity_mismatch/);
  await assert.rejects(factory({...node,payload:{...node.payload,assetBindings:[]}},[input],'unbound'),/skill_input_unbound/);
  await assert.rejects(factory({...node,payload:{...node.payload,plan:{assets:{product:{path:'/outside'}}}}},[input],'path'),/skill_payload_invalid/);
 }finally{await rm(root,{recursive:true});}
});
test('public EffectCraft skill script produces registered native project and render',{skip:!cli||!skill},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-public-skill-'));const ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const python='/opt/anaconda3/bin/python3',runtimeHome=process.env.CRAFT_NATIVE_RUNTIME_HOME||join(homedir(),'.local/share/craft-runtimes');
  const scripts=['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py','native_workflow.py','commands.py'];
  const files=await Promise.all(scripts.map(async name=>({path:join(skill!,'scripts',name),sha256:hash(await readFile(join(skill!,'scripts',name)))})));
  await lockNativeSchema(files);
  files.push({path:join(skill!,'references/command-coverage.json'),sha256:hash(await readFile(join(skill!,'references/command-coverage.json')))});
  const factory=publicSkillFactory({pluginId:'effectcraft',skillRoot:skill!,python,pythonSha256:hash(await readFile(python)),nativeExecutable:cli!,runtimeHome,files,outputRoot:join(root,'deliveries')});
  const runtimeIdentity={pluginId:'effectcraft',pluginVersion:'0.1.0',cliVersion:'0.2.0',sha256:hash(await readFile(cli!)),mode:'headless',capabilitySnapshotSha256:hash(JSON.stringify(files))};
  const plan={workflowId:'public-intro',ownerId:'test',revision:'v1',authorizationRef:'test-scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:1,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),nodes:[{id:'intro',dependsOn:[],projectKey:'intro-project',runtimeIdentity,expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{document:{name:'Public intro',width:320,height:180,frameRate:12,duration:1},operations:[{command:'layer.newText',params:{name:'Title',text:'NOVA',font:'Arial',size:30,position:[120,90]},as:'title'},{command:'prop.addKey',params:{layer:{'$ref':'title.layer'},path:'transform/opacity',time:0,value:0}},{command:'prop.addKey',params:{layer:{'$ref':'title.layer'},path:'transform/opacity',time:.5,value:100}}],frames:[0],exports:[{format:'mp4'}]},assetBindings:[],outputs:[{assetId:'intro-video',location:'intro.mp4',mediaType:'video/mp4'}]}}]};
  plan.nodes[0].payload.plan.operations.push({command:'native.command',params:{command:'layer.setBlendMode',params:{layers:[{'$ref':'title.layer'}],mode:'Multiply'}}} as any);
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async request=>assert.equal(request.authorizationRef,'test-scope')),{effectcraft:factory});
  const result=await engine.run(plan);
  assert.equal(result.state,'review_ready',JSON.stringify(result));
  assert.match(await readFile(join(result.nodes.intro.root!,'operations.json'),'utf8'),/nativeCommand/);
  const output=result.nodes.intro.outputs![0];
  assert.equal(output.assetId,'intro-video');assert.equal(output.nativeProjectRef.location,'project.ecproj');
  assert.ok(output.evidenceRefs.some((item:{location:string})=>item.location==='manifest.json'));
  assert.equal((await engine.run(plan)).nodes.intro.taskId,result.nodes.intro.taskId);
  const before=JSON.parse(await readFile(join(result.nodes.intro.root!,'native.json'),'utf8'));
  const priorManifest=JSON.parse(await readFile(join(result.nodes.intro.root!,'manifest.json'),'utf8'));
  const revised=structuredClone(plan);revised.revision='v2';
  revised.nodes[0].expectedRevision=output.nativeProjectRef.sha256 as any;
  revised.nodes[0].payload={schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:'intro-video'},plan:{operations:[{command:'layer.setText',params:{layer:{'$ref':'title.layer'},text:'NOVA PLUS'}}],frames:[0,.5],exports:[{format:'mp4'}]},assetBindings:[],outputs:[{assetId:'intro-video',location:'intro.mp4',mediaType:'video/mp4'}]} as any;
  (revised.nodes[0] as any).externalInputs=[{root:result.nodes.intro.root,artifact:output}];
  const second=await engine.run(revised);
  assert.equal(second.state,'review_ready',JSON.stringify(second));
  const after=JSON.parse(await readFile(join(second.nodes.intro.root!,'native.json'),'utf8'));
  const title=String(priorManifest.bindings.title.layer);
  const find=(property:any,path:string):any=>property.path===path?property:(property.children??[]).map((child:any)=>find(child,path)).find(Boolean);
  assert.deepEqual(find(before.layers[title].properties,'transform/opacity'),find(after.layers[title].properties,'transform/opacity'));
  assert.equal(find(after.layers[title].properties,'text/sourceText').value,'NOVA PLUS');
  assert.equal(hash(await readFile(join(result.nodes.intro.root!,'project.ecproj'))),output.nativeProjectRef.sha256);
  assert.equal(second.nodes.intro.outputs![0].sourceRefs[0].assetId,'intro-video');
  assert.equal((await engine.run(revised)).nodes.intro.taskId,second.nodes.intro.taskId);
  const badFactory=publicSkillFactory({pluginId:'effectcraft',skillRoot:skill!,python,pythonSha256:hash(await readFile(python)),nativeExecutable:cli!,runtimeHome,files:files.map((file,index)=>index===0?{...file,sha256:'0'.repeat(64)}:file),outputRoot:join(root,'bad')});
  await assert.rejects(badFactory(plan.nodes[0],[],'bad'),/launcher_file_identity_mismatch/);
 }finally{ledger.close();await rm(root,{recursive:true});}
});

test('public skill preflight rejects arbitrary paths, inline assets and unbound revisions before writes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-skill-preflight-'));
 try{
  const files=['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(name=>({path:join(root,'scripts',name),sha256:'0'.repeat(64)}));
  const factory=publicSkillFactory({pluginId:'effectcraft',skillRoot:root,python:process.execPath,pythonSha256:'0'.repeat(64),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'output')});
  const node={id:'intro',dependsOn:[],projectKey:'intro',runtimeIdentity:{pluginId:'effectcraft'},expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{},assetBindings:[],outputs:[{assetId:'render',location:'../outside.mp4',mediaType:'video/mp4'}]}};
  await assert.rejects(factory(node,[],'task'),/skill_output_invalid/);
  await assert.rejects(factory({...node,payload:{...node.payload,plan:{assets:{evil:{path:'/outside'}}}}},[],'task'),/skill_payload_invalid/);
  await assert.rejects(factory({...node,expectedRevision:'old'},[],'task'),/skill_source_missing/);
  await assert.rejects(factory({...node,payload:{...node.payload,script:'/arbitrary.py'}},[],'task'),/skill_payload_invalid/);
  await assert.rejects(readFile(join(root,'output','plan.json')),/ENOENT/);
 }finally{await rm(root,{recursive:true});}
});

/** 使用伪交付只检验公开适配合同，原生文件可编辑性另由真实 CLI 验收。 */
test('source binding derives public source argv and refuses revision drift',async()=>{
 const {writeFile,mkdir,symlink}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'craft-source-binding-'));
 try{
  const source=join(root,'source'),skillRoot=join(root,'skill');await mkdir(source);await mkdir(join(skillRoot,'scripts'),{recursive:true});
  const native=Buffer.from('registered native project'),digest=hash(native);
  await writeFile(join(source,'project.ecproj'),native);
  const manifest={schema:'effectcraft-delivery/v1',runtimeSha256:'a'.repeat(64),files:{'project.ecproj':digest},assets:{},bindings:{}};
  const manifestText=JSON.stringify(manifest);await writeFile(join(source,'manifest.json'),manifestText);
  const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(skillRoot,'scripts',name);await writeFile(path,'fixture');return {path,sha256:hash('fixture')};}));
  await lockNativeSchema(files,true);
  const factory=publicSkillFactory({pluginId:'effectcraft',skillRoot,python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'output')});
  const reference={assetId:'native',version:digest,sha256:digest,location:'project.ecproj'};
  const artifact={protocolVersion:'craft-artifact/v1',assetId:'old-project',version:digest,sha256:digest,bytes:native.length,mediaType:'application/octet-stream',producerTaskId:'old-task',sourceRefs:[],nativeProjectRef:reference,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[{assetId:'manifest',version:hash(manifestText),sha256:hash(manifestText),location:'manifest.json'}],location:'project.ecproj'};
  const node={id:'intro',dependsOn:[],projectKey:'intro',runtimeIdentity:{pluginId:'effectcraft',sha256:'a'.repeat(64)},expectedRevision:digest,payload:{schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:'old-project'},plan:{operations:[]},assetBindings:[],outputs:[{assetId:'new',location:'project.ecproj',mediaType:'application/octet-stream'}]}};
  const input={root:source,artifact};
  const made=await factory(node,[input],'revision-task');
  const prepared=await made.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:digest} as any);
  assert.equal(prepared.actualRevision,digest);assert.deepEqual(prepared.args.slice(-2),['--source',source]);
  assert.equal(JSON.parse(await readFile(prepared.args[prepared.args.indexOf(join(skillRoot,'scripts/workflow.py'))+1],'utf8')).expectedProjectSha256,digest);
  await assert.rejects(factory({...node,expectedRevision:'b'.repeat(64)},[input],'wrong-revision'),/skill_source_revision_mismatch/);
  await assert.rejects(factory({...node,payload:{...node.payload,sourceProject:{assetId:'missing'}}},[input],'missing'),/skill_source_missing/);
  await assert.rejects(factory({...node,payload:{...node.payload,sourceProject:{assetId:'old-project',path:source}}},[input],'path'),/skill_source_binding_invalid/);
  await assert.rejects(factory({...node,payload:{...node.payload,plan:{document:{}}}},[input],'recreate'),/skill_source_plan_invalid/);
  const outside=join(root,'outside');await writeFile(outside,'outside');await symlink(outside,join(source,'escaping'));
  const evilManifest=JSON.stringify({...manifest,files:{...manifest.files,escaping:hash('outside')}});
  await writeFile(join(source,'manifest.json'),evilManifest);
  const evilInput={root:source,artifact:{...artifact,evidenceRefs:[{...artifact.evidenceRefs[0],sha256:hash(evilManifest),version:hash(evilManifest)}]}};
  await assert.rejects(factory(node,[evilInput],'escape'),/location_invalid/);
  await writeFile(join(source,'manifest.json'),manifestText);
  const noManifest={root:source,artifact:{...artifact,evidenceRefs:[]}};
  await assert.rejects(factory(node,[noManifest],'missing-manifest'),/skill_source_manifest_missing/);
  // 工厂冻结调用输入，不接受调用者在准备阶段改写旧工程身份。
  node.expectedRevision='b'.repeat(64);
  assert.equal((await made.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:digest} as any)).actualRevision,digest);
  await writeFile(join(source,'project.ecproj'),'changed externally');
  await assert.rejects(made.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:digest} as any),/^Error: revision_conflict$/);
  await assert.rejects(made.adapter.verify({runtimeIdentity:node.runtimeIdentity,expectedRevision:digest} as any),/^Error: revision_conflict$/);
 }finally{await rm(root,{recursive:true});}
});


test('retained media binding keeps upstream dependency without reinserting source media',async()=>{
 const {writeFile,mkdir}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'craft-retained-media-'));
 try{
  const source=join(root,'source'),upstream=join(root,'upstream'),skillRoot=join(root,'skill');await mkdir(source);await mkdir(upstream);await mkdir(join(skillRoot,'scripts'),{recursive:true});
  const native=Buffer.from('native project'),media=Buffer.from('registered intro'),nativeSha=hash(native),mediaSha=hash(media);
  await writeFile(join(source,'project.fcproj'),native);await writeFile(join(source,'intro.mp4'),media);await writeFile(join(upstream,'intro.mp4'),media);
  const manifest={schema:'filmcraft-delivery/v1',runtimeSha256:'a'.repeat(64),files:{'project.fcproj':nativeSha,'intro.mp4':mediaSha},assets:{intro:{path:'intro.mp4',sha256:mediaSha}},bindings:{}};
  const text=JSON.stringify(manifest);await writeFile(join(source,'manifest.json'),text);
  const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(skillRoot,'scripts',name);await writeFile(path,'fixture');return {path,sha256:hash('fixture')};}));
  await lockNativeSchema(files,true);
  const factory=publicSkillFactory({pluginId:'filmcraft',skillRoot,python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'output')});
  const base={protocolVersion:'craft-artifact/v1',producerTaskId:'previous',sourceRefs:[],renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null};
  const old={...base,assetId:'old-film',version:nativeSha,sha256:nativeSha,bytes:native.length,mediaType:'application/octet-stream',nativeProjectRef:{assetId:'native',version:nativeSha,sha256:nativeSha,location:'project.fcproj'},evidenceRefs:[{assetId:'manifest',version:hash(text),sha256:hash(text),location:'manifest.json'}],location:'project.fcproj'};
  const intro={...base,assetId:'intro-video',version:mediaSha,sha256:mediaSha,bytes:media.length,mediaType:'application/octet-stream',nativeProjectRef:null,evidenceRefs:[],location:'intro.mp4'};
  const node={id:'film',dependsOn:['intro'],projectKey:'film',runtimeIdentity:{pluginId:'filmcraft',sha256:'a'.repeat(64)},expectedRevision:nativeSha,payload:{schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:'old-film'},plan:{operations:[]},assetBindings:[{name:'intro',assetId:'intro-video',retained:true}],outputs:[{assetId:'new-film',location:'film.mp4',mediaType:'video/mp4'}]}};
  const made=await factory(node,[{root:source,artifact:old},{root:upstream,artifact:intro}],'retained');
  const prepared=await made.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:nativeSha} as any);
  assert.equal(prepared.args.includes('--asset'),false);assert.deepEqual(prepared.args.slice(-2),['--source',source]);
  const changed=Buffer.from('changed intro');await writeFile(join(upstream,'changed.mp4'),changed);
  await assert.rejects(factory(node,[{root:source,artifact:old},{root:upstream,artifact:{...intro,location:'changed.mp4',sha256:hash(changed),version:hash(changed),bytes:changed.length}}],'changed'),/skill_retained_asset_mismatch/);
  await assert.rejects(factory({...node,payload:{...node.payload,sourceProject:undefined},expectedRevision:null},[{root:upstream,artifact:intro}],'no-source'),/skill_retained_asset_mismatch/);
  await assert.rejects(factory({...node,payload:{...node.payload,assetBindings:[{name:'intro',assetId:'intro-video',retained:'true'}]}},[{root:source,artifact:old},{root:upstream,artifact:intro}],'bad-flag'),/skill_asset_binding_invalid/);
  await writeFile(join(upstream,'intro.mp4'),Buffer.from('tampered upstream'));
  await assert.rejects(made.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:nativeSha} as any),/artifact_digest_mismatch/);
  await assert.rejects(made.adapter.verify({runtimeIdentity:node.runtimeIdentity} as any),/artifact_digest_mismatch/);
 }finally{await rm(root,{recursive:true});}
});

// 缺少完整命令组件锁时，在写计划之前拒绝网关操作。
test('complete native workflow gateway requires locked helper, command parser and catalog',async()=>{
 const root=join(tmpdir(),'craft-native-lock');
 const files=['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(name=>({path:join(root,'scripts',name),sha256:'0'.repeat(64)}));
 const factory=publicSkillFactory({pluginId:'effectcraft',skillRoot:root,python:process.execPath,pythonSha256:'0'.repeat(64),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'output')});
 const node={runtimeIdentity:{pluginId:'effectcraft'},expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{operations:[{command:'native.command',params:{command:'layer.setBlendMode',params:{}}}]},assetBindings:[],outputs:[{assetId:'render',location:'intro.mp4',mediaType:'video/mp4'}]}};
 await assert.rejects(factory(node,[],'native-lock'),/native_workflow_lock_incomplete/);
});
