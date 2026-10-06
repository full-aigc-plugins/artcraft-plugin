/** Film 原生只读响应解析；保留原始整数 token，避免源时间线 ticks 舍入。 */
import { createHash } from 'node:crypto';
import type { SourceInspection } from '../planning/project_brief.ts';

/** 调用者负责固定 CLI 身份及前后源文件核验；响应摘要不代替这些检查。 */
export function parseFilmSourceInspection(stdout:string,projectSha256:string,runtimeSha256:string):SourceInspection {
 let native:any;
 try{
  native=JSON.parse(stdout,(key,value,context:any)=>key==='duration' && typeof value==='number' ? context.source : value);
 }catch{throw new Error('brief_source_inspection_invalid');}
 const sequence=native?.sequence,settings=sequence?.settings,rate=settings?.frame_rate;
 if(!settings || !['width','height'].every(key=>Number.isInteger(settings[key]) && settings[key]>0 && settings[key]<=16384) || !rate || ![rate.num,rate.den].every(value=>Number.isSafeInteger(value)&&value>0) || rate.num/rate.den<1 || rate.num/rate.den>240 || typeof sequence.duration!=='string' || !/^[1-9][0-9]{0,18}$/.test(sequence.duration) || BigInt(sequence.duration)>9223372036854775807n)throw new Error('brief_source_inspection_invalid');
 return {schema:'craft-source-inspection/v1',pluginId:'filmcraft',nativeInspectionSha256:createHash('sha256').update(stdout).digest('hex'),document:{width:settings.width,height:settings.height,frameRate:rate},durationTicks:sequence.duration,nativeProjectSha256:projectSha256,nativeRuntimeSha256:runtimeSha256};
}
