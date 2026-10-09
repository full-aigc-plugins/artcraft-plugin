import {lockNativeSchema} from './fixtures/native_schema_lock.ts';
/** 派生图片的公开属性交接；结构夹具不代替原生导出与视觉验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,mkdir,rm,readdir,copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { publicSkillFactory } from '../src/adapters/public_skill.ts';
import { inspectPng } from '../src/protocol/png_inspection.ts';
import { inspectJpeg } from '../src/protocol/jpeg_inspection.ts';
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DQAAAEgQGALFXOsAAAAABJRU5ErkJggg==','base64');
const jpegImages=JSON.parse(await readFile(new URL('./fixtures/jpeg-images.json',import.meta.url),'utf8')).images;
async function fixture(pluginId:'photocraft'|'vectorcraft'|'effectcraft',media:Buffer,mediaType:string,collected=false){
 const root=await mkdtemp(join(tmpdir(),'craft-image-export-')),skill=join(root,'skill');await mkdir(join(skill,'scripts'),{recursive:true});
 const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(skill,'scripts',name);await writeFile(path,'fixture');return {path,sha256:hash('fixture')};}));
 await lockNativeSchema(files,true);
 const identity={pluginId,sha256:'a'.repeat(64)},location=mediaType==='image/png'?'image.png':'image.jpeg';
 const factory=publicSkillFactory({pluginId,skillRoot:skill,python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'outputs')});
 const made=await factory({id:'design',dependsOn:[],projectKey:'design',runtimeIdentity:identity,expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{},assetBindings:[],outputs:[{assetId:'design',location,mediaType}]}},[],'image-task');
 await mkdir(made.root,{recursive:true});
 const project={photocraft:'project.pcraft',vectorcraft:'project.vectorcraft',effectcraft:'project.ecproj'}[pluginId];
 const vector={layers:[{kind:{type:'text',runs:[{text:'NOVA',style:{font_family:'Arial'}}]}}]};
 const effect={schema:1,items:{'1':{value:{t:'Text',v:{font:'Arial'}}}}};
 const content:Record<string,Buffer|string>={[project]:pluginId==='effectcraft'?JSON.stringify(effect):'fixture project','native.json':JSON.stringify(pluginId==='photocraft'?{layers:[{kind:'Type',text:{font:'Arial',text:'NOVA'}}]}:pluginId==='vectorcraft'?vector:{}),[location]:media};
 if(collected)content['asset.bin']='inherited media';
 const ref=(location:string)=>({location,sha256:hash(content[location])});
 content['exchange-loss.json']=JSON.stringify({schema:'craft-exchange-loss/v1',pluginId,native:ref(project),inspection:ref('native.json'),acceptance:'technical-observations-only',outputs:[{...ref(location),format:mediaType==='image/png'?'png':'jpeg',role:'derivative',nativeSubstitute:false,observations:{},warnings:[],changes:[{code:'editable_layers',status:'lost',reason:'flattened_image'}]}]});
 const hashes:Record<string,string>={};for(const [name,value] of Object.entries(content)){await writeFile(join(made.root,name),value);hashes[name]=hash(value);}
 await writeFile(join(made.root,'manifest.json'),JSON.stringify({schema:pluginId+'-delivery/v1',runtimeSha256:identity.sha256,files:hashes,assets:collected?{logo:{path:'asset.bin',sha256:hashes['asset.bin']}}:{},lossReport:{path:'exchange-loss.json',sha256:hashes['exchange-loss.json']}}));
 return {made,identity,factory,cleanup:()=>rm(root,{recursive:true})};
}
test('Photo Vector Effect publish actual PNG and JPEG encoded facts in public outputs',async()=>{
 for(const plugin of ['photocraft','vectorcraft','effectcraft'] as const){
  const samples=[{media:png,type:'image/png',facts:{width:1,height:1,bitDepth:8,alpha:true}},...Object.values(jpegImages).map(value=>({media:Buffer.from(value as string,'base64'),type:'image/jpeg',facts:{width:7,height:5,bitDepth:8,alpha:false}}))];
  for(const sample of samples){const f=await fixture(plugin,sample.media,sample.type);try{
   const result=await f.made.adapter.verify({runtimeIdentity:f.identity} as any),output=result.outputs[0];
   assert.deepEqual(output.technicalMetadata,sample.facts,plugin+' '+sample.type);
   assert.equal(output.sha256,hash(sample.media));assert.ok(output.nativeProjectRef);assert.ok(output.lossReportRef);
   assert.equal(output.technicalMetadata.colorSpace,undefined);
   {
    assert.equal(output.dependencies.length,1);
    assert.equal(output.dependencies[0].fontRequirement.family,'Arial');
    assert.equal(output.dependencies[0].assetRef,null);
    assert.equal(output.dependencies[0].packaged,false);
    assert.equal(output.dependencies[0].fontRequirement.nativeProjectSha256,output.nativeProjectRef.sha256);
    assert.ok(output.evidenceRefs.some((ref:any)=>ref.location===(plugin==='effectcraft'?'project.ecproj':'native.json')));
   }
  }finally{await f.cleanup();}}
 }
});

for(const plugin of ['photocraft','vectorcraft','effectcraft'] as const)test(`${plugin} public adapter preserves inherited media identity and matching file evidence through two reopens`,async()=>{
 const f=await fixture(plugin,png,'image/png',true);try{
  let result=await f.made.adapter.verify({runtimeIdentity:f.identity} as any);
  const first=result.outputs[0].dependencies.filter((d:any)=>d.kind==='media');assert.equal(first.length,1);
  for(let revision=1;revision<=2;revision++){
   const old=result.outputs[0],node:any={id:'revise',dependsOn:[],projectKey:'design',runtimeIdentity:f.identity,expectedRevision:old.nativeProjectRef.sha256,payload:{schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:old.assetId},plan:{operations:[]},assetBindings:[],outputs:[{assetId:'reopened-'+revision,location:'image.png',mediaType:'image/png'}]}};
   const made=await f.factory(node,[{root:result.root,artifact:old}],'reopen-media-'+revision);
   await mkdir(made.root,{recursive:true});
   for(const name of await readdir(result.root))await copyFile(join(result.root,name),join(made.root,name));
   const path=join(made.root,'manifest.json'),manifest=JSON.parse(await readFile(path,'utf8'));manifest.sourceProjectSha256=node.expectedRevision;await writeFile(path,JSON.stringify(manifest));
   result=await made.adapter.verify({runtimeIdentity:f.identity} as any);
   const output=result.outputs[0];assert.deepEqual(output.dependencies.filter((d:any)=>d.kind==='media'),first);
   assert.equal(output.sourceRefs.length,1);assert.equal(output.sourceRefs[0].assetId,old.assetId);
   for(const dependency of first)assert.ok(output.evidenceRefs.some((ref:any)=>ref.assetId===dependency.assetRef.assetId&&ref.version===dependency.assetRef.version&&ref.sha256===dependency.assetRef.sha256&&ref.location==='asset.bin'));
  }
 }finally{await f.cleanup();}
});
test('invalid derived images are rejected even when their manifest digest matches',async()=>{
 for(const [data,type] of [[png.subarray(0,33),'image/png'],[Buffer.from(jpegImages.rgb,'base64').subarray(0,20),'image/jpeg']] as const){
  const f=await fixture('photocraft',data,type);try{await assert.rejects(f.made.adapter.verify({runtimeIdentity:f.identity} as any),/png_artifact_invalid|jpeg_artifact_invalid/);}finally{await f.cleanup();}
 }
});
test('image attribute parsers reject bytes that differ from the declared output digest',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-image-digest-'));
 try{
  const file=join(root,'image');await writeFile(file,png);
  await assert.rejects(inspectPng(file,png.length,false,'0'.repeat(64)),/artifact_changed_during_read/);
  assert.deepEqual(await inspectPng(file,png.length,false,hash(png)),{width:1,height:1,bitDepth:8,alpha:true});
  const jpg=Buffer.from(jpegImages.rgb,'base64');await writeFile(file,jpg);
  await assert.rejects(inspectJpeg(file,jpg.length,'0'.repeat(64)),/artifact_changed_during_read/);
  assert.deepEqual(await inspectJpeg(file,jpg.length,hash(jpg)),{width:7,height:5,bitDepth:8,alpha:false});
 }finally{await rm(root,{recursive:true});}
});

test('editable font requirement survives source-project preflight without contaminating individual file checks',async()=>{
 const f=await fixture('photocraft',png,'image/png');try{
  const result=await f.made.adapter.verify({runtimeIdentity:f.identity} as any),output=result.outputs[0];
  const node:any={id:'revise',dependsOn:[],projectKey:'design',runtimeIdentity:f.identity,expectedRevision:output.nativeProjectRef.sha256,payload:{schemaVersion:'craft-skill-workflow/v1',sourceProject:{assetId:output.assetId},plan:{operations:[]},assetBindings:[],outputs:[{assetId:'revised',location:'image.png',mediaType:'image/png'}]}};
  const next=await f.factory(node,[{root:result.root,artifact:output}],'revise-task');
  assert.ok(next.adapter);
 }finally{await f.cleanup();}
});
