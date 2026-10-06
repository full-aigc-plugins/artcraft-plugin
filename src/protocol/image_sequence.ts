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
  if(isAbsolute(relative(base,target))||relative(base,target).startsWith('../')||!['sequence.json','segments.json'].includes(basename(target)))invalid('location_invalid');
  let current=base;
  if((await lstat(current)).isSymbolicLink())invalid('symlink');
  for(const part of location.split('/')){current=join(current,part);if((await lstat(current)).isSymbolicLink())invalid('symlink');}
  const before=await lstat(target);if(!before.isFile()||before.size>4*1024*1024)invalid('descriptor_limit');
  const content=await readFile(target);if(content.length!==before.size||sha(content)!==expectedSha)invalid('descriptor_changed');
  const descriptor=strictJson(new TextDecoder('utf-8',{fatal:true}).decode(content));
  if(descriptor?.schema==='craft-segmented-render-checkpoint/v1')return inspectSegmentedSource(root,location,expectedSha,descriptor);
  if(basename(target)!=='sequence.json')invalid('location_invalid');
  const collected=descriptor?.schema==='filmcraft-collected-sequence/v1';
  keys(descriptor,['schema','encoding','width','height','bitDepth','channels','alphaRepresentation','colorSpace','frameRate','frameCount','durationTicks','timeBase','frames',...(collected?['segments','sourceSequenceSha256']:[])]);
  if(!['craft-image-sequence/v1','filmcraft-collected-sequence/v1'].includes(descriptor.schema)||descriptor.encoding!=='png'||descriptor.bitDepth!==8||descriptor.channels!=='rgba'||descriptor.alphaRepresentation!=='straight-png'||descriptor.colorSpace!=='unknown')invalid('format_unsupported');
  if(!integer(descriptor.width,1,16384)||!integer(descriptor.height,1,16384)||!integer(descriptor.frameCount,1,10000)||!Array.isArray(descriptor.frames)||descriptor.frames.length!==descriptor.frameCount)invalid('dimensions_or_count');
  keys(descriptor.frameRate,['num','den']);keys(descriptor.timeBase,['num','den']);
  const rate=descriptor.frameRate;
  if(!integer(rate.num,1,2**31-1)||!integer(rate.den,1,2**31-1)||gcd(rate.num,rate.den)!==1||rate.num<rate.den||rate.num>240*rate.den||descriptor.durationTicks!==String(descriptor.frameCount)||descriptor.timeBase.num!==rate.den||descriptor.timeBase.den!==rate.num)invalid('timing_invalid');
  if(descriptor.width*descriptor.height*4*descriptor.frameCount>(collected?64*1024**3:limit))invalid('decoded_limit');
  if(collected)validateCollectedRanges(descriptor);
  const directory=dirname(target),expected=['sequence.json'];let total=0;
  for(let index=0;index<descriptor.frameCount;index++){
   const frame=descriptor.frames[index];keys(frame,['index','location','sha256','bytes','alphaExtrema','rgbaSha256']);
   const name=`frame_${String(index).padStart(5,'0')}.png`;
   if(frame.index!==index||frame.location!==name||!integer(frame.bytes,1,64*1024*1024)||!/^([a-f0-9]{64})$/.test(frame.sha256)||!/^([a-f0-9]{64})$/.test(frame.rgbaSha256)||!Array.isArray(frame.alphaExtrema)||frame.alphaExtrema.length!==2||!frame.alphaExtrema.every((v:any)=>integer(v,0,255))||frame.alphaExtrema[0]>frame.alphaExtrema[1])invalid('frame_invalid');
   total+=frame.bytes;if(total>(collected?2*1024**3:limit))invalid('encoded_limit');expected.push(name);
  }
  if(collected)for(const segment of descriptor.segments)if(descriptor.frames.slice(segment.firstFrame,segment.firstFrame+segment.frameCount).reduce((n:number,f:any)=>n+f.bytes,0)>limit)invalid('encoded_limit');
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

function validateCollectedRanges(value:any):void{
 if(typeof value.sourceSequenceSha256!=='string'||!/^([a-f0-9]{64})$/.test(value.sourceSequenceSha256)||!Array.isArray(value.segments)||!integer(value.segments.length,1,10000))invalid('segment_source');
 let first=0;
 for(const part of value.segments){
  keys(part,['firstFrame','frameCount','sourceSha256']);
  if(!integer(part.firstFrame,0,10000)||part.firstFrame!==first||!integer(part.frameCount,1,10000)||part.frameCount*value.width*value.height*4>limit||typeof part.sourceSha256!=='string'||!/^([a-f0-9]{64})$/.test(part.sourceSha256))invalid('segment_ranges');
  first+=part.frameCount;
 }
 if(first!==value.frameCount)invalid('segment_ranges');
}

/** 将有限十进制或有理秒数字符串转为精确分数；不累加浮点段时长。 */
function rationalSeconds(value:any):[bigint,bigint]{
 if(!['string','number'].includes(typeof value))invalid('segment_timing');
 const text=String(value);let match=/^([0-9]{1,32})\/([0-9]{1,32})$/.exec(text);
 if(match){const den=BigInt(match[2]);if(den===0n)invalid('segment_timing');return [BigInt(match[1]),den];}
 match=/^([0-9]{1,32})(?:\.([0-9]{1,32}))?(?:e([+-]?[0-9]{1,2}))?$/i.exec(text);
 if(!match)invalid('segment_timing');
 const fraction=match![2]??'',power=Number(match![3]??0)-fraction.length;
 if(Math.abs(power)>64)invalid('segment_timing');
 const num=BigInt(match![1]+fraction);return power>=0?[num*10n**BigInt(power),1n]:[num,10n**BigInt(-power)];
}

