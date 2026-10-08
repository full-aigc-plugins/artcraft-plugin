import {lockNativeSchema} from './fixtures/native_schema_lock.ts';
/** 公开领域技能的真实序列交接；候选 Art 实现，不替代固定 Art 安装验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, rename, readdir, mkdir } from 'node:fs/promises';
import { join, dirname, relative } from 'node:path';
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
const enabled=process.env.CRAFT_ART_SEGMENT_HD_NATIVE==='1';
test('candidate Art executes HD segmented sequence, moved selective text revision and corruption recovery',{skip:!enabled},async()=>{
 const retained=process.env.CRAFT_ART_SEGMENT_HD_ROOT;
 const root=retained ?? await mkdtemp(join(tmpdir(),'art-sequence-hd-native-'));
 if(retained)await mkdir(root,{recursive:false});
 const ledger=new TaskLedger(join(root,'ledger.sqlite'));
 try{
  assert.ok(process.env.CRAFT_SEQUENCE_IDENTITIES,'native acceptance requires identity records from a fixed installation receipt');
  const installedIdentities=JSON.parse(await readFile(process.env.CRAFT_SEQUENCE_IDENTITIES!,'utf8'));
  const python=process.env.CRAFT_SEQUENCE_PYTHON!,identities:any={},factories:any={},sourceSkills:any={},skillFiles:{path:string;sha256:string}[]=[];
  for(const domain of ['effectcraft','filmcraft'] as const){
   const skillRoot=process.env[domain==='effectcraft'?'CRAFT_SEQUENCE_EFFECT_SKILL':'CRAFT_SEQUENCE_FILM_SKILL']!,cli=process.env[domain==='effectcraft'?'CRAFT_SEQUENCE_EFFECT_CLI':'CRAFT_SEQUENCE_FILM_CLI']!;
   const walk=async(folder:string):Promise<string[]>=>{const paths:string[]=[];for(const entry of await readdir(folder,{withFileTypes:true})){if(entry.name==='__pycache__')continue;const path=join(folder,entry.name);if(entry.isDirectory())paths.push(...await walk(path));else if(entry.isFile())paths.push(path);}return paths;};
   const files=await Promise.all((await walk(skillRoot)).map(async path=>({path,sha256:hash(await readFile(path))})));
   await lockNativeSchema(files);
   skillFiles.push(...files);
   sourceSkills[domain]=Object.fromEntries(files.map(file=>[relative(skillRoot,file.path),file.sha256]));
   identities[domain]=installedIdentities[domain];
   assert.equal(identities[domain]?.pluginId,domain);
   assert.equal(identities[domain]?.sha256,hash(await readFile(cli)));
   assert.equal(identities[domain]?.mode,'headless');
   factories[domain]=publicSkillFactory({pluginId:domain,skillRoot,python,pythonSha256:hash(await readFile(python)),nativeExecutable:cli,runtimeHome:dirname(dirname(dirname(cli))),files,outputRoot:join(root,domain)});
  }
  const effectSkill=process.env.CRAFT_SEQUENCE_EFFECT_SKILL!,effectPlan=JSON.parse(await readFile(join(effectSkill,'examples/brand-intro.json'),'utf8'));effectPlan.document={...effectPlan.document,width:1920,height:1080,frameRate:24,duration:5};effectPlan.frames=[0,.5];effectPlan.exports=[{format:'png-segmented',chunkFrames:32}];
  // 生成背景只使用独立 Pillow；不导入领域技能私有模块。
  await native(python,['-I','-B','-c',"from PIL import Image; import sys; Image.new('RGB',(1920,1080),(0,128,0)).save(sys.argv[1])",join(root,'background.png')]);
  const bytes=await readFile(join(root,'background.png')),digest=hash(bytes);
  const background={root,artifact:{protocolVersion:'craft-artifact/v1',assetId:'background',version:digest,sha256:digest,bytes:bytes.length,mediaType:'image/png',producerTaskId:'provided',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{width:1920,height:1080,bitDepth:8,alpha:false},lossReportRef:null,evidenceRefs:[],location:'background.png'}};
  const ticks='1270080000000',half='127008000000';
  const plan:any={workflowId:'sequence-candidate',ownerId:'test',revision:'v1',authorizationRef:'native-test',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:2,maxExternalCalls:0},deadline:new Date(Date.now()+600000).toISOString(),nodes:[
   {id:'intro',dependsOn:[],projectKey:'intro',runtimeIdentity:identities.effectcraft,expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:effectPlan,assetBindings:[],outputs:[{assetId:'intro',location:'rgba-segments/segments.json',mediaType:imageSequenceMime}]}},
   {id:'film',dependsOn:['intro'],projectKey:'film',runtimeIdentity:identities.filmcraft,expectedRevision:null,externalInputs:[background],payload:{schemaVersion:'craft-skill-workflow/v1',plan:{document:{name:'Art dynamic handoff',width:1920,height:1080,frameRate:{num:24,den:1}},operations:[{command:'asset.import',params:{asset:'background'},as:'background'},{command:'asset.import',params:{asset:'intro'},as:'overlay'},{command:'timeline.place',params:{item:{'$ref':'background.item'},track:'V1',duration:ticks,insert:false}},{command:'timeline.place',params:{item:{'$ref':'overlay.item'},track:'V2',duration:ticks,insert:false},as:'overlayClip'}],frames:['0',half],export:{audioRequired:false}},assetBindings:[{name:'background',assetId:'background'},{name:'intro',assetId:'intro'}],outputs:[{assetId:'film',location:'film.mp4',mediaType:'video/mp4'}]}}
  ]};
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),factories),first=await engine.run(plan);
  assert.equal(first.state,'review_ready',JSON.stringify(first));
  const effect=first.nodes.intro,film=first.nodes.film,sequence=effect.outputs![0];
  assert.equal(sequence.technicalMetadata.durationTicks,'120');assert.equal(sequence.evidenceRefs.filter((ref:any)=>ref.location.includes('/frame_')).length,120);
  assert.equal(film.outputs![0].evidenceRefs.filter((ref:any)=>ref.location.includes('/frame_')).length,120);
  const filmManifest=JSON.parse(await readFile(join(film.root!,'manifest.json'),'utf8'));
  assert.equal(filmManifest.assets.intro.probe.kind,'ImageSequence');
  const probe=JSON.parse((await native('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=width,height,avg_frame_rate,duration,nb_read_frames','-of','json',join(film.root!,'film.mp4')])).stdout).streams[0];
  assert.deepEqual([probe.width,probe.height,probe.avg_frame_rate,probe.nb_read_frames],[1920,1080,'24/1','120']);assert.ok(Math.abs(Number(probe.duration)-5)<1/24);
  await native('ffmpeg',['-v','error','-i',join(film.root!,'film.mp4'),'-f','rawvideo','-pix_fmt','rgb24',join(root,'decoded.rgb')]);
  const oracle=`from PIL import Image
import sys, json, hashlib
from pathlib import Path
root=Path(sys.argv[1]); raw=Path(sys.argv[2]); assert raw.stat().st_size==120*1920*1080*3
verified=0
for manifest in sorted((root/'rgba-segments').glob('segment_*/sequence.json')):
 data=json.loads(manifest.read_text())
 for frame in data['frames']:
  path=manifest.parent/frame['location']; assert hashlib.sha256(path.read_bytes()).hexdigest()==frame['sha256']
  with Image.open(path) as image:
   image.load(); assert image.mode=='RGBA' and image.size==(1920,1080)
   assert hashlib.sha256(image.tobytes()).hexdigest()==frame['rgbaSha256']; assert list(image.getchannel('A').getextrema())==frame['alphaExtrema']
  verified+=1
