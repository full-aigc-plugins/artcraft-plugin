import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { verifyArtifact } from '../src/protocol/contracts.ts';
const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const mime='application/vnd.craft.image-sequence+json';
function chunk(kind:string,body:Buffer){const bytes=Buffer.concat([Buffer.from(kind),body]);let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}const length=Buffer.alloc(4),sum=Buffer.alloc(4);length.writeUInt32BE(body.length);sum.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([length,bytes,sum]);}
function png(pixels:Buffer,filter=0){const header=Buffer.alloc(13);header.writeUInt32BE(2,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;const row=Buffer.from(pixels);for(let i=row.length-1;i>=0;i--){const left=i>=4?pixels[i-4]:0;row[i]=(pixels[i]-[0,left,0,Math.floor(left/2),left][filter])&255;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat([Buffer.from([filter]),row]))),chunk('IEND',Buffer.alloc(0))]);}
async function fixture(filter?:number){const root=await mkdtemp(join(tmpdir(),'craft-sequence-'));await mkdir(join(root,'seq'));const frames=[];for(let i=0;i<2;i++){const pixels=Buffer.from([i*80,20,30,0,40,50,60,200]),data=png(pixels,filter??i),location=`frame_${String(i).padStart(5,'0')}.png`;await writeFile(join(root,'seq',location),data);frames.push({index:i,location,sha256:sha(data),bytes:data.length,alphaExtrema:[0,200],rgbaSha256:sha(pixels)});}const descriptor:any={schema:'craft-image-sequence/v1',encoding:'png',width:2,height:1,bitDepth:8,channels:'rgba',alphaRepresentation:'straight-png',colorSpace:'unknown',frameRate:{num:12,den:1},frameCount:2,durationTicks:'2',timeBase:{num:1,den:12},frames};const artifact:any={protocolVersion:'craft-artifact/v1',assetId:'animation',version:'v1',sha256:'',bytes:0,mediaType:mime,producerTaskId:'effect',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{width:2,height:1,bitDepth:8,alpha:true,colorSpace:'unknown',frameRate:{num:12,den:1},durationTicks:'2',timeBase:{num:1,den:12}},lossReportRef:null,evidenceRefs:[],location:'seq/sequence.json'};const save=async(text=JSON.stringify(descriptor))=>{await writeFile(join(root,artifact.location),text);artifact.sha256=sha(text);artifact.bytes=Buffer.byteLength(text);};await save();return {root,descriptor,artifact,save};}
test('typed sequence verifies every RGBA frame including filtered pixels',async()=>{const f=await fixture();try{await verifyArtifact(f.artifact,f.root);}finally{await rm(f.root,{recursive:true});}});
test('middle frame tampering, missing frame and unlisted file reject whole sequence',async()=>{for(const mutation of ['tamper','missing','extra']){const f=await fixture();try{const path=join(f.root,'seq/frame_00001.png');if(mutation==='tamper')await writeFile(path,'changed');if(mutation==='missing')await rm(path);if(mutation==='extra')await writeFile(join(f.root,'seq/extra.png'),'extra');await assert.rejects(verifyArtifact(f.artifact,f.root),/image_sequence_/);}finally{await rm(f.root,{recursive:true});}}});
test('pixel digest, alpha extrema, timing, metadata and resource claims cannot be forged',async()=>{for(const field of ['pixel','alpha','time','rate','count','budget','metadata']){const f=await fixture();try{if(field==='pixel')f.descriptor.frames[1].rgbaSha256='a'.repeat(64);if(field==='alpha')f.descriptor.frames[1].alphaExtrema=[0,255];if(field==='time')f.descriptor.timeBase.den=24;if(field==='rate')f.descriptor.frameRate={num:24,den:2};if(field==='count')f.descriptor.frameCount=3;if(field==='budget'){f.descriptor.width=16384;f.descriptor.height=16384;}if(field==='metadata')f.artifact.technicalMetadata.durationTicks='3';await f.save();await assert.rejects(verifyArtifact(f.artifact,f.root),/image_sequence_/);}finally{await rm(f.root,{recursive:true});}}});
test('duplicate JSON keys and within-root symlinks are rejected',async()=>{for(const mutation of ['duplicate','frame-link','directory-link']){const f=await fixture();try{if(mutation==='duplicate')await f.save(JSON.stringify(f.descriptor).replace('"frameCount":2','"frameCount":1,"frameCount":2'));if(mutation==='frame-link'){const path=join(f.root,'seq/frame_00001.png'),bytes=await readFile(path);await writeFile(join(f.root,'copy.png'),bytes);await rm(path);await symlink('../copy.png',path);}if(mutation==='directory-link'){await symlink('seq',join(f.root,'alias'));f.artifact.location='alias/sequence.json';}await assert.rejects(verifyArtifact(f.artifact,f.root),/image_sequence_/);}finally{await rm(f.root,{recursive:true});}}});

