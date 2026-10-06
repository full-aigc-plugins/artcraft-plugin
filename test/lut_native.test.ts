/** 真实固定领域技能与候选 Art 适配器的 LUT/运动局部返工。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {publicSkillFactory} from '../src/adapters/public_skill.ts';
import {WorkflowEngine} from '../src/planning/workflow_engine.ts';
import {TaskLedger} from '../src/harness/task_ledger.ts';
import {LocalRunner} from '../src/harness/local_runner.ts';
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const env=process.env;
test('native Effect to Film typed LUT and motion revision preserves upstream/audio/source',{skip:env.CRAFT_LUT_NATIVE!=='1'},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-lut-native-'));const ledger=new TaskLedger(join(root,'tasks.sqlite'));
 const python=env.CRAFT_PYTHON!,filmSkill=env.CRAFT_FILMCRAFT_SKILL!,effectSkill=env.CRAFT_EFFECTCRAFT_SKILL!,runtimeHome=join(root,'empty-runtime');
 const identities:any={},factories:any={},skillHashes:any={};
 const snapshot=async(path:string,prefix=''):Promise<Record<string,string>>=>{
  const result:Record<string,string>={};for(const entry of await readdir(path,{withFileTypes:true})){const relative=prefix+entry.name,full=join(path,entry.name);if(entry.isDirectory())Object.assign(result,await snapshot(full,relative+'/'));else if(entry.isFile())result[relative]=hash(await readFile(full));}return result;
 };
 try{
  for(const [domain,skill,cli,pluginVersion,cliVersion] of [['filmcraft',filmSkill,env.CRAFT_FILMCRAFT_CLI!,'0.1.0-dev.11','0.2.0-craft.2'],['effectcraft',effectSkill,env.CRAFT_EFFECTCRAFT_CLI!,'0.1.0-dev.10','0.2.0']]){
   skillHashes[domain]=await snapshot(skill);
   const files=await Promise.all(Object.keys(await snapshot(join(skill,'scripts'))).map(async name=>({path:join(skill,'scripts',name),sha256:hash(await readFile(join(skill,'scripts',name)))})));
   identities[domain]={pluginId:domain,pluginVersion,cliVersion,sha256:hash(await readFile(cli)),mode:'headless',capabilitySnapshotSha256:hash(JSON.stringify(files))};
   factories[domain]=publicSkillFactory({pluginId:domain as any,skillRoot:skill,python,pythonSha256:hash(await readFile(python)),nativeExecutable:cli,runtimeHome,files,outputRoot:join(root,'deliveries',domain)});
  }
  const voice=join(root,'voice.wav'),cube=join(root,'grade.cube');
  execFileSync(env.CRAFT_FFMPEG!,['-v','error','-f','lavfi','-i','sine=frequency=440:duration=2:sample_rate=48000','-c:a','pcm_s16le',voice]);
  await writeFile(cube,'TITLE "Swap red and green"\nLUT_3D_SIZE 2\n'+[0,1].flatMap(b=>[0,1].flatMap(g=>[0,1].map(r=>`${g} ${r} ${b}\n`))).join(''));
  const input=async(location:string,id:string,mediaType:string)=>{const bytes=await readFile(join(root,location)),digest=hash(bytes);return {root,artifact:{protocolVersion:'craft-artifact/v1',assetId:id,version:digest,sha256:digest,bytes:bytes.length,mediaType,producerTaskId:'provided',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:mediaType==='audio/wav'?{audio:{sampleRate:48000,channels:1},bitDepth:16}:{},lossReportRef:null,evidenceRefs:[],location}};};
  const voiceInput=await input('voice.wav','voice-source','audio/wav'),lutInput=await input('grade.cube','grade-source','application/octet-stream');
  const filmPlan=JSON.parse(await readFile(join(filmSkill,'examples/short-film.json'),'utf8'));const common={clip:{$ref:'shotClip.clips.0'},effect:'motion',param:'position'};
  filmPlan.operations.push({command:'effects.toggleAnimation',params:common},{command:'effects.setParam',params:{...common,value:[100,90],time:'0'}},{command:'effects.setParam',params:{...common,value:[200,90],time:'254016000000'}},{command:'lumetri.setInputLut',params:{clip:common.clip,asset:'grade'}});filmPlan.frames=['0','381024000000'];
  const plan:any={workflowId:'lut-motion-mixed',ownerId:'test',revision:'v1',authorizationRef:'lut-motion-native',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:2,maxExternalCalls:0},deadline:new Date(Date.now()+180000).toISOString(),nodes:[
   {id:'intro',dependsOn:[],projectKey:'intro',runtimeIdentity:identities.effectcraft,expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{document:{name:'Red intro',width:320,height:180,frameRate:12,duration:2},operations:[{command:'layer.newSolid',params:{name:'Red',color:'#ff0000'}}],frames:[0],exports:[{format:'mp4'}]},assetBindings:[],outputs:[{assetId:'intro-video',location:'intro.mp4',mediaType:'video/mp4'}]}},
   {id:'film',dependsOn:['intro'],inputBindings:[{from:'intro',assetId:'intro-video'}],projectKey:'film',runtimeIdentity:identities.filmcraft,expectedRevision:null,externalInputs:[voiceInput,lutInput],payload:{schemaVersion:'craft-skill-workflow/v1',plan:filmPlan,assetBindings:[{name:'shot',assetId:'intro-video'},{name:'voice',assetId:'voice-source'},{name:'grade',assetId:'grade-source',kind:'lut'}],outputs:[{assetId:'film',location:'film.mp4',mediaType:'video/mp4'}]}}]};
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async request=>assert.equal(request.authorizationRef,'lut-motion-native')),factories);
  const first=await engine.run(plan);assert.equal(first.state,'review_ready',JSON.stringify(first));
  const old=first.nodes.film.root!,original=await snapshot(old),artifact=first.nodes.film.outputs![0],manifest=JSON.parse(await readFile(join(old,'manifest.json'),'utf8'));
  assert.equal(artifact.dependencies.find((entry:any)=>entry.assetRef.assetId==='grade-source').kind,'lut');
  const before=JSON.parse(await readFile(join(old,'native.json'),'utf8')).sequence;
  const revised=structuredClone(plan);revised.revision='v2';const node=revised.nodes[1];node.expectedRevision=artifact.nativeProjectRef.sha256;
  node.externalInputs=[voiceInput,{root:old,artifact:{...lutInput.artifact,location:manifest.assets.grade.path}}, {root:old,artifact}];
  node.payload.sourceProject={assetId:'film'};node.payload.assetBindings.forEach((binding:any)=>binding.retained=true);
  node.payload.plan={operations:[{command:'effects.setParam',params:{...common,value:[260,90],time:'254016000000'}}],frames:['0','381024000000'],export:{audioRequired:true}};
  await rm(cube); // 后续返工只消费旧包的已核验 LUT，不读取原文件。
  const second=await engine.run(revised);assert.equal(second.state,'review_ready',JSON.stringify(second));assert.equal(second.nodes.intro.taskId,first.nodes.intro.taskId);assert.notEqual(second.nodes.film.taskId,first.nodes.film.taskId);
  const changed=second.nodes.film.root!,after=JSON.parse(await readFile(join(changed,'native.json'),'utf8')).sequence;
  assert.deepEqual(before.audio,after.audio);assert.equal(hash(await readFile(join(old,'captions.json'))),hash(await readFile(join(changed,'captions.json'))));
  const oldEffects=before.video[0].items[0].effects,newEffects=after.video[0].items[0].effects;
  assert.deepEqual(oldEffects.find((effect:any)=>effect.effect==='lumetri'),newEffects.find((effect:any)=>effect.effect==='lumetri'));
  assert.equal(newEffects.find((effect:any)=>effect.effect==='motion').params.position.keyframes,2);
  const decoded=(path:string)=>execFileSync(env.CRAFT_FFMPEG!,['-v','error','-i',path,'-frames:v','24','-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:16*1024*1024});
  const initial=decoded(join(old,'film.mp4')),final=decoded(join(changed,'film.mp4'));assert.equal(final.length,24*320*180*3);assert.notEqual(hash(initial),hash(final));
  const offset=18*320*180*3+(20*320+160)*3,pixel=[...final.subarray(offset,offset+3)];assert.ok(pixel[1]>180&&pixel[0]<35,JSON.stringify(pixel));
  const audio=(path:string)=>execFileSync(env.CRAFT_FFMPEG!,['-v','error','-i',path,'-map','0:a:0','-f','s16le','-']);assert.equal(hash(audio(join(old,'film.mp4'))),hash(audio(join(changed,'film.mp4'))));
  const repeat=await engine.run(revised);assert.deepEqual(repeat.budget,second.budget);assert.equal(repeat.nodes.film.taskId,second.nodes.film.taskId);
  assert.deepEqual(await snapshot(old),original);assert.deepEqual(await snapshot(filmSkill),skillHashes.filmcraft);assert.deepEqual(await snapshot(effectSkill),skillHashes.effectcraft);
  if(env.CRAFT_LUT_NATIVE_EVIDENCE)await writeFile(env.CRAFT_LUT_NATIVE_EVIDENCE,JSON.stringify({schema:'artcraft-lut-motion-native-candidate/v1',result:'PASS',scope:'candidate Art adapter with installed fixed Film dev.11 and Effect dev.10; two-domain native workflow; not fixed Art runtime or full creative acceptance',runtimeIdentities:identities,independentlyDecodedFrames:24,lutPixel:pixel,lutDependencyTyped:true,originalLutRemoved:true,sourcePreserved:true,decodedAudioPreserved:true,captionsPreserved:true,nonTargetLutPreserved:true,upstreamTaskReused:true,repeatTasksAndBudgetPreserved:true,installedSkillFilesPreserved:true,initialTaskIds:Object.fromEntries(Object.entries(first.nodes).map(([id,value]:any)=>[id,value.taskId])),revisedTaskIds:Object.fromEntries(Object.entries(second.nodes).map(([id,value]:any)=>[id,value.taskId])),adapterSha256:hash(await readFile(new URL('../src/adapters/public_skill.ts',import.meta.url))),driverSha256:hash(await readFile(new URL('./lut_native.test.ts',import.meta.url)))},null,2)+'\n',{flag:'wx'});
 }finally{ledger.close();await rm(root,{recursive:true,force:true});}
});
