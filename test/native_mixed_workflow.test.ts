/** 四个独立技能公开脚本的真实交接；程序化品牌样本仅证明功能。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
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
   const nativeExecutable=join(runtimeHome!,pluginId,'0.2.0',pluginId+'-cli');
   const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json'].map(async name=>({path:join(skillRoot,'scripts',name),sha256:hash(await readFile(join(skillRoot,'scripts',name)))})));
   configs[pluginId]={pluginId,skillRoot,python,pythonSha256:pythonHash,nativeExecutable,runtimeHome:runtimeHome!,files,outputRoot:join(root,'deliveries')};
   factories[pluginId]=publicSkillFactory(configs[pluginId]);
   identities[pluginId]={pluginId,pluginVersion:'0.1.0',cliVersion:'0.2.0',sha256:hash(await readFile(nativeExecutable)),mode:'headless',capabilitySnapshotSha256:hash(JSON.stringify(files))};
  }
  const voice=join(root,'voice.wav');await writeFile(voice,narration());const voiceHash=hash(await readFile(voice));
  const voiceInput={root,artifact:{protocolVersion:'craft-artifact/v1',assetId:'voice',version:'v1',sha256:voiceHash,bytes:(await readFile(voice)).length,mediaType:'application/octet-stream',producerTaskId:'provided-voice',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{audio:{sampleRate:48000,channels:1}},lossReportRef:null,evidenceRefs:[],location:'voice.wav'}};
  const vectorPlan=JSON.parse(await readFile(join(skillsRoot!,'vectorcraft-skills/skills/vectorcraft-use/examples/brand-assets.json'),'utf8'));
  vectorPlan.exports=[{format:'png',artboard:0},{format:'svg',artboard:0}];
  const payload=(plan:Record<string,any>,assetBindings:{name:string;assetId:string}[],assetId:string,location:string,mediaType:string)=>({schemaVersion:'craft-skill-workflow/v1',plan,assetBindings,outputs:[{assetId,location,mediaType}]});
  const node=(id:string,plugin:string,dependsOn:string[],payload:Record<string,any>)=>({id,dependsOn,projectKey:id+'-project',runtimeIdentity:identities[plugin],expectedRevision:null,payload});
  const plan={workflowId:'native-brand-campaign',ownerId:'test',revision:'v1',authorizationRef:'mixed-test-scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+180000).toISOString(),nodes:[
   node('logo','vectorcraft',[],payload(vectorPlan,[],'logo-png','artboard-1.png','image/png')),
   node('poster','photocraft',['logo'],payload({document:{name:'NOVA brand poster',width:320,height:400,background:'#faf4e8'},minimumLayers:3,operations:[operation('asset.place',{asset:'logo',center:[160,210],name:'Logo'},'logo'),operation('type.create',{x:28,y:60,text:'NOVA',name:'Headline',font:'Arial',size:30,color:'#192a3b'},'title')],exports:[{format:'png'},{format:'psd'}]},[{name:'logo',assetId:'logo-png'}],'poster-png','design.png','image/png')),
   node('intro','effectcraft',['logo'],payload({document:{name:'NOVA intro',width:320,height:180,frameRate:12,duration:1},operations:[operation('asset.import',{asset:'logo'},'logo'),operation('layer.addItem',{item:ref('logo.item'),duration:1},'logoLayer'),operation('prop.addKey',{layer:ref('logoLayer.layer'),path:'transform/opacity',time:0,value:0}),operation('prop.addKey',{layer:ref('logoLayer.layer'),path:'transform/opacity',time:.5,value:100})],frames:[0,.5],exports:[{format:'mp4'}]},[{name:'logo',assetId:'logo-png'}],'intro-video','intro.mp4','video/mp4')),
   {...node('film','filmcraft',['intro'],payload({document:{name:'NOVA campaign',width:320,height:180,frameRate:{num:12,den:1}},operations:[operation('asset.import',{asset:'intro'},'intro'),operation('asset.import',{asset:'voice'},'voice'),operation('timeline.place',{item:ref('intro.item'),track:'V1',time:'0',sourceIn:'0',duration:tick,insert:false}),operation('timeline.place',{item:ref('voice.item'),track:'A1',audioTrack:'A1',time:'0',sourceIn:'0',duration:tick,insert:false}),operation('captions.newTrack',{format:'Subtitle',name:'Brand subtitle',language:'en'}),operation('captions.setStyle',{track:'C1',font:'Arial',size:18,color:'#ffffff',background:true}),operation('caption.add',{track:'C1',text:'NOVA essentials',startTicks:'0',durationTicks:tick})],frames:['127008000000'],export:{audioRequired:true}},[{name:'intro',assetId:'intro-video'},{name:'voice',assetId:'voice'}],'film-video','film.mp4','video/mp4')),externalInputs:[voiceInput]}
  ]};
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
  const registry=join(root,'registry.json'),planFile=join(root,'workflow.json');
  await writeFile(registry,JSON.stringify({schemaVersion:'craft-skill-registry/v1',plugins:Object.fromEntries(Object.keys(configs).map(id=>[id,{config:configs[id],runtimeIdentity:identities[id]}]))}));
  await writeFile(planFile,JSON.stringify(changed));
  const runtimeNode=process.env.CRAFT_ARTCRAFT_NODE ?? process.execPath,cli=new URL('../src/cli.ts',import.meta.url).pathname;
  const cliResult=JSON.parse((await exec(runtimeNode,[cli,'run','--database',join(root,'tasks.sqlite'),'--registry',registry,'--plan',planFile,'--owner','test','--authorization','mixed-test-scope'])).stdout);
  assert.equal(cliResult.state,'review_ready');
  for(const id of ['logo','poster','intro','film'])assert.equal(cliResult.nodes[id].taskId,second.nodes[id].taskId);
  const cliStatus=JSON.parse((await exec(runtimeNode,[cli,'status','--database',join(root,'tasks.sqlite')])).stdout);
  assert.equal(cliStatus.tasks.length,8);assert.equal(cliStatus.leases.length,0);
  await writeFile(join(root,'cli-result.json'),JSON.stringify(cliResult,null,2));
  if(process.env.CRAFT_KEEP_NATIVE_EVIDENCE==='1')console.log('Native mixed evidence: '+root);
 }finally{ledger.close();if(process.env.CRAFT_KEEP_NATIVE_EVIDENCE!=='1')await rm(root,{recursive:true});}
});
