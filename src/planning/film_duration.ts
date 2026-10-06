/** 从摘要绑定的重开工程记录和成片探测记录核对 Brief 时长。 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyArtifact } from '../protocol/contracts.ts';
import { durationMatches } from './project_brief.ts';

const ticks=(value:unknown):bigint=>{
 if(typeof value!=='string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value)>9223372036854775807n)throw new Error('film_duration_evidence_invalid');
 return BigInt(value);
};
const rate=(value:any)=>{
 if(!value || ![value.num,value.den].every(n=>Number.isSafeInteger(n)&&n>0) || value.num/value.den<1 || value.num/value.den>240)throw new Error('film_duration_evidence_invalid');
 return value;
};

/** 每次发布或复用均读取已核验文件，不能以旧元数据替代当前摘要。 */
export async function verifyFilmDuration(root:string,outputs:Record<string,any>[],seconds:number):Promise<void>{
 if(!outputs.length)throw new Error('film_duration_evidence_missing');
 const output=outputs[0];
 await verifyArtifact(output,root);
 const manifests=output.evidenceRefs.filter((ref:any)=>ref.location==='manifest.json');
 if(manifests.length!==1 || output.nativeProjectRef?.location!=='project.fcproj')throw new Error('film_duration_evidence_missing');
 const manifestBytes=await readFile(join(root,'manifest.json'));
 if(createHash('sha256').update(manifestBytes).digest('hex')!==manifests[0].sha256)throw new Error('film_duration_evidence_stale');
 const manifest=JSON.parse(manifestBytes.toString());
 if(manifest.schema!=='filmcraft-delivery/v1' || manifest.files?.['project.fcproj']!==output.nativeProjectRef.sha256)throw new Error('film_duration_evidence_invalid');
 for(const item of outputs){
  if(item.nativeProjectRef?.sha256!==output.nativeProjectRef.sha256 || !item.evidenceRefs.some((ref:any)=>ref.location==='manifest.json' && ref.sha256===manifests[0].sha256))throw new Error('film_duration_evidence_invalid');
 }
 const read=async(location:string)=>{
  const digest=manifest.files[location];
  if(typeof digest!=='string' || !/^[a-f0-9]{64}$/.test(digest))throw new Error('film_duration_evidence_missing');
  const bytes=await readFile(join(root,location));
  await verifyArtifact({...output,location,sha256:digest,version:digest,bytes:bytes.length,mediaType:'application/octet-stream',nativeProjectRef:null,evidenceRefs:[],renditions:[],dependencies:[],lossReportRef:null},root);
  if(createHash('sha256').update(bytes).digest('hex')!==digest)throw new Error('film_duration_evidence_stale');
  return bytes;
 };
 const native=JSON.parse((await read('native.json')).toString()),probe=JSON.parse((await read('export-probe.json')).toString());
 await read('film.mp4');
 const nativeTicks=ticks(native.sequence?.duration),exportTicks=ticks(probe.duration);
 const nativeRate=rate(native.sequence?.settings?.frame_rate),exportRate=rate(probe.video?.frame_rate);
 if(BigInt(nativeRate.num)*BigInt(exportRate.den)!==BigInt(exportRate.num)*BigInt(nativeRate.den))throw new Error('film_duration_evidence_invalid');
 const frame=254016000000n*BigInt(nativeRate.den)/BigInt(nativeRate.num);
 const difference=exportTicks-nativeTicks;
 if(!durationMatches(nativeTicks,seconds) || !durationMatches(exportTicks,seconds,frame) || (difference<0n?-difference:difference)>frame)throw new Error('film_duration_mismatch');
}
