/** 静态 PNG 的结构与扫描数据核验；Alpha 表示不等于视觉透明度。 */
import { open } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const maxFile=64*1024*1024,maxScan=128*1024*1024;
const invalid=():never=>{throw new Error('png_artifact_invalid');};
const crcTable=Array.from({length:256},(_,value)=>{for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);return value>>>0;});
function crc32(bytes:Buffer):number{
 let crc=0xffffffff;
 for(const byte of bytes)crc=(crc>>>8)^crcTable[(crc^byte)&255];
 return (crc^0xffffffff)>>>0;
}
/** 支持标准颜色类型、位深和 Adam7；明确拒绝 APNG 与超限输入。 */
export async function inspectPng(path:string,size:number,rgbaPixels=false,expectedSha256?:string):Promise<{width:number;height:number;bitDepth:number;alpha:boolean;rgbaSha256?:string;alphaExtrema?:number[];encodedSha256?:string}>{
 if(size>maxFile)throw new Error('png_artifact_too_large');
 const handle=await open(path,'r');const buffer=Buffer.alloc(size+1);let count=0;
 try{while(count<buffer.length){const read=await handle.read(buffer,count,buffer.length-count,count);if(!read.bytesRead)break;count+=read.bytesRead;}}finally{await handle.close();}
 const data=buffer.subarray(0,count);
 if(expectedSha256!==undefined && createHash('sha256').update(data).digest('hex')!==expectedSha256)throw new Error('artifact_changed_during_read');
 if(data.length!==size || data.length>maxFile || !data.subarray(0,8).equals(signature))invalid();
 let offset=8,width=0,height=0,depth=0,color=0,interlace=0,palette=0,transparency=false,ended=false,closedData=false;
 const compressed:Buffer[]=[];
 while(offset<data.length){
  if(offset+12>data.length)invalid();
  const length=data.readUInt32BE(offset),end=offset+12+length,kind=data.toString('ascii',offset+4,offset+8);
  if(end>data.length || !data.subarray(offset+4,offset+8).every(c=>(c>=65&&c<=90)||(c>=97&&c<=122)) || !/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(kind))invalid();
  const body=data.subarray(offset+8,end-4);
  if(crc32(data.subarray(offset+4,end-4))!==data.readUInt32BE(end-4))invalid();
  if(!width && kind!=='IHDR')invalid();
  if(kind==='IHDR'){
   if(width || length!==13)invalid();
   width=body.readUInt32BE(0);height=body.readUInt32BE(4);depth=body[8];color=body[9];interlace=body[12];
   const depths:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
   if(!width || !height || width>=2**31 || height>=2**31 || !depths[color]?.includes(depth) || body[10] || body[11] || interlace>1)invalid();
  }else if(kind==='PLTE'){
   if(palette || compressed.length || transparency || [0,4].includes(color) || !length || length%3 || length>768 || (color===3&&length/3>2**depth))invalid();
   palette=length/3;
  }else if(kind==='tRNS'){
   if(transparency || compressed.length || !((color===0&&length===2)||(color===2&&length===6)||(color===3&&length>0&&length<=palette)))invalid();
   if(color===0||color===2)for(let at=0;at<length;at+=2)if(body.readUInt16BE(at)>=2**depth)invalid();
   transparency=true;
  }else if(kind==='IDAT'){
   if(closedData || (color===3&&!palette))invalid();
   compressed.push(body);
  }else if(kind==='IEND'){
   if(length || !compressed.length || end!==data.length)invalid();
   ended=true;
  }else if(kind==='acTL')throw new Error('png_animated_unsupported');
  else if(!(data[offset+4]&32))invalid();
  if(compressed.length && kind!=='IDAT')closedData=true;
  offset=end;
 }
 if(!ended)invalid();
 if(rgbaPixels && (color!==6 || depth!==8 || interlace!==0))throw new Error('image_sequence_rgba_required');
 const channels:Record<number,number>={0:1,2:3,3:1,4:2,6:4};
 const passes=interlace?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
 const rows:number[][]=[];let expected=0;
 for(const [x,y,dx,dy] of passes){
  const w=Math.max(0,Math.ceil((width-x)/dx)),h=Math.max(0,Math.ceil((height-y)/dy));
  if(!w||!h)continue;
  const stride=Math.ceil(w*channels[color]*depth/8)+1;expected+=stride*h;rows.push([stride,h]);
  if(expected>maxScan)throw new Error('png_artifact_too_large');
 }
 let scan:Buffer;
 try{
  const input=Buffer.concat(compressed),result=inflateSync(input,{maxOutputLength:expected+1,info:true});
  scan=result.buffer;
  if(scan.length!==expected || result.engine.bytesWritten!==input.length)invalid();
 }catch{invalid();}
 let at=0;
 for(const [stride,count] of rows)for(let row=0;row<count;row++){if(scan![at]>4)invalid();at+=stride;}
 if(rgbaPixels){
  // 逐行反滤波，摘要基于实际 RGBA 像素而不是压缩文件或 IHDR 声明。
  const stride=width*4,digest=createHash('sha256');let previous=Buffer.alloc(stride),minimum=255,maximum=0;
  const paeth=(a:number,b:number,c:number)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let row=0;row<height;row++){
   const start=row*(stride+1),filter=scan![start],pixels=Buffer.alloc(stride);
   // 每行只计算当前滤波器；五种预测器与模 256 语义保持不变。
   scan!.copy(pixels,0,start+1,start+1+stride);
   switch(filter){
    case 0:break;
    case 1:
     for(let column=4;column<stride;column++)pixels[column]=(pixels[column]+pixels[column-4])&255;
     break;
    case 2:
     for(let column=0;column<stride;column++)pixels[column]=(pixels[column]+previous[column])&255;
     break;
    case 3:
     for(let column=0;column<stride;column++)pixels[column]=(pixels[column]+Math.floor(((column>=4?pixels[column-4]:0)+previous[column])/2))&255;
     break;
    case 4:
     for(let column=0;column<stride;column++)pixels[column]=(pixels[column]+paeth(column>=4?pixels[column-4]:0,previous[column],column>=4?previous[column-4]:0))&255;
     break;
    default:invalid();
   }
   for(let column=3;column<stride;column+=4){minimum=Math.min(minimum,pixels[column]);maximum=Math.max(maximum,pixels[column]);}
   digest.update(pixels);previous=pixels;
  }
  return {width,height,bitDepth:depth,alpha:true,rgbaSha256:digest.digest('hex'),alphaExtrema:[minimum,maximum],encodedSha256:createHash('sha256').update(data).digest('hex')};
 }
 return {width,height,bitDepth:depth,alpha:color===4||color===6||transparency};
}
