/** 依赖复用门禁覆盖缺失、额外、LUT类型与包内摘要；不声称原生创作验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyCollectedOutput} from '../src/adapters/collected_output.ts';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
for(const kind of ['media','lut'])test(`${kind} cached public dependencies must match collected files and identity-bound evidence`,async()=>{
 const parent=await mkdtemp(join(tmpdir(),'art-collected-output-')),root=join(parent,'source');
 try{
  const {mkdir}=await import('node:fs/promises');await mkdir(root);
  await writeFile(join(root,'asset.bin'),'asset');await writeFile(join(root,'output.bin'),'out');await writeFile(join(root,'project.fcproj'),'native');
  const ref=(assetId:string,digest:string,location?:string)=>({assetId,version:digest,sha256:digest,...(location?{location}:{})});
  const digest=sha('asset'),runtime=sha('runtime'),assetRef=ref('known-asset',digest),manifest=JSON.stringify({schema:'filmcraft-delivery/v1',runtimeSha256:runtime,files:{'asset.bin':digest,'project.fcproj':sha('native'),'output.bin':sha('out')},assets:{logo:{path:'asset.bin',sha256:digest,...(kind==='lut'?{kind}:{})}}});
  await writeFile(join(root,'manifest.json'),manifest);
  const output:any={protocolVersion:'craft-artifact/v1',assetId:'output',version:sha('out'),sha256:sha('out'),bytes:3,mediaType:'application/octet-stream',producerTaskId:'task',sourceRefs:[],nativeProjectRef:ref('native',sha('native'),'project.fcproj'),renditions:[],evidenceRefs:[ref('manifest',sha(manifest),'manifest.json'),{...assetRef,location:'asset.bin'}],dependencies:[{assetRef,kind,packaged:true,missingReason:null}],technicalMetadata:{},lossReportRef:null,location:'output.bin'};
  await verifyCollectedOutput(root,output,'filmcraft',runtime);
  for(const patch of [{dependencies:[]},{dependencies:[{...output.dependencies[0],kind:kind==='lut'?'media':'lut'}]},{dependencies:[...output.dependencies,{...output.dependencies[0],assetRef:ref('extra',sha('other'))}]},{evidenceRefs:output.evidenceRefs.slice(0,1)}]){
   await assert.rejects(verifyCollectedOutput(root,{...output,...patch},'filmcraft',runtime),/dependency_manifest_mismatch/);
  }
  const moved=join(parent,'moved');await rename(root,moved);await verifyCollectedOutput(moved,output,'filmcraft',runtime);
  await writeFile(join(moved,'asset.bin'),'tampered');await assert.rejects(verifyCollectedOutput(moved,output,'filmcraft',runtime),/artifact_digest_mismatch/);
 }finally{await rm(parent,{recursive:true});}
});
