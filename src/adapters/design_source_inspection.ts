/** 设计类源工程只读响应；调用者负责实际 CLI 身份及源文件保全。 */
import { createHash } from 'node:crypto';
import type { SourceInspection } from '../planning/project_brief.ts';
type DesignPlugin='photocraft'|'effectcraft'|'vectorcraft';
const invalid=():never=>{throw new Error('brief_source_inspection_invalid');};
const dimension=(value:unknown):number=>typeof value==='number' && Number.isInteger(value) && value>0 && value<=16384 ? value : invalid();
/** 显式绑定目标画板／合成；不接受响应中的本机路径作为文件引用。 */
export function parseDesignSourceInspection(pluginId:DesignPlugin,stdout:string,projectSha256:string,runtimeSha256:string,selection:{artboard?:number;composition?:number}={}):SourceInspection {
 if(![projectSha256,runtimeSha256].every(value=>/^[a-f0-9]{64}$/.test(value)))invalid();
 let native:any;try{native=JSON.parse(stdout);}catch{invalid();}
 let document:Record<string,any>;
 if(pluginId==='photocraft')document={width:dimension(native?.width),height:dimension(native?.height)};
 else if(pluginId==='vectorcraft'){
  const index=selection.artboard;
  if(!Number.isSafeInteger(index) || index!<0 || !Array.isArray(native?.artboards) || index!>=native.artboards.length)invalid();
  const rect=native.artboards[index!]?.rect;
  if(!Array.isArray(rect) || rect.length!==4 || !rect.every(value=>typeof value==='number' && Number.isFinite(value)))invalid();
  document={width:dimension(rect[2]),height:dimension(rect[3])};
 }else if(pluginId==='effectcraft'){
  const comp=Array.isArray(native) && native.length===1 && native[0]?.command==='comp.info' ? native[0].result : native?.activeComp;
  if(!Number.isSafeInteger(selection.composition) || selection.composition!<=0 || comp?.id!==selection.composition || typeof comp.frameRate!=='number' || !Number.isFinite(comp.frameRate) || comp.frameRate<1 || comp.frameRate>240 || typeof comp.duration!=='number' || !Number.isFinite(comp.duration) || comp.duration<=0)invalid();
  document={width:dimension(comp.width),height:dimension(comp.height),frameRate:comp.frameRate,duration:comp.duration};
 }else invalid();
 return {schema:'craft-source-inspection/v1',pluginId,nativeInspectionSha256:createHash('sha256').update(stdout).digest('hex'),document,nativeProjectSha256:projectSha256,nativeRuntimeSha256:runtimeSha256};
}