assert verified==120
checks=0
with raw.open('rb') as stream:
 for i in (0,60,119):
  with Image.open(root/'rgba-segments'/f'segment_{i//32:05d}'/f'frame_{i%32:05d}.png') as overlay:
   expected=Image.alpha_composite(Image.new('RGBA',(1920,1080),(0,128,0,255)),overlay).convert('RGB')
   for x,y in ((10,10),(60,85)):
    stream.seek((i*1920*1080+y*1920+x)*3); actual=tuple(stream.read(3))
    assert max(abs(a-b) for a,b in zip(actual,expected.getpixel((x,y))))<=20; checks+=1
 with Image.open(root/'rgba-segments/segment_00000/frame_00000.png') as first, Image.open(root/'rgba-segments/segment_00001/frame_00028.png') as later:
  first.load();later.load(); found=None
  for y in range(70,110):
   for x in range(100,240):
    if first.getpixel((x,y))[3]==0 and later.getpixel((x,y))[3]==255:found=(x,y);break
   if found:break
  assert found is not None
  x,y=found;actuals=[]
  for i,image in ((0,first),(60,later)):
   expected=Image.alpha_composite(Image.new('RGBA',(1920,1080),(0,128,0,255)),image).convert('RGB').getpixel((x,y))
   stream.seek((i*1920*1080+y*1920+x)*3); actual=tuple(stream.read(3));actuals.append(actual)
   assert max(abs(a-b) for a,b in zip(actual,expected))<=20;checks+=1
  assert max(abs(a-b) for a,b in zip(*actuals))>40
