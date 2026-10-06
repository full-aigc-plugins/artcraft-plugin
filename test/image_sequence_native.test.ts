/** 公开领域技能的真实序列交接；候选 Art 实现，不替代固定 Art 安装验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { publicSkillFactory } from '../src/adapters/public_skill.ts';
import { imageSequenceMime } from '../src/protocol/image_sequence.ts';
import { verifyArtifact } from '../src/protocol/contracts.ts';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { WorkflowEngine } from '../src/planning/workflow_engine.ts';
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const native=promisify(execFile);
const enabled=process.env.CRAFT_ART_SEQUENCE_NATIVE==='1';
test('candidate Art executes Effect sequence to Film and moved-project selective text revision',{skip:!enabled},async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-sequence-native-')),ledger=new TaskLedger(join(root,'ledger.sqlite'));
 try{
  const python=process.env.CRAFT_SEQUENCE_PYTHON!,identities:any={},factories:any={};
  for(const domain of ['effectcraft','filmcraft'] as const){
   const skillRoot=process.env[domain==='effectcraft'?'CRAFT_SEQUENCE_EFFECT_SKILL':'CRAFT_SEQUENCE_FILM_SKILL']!,cli=process.env[domain==='effectcraft'?'CRAFT_SEQUENCE_EFFECT_CLI':'CRAFT_SEQUENCE_FILM_CLI']!;
   const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py'].map(async name=>({path:join(skillRoot,'scripts',name),sha256:hash(await readFile(join(skillRoot,'scripts',name)))})));
   identities[domain]={pluginId:domain,pluginVersion:'0.1.0',cliVersion:domain==='filmcraft'?'0.2.0-craft.2':'0.2.0',sha256:hash(await readFile(cli)),mode:'headless',capabilitySnapshotSha256:hash(JSON.stringify(files))};
   factories[domain]=publicSkillFactory({pluginId:domain,skillRoot,python,pythonSha256:hash(await readFile(python)),nativeExecutable:cli,runtimeHome:dirname(dirname(dirname(cli))),files,outputRoot:join(root,domain)});
  }
  const effectSkill=process.env.CRAFT_SEQUENCE_EFFECT_SKILL!,effectPlan=JSON.parse(await readFile(join(effectSkill,'examples/brand-intro.json'),'utf8'));effectPlan.exports=[{format:'png-sequence'}];
  // 生成背景只使用独立 Pillow；不导入领域技能私有模块。
  await native(python,['-I','-B','-c',"from PIL import Image; import sys; Image.new('RGB',(320,180),(0,128,0)).save(sys.argv[1])",join(root,'background.png')]);
  const bytes=await readFile(join(root,'background.png')),digest=hash(bytes);
  const background={root,artifact:{protocolVersion:'craft-artifact/v1',assetId:'background',version:digest,sha256:digest,bytes:bytes.length,mediaType:'image/png',producerTaskId:'provided',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{width:320,height:180,bitDepth:8,alpha:false},lossReportRef:null,evidenceRefs:[],location:'background.png'}};
  const ticks='254016000000',half='127008000000';
  const plan:any={workflowId:'sequence-candidate',ownerId:'test',revision:'v1',authorizationRef:'native-test',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:2,maxExternalCalls:0},deadline:new Date(Date.now()+120000).toISOString(),nodes:[
   {id:'intro',dependsOn:[],projectKey:'intro',runtimeIdentity:identities.effectcraft,expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:effectPlan,assetBindings:[],outputs:[{assetId:'intro',location:'rgba-sequence/sequence.json',mediaType:imageSequenceMime}]}},
   {id:'film',dependsOn:['intro'],projectKey:'film',runtimeIdentity:identities.filmcraft,expectedRevision:null,externalInputs:[background],payload:{schemaVersion:'craft-skill-workflow/v1',plan:{document:{name:'Art dynamic handoff',width:320,height:180,frameRate:{num:12,den:1}},operations:[{command:'asset.import',params:{asset:'background'},as:'background'},{command:'asset.import',params:{asset:'intro'},as:'overlay'},{command:'timeline.place',params:{item:{'$ref':'background.item'},track:'V1',duration:ticks,insert:false}},{command:'timeline.place',params:{item:{'$ref':'overlay.item'},track:'V2',duration:ticks,insert:false},as:'overlayClip'}],frames:['0',half],export:{audioRequired:false}},assetBindings:[{name:'background',assetId:'background'},{name:'intro',assetId:'intro'}],outputs:[{assetId:'film',location:'film.mp4',mediaType:'video/mp4'}]}}
  ]};
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),factories),first=await engine.run(plan);
  assert.equal(first.state,'review_ready',JSON.stringify(first));
  const effect=first.nodes.intro,film=first.nodes.film,sequence=effect.outputs![0];
  assert.equal(sequence.technicalMetadata.durationTicks,'12');assert.equal(sequence.evidenceRefs.filter((ref:any)=>ref.location.includes('/frame_')).length,12);
  assert.equal(film.outputs![0].evidenceRefs.filter((ref:any)=>ref.location.includes('/frame_')).length,12);
  const filmManifest=JSON.parse(await readFile(join(film.root!,'manifest.json'),'utf8'));
  assert.equal(filmManifest.assets.intro.probe.kind,'ImageSequence');
  const decoded=await native('ffmpeg',['-v','error','-i',join(film.root!,'film.mp4'),'-f','rawvideo','-pix_fmt','rgb24','-'],{encoding:'buffer',maxBuffer:16*1024*1024});assert.equal(decoded.stdout.length,12*320*180*3);
  await writeFile(join(root,'decoded.rgb'),decoded.stdout);
  await native(python,['-I','-B','-c',"from PIL import Image; import sys; from pathlib import Path; root=Path(sys.argv[1]); raw=Path(sys.argv[2]).read_bytes(); checks=0\nfor i in (0,6,11):\n overlay=Image.open(root/'rgba-sequence'/f'frame_{i:05d}.png'); expected=Image.alpha_composite(Image.new('RGBA',(320,180),(0,128,0,255)),overlay).convert('RGB')\n for x,y in ((10,10),(60,85)):\n  offset=(i*320*180+y*320+x)*3; assert max(abs(a-b) for a,b in zip(raw[offset:offset+3],expected.getpixel((x,y))))<=20; checks+=1\nassert checks==6",effect.root!,join(root,'decoded.rgb')]);
  const moved=join(root,'moved-film');await rename(film.root!,moved);await verifyArtifact(film.outputs![0],moved);
  const before=new Map(await Promise.all(Object.keys(filmManifest.files).map(async name=>[name,hash(await readFile(join(moved,name)))] as const)));
  const revision=structuredClone(plan);revision.revision='v2';revision.nodes[0].expectedRevision=sequence.nativeProjectRef.sha256;revision.nodes[0].externalInputs=[{root:effect.root,artifact:sequence}];
  revision.nodes[0].payload={schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:'intro'},plan:{operations:[{command:'layer.setText',params:{layer:{'$ref':'title.layer'},text:'NOVA PLUS'}}],frames:[0,.5],exports:[{format:'png-sequence'}]},assetBindings:[],outputs:plan.nodes[0].payload.outputs};
  await rm(join(root,'background.png'));
  const retainedBackground={root:moved,artifact:{...background.artifact,location:filmManifest.assets.background.path}};
  revision.nodes[1].expectedRevision=film.outputs![0].nativeProjectRef.sha256;revision.nodes[1].externalInputs=[retainedBackground,{root:moved,artifact:film.outputs![0]}];
  revision.nodes[1].payload={schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:'film'},plan:{operations:[{command:'asset.import',params:{asset:'replacement'},as:'replacement'},{command:'clip.replaceFromBin',params:{clips:{'$ref':'overlayClip.clips'},item:{'$ref':'replacement.item'}}}],frames:['0',half],export:{audioRequired:false}},assetBindings:[{name:'replacement',assetId:'intro'},{name:'background',assetId:'background',retained:true}],outputs:plan.nodes[1].payload.outputs};
  const second=await engine.run(revision);assert.equal(second.state,'review_ready',JSON.stringify(second));
  const after=JSON.parse(await readFile(join(second.nodes.film.root!,'manifest.json'),'utf8'));
  assert.equal(after.assets.background.sha256,filmManifest.assets.background.sha256);assert.equal(after.files['frame-0000.png'],filmManifest.files['frame-0000.png']);assert.notEqual(after.files['frame-0001.png'],filmManifest.files['frame-0001.png']);
  for(const [name,digest] of before)assert.equal(hash(await readFile(join(moved,name))),digest);
  const tampered=join(second.nodes.intro.root!,'rgba-sequence/frame_00006.png');await writeFile(tampered,'corrupt');await assert.rejects(verifyArtifact(second.nodes.intro.outputs![0],second.nodes.intro.root!),/image_sequence_/);
  const blocked=await engine.run(revision);assert.equal(blocked.state,'blocked');assert.match(blocked.nodes.preflight.error!,/image_sequence_/);
 }finally{ledger.close();await rm(root,{recursive:true});}
});
