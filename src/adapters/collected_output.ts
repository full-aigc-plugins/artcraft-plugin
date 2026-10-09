/** 复用时核对公共依赖与领域实际收集清单，拒绝历史遗漏。 */
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyArtifact} from '../protocol/contracts.ts';

/** 核验包内依赖文件及其身份绑定；不修补历史产物或重新执行领域操作。 */
export async function verifyCollectedOutput(root:string,output:any,pluginId:string,runtimeSha256:string):Promise<void>{
 const mismatch=():never=>{throw new Error('dependency_manifest_mismatch');};
 const manifests=output.evidenceRefs.filter((ref:any)=>ref.location==='manifest.json');
 if(manifests.length!==1)mismatch();
 const file=async(location:string,digest:string,json=false)=>{
  const bytes=(await stat(join(root,location))).size;
  if(json && bytes>16*1024*1024)mismatch();
  await verifyArtifact({...output,location,version:digest,sha256:digest,bytes,mediaType:json?'application/json':'application/octet-stream',nativeProjectRef:null,evidenceRefs:[],dependencies:[],renditions:[],lossReportRef:null,technicalMetadata:{}},root);
 };
 await file('manifest.json',manifests[0].sha256,true);
 const bytes=await readFile(join(root,'manifest.json'));
 if(bytes.length>16*1024*1024 || createHash('sha256').update(bytes).digest('hex')!==manifests[0].sha256)mismatch();
 const manifest=JSON.parse(bytes.toString('utf8'));
 if(manifest.schema!==pluginId+'-delivery/v1' || manifest.runtimeSha256!==runtimeSha256 || !output.nativeProjectRef || manifest.files?.[output.nativeProjectRef.location]!==output.nativeProjectRef.sha256 || (manifest.assets!==undefined && (!manifest.assets || typeof manifest.assets!=='object' || Array.isArray(manifest.assets))))mismatch();
 const dependencies=output.dependencies.filter((d:any)=>d.kind!=='font'),matched=new Set<any>();
 for(const asset of Object.values(manifest.assets??{}) as any[]){
  if(!asset || typeof asset.path!=='string' || typeof asset.sha256!=='string' || manifest.files?.[asset.path]!==asset.sha256)mismatch();
  const kind=asset.kind==='lut'?'lut':'media';
  const found=dependencies.filter((d:any)=>d.kind===kind && d.packaged===true && d.missingReason===null && d.assetRef?.sha256===asset.sha256 && output.evidenceRefs.some((ref:any)=>ref.assetId===d.assetRef.assetId && ref.version===d.assetRef.version && ref.sha256===d.assetRef.sha256 && ref.location===asset.path));
  if(!found.length)mismatch();
  found.forEach((dependency:any)=>matched.add(dependency));
  await file(asset.path,asset.sha256);
 }
 if(matched.size!==dependencies.length)mismatch();
}