assert checks==8
`;
  await native(python,['-I','-B','-c',oracle,effect.root!,join(root,'decoded.rgb')]);
  const moved=join(root,'moved-film');await rename(film.root!,moved);await verifyArtifact(film.outputs![0],moved);
  const before=new Map(await Promise.all(Object.keys(filmManifest.files).map(async name=>[name,hash(await readFile(join(moved,name)))] as const)));
  const revision=structuredClone(plan);revision.revision='v2';revision.nodes[0].expectedRevision=sequence.nativeProjectRef.sha256;revision.nodes[0].externalInputs=[{root:effect.root,artifact:sequence}];
  revision.nodes[0].payload={schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:'intro'},plan:{operations:[{command:'layer.setText',params:{layer:{'$ref':'title.layer'},text:'NOVA PLUS'}}],frames:[0,.5],exports:[{format:'png-segmented',chunkFrames:32}]},assetBindings:[],outputs:plan.nodes[0].payload.outputs};
  await rm(join(root,'background.png'));
  const retainedBackground={root:moved,artifact:{...background.artifact,location:filmManifest.assets.background.path}};
  revision.nodes[1].expectedRevision=film.outputs![0].nativeProjectRef.sha256;revision.nodes[1].externalInputs=[retainedBackground,{root:moved,artifact:film.outputs![0]}];
  revision.nodes[1].payload={schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:'film'},plan:{operations:[{command:'asset.import',params:{asset:'replacement'},as:'replacement'},{command:'clip.replaceFromBin',params:{clips:{'$ref':'overlayClip.clips'},item:{'$ref':'replacement.item'}}}],frames:['0',half],export:{audioRequired:false}},assetBindings:[{name:'replacement',assetId:'intro'},{name:'background',assetId:'background',retained:true}],outputs:plan.nodes[1].payload.outputs};
  const second=await engine.run(revision);assert.equal(second.state,'review_ready',JSON.stringify(second));
  const after=JSON.parse(await readFile(join(second.nodes.film.root!,'manifest.json'),'utf8'));
  assert.equal(after.assets.background.sha256,filmManifest.assets.background.sha256);assert.equal(after.files['frame-0000.png'],filmManifest.files['frame-0000.png']);assert.notEqual(after.files['frame-0001.png'],filmManifest.files['frame-0001.png']);
  for(const [name,digest] of before)assert.equal(hash(await readFile(join(moved,name))),digest);
  const tampered=join(second.nodes.intro.root!,'rgba-segments/segment_00001/frame_00002.png'),original=await readFile(tampered);await writeFile(tampered,'corrupt');await assert.rejects(verifyArtifact(second.nodes.intro.outputs![0],second.nodes.intro.root!),/image_sequence_/);
  const blocked=await engine.run(revision);assert.equal(blocked.state,'blocked');assert.match(blocked.nodes.preflight.error!,/image_sequence_/);
  await writeFile(tampered,original);const restored=await engine.run(revision);assert.equal(restored.state,'review_ready',JSON.stringify(restored));
  for(const id of ['intro','film'])assert.equal(restored.nodes[id].taskId,second.nodes[id].taskId);assert.deepEqual(restored.budget,second.budget);
  for(const file of skillFiles)assert.equal(hash(await readFile(file.path)),file.sha256);
  if(process.env.CRAFT_ART_SEGMENT_HD_EVIDENCE)await writeFile(process.env.CRAFT_ART_SEGMENT_HD_EVIDENCE,JSON.stringify({schema:'artcraft-segment-hd-adapter-candidate/v1',result:'PASS',driverSha256:hash(await readFile(new URL(import.meta.url))),runtimeIdentities:identities,sourceSkills,sourceFilesPreserved:true,width:1920,height:1080,fps:24,seconds:5,frameCount:120,segmentCount:4,independentDecodedFrames:120,independentSourceFrames:120,animatedTitlePixelVerified:true,compositePixelChecks:8,independentVideoProbe:probe,movedFilmTextRevision:true,backgroundAndInitialFramePreserved:true,corruptSegmentBlockedAndRestored:true,restoredTaskIdsReused:true,budgetUnchangedOnRestore:true,scope:'actual candidate Art HD runtime adapters and current independent domain source; existing verified local native runtime',excluded:['public cold Art installation','immutable new plugin','full V1','GUI/model/creative acceptance']},null,2)+'\n');
 }finally{ledger.close();if(!retained)await rm(root,{recursive:true});}
});