async function inspectSegmentedSource(root:string,location:string,expectedSha:string,value:any):Promise<any>{
 if(basename(location)!=='segments.json')invalid('location_invalid');
 keys(value,['schema','state','binding','frameCount','frameRate','segments']);
 if(value.state!=='verified'||!integer(value.frameCount,1,10000)||!Array.isArray(value.segments)||!integer(value.segments.length,1,10000))invalid('segment_state');
 keys(value.binding,['projectSha256','runtimeSha256','composition','chunkBytes','parts']);
 const binding=value.binding,comp=binding.composition,rate=value.frameRate;
 if(!comp||!integer(comp.width,1,16384)||!integer(comp.height,1,16384)||!integer(binding.chunkBytes,1,limit)||!Array.isArray(binding.parts)||binding.parts.length!==value.segments.length)invalid('segment_binding');
 for(const field of ['projectSha256','runtimeSha256'])if(typeof binding[field]!=='string'||!/^([a-f0-9]{64})$/.test(binding[field]))invalid('segment_binding');
 keys(rate,['num','den']);if(!integer(rate.num,1,2**31-1)||!integer(rate.den,1,2**31-1)||gcd(rate.num,rate.den)!==1||rate.num<rate.den||rate.num>240*rate.den)invalid('timing_invalid');
 const [rateNum,rateDen]=rationalSeconds(comp.frameRate),[durationNum,durationDen]=rationalSeconds(comp.duration);
 if(rateNum*BigInt(rate.den)!==BigInt(rate.num)*rateDen||durationNum<=0n||(durationNum*BigInt(rate.num)+durationDen*BigInt(rate.den)-1n)/(durationDen*BigInt(rate.den))!==BigInt(value.frameCount))invalid('segment_timing');
 if(value.frameCount*comp.width*comp.height*4>64*1024**3)invalid('decoded_limit');
 const prefix=location.replace(/[^/]+$/,''),frames:any[]=[],segmentManifestRefs:any[]=[];let first=0,total=0;
 for(let index=0;index<value.segments.length;index++){
  const part=value.segments[index];keys(part,['firstFrame','frameCount','start','end','location','sha256']);
  if(part.firstFrame!==first||!integer(part.firstFrame,0,10000)||!integer(part.frameCount,1,10000)||first+part.frameCount>value.frameCount||part.frameCount*comp.width*comp.height*4>binding.chunkBytes)invalid('segment_ranges');
  for(const [field,count] of [['start',first],['end',first+part.frameCount]] as const){
   keys(part[field],['num','den']);const num=count*rate.den,divisor=gcd(num,rate.num);
   if(!integer(part[field].num,0,Number.MAX_SAFE_INTEGER)||!integer(part[field].den,1,Number.MAX_SAFE_INTEGER)||part[field].num!==num/divisor||part[field].den!==rate.num/divisor)invalid('segment_timing');
  }
  const range={firstFrame:part.firstFrame,frameCount:part.frameCount,start:part.start,end:part.end};
  const childFolder=`segment_${String(index).padStart(5,'0')}`;
  if(!isDeepStrictEqual(binding.parts[index],range)||part.location!==childFolder+'/sequence.json'||typeof part.sha256!=='string'||!/^([a-f0-9]{64})$/.test(part.sha256))invalid('segment_ranges');
  const child=await inspectImageSequence(root,prefix+part.location,part.sha256);
  if(child.schema!=='craft-image-sequence/v1'||child.width!==comp.width||child.height!==comp.height||child.frameCount!==part.frameCount||!isDeepStrictEqual(child.frameRate,rate))invalid('segment_child');
  for(const frame of child.frames){
   if(frame.alphaExtrema[0]===255)invalid('segment_transparency');
   total+=frame.bytes;if(total>2*1024**3)invalid('encoded_limit');
   frames.push({...frame,index:first+frame.index,location:childFolder+'/'+frame.location});
  }
  segmentManifestRefs.push({location:part.location,sha256:part.sha256});first+=part.frameCount;
 }
 if(first!==value.frameCount||sha(await readFile(join(root,location)))!==expectedSha)invalid('descriptor_changed');
 return {schema:'craft-inspected-segments/v1',encoding:'png',width:comp.width,height:comp.height,bitDepth:8,channels:'rgba',alphaRepresentation:'straight-png',colorSpace:'unknown',frameRate:rate,frameCount:first,durationTicks:String(first),timeBase:{num:rate.den,den:rate.num},frames,segmentManifestRefs};
}

/** 公共技术元数据必须完整，并与实际序列事实一致。 */
export function sequenceMetadata(descriptor:any):Record<string,any>{
 return {width:descriptor.width,height:descriptor.height,bitDepth:8,alpha:true,colorSpace:descriptor.colorSpace,frameRate:descriptor.frameRate,durationTicks:descriptor.durationTicks,timeBase:descriptor.timeBase};
}