test('Film binding forwards typed sequence and other domains refuse it',async()=>{
 const {publicSkillFactory}=await import('../src/adapters/public_skill.ts');const f=await fixture();
 try{
  const skillRoot=join(f.root,'skill');await mkdir(join(skillRoot,'scripts'),{recursive:true});
  const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(skillRoot,'scripts',name);await writeFile(path,'fixture');return {path,sha256:sha('fixture')};}));
  const config={pluginId:'filmcraft' as const,skillRoot,python:process.execPath,pythonSha256:sha(await readFile(process.execPath)),nativeExecutable:'/usr/bin/true',runtimeHome:f.root,files,outputRoot:join(f.root,'output')};
  const node:any={id:'film',dependsOn:[],projectKey:'film',runtimeIdentity:{pluginId:'filmcraft'},expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{operations:[]},assetBindings:[{name:'intro',assetId:'animation'}],outputs:[{assetId:'film',location:'project.fcproj',mediaType:'application/octet-stream'}]}};
  const input={root:f.root,artifact:f.artifact},factory=publicSkillFactory(config),made=await factory(node,[input],'sequence-film');
  const prepared=await made.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:null} as any);
  assert.deepEqual(prepared.args.slice(-2),['--sequence-asset','intro='+join(f.root,'seq/sequence.json')]);
  const other=publicSkillFactory({...config,pluginId:'photocraft'});
  await assert.rejects(other({...node,runtimeIdentity:{pluginId:'photocraft'}},[input],'sequence-photo'),/skill_sequence_domain_unsupported/);
  await writeFile(join(f.root,'seq/frame_00001.png'),'changed-after-prepare');
  await assert.rejects(made.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:null} as any),/image_sequence_/);
 }finally{await rm(f.root,{recursive:true});}
});

for(const filter of [0,1,2,3,4])test('RGBA pixel facts decode PNG filter '+filter,async()=>{const f=await fixture(filter);try{await verifyArtifact(f.artifact,f.root);}finally{await rm(f.root,{recursive:true});}});

test('sequence Brief checks actual dimensions, rational rate and duration',async()=>{
 const {publicSkillFactory}=await import('../src/adapters/public_skill.ts');const f=await fixture();
 try{
  const files=['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(name=>({path:join(f.root,'scripts',name),sha256:'a'.repeat(64)}));
  const factory=publicSkillFactory({pluginId:'effectcraft',skillRoot:f.root,python:process.execPath,pythonSha256:'a'.repeat(64),nativeExecutable:'/usr/bin/true',runtimeHome:f.root,files,outputRoot:join(f.root,'output')}),node:any={runtimeIdentity:{pluginId:'effectcraft'}},brief={width:2,height:1,frameRate:{num:12,den:1},durationSeconds:1/6};
  await factory.verifyBriefExport!(node,f.root,[f.artifact],brief);
  for(const [change,error] of [[{width:3},'size'],[{frameRate:{num:24,den:1}},'frame_rate'],[{durationSeconds:1},'duration']] as const)await assert.rejects(factory.verifyBriefExport!(node,f.root,[f.artifact],{...brief,...change}),new RegExp('brief_export_'+error+'_mismatch'));
 }finally{await rm(f.root,{recursive:true});}
});
