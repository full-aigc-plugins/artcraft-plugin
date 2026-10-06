/** 四个独立技能公开脚本的真实交接；程序化品牌样本仅证明功能。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { publicSkillFactory } from '../src/adapters/public_skill.ts';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { WorkflowEngine } from '../src/planning/workflow_engine.ts';
const exec=promisify(execFile),hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const skillsRoot=process.env.CRAFT_NATIVE_SKILLS_ROOT,runtimeHome=process.env.CRAFT_NATIVE_RUNTIME_HOME;
const tick='254016000000';
const operation=(command:string,params:Record<string,any>,as?:string)=>({command,params,...(as?{as}:{})});
const ref=(path:string)=>({'$ref':path});

function narration():Buffer {
 const samples=48000,bytes=Buffer.alloc(44+samples*2);
 bytes.write('RIFF',0);bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(samples,24);bytes.writeUInt32LE(samples*2,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++)bytes.writeInt16LE(Math.round(5000*Math.sin(i*2*Math.PI*440/samples)),44+i*2);
 return bytes;
}

test('four native public skills hand off Logo, poster, intro and narrated film; Logo revision updates consumers',{skip:!skillsRoot||!runtimeHome},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-native-mixed-'));const ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const python='/opt/anaconda3/bin/python3',pythonHash=hash(await readFile(python));
  const factories:Record<string,any>={},identities:Record<string,any>={},configs:Record<string,any>={};
  for(const pluginId of ['vectorcraft','photocraft','effectcraft','filmcraft'] as const){
   const skillRoot=join(skillsRoot!,pluginId+'-skills','skills',pluginId+'-use');
   const runtimeLock=JSON.parse(await readFile(join(skillRoot,'scripts/runtime.lock.json'),'utf8'));
   const nativeVersion=runtimeLock.resolvedVersion;
   const nativeExecutable=join(runtimeHome!,pluginId,nativeVersion,pluginId+'-cli');
   const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>({path:join(skillRoot,'scripts',name),sha256:hash(await readFile(join(skillRoot,'scripts',name)))})));
   configs[pluginId]={pluginId,skillRoot,python,pythonSha256:pythonHash,nativeExecutable,runtimeHome:runtimeHome!,files,outputRoot:join(root,'deliveries')};
   factories[pluginId]=publicSkillFactory(configs[pluginId]);
   identities[pluginId]={pluginId,pluginVersion:'0.1.0',cliVersion:nativeVersion,sha256:hash(await readFile(nativeExecutable)),mode:'headless',capabilitySnapshotSha256:hash(JSON.stringify(files))};
  }
  const voice=join(root,'voice.wav');await writeFile(voice,narration());const voiceHash=hash(await readFile(voice));
  const voiceInput={root,artifact:{protocolVersion:'craft-artifact/v1',assetId:'voice',version:'v1',sha256:voiceHash,bytes:(await readFile(voice)).length,mediaType:'application/octet-stream',producerTaskId:'provided-voice',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{audio:{sampleRate:48000,channels:1}},lossReportRef:null,evidenceRefs:[],location:'voice.wav'}};
  const vectorPlan=JSON.parse(await readFile(join(skillsRoot!,'vectorcraft-skills/skills/vectorcraft-use/examples/brand-assets.json'),'utf8'));
  vectorPlan.exports=[{format:'png',artboard:0},{format:'svg',artboard:0}];
  const payload=(plan:Record<string,any>,assetBindings:{name:string;assetId:string}[],assetId:string,location:string,mediaType:string)=>({schemaVersion:'craft-skill-workflow/v1',plan,assetBindings,outputs:[{assetId,location,mediaType}]});
  const node=(id:string,plugin:string,dependsOn:string[],payload:Record<string,any>)=>({id,dependsOn,projectKey:id+'-project',runtimeIdentity:identities[plugin],expectedRevision:null,payload});
  const plan={workflowId:'native-brand-campaign',ownerId:'test',revision:'v1',authorizationRef:'mixed-test-scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:1,maxExternalCalls:0},deadline:new Date(Date.now()+180000).toISOString(),nodes:[
   node('logo','vectorcraft',[],payload(vectorPlan,[],'logo-png','artboard-1.png','image/png')),
   node('poster','photocraft',['logo'],payload({document:{name:'NOVA brand poster',width:320,height:400,background:'#faf4e8'},minimumLayers:3,operations:[operation('asset.place',{asset:'logo',center:[160,210],name:'Logo'},'logo'),operation('type.create',{x:28,y:60,text:'NOVA',name:'Headline',font:'Arial',size:30,color:'#192a3b'},'title')],exports:[{format:'png'},{format:'psd'}]},[{name:'logo',assetId:'logo-png'}],'poster-png','design.png','image/png')),
   node('intro','effectcraft',['logo'],payload({document:{name:'NOVA intro',width:320,height:180,frameRate:12,duration:1},operations:[operation('asset.import',{asset:'logo'},'logo'),operation('layer.addItem',{item:ref('logo.item'),duration:1},'logoLayer'),operation('prop.addKey',{layer:ref('logoLayer.layer'),path:'transform/opacity',time:0,value:0}),operation('prop.addKey',{layer:ref('logoLayer.layer'),path:'transform/opacity',time:.5,value:100})],frames:[0,.5],exports:[{format:'mp4'}]},[{name:'logo',assetId:'logo-png'}],'intro-video','intro.mp4','video/mp4')),
   {...node('film','filmcraft',['intro'],payload({document:{name:'NOVA campaign',width:320,height:180,frameRate:{num:12,den:1}},operations:[operation('asset.import',{asset:'intro'},'intro'),operation('asset.import',{asset:'voice'},'voice'),operation('timeline.place',{item:ref('intro.item'),track:'V1',time:'0',sourceIn:'0',duration:tick,insert:false},'introClip'),operation('timeline.place',{item:ref('voice.item'),track:'A1',audioTrack:'A1',time:'0',sourceIn:'0',duration:tick,insert:false}),operation('captions.newTrack',{format:'Subtitle',name:'Brand subtitle',language:'en'}),operation('captions.setStyle',{track:'C1',font:'Arial',size:18,color:'#ffffff',background:true}),operation('caption.add',{track:'C1',text:'NOVA essentials',startTicks:'0',durationTicks:tick})],frames:['127008000000'],export:{audioRequired:true}},[{name:'intro',assetId:'intro-video'},{name:'voice',assetId:'voice'}],'film-video','film.mp4','video/mp4')),externalInputs:[voiceInput]}
  ]};
  // 实际领域计划携带需求元数据；不把 Brief 伪装成媒体输入。
  (plan as any).projectBrief={schema:'craft-brief/v1',workflowId:plan.workflowId,revision:'brief-v1',ownerId:plan.ownerId,authorizationRef:plan.authorizationRef,budget:structuredClone(plan.budget),brand:{name:'NOVA',colors:[],fonts:[],appliesTo:['logo','poster','intro','film'],referenceAssets:[]},subjects:[],dataPolicy:{allowUpload:false},ambiguities:[],deliverables:plan.nodes.map(node=>({id:node.id,nativeFormat:({vectorcraft:'.vectorcraft',photocraft:'.pcraft',effectcraft:'.ecproj',filmcraft:'.fcproj'} as any)[node.runtimeIdentity.pluginId],width:node.payload.plan.document.width,height:node.payload.plan.document.height,dependsOn:node.dependsOn,execution:'local',...(['intro','film'].includes(node.id)?{frameRate:{num:12,den:1},durationSeconds:1}:{})}))};
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async request=>assert.equal(request.authorizationRef,'mixed-test-scope')),factories);
  const first=await engine.run(plan,2);await writeFile(join(root,'v1-result.json'),JSON.stringify(first,null,2));
  assert.equal(first.state,'review_ready',JSON.stringify(first)+' evidence='+root);
  for(const id of ['logo','poster','intro','film'])assert.equal(first.nodes[id].status,'review_ready');
  const decode=async(file:string)=>JSON.parse((await exec('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',file])).stdout);
  const streams=(await decode(join(first.nodes.film.root!,'film.mp4'))).streams;
  const video=streams.find((item:any)=>item.codec_type==='video'),audio=streams.find((item:any)=>item.codec_type==='audio');
  assert.deepEqual([video.width,video.height,video.avg_frame_rate,video.nb_read_frames],[320,180,'12/1','12']);assert.ok(audio);
  assert.ok((await readFile(join(first.nodes.film.root!,'captions.srt'),'utf8')).includes('NOVA essentials'));
  const originalHashes=Object.fromEntries(await Promise.all(Object.entries(first.nodes).map(async([id,result])=>[id,hash(await readFile(join(result.root!,result.outputs![0].nativeProjectRef.location)))])));
  const repeated=await engine.run(plan);for(const id of ['logo','poster','intro','film'])assert.equal(repeated.nodes[id].taskId,first.nodes[id].taskId);
  const changed=structuredClone(plan);changed.revision='v2';
  for(const item of changed.nodes[0].payload.plan.operations)if(item.params?.color==='#ef5b36')item.params.color='#2366e8';
  const second=await engine.run(changed,2);await writeFile(join(root,'v2-result.json'),JSON.stringify(second,null,2));
  assert.equal(second.state,'review_ready',JSON.stringify(second)+' evidence='+root);
  for(const id of ['logo','poster','intro','film']){
   assert.notEqual(second.nodes[id].taskId,first.nodes[id].taskId);
   assert.notEqual(second.nodes[id].outputs![0].sha256,first.nodes[id].outputs![0].sha256);
   assert.equal(hash(await readFile(join(first.nodes[id].root!,first.nodes[id].outputs![0].nativeProjectRef.location))),originalHashes[id]);
  }
  assert.equal(hash(await readFile(voice)),voiceHash);
  const filmManifest=JSON.parse(await readFile(join(second.nodes.film.root!,'manifest.json'),'utf8'));
  assert.equal(filmManifest.assets.voice.sha256,voiceHash);
  await writeFile(join(root,'acceptance.json'),JSON.stringify({scope:'four native public scripts and selective semantic revision; procedural Logo and sine-wave narration, no creative acceptance',checks:['four native projects reopened by domain helpers','actual PNG/media collection and SHA lineage','MP4 decoded 12 frames with audio','SRT text','same workflow no replay','Logo revision rebuilt all consumers','original native projects and narration unchanged'],first,second},null,2));
  // 真实旧工程修订通过公开 --source 交接；四个旧包均为登记输入。
  const sourceNode=(id:string,plugin:string,domainPlan:Record<string,any>,dependsOn:string[]=[],assetBindings:{name:string;assetId:string}[]=[])=>{
   const old=second.nodes[id];const output=old.outputs![0];
   return {...node(id,plugin,dependsOn,{...payload(domainPlan,assetBindings,output.assetId,output.location,output.mediaType),sourceProject:{assetId:output.assetId}}),expectedRevision:output.nativeProjectRef.sha256,externalInputs:[{root:old.root!,artifact:output}]};
  };
  const revisionPlan={...plan,workflowId:'native-source-revisions',revision:'v1',nodes:[
   sourceNode('logo','vectorcraft',{operations:[operation('paint.setFill',{ids:[ref('logo.ids.0'),ref('wordmark.id')],color:'#175cce'})],exports:vectorPlan.exports}),
   sourceNode('poster','photocraft',{minimumLayers:3,operations:[operation('type.edit',{layer:ref('title.layer'),text:'NOVA PLUS'})],exports:[{format:'png'},{format:'psd'}]}),
   sourceNode('intro','effectcraft',{operations:[operation('asset.replace',{asset:'logo',replacement:'replacement'})],frames:[0,.5],exports:[{format:'mp4'}]},['logo'],[{name:'replacement',assetId:'logo-png'}]),
   sourceNode('film','filmcraft',{operations:[operation('asset.import',{asset:'replacement'},'replacement'),operation('clip.replaceFromBin',{clips:ref('introClip.clips'),item:ref('replacement.item')})],frames:['127008000000'],export:{audioRequired:true}},['intro'],[{name:'replacement',assetId:'intro-video'}])
  ]};
  // 源工程尺寸检查仍是独立待办，不把无 document 的修订冒充 Brief 验收。
  delete (revisionPlan as any).projectBrief;
  const nativeRevision=await engine.run(revisionPlan,2);
  assert.equal(nativeRevision.state,'review_ready',JSON.stringify(nativeRevision));
  for(const id of ['logo','poster','intro','film']){
   const old=second.nodes[id],updated=nativeRevision.nodes[id];
   const oldManifest=JSON.parse(await readFile(join(old.root!,'manifest.json'),'utf8'));
   const newManifest=JSON.parse(await readFile(join(updated.root!,'manifest.json'),'utf8'));
   assert.equal(newManifest.sourceProjectSha256,old.outputs![0].nativeProjectRef.sha256);
   for(const [file,digest] of Object.entries(oldManifest.files))assert.equal(hash(await readFile(join(old.root!,file))),digest,'old '+id+' '+file+' preserved');
   assert.notEqual(updated.outputs![0].sha256,old.outputs![0].sha256);
   assert.ok(updated.outputs![0].sourceRefs.some((ref:any)=>ref.sha256===old.outputs![0].sha256));
  }
  const oldIntro=JSON.parse(await readFile(join(second.nodes.intro.root!,'native.json'),'utf8'));
  const newIntro=JSON.parse(await readFile(join(nativeRevision.nodes.intro.root!,'native.json'),'utf8'));
  assert.deepEqual(newIntro.layers,oldIntro.layers,'asset replacement preserves animation/layer IDs');
  const oldFilm=JSON.parse(await readFile(join(second.nodes.film.root!,'native.json'),'utf8')).sequence;
  const newFilm=JSON.parse(await readFile(join(nativeRevision.nodes.film.root!,'native.json'),'utf8')).sequence;
  assert.deepEqual(newFilm.audio,oldFilm.audio);
  assert.equal(await readFile(join(nativeRevision.nodes.film.root!,'captions.srt'),'utf8'),await readFile(join(second.nodes.film.root!,'captions.srt'),'utf8'));
  const revisedFilmManifest=JSON.parse(await readFile(join(nativeRevision.nodes.film.root!,'manifest.json'),'utf8'));
  assert.equal(revisedFilmManifest.assets.voice.sha256,voiceHash);
  const revisionReplay=await engine.run(revisionPlan);for(const id of ['logo','poster','intro','film'])assert.equal(revisionReplay.nodes[id].taskId,nativeRevision.nodes[id].taskId);
  await writeFile(join(root,'source-revision-result.json'),JSON.stringify(nativeRevision,null,2));
  const registry=join(root,'registry.json'),planFile=join(root,'workflow.json');
  await writeFile(registry,JSON.stringify({schemaVersion:'craft-skill-registry/v1',plugins:Object.fromEntries(Object.keys(configs).map(id=>[id,{config:configs[id],runtimeIdentity:identities[id]}]))}));
  await writeFile(planFile,JSON.stringify(changed));
  const runtimeNode=process.env.CRAFT_ARTCRAFT_NODE ?? process.execPath,cli=new URL('../src/cli.ts',import.meta.url).pathname;
  const cliResult=JSON.parse((await exec(runtimeNode,[cli,'run','--database',join(root,'tasks.sqlite'),'--registry',registry,'--plan',planFile,'--owner','test','--authorization','mixed-test-scope'])).stdout);
  assert.equal(cliResult.state,'review_ready');
  for(const id of ['logo','poster','intro','film'])assert.equal(cliResult.nodes[id].taskId,second.nodes[id].taskId);
  const cliStatus=JSON.parse((await exec(runtimeNode,[cli,'status','--database',join(root,'tasks.sqlite')])).stdout);
  assert.equal(cliStatus.tasks.length,12);assert.equal(cliStatus.leases.length,0);
  await writeFile(join(root,'cli-result.json'),JSON.stringify(cliResult,null,2));
  const briefPackage=join(root,'brief-package');
  const briefPacked=JSON.parse((await exec(runtimeNode,[cli,'package','--database',join(root,'tasks.sqlite'),'--workflow',second.runKey,'--owner','test','--authorization','mixed-test-scope','--output',briefPackage])).stdout);
  const movedBrief=join(root,'moved-brief-package');await rename(briefPackage,movedBrief);
  const briefVerified=JSON.parse((await exec(runtimeNode,[cli,'verify-package','--package',movedBrief,'--sha',briefPacked.sha256])).stdout);
  assert.equal(briefVerified.children.length,4);
  assert.deepEqual(JSON.parse(await readFile(join(movedBrief,'workflow-plan-portable.json'),'utf8')).projectBrief,(plan as any).projectBrief);
  await writeFile(join(root,'brief-package-receipt.json'),JSON.stringify({briefPacked,briefVerified,brief:(plan as any).projectBrief},null,2));
  const packagePath=join(root,'project-package');
  const packed=JSON.parse((await exec(runtimeNode,[cli,'package','--database',join(root,'tasks.sqlite'),'--workflow',nativeRevision.runKey,'--owner','test','--authorization','mixed-test-scope','--output',packagePath])).stdout);
  assert.equal(packed.state,'review_ready');assert.equal(packed.children.length,4);
  const moved=join(root,'moved-package');await rename(packagePath,moved);
  // 删除所有原交付和外部音频，移动包必须独立核验并能重关联原生素材。
  await rm(join(root,'deliveries'),{recursive:true});await rm(voice);
  const independentBrief=JSON.parse((await exec(runtimeNode,[cli,'verify-package','--package',movedBrief,'--sha',briefPacked.sha256])).stdout);
  assert.equal(independentBrief.children.length,4);
  assert.deepEqual(JSON.parse(await readFile(join(movedBrief,'workflow-plan-portable.json'),'utf8')).projectBrief,(plan as any).projectBrief);
  const checked=JSON.parse((await exec(runtimeNode,[cli,'verify-package','--package',moved,'--sha',packed.sha256])).stdout);
  assert.equal(checked.children.length,4);
  const reopen={...plan,workflowId:'moved-package-reopen',revision:'v1',nodes:checked.children.map((child:any)=>({
   id:child.nodeId,dependsOn:[],projectKey:'moved-'+child.nodeId,runtimeIdentity:child.runtimeIdentity,expectedRevision:child.outputs[0].nativeProjectRef.sha256,
   externalInputs:[{root:child.root,artifact:child.outputs[0]}],
   payload:{schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:child.outputs[0].assetId},assetBindings:[],outputs:[{assetId:'reopened-'+child.nodeId,location:child.outputs[0].location,mediaType:child.outputs[0].mediaType}],plan:child.nodeId==='logo'?{operations:[],exports:vectorPlan.exports}:child.nodeId==='poster'?{operations:[],minimumLayers:3,exports:[{format:'png'},{format:'psd'}]}:child.nodeId==='intro'?{operations:[],frames:[0,.5],exports:[{format:'mp4'}]}:{operations:[],frames:['127008000000'],export:{audioRequired:true}}}
  }))};
  delete (reopen as any).projectBrief;
  // 只读设计源检查直接使用摘要锁定的公开 CLI，不启用尚未完成的 Brief 后置门禁。
  const designInspections:Record<string,any>={};
  for(const sourceNode of reopen.nodes.filter(node=>node.id!=='film')){
   const source=sourceNode.externalInputs[0],manifestBefore=await readFile(join(source.root,'manifest.json'));
   const manifest=JSON.parse(manifestBefore.toString());
   const compiled=await factories[sourceNode.runtimeIdentity.pluginId](sourceNode,sourceNode.externalInputs,'source-inspect-'+sourceNode.id);
   assert.ok(compiled.adapter.inspectSource);
   const inspected=await compiled.adapter.inspectSource();
   assert.equal(inspected.nativeProjectSha256,sourceNode.expectedRevision);
   assert.equal(inspected.nativeRuntimeSha256,sourceNode.runtimeIdentity.sha256);
   const expected=sourceNode.id==='logo'?{width:256,height:256}:sourceNode.id==='poster'?{width:320,height:400}:{width:320,height:180,frameRate:12,duration:1};
   assert.deepEqual(inspected.document,expected);
   assert.equal(hash(await readFile(join(source.root,'manifest.json'))),hash(manifestBefore));
   for(const [file,digest] of Object.entries(manifest.files))assert.equal(hash(await readFile(join(source.root,file))),digest,'readonly source '+file);
   assert.equal(ledger.leases().length,0);
   designInspections[sourceNode.id]=inspected;
  }
  await writeFile(join(root,'design-source-inspection-receipt.json'),JSON.stringify(designInspections,null,2));
  const reopened=await engine.run(reopen,2);assert.equal(reopened.state,'review_ready',JSON.stringify(reopened));
  const movedFilm=JSON.parse(await readFile(join(reopened.nodes.film.root!,'manifest.json'),'utf8'));
  assert.equal(movedFilm.assets.voice.sha256,voiceHash);
  assert.ok((await decode(join(reopened.nodes.film.root!,'film.mp4'))).streams.some((stream:any)=>stream.codec_type==='audio'));
  await writeFile(join(root,'package-receipt.json'),JSON.stringify({packed,checked,reopened},null,2));
  const sourceDesignBriefResults:Record<string,any>={};
  for(const sourceNode of reopen.nodes.filter(node=>node.id!=='film')){
   const source=sourceNode.externalInputs[0],before=await readFile(join(source.root,'manifest.json')),sourceManifest=JSON.parse(before.toString());
   const verifySource=async()=>{assert.equal(hash(await readFile(join(source.root,'manifest.json'))),hash(before));for(const [file,digest] of Object.entries(sourceManifest.files))assert.equal(hash(await readFile(join(source.root,file))),digest);assert.equal(ledger.leases().length,0);};
   const briefPlan:any={...structuredClone(reopen),workflowId:'source-design-brief-'+sourceNode.id,nodes:[structuredClone(sourceNode)]};
   const dims=sourceNode.id==='logo'?{width:256,height:256}:sourceNode.id==='poster'?{width:320,height:400}:{width:320,height:180,frameRate:{num:12,den:1},durationSeconds:1};
   const nativeFormat=sourceNode.id==='logo'?'.vectorcraft':sourceNode.id==='poster'?'.pcraft':'.ecproj';
   briefPlan.projectBrief={schema:'craft-brief/v1',workflowId:briefPlan.workflowId,revision:'design-brief-v1',ownerId:briefPlan.ownerId,authorizationRef:briefPlan.authorizationRef,budget:structuredClone(briefPlan.budget),brand:null,subjects:[],dataPolicy:{allowUpload:false},ambiguities:[],deliverables:[{id:sourceNode.id,nativeFormat,...dims,dependsOn:[],execution:'local'}]};
   const result=await engine.run(briefPlan);assert.equal(result.state,'review_ready',JSON.stringify(result));await verifySource();
   const replay=await engine.run(briefPlan);assert.equal(replay.nodes[sourceNode.id].status,'reused');await verifySource();
   const wrong=structuredClone(briefPlan);wrong.workflowId+='-wrong';wrong.projectBrief.workflowId=wrong.workflowId;wrong.projectBrief.deliverables[0].width++;
   const blocked=await engine.run(wrong);assert.equal(blocked.state,'blocked');assert.match(blocked.nodes[sourceNode.id].error!,/document_size_mismatch/);await verifySource();
   const resized=structuredClone(briefPlan);resized.workflowId+='-resize';resized.projectBrief.workflowId=resized.workflowId;resized.projectBrief.deliverables[0].width=352;
   resized.nodes[0].payload.plan.operations=[sourceNode.id==='logo'?operation('artboard.setProps',{index:0,width:352,height:256}):sourceNode.id==='poster'?operation('image.canvasSize',{width:352,height:400}):operation('comp.settings',{comp:sourceManifest.bindings.composition.comp,width:352})];
   const updated=await engine.run(resized);assert.equal(updated.state,'review_ready',JSON.stringify(updated));await verifySource();
   if(sourceNode.id==='poster'){
    const variantPlan=structuredClone(resized);variantPlan.workflowId+='-variant';variantPlan.projectBrief.workflowId=variantPlan.workflowId;
    const originalNative=JSON.parse(await readFile(join(source.root,'native.json'),'utf8'));
    const background=originalNative.layers.find((layer:any)=>layer.name==='Background').id;
    variantPlan.nodes[0].payload.plan.variant={width:352,height:400,safeArea:[8,8,336,384],roles:{background,product:ref('logo.layer'),text:ref('title.layer')}};
    const freshVariant=await engine.run(variantPlan);assert.equal(freshVariant.state,'review_ready',JSON.stringify(freshVariant));await verifySource();
    const reusedVariant=await engine.run(variantPlan);assert.equal(reusedVariant.nodes.poster.status,'reused');await verifySource();
    const withoutBrief=structuredClone(variantPlan);withoutBrief.workflowId+='-without-brief';delete withoutBrief.projectBrief;
    const plainVariant=await engine.run(withoutBrief);assert.equal(plainVariant.state,'review_ready',JSON.stringify(plainVariant));await verifySource();
    const plainReuse=await engine.run(withoutBrief);assert.equal(plainReuse.nodes.poster.status,'reused');await verifySource();

    const variantRoot=freshVariant.nodes.poster.root!,layoutBytes=await readFile(join(variantRoot,'layout-variant.json'));
    await writeFile(join(variantRoot,'layout-variant.json'),'{}');
    const blockedVariant=await engine.run(variantPlan);assert.equal(blockedVariant.state,'blocked');assert.match(blockedVariant.nodes.preflight.error!,/photo_variant_evidence_stale/);await verifySource();
    await writeFile(join(variantRoot,'layout-variant.json'),layoutBytes);
    const restoredVariant=await engine.run(variantPlan);assert.equal(restoredVariant.nodes.poster.status,'reused');await verifySource();
    await writeFile(join(root,'photo-variant-gate-receipt.json'),JSON.stringify({runtimeSha256:identities.photocraft.sha256,layout:JSON.parse(layoutBytes.toString()),layoutSha256:hash(layoutBytes),nativeProjectSha256:freshVariant.nodes.poster.outputs[0].nativeProjectRef.sha256,newVerified:true,reused:true,withoutBriefVerified:true,withoutBriefReused:true,staleCachedLayoutBlocked:true,restoredReused:true,sourcePreserved:true,leases:0},null,2));
   }

   const violated=structuredClone(resized);violated.workflowId+='-violate';violated.projectBrief.workflowId=violated.workflowId;violated.nodes[0].payload.plan.operations[0].params.width=384;
   const rejected=await engine.run(violated);assert.equal(rejected.state,'failed',JSON.stringify(rejected));assert.deepEqual(rejected.nodes[sourceNode.id].outputs,[]);assert.equal(ledger.execution(rejected.nodes[sourceNode.id].taskId!)!.exitCode,0);await verifySource();
   if(sourceNode.id==='intro'){
    await factories.effectcraft.verifyBriefExport(sourceNode,source.root,[source.artifact],briefPlan.projectBrief.deliverables[0]);
    await assert.rejects(factories.effectcraft.verifyBriefExport(sourceNode,source.root,[source.artifact],{...briefPlan.projectBrief.deliverables[0],durationSeconds:2}),/brief_export_duration_mismatch/);
    await verifySource();
   }
   let addedBoard:any;
   if(sourceNode.id==='logo'){
    const count=JSON.parse(await readFile(join(source.root,'native.json'),'utf8')).artboards.length;
    const expanded=structuredClone(briefPlan);expanded.workflowId+='-new-board';expanded.projectBrief.workflowId=expanded.workflowId;expanded.projectBrief.deliverables[0].width=352;
    expanded.nodes[0].payload.plan.operations=[operation('artboard.new',{width:352,height:256,name:'Brief Variant'})];
    expanded.nodes[0].payload.plan.exports=[{format:'png',artboard:count}];expanded.nodes[0].payload.outputs[0].location='artboard-'+(count+1)+'.png';
    addedBoard=await engine.run(expanded);assert.equal(addedBoard.state,'review_ready',JSON.stringify(addedBoard));await verifySource();
   }
   sourceDesignBriefResults[sourceNode.id]={result,replay,blocked,updated,rejected,...(addedBoard?{addedBoard}:{})};
  }
  await writeFile(join(root,'source-design-brief-receipt.json'),JSON.stringify(sourceDesignBriefResults,null,2));
  const sourceFilm=structuredClone(reopen);sourceFilm.workflowId='source-film-brief';sourceFilm.nodes=sourceFilm.nodes.filter(node=>node.id==='film');
  sourceFilm.nodes[0].payload.plan.operations=[operation('captions.setStyle',{track:'C1',font:'Arial',size:18,color:'#ff6600',background:true})];
  (sourceFilm as any).projectBrief={schema:'craft-brief/v1',workflowId:sourceFilm.workflowId,revision:'source-brief-v1',ownerId:sourceFilm.ownerId,authorizationRef:sourceFilm.authorizationRef,budget:structuredClone(sourceFilm.budget),brand:null,subjects:[],dataPolicy:{allowUpload:false},ambiguities:[],deliverables:[{id:'film',nativeFormat:'.fcproj',width:320,height:180,frameRate:{num:12,den:1},durationSeconds:1,dependsOn:[],execution:'local'}]};
  const sourceRoot=sourceFilm.nodes[0].externalInputs![0].root;
  const sourceSnapshot=async()=>{const fs=await import('node:fs/promises');const values:Record<string,string>={};const visit=async(directory:string,prefix='')=>{for(const entry of await fs.readdir(directory,{withFileTypes:true})){const name=prefix+entry.name;if(entry.isDirectory())await visit(join(directory,entry.name),name+'/');else values[name]=hash(await readFile(join(directory,entry.name)));}};await visit(sourceRoot);return values;};
  const sourceBefore=await sourceSnapshot();
  const sourceEdited=await engine.run(sourceFilm);assert.equal(sourceEdited.state,'review_ready',JSON.stringify(sourceEdited));
  assert.equal(sourceEdited.nodes.film.sourceInspection!.durationTicks,tick);
  assert.equal(sourceEdited.nodes.film.sourceInspection!.nativeProjectSha256,sourceFilm.nodes[0].expectedRevision);
  const sourceReused=await engine.run(sourceFilm);assert.equal(sourceReused.nodes.film.taskId,sourceEdited.nodes.film.taskId);
  assert.equal(sourceReused.nodes.film.status,'reused');
  assert.deepEqual(await sourceSnapshot(),sourceBefore);
  const wrongSourceBrief=structuredClone(sourceFilm);wrongSourceBrief.workflowId='source-film-wrong-size';(wrongSourceBrief as any).projectBrief.workflowId=wrongSourceBrief.workflowId;(wrongSourceBrief as any).projectBrief.deliverables[0].width=321;
  const blockedSource=await engine.run(wrongSourceBrief);assert.equal(blockedSource.state,'blocked');assert.ok(blockedSource.nodes.film.error!.includes('document_size_mismatch'));assert.equal(ledger.leases().length,0);assert.deepEqual(await sourceSnapshot(),sourceBefore);
  const sourceNative=JSON.parse(await readFile(join(sourceRoot,'native.json'),'utf8'));
  const replacedSource=structuredClone(sourceFilm);replacedSource.workflowId='source-film-replace';(replacedSource as any).projectBrief.workflowId=replacedSource.workflowId;
  const introChild=checked.children.find((child:any)=>child.nodeId==='intro')!;
  replacedSource.nodes[0].externalInputs!.push({root:introChild.root,artifact:introChild.outputs[0]});
  replacedSource.nodes[0].payload.assetBindings=[{name:'briefReplacement',assetId:introChild.outputs[0].assetId}];
  replacedSource.nodes[0].payload.plan.operations=[operation('asset.import',{asset:'briefReplacement'},'briefReplacement'),operation('clip.replaceFromBin',{clips:ref('introClip.clips'),item:ref('briefReplacement.item')})];
  const sourceReplaced=await engine.run(replacedSource);assert.equal(sourceReplaced.state,'review_ready',JSON.stringify(sourceReplaced));assert.deepEqual(await sourceSnapshot(),sourceBefore);
  const wrongDurationSource=structuredClone(sourceFilm);wrongDurationSource.workflowId='source-film-wrong-duration';(wrongDurationSource as any).projectBrief.workflowId=wrongDurationSource.workflowId;
  const moves=[...sourceNative.sequence.video,...sourceNative.sequence.audio].flatMap((track:any)=>track.items.map((clip:any)=>({clip:clip.clip,track:track.id,time:'21168000000'})));
  wrongDurationSource.nodes[0].payload.plan.operations=[operation('timeline.move',{moves,insert:false})];
  const durationRejected=await engine.run(wrongDurationSource);assert.equal(durationRejected.state,'failed',JSON.stringify(durationRejected));assert.deepEqual(durationRejected.nodes.film.outputs,[]);assert.equal(ledger.execution(durationRejected.nodes.film.taskId!)!.exitCode,0);assert.equal((durationRejected.nodes.film.failure as any).code,'artifact_invalid');assert.equal(ledger.leases().length,0);assert.deepEqual(await sourceSnapshot(),sourceBefore);
  await writeFile(join(root,'source-film-brief-receipt.json'),JSON.stringify({plan:sourceFilm,result:sourceEdited,reused:sourceReused,replaced:sourceReplaced,wrongSize:blockedSource,wrongDuration:durationRejected,sourceFiles:sourceBefore},null,2));
  if(process.env.CRAFT_KEEP_NATIVE_EVIDENCE==='1')console.log('Native mixed evidence: '+root);
 }finally{ledger.close();if(process.env.CRAFT_KEEP_NATIVE_EVIDENCE!=='1')await rm(root,{recursive:true});}
});
