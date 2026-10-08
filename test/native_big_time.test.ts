/** 使用固定原生 CLI 验证大整数保存、逐帧修改与可信源检查；不渲染整条长时间线。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { publicSkillFactory } from '../src/adapters/public_skill.ts';
import { parseFilmSourceInspection } from '../src/adapters/film_source_inspection.ts';

const cli=process.env.CRAFT_FILM_NATIVE_EXECUTABLE;
const skill=process.env.CRAFT_FILM_SKILL_ROOT;
const output=process.env.CRAFT_NATIVE_BIG_TIME_ROOT;
const hash=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');

test('native Film large ticks survive reopen, one-frame trim and trusted Art source handoff',{
 skip:!cli||!skill||!output,
},async()=>{
 const root=resolve(output!);await mkdir(root,{recursive:true});
 const files:{path:string;sha256:string}[]=[];
 async function snapshot(directory:string):Promise<void>{
  for(const item of await readdir(directory,{withFileTypes:true})){
   const path=join(directory,item.name);
   if(item.isDirectory())await snapshot(path);
   else if(item.isFile())files.push({path,sha256:hash(await readFile(path))});
   else throw new Error('native_test_skill_link_rejected');
  }
 }
 await snapshot(resolve(skill!));
 const nativeSha=hash(await readFile(cli!));
 const calls:any[]=[];
 async function invoke(args:string[],label:string){
  const stdout=execFileSync(cli!,args,{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
  await writeFile(join(root,label+'.json'),stdout);
  calls.push({args,stdoutSha256:hash(stdout)});
  return {stdout,value:JSON.parse(stdout)};
 }
 const created=join(root,'created.fcproj');
 await invoke(['--save-as',created,'exec','file.newSequence',JSON.stringify({name:'Exact ticks',width:320,height:180,fps:12})],'create');
 const matte=await invoke(['--project',created,'--save','exec','file.newColorMatte',JSON.stringify({color:'#ff0000',seconds:1})],'matte');
 const frame=254016000000n/12n,start=9007199254740993n;
 const placed=join(root,'placed.fcproj');
 // 原生 JSON 接收整数；拼接经过 BigInt 限定的 token，禁止先转 Number。
 const placement=`{"item":${matte.value.item},"track":"V1","time":${start},"duration":${frame},"insert":false}`;
 const placedResult=await invoke(['--project',created,'--save-as',placed,'exec','timeline.place',placement],'placement');
 const initial=await invoke(['--project',placed,'inspect'],'initial-inspection');
 function exact(stdout:string){
  return JSON.parse(stdout,(key,value,context:any)=>['duration','start','sourceIn'].includes(key)&&typeof value==='number'?context.source:value);
 }
 const parsed=exact(initial.stdout);
 assert.equal(parsed.sequence.duration,String(start+frame));
 assert.equal(parsed.sequence.video[0].items[0].start,String(start));
 assert.equal(parsed.sequence.video[0].items[0].duration,String(frame));
 assert.notEqual(BigInt(JSON.parse(initial.stdout).sequence.duration),start+frame);
 const initialSha=hash(await readFile(placed));
 const edited=join(root,'edited.fcproj');
 await invoke(['--project',placed,'--save-as',edited,'exec','timeline.trim',JSON.stringify({clip:placedResult.value.clips[0],edge:'out',mode:'regular',deltaFrames:1})],'trim');
 assert.equal(hash(await readFile(placed)),initialSha);
 const reopened=await invoke(['--project',edited,'inspect'],'edited-inspection');
 const changed=exact(reopened.stdout);
 assert.equal(changed.sequence.duration,String(start+2n*frame));
 assert.equal(changed.sequence.video[0].items[0].start,String(start));
 assert.equal(changed.sequence.video[0].items[0].duration,String(2n*frame));
 const source=join(root,'source');await mkdir(source,{recursive:true});
 const bytes=await readFile(edited),digest=hash(bytes);
 await writeFile(join(source,'project.fcproj'),bytes);
 // 包装本次 CLI 生成的真实工程；不是领域 workflow 的完整渲染交付证明。
 const manifest=JSON.stringify({schema:'filmcraft-delivery/v1',runtimeSha256:nativeSha,files:{'project.fcproj':digest},assets:{},bindings:{}});
 await writeFile(join(source,'manifest.json'),manifest);
 const reference={assetId:'native',version:digest,sha256:digest,location:'project.fcproj'};
 const artifact={protocolVersion:'craft-artifact/v1',assetId:'source',version:digest,sha256:digest,bytes:bytes.length,mediaType:'application/octet-stream',producerTaskId:'native-big-time',sourceRefs:[],nativeProjectRef:reference,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[{assetId:'manifest',version:hash(manifest),sha256:hash(manifest),location:'manifest.json'}],location:'project.fcproj'};
 const factory=publicSkillFactory({pluginId:'filmcraft',skillRoot:resolve(skill!),python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:resolve(cli!),runtimeHome:root,files,outputRoot:join(root,'handoff')});
 const node:any={id:'film',dependsOn:[],projectKey:'film',runtimeIdentity:{pluginId:'filmcraft',sha256:nativeSha},expectedRevision:digest,payload:{schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:'source'},plan:{operations:[]},assetBindings:[],outputs:[{assetId:'new-film',location:'film.mp4',mediaType:'video/mp4'}]}};
 const made=await factory(node,[{root:source,artifact}] as any,'inspect-big-time');
 const inspection=await made.adapter.inspectSource!();
 assert.equal(inspection.durationTicks,String(start+2n*frame));
 assert.equal(inspection.nativeProjectSha256,digest);
 assert.equal(inspection.nativeRuntimeSha256,nativeSha);
 assert.equal(inspection.nativeInspectionSha256,hash(execFileSync(cli!,['--project',join(source,'project.fcproj'),'inspect'])));
 assert.deepEqual(JSON.parse(JSON.stringify(inspection)),inspection);
 assert.equal((BigInt(inspection.durationTicks!)-start)/frame,2n);
 assert.equal((BigInt(inspection.durationTicks!)-start)%frame,0n);
 assert.equal(hash(await readFile(join(source,'project.fcproj'))),digest);
 await writeFile(join(source,'project.fcproj'),Buffer.concat([bytes,Buffer.from('drift')]));
 await assert.rejects(made.adapter.inspectSource!());
 await writeFile(join(source,'project.fcproj'),bytes);
 for(const file of files)assert.equal(hash(await readFile(file.path)),file.sha256);
 assert.equal(hash(await readFile(cli!)),nativeSha);
 const alignedStart=(start/frame+1n)*frame,aligned=join(root,'aligned.fcproj');
 await invoke(['--project',created,'--save-as',aligned,'exec','timeline.place',`{"item":${matte.value.item},"track":"V1","time":${alignedStart},"duration":${frame},"insert":false}`],'aligned-placement');
 const alignedNative=await invoke(['--project',aligned,'inspect'],'aligned-inspection');
 const alignedInspection=JSON.parse(JSON.stringify(parseFilmSourceInspection(alignedNative.stdout,hash(await readFile(aligned)),nativeSha)));
 assert.equal(BigInt(alignedInspection.durationTicks),alignedStart+frame);
 assert.equal(BigInt(alignedInspection.durationTicks)%frame,0n);
 assert.equal(BigInt(alignedInspection.durationTicks)/frame,alignedStart/frame+1n);
 await writeFile(join(root,'proof.json'),JSON.stringify({schema:'craft-native-big-time/v1',result:'PASS',platform:process.platform+'-'+process.arch,nativeSha256:nativeSha,testSha256:hash(await readFile(new URL(import.meta.url))),startTicks:String(start),frameTicks:String(frame),initialDurationTicks:String(start+frame),editedDurationTicks:String(start+2n*frame),originalProjectSha256:initialSha,editedProjectSha256:digest,inspection,alignedInspection,calls,skillFiles:files,scope:['native save and reopen','one-frame edit without source mutation','trusted Art source inspection and JSON roundtrip','source drift rejection','absolute frame boundary roundtrip'],excluded:['public domain workflow rendering','full-length export','complete artifact protocol matrix']},null,2)+'\n');
});
