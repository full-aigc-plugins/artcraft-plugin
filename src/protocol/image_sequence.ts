/** 动态 PNG 序列的完整性、资源边界与实际像素合同。 */
import { lstat, readFile, readdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname, basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { inspectPng } from './png_inspection.ts';
export const imageSequenceMime='application/vnd.craft.image-sequence+json';
const invalid=(reason:string):never=>{throw new Error('image_sequence_'+reason);};
const limit=512*1024*1024;
const sha=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
const keys=(value:any,expected:string[])=>{if(!value||typeof value!=='object'||Array.isArray(value)||!isDeepStrictEqual(Object.keys(value).sort(),expected.sort()))invalid('fields_invalid');};
const integer=(value:any,min:number,max:number)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;

/** 先由 JSON.parse 校验语法，再扫描嵌套键；转义后的同名键也拒绝。 */
function strictJson(text:string):any{
 let value:any;try{value=JSON.parse(text);}catch{invalid('json_invalid');}
 let at=0;
 const whitespace=()=>{while(/\s/.test(text[at]??'!'))at++;};
 const string=()=>{const start=at++;while(at<text.length){if(text[at]==='\\'){at+=2;continue;}if(text[at++]==='"')return JSON.parse(text.slice(start,at));}return invalid('json_invalid');};
 const scan=(depth:number):void=>{
  if(depth>32)invalid('json_depth');whitespace();const token=text[at];
  if(token==='"'){string();return;}
  if(token==='{'){
   at++;whitespace();const seen=new Set<string>();if(text[at]==='}'){at++;return;}
   while(true){whitespace();const key=string();if(seen.has(key))invalid('duplicate_key');seen.add(key);whitespace();at++;scan(depth+1);whitespace();if(text[at++]==='}')return;}
  }
  if(token==='['){at++;whitespace();if(text[at]===']'){at++;return;}while(true){scan(depth+1);whitespace();if(text[at++]===']')return;}}
  while(at<text.length&&!/[\s,}\]]/.test(text[at]))at++;
 };
 scan(0);return value;
}

/** 返回经逐帧核验的清单；包内路径的每一级均拒绝符号链接。 */
export async function inspectImageSequence(root:string,location:string,expectedSha:string):Promise<any>{
 try{
  if(isAbsolute(location)||/[\\:\x00]/.test(location)||location.split('/').some(part=>['','..','.'].includes(part)))invalid('location_invalid');
  const base=resolve(root),target=resolve(base,location);
  if(isAbsolute(relative(base,target))||relative(base,target).startsWith('../')||basename(target)!=='sequence.json')invalid('location_invalid');
  let current=base;
  if((await lstat(current)).isSymbolicLink())invalid('symlink');
  for(const part of location.split('/')){current=join(current,part);if((await lstat(current)).isSymbolicLink())invalid('symlink');}
  const before=await lstat(target);if(!before.isFile()||before.size>4*1024*1024)invalid('descriptor_limit');
  const content=await readFile(target);if(content.length!==before.size||sha(content)!==expectedSha)invalid('descriptor_changed');
  const descriptor=strictJson(new TextDecoder('utf-8',{fatal:true}).decode(content));
  keys(descriptor,['schema','encoding','width','height','bitDepth','channels','alphaRepresentation','colorSpace','frameRate','frameCount','durationTicks','timeBase','frames']);
  if(descriptor.schema!=='craft-image-sequence/v1'||descriptor.encoding!=='png'||descriptor.bitDepth!==8||descriptor.channels!=='rgba'||descriptor.alphaRepresentation!=='straight-png'||descriptor.colorSpace!=='unknown')invalid('format_unsupported');
  if(!integer(descriptor.width,1,16384)||!integer(descriptor.height,1,16384)||!integer(descriptor.frameCount,1,10000)||!Array.isArray(descriptor.frames)||descriptor.frames.length!==descriptor.frameCount)invalid('dimensions_or_count');
  keys(descriptor.frameRate,['num','den']);keys(descriptor.timeBase,['num','den']);
  const rate=descriptor.frameRate;
  if(!integer(rate.num,1,2**31-1)||!integer(rate.den,1,2**31-1)||gcd(rate.num,rate.den)!==1||rate.num<rate.den||rate.num>240*rate.den||descriptor.durationTicks!==String(descriptor.frameCount)||descriptor.timeBase.num!==rate.den||descriptor.timeBase.den!==rate.num)invalid('timing_invalid');
  if(descriptor.width*descriptor.height*4*descriptor.frameCount>limit)invalid('decoded_limit');
  const directory=dirname(target),expected=['sequence.json'];let total=0;
  for(let index=0;index<descriptor.frameCount;index++){
   const frame=descriptor.frames[index];keys(frame,['index','location','sha256','bytes','alphaExtrema','rgbaSha256']);
   const name=`frame_${String(index).padStart(5,'0')}.png`;
   if(frame.index!==index||frame.location!==name||!integer(frame.bytes,1,64*1024*1024)||!/^([a-f0-9]{64})$/.test(frame.sha256)||!/^([a-f0-9]{64})$/.test(frame.rgbaSha256)||!Array.isArray(frame.alphaExtrema)||frame.alphaExtrema.length!==2||!frame.alphaExtrema.every((v:any)=>integer(v,0,255))||frame.alphaExtrema[0]>frame.alphaExtrema[1])invalid('frame_invalid');
   total+=frame.bytes;if(total>limit)invalid('encoded_limit');expected.push(name);
  }
  if(!isDeepStrictEqual((await readdir(directory)).sort(),expected.sort()))invalid('file_set');
  for(const frame of descriptor.frames){
   const path=join(directory,frame.location),beforeFrame=await lstat(path);
   if(beforeFrame.isSymbolicLink()||!beforeFrame.isFile()||beforeFrame.size!==frame.bytes)invalid('frame_file');
   const facts=await inspectPng(path,frame.bytes,true),after=await lstat(path);
   if(beforeFrame.ino!==after.ino||beforeFrame.size!==after.size||beforeFrame.mtimeMs!==after.mtimeMs||after.isSymbolicLink())invalid('frame_changed');
   if(facts.encodedSha256!==frame.sha256||facts.rgbaSha256!==frame.rgbaSha256||facts.width!==descriptor.width||facts.height!==descriptor.height||!isDeepStrictEqual(facts.alphaExtrema,frame.alphaExtrema))invalid('frame_mismatch');
  }
  if(!isDeepStrictEqual((await readdir(directory)).sort(),expected.sort())||sha(await readFile(target))!==expectedSha)invalid('descriptor_changed');
  return descriptor;
 }catch(error){if(error instanceof Error&&error.message.startsWith('image_sequence_'))throw error;invalid('input_invalid');}
}

/** 公共技术元数据必须完整，并与实际序列事实一致。 */
export function sequenceMetadata(descriptor:any):Record<string,any>{
 return {width:descriptor.width,height:descriptor.height,bitDepth:8,alpha:true,colorSpace:descriptor.colorSpace,frameRate:descriptor.frameRate,durationTicks:descriptor.durationTicks,timeBase:descriptor.timeBase};
}
