import {lockNativeSchema} from './fixtures/native_schema_lock.ts';
/** Film 公开交付的精确时间映射；夹具仅证明合同，不代替原生渲染。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,mkdir,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { publicSkillFactory } from '../src/adapters/public_skill.ts';
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
async function fixture(change:(probe:any,native:any)=>void=()=>{},missing=false){
 const root=await mkdtemp(join(tmpdir(),'craft-film-metadata-')),skill=join(root,'skill');await mkdir(join(skill,'scripts'),{recursive:true});
 const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(skill,'scripts',name);await writeFile(path,'fixture');return {path,sha256:hash('fixture')};}));
 await lockNativeSchema(files,true);
 const identity={pluginId:'filmcraft',sha256:'a'.repeat(64)};
 const factory=publicSkillFactory({pluginId:'filmcraft',skillRoot:skill,python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'outputs')});
 const node={id:'film',dependsOn:[],projectKey:'film',runtimeIdentity:identity,expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{},assetBindings:[],outputs:[{assetId:'film',location:'film.mp4',mediaType:'video/mp4'}]}};
 const made=await factory(node,[],'metadata-task');await mkdir(made.root,{recursive:true});
 // ftyp is sufficient only for the existing container signature check; no decode claim.
 const media=Buffer.from([0,0,0,20,102,116,121,112,105,115,111,109,0,0,0,0,105,115,111,109]);
 const native={sequence:{duration:'21946982400000001',settings:{width:320,height:180,frame_rate:{num:30000,den:1001}}}};
 const probe:any={name:'film.mp4',kind:'Movie',file_size:media.length,duration:'21946982400000001',video:{width:320,height:180,frame_rate:{num:30000,den:1001},has_alpha:false},audio:{sample_rate:48000,channels:2}};
 change(probe,native);
 const content:Record<string,Buffer|string>={'project.fcproj':'fixture project','native.json':JSON.stringify(native),'export-probe.json':JSON.stringify(probe),'film.mp4':media};
 if(missing)delete content['export-probe.json'];
 const ref=(location:string)=>({location,sha256:hash(content[location])});
 const loss={schema:'craft-exchange-loss/v1',pluginId:'filmcraft',native:ref('project.fcproj'),inspection:ref('native.json'),acceptance:'technical-observations-only',outputs:[{...ref('film.mp4'),format:'mp4',role:'derivative',nativeSubstitute:false,observations:{},warnings:[],changes:[{code:'native_timeline',status:'lost',reason:'rendered_frames'}]}]};
 content['exchange-loss.json']=JSON.stringify(loss);
 const hashes:Record<string,string>={};for(const [name,value] of Object.entries(content)){await writeFile(join(made.root,name),value);hashes[name]=hash(value);}
 await writeFile(join(made.root,'manifest.json'),JSON.stringify({schema:'filmcraft-delivery/v1',runtimeSha256:identity.sha256,files:hashes,assets:{},lossReport:{path:'exchange-loss.json',sha256:hashes['exchange-loss.json']}}));
 return {made,identity,root,cleanup:()=>rm(root,{recursive:true})};
}
test('Film adapter publishes exact large ticks, rational rates and bound probe evidence',async()=>{
 const f=await fixture();try{
  const result=await f.made.adapter.verify({runtimeIdentity:f.identity} as any);const output=result.outputs[0];
  assert.deepEqual(output.technicalMetadata,{durationTicks:'21946982400000001',timeBase:{num:1,den:254016000000},frameRate:{num:30000,den:1001},width:320,height:180,alpha:false,audio:{sampleRate:48000,channels:2}});
  const roundtrip=JSON.parse(JSON.stringify(output));assert.equal(BigInt(roundtrip.technicalMetadata.durationTicks),21946982400000001n);
  for(const location of ['native.json','export-probe.json'])assert.ok(output.evidenceRefs.some((r:any)=>r.location===location));
 }finally{await f.cleanup();}
});
test('Film adapter rejects numeric, overflowing, missing and inconsistent export evidence',async()=>{
 const changes=[(p:any)=>p.duration=21946982400000001,(p:any)=>p.duration='9223372036854775808',(p:any)=>delete p.duration,(p:any)=>p.video.frame_rate.den=0,(p:any)=>p.video.width=321,(p:any)=>p.name='other.mp4',(p:any)=>p.file_size++,(p:any)=>p.duration='21947236416000001',(p:any)=>p.timeBase={num:1,den:1000}];
 for(const change of changes){const f=await fixture(change);try{await assert.rejects(f.made.adapter.verify({runtimeIdentity:f.identity} as any),/film_export_metadata_invalid/);}finally{await f.cleanup();}}
 const f=await fixture(()=>{},true);try{await assert.rejects(f.made.adapter.verify({runtimeIdentity:f.identity} as any),/film_export_metadata_missing/);}finally{await f.cleanup();}
});
