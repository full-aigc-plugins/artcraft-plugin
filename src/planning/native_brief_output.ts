/** 核对摘要绑定的保存后重开记录；不得以源工程或声明文档代替实际结果。 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyArtifact } from '../protocol/contracts.ts';
const formats:Record<string,string>={'.fcproj':'filmcraft','.ecproj':'effectcraft','.pcraft':'photocraft','.vectorcraft':'vectorcraft'};
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const invalid=():never=>{throw new Error('brief_native_evidence_invalid');};
const dimension=(value:unknown)=>typeof value==='number' && Number.isInteger(value) && value>0 && value<=16384 ? value : invalid();
/** 新交付、依赖交接与缓存复用都重新核验当前文件。成片时长另有导出门禁。 */
export async function verifyNativeBriefOutput(root:string,outputs:Record<string,any>[],brief:Record<string,any>,runtimeSha256:string):Promise<void>{
 const plugin=formats[brief.nativeFormat],project='project'+brief.nativeFormat,output=outputs[0];
 if(!plugin || !output)throw new Error('brief_native_evidence_missing');
 const manifests=output.evidenceRefs.filter((ref:any)=>ref.location==='manifest.json');
 if(manifests.length!==1 || output.nativeProjectRef?.location!==project)throw new Error('brief_native_evidence_missing');
 await verifyArtifact(output,root);
 const manifestBytes=await readFile(join(root,'manifest.json'));
 if(hash(manifestBytes)!==manifests[0].sha256)throw new Error('brief_native_evidence_stale');
 const manifest=JSON.parse(manifestBytes.toString());
 if(manifest.schema!==plugin+'-delivery/v1' || manifest.runtimeSha256!==runtimeSha256 || manifest.files?.[project]!==output.nativeProjectRef.sha256)invalid();
 for(const item of outputs){
  await verifyArtifact(item,root);
  if(item.nativeProjectRef?.sha256!==output.nativeProjectRef.sha256 || !item.evidenceRefs.some((ref:any)=>ref.location==='manifest.json' && ref.sha256===manifests[0].sha256))invalid();
 }
 const digest=manifest.files?.['native.json'];
 if(typeof digest!=='string' || !/^[a-f0-9]{64}$/.test(digest))throw new Error('brief_native_evidence_missing');
 const bytes=await readFile(join(root,'native.json'));
 await verifyArtifact({...output,location:'native.json',sha256:digest,version:digest,bytes:bytes.length,mediaType:'application/json',nativeProjectRef:null,evidenceRefs:[],renditions:[],dependencies:[],lossReportRef:null},root);
 if(hash(bytes)!==digest)throw new Error('brief_native_evidence_stale');
 const native=JSON.parse(bytes.toString());let document:any;
 if(plugin==='photocraft')document=native;
 else if(plugin==='filmcraft'){
  const settings=native?.sequence?.settings,rate=settings?.frame_rate;
  if(!rate || ![rate.num,rate.den].every(value=>Number.isSafeInteger(value)&&value>0))invalid();
  document={...settings,frameRate:rate.num/rate.den};
 }else if(plugin==='effectcraft'){
  document=native?.composition;
  if(!document || document.id!==manifest.bindings?.composition?.comp || !Number.isSafeInteger(document.id))invalid();
 }else{
  const board=/^artboard-([1-9][0-9]*)\.(png|svg|pdf)$/.exec(output.location);
  if(!board || !Array.isArray(native?.artboards))invalid();
  const index=Number(board![1])-1,rect=native.artboards[index]?.rect;
  if(!Number.isSafeInteger(index) || !rect || ![rect.x0,rect.x1,rect.y0,rect.y1].every(value=>typeof value==='number'&&Number.isFinite(value)))invalid();
  document={width:rect.x1-rect.x0,height:rect.y1-rect.y0};
 }
 if(dimension(document?.width)!==brief.width || dimension(document?.height)!==brief.height)throw new Error('brief_native_size_mismatch');
 if(brief.frameRate){
  if(typeof document.frameRate!=='number' || !Number.isFinite(document.frameRate) || document.frameRate<1 || document.frameRate>240)invalid();
  if(Math.abs(document.frameRate-brief.frameRate.num/brief.frameRate.den)>1e-9)throw new Error('brief_native_frame_rate_mismatch');
 }
 if(output.mediaType==='image/png' || output.location.endsWith('.png')){
  const image=await readFile(join(root,output.location));
  if(hash(image)!==output.sha256)throw new Error('brief_native_evidence_stale');
  if(image.length<33 || !image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || image.readUInt32BE(8)!==13 || image.toString('ascii',12,16)!=='IHDR')throw new Error('brief_export_image_invalid');
  if(image.readUInt32BE(16)!==brief.width || image.readUInt32BE(20)!==brief.height)throw new Error('brief_export_size_mismatch');
 }
 if(plugin==='effectcraft' && Object.hasOwn(brief,'durationSeconds')){
  if(typeof document.duration!=='number' || !Number.isFinite(document.duration) || document.duration<=0)invalid();
  if(Math.abs(document.duration-brief.durationSeconds)>1e-9)throw new Error('brief_native_duration_mismatch');
 }
}
