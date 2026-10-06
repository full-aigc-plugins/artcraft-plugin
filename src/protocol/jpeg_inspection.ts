/** 有界 JPEG 标记检查；不解码熵数据，不推断 EXIF 方向或 ICC 保真。 */
import { open } from 'node:fs/promises';
const maxFile=64*1024*1024;
const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
const invalid=():never=>{throw new Error('jpeg_artifact_invalid');};
const unsupported=():never=>{throw new Error('jpeg_artifact_unsupported');};
/** 有界读取、帧头和扫描边界检查；尺寸描述编码栅格。 */
export async function inspectJpeg(path:string,size:number):Promise<{width:number;height:number;bitDepth:number;alpha:boolean}>{
 if(size>maxFile)unsupported();
 const handle=await open(path,'r'),buffer=Buffer.alloc(size+1);let count=0;
 try{while(count<buffer.length){const read=await handle.read(buffer,count,buffer.length-count,count);if(!read.bytesRead)break;count+=read.bytesRead;}}finally{await handle.close();}
 const data=buffer.subarray(0,count);
 if(count!==size || data[0]!==255 || data[1]!==216)invalid();
 let position=2,scans=0,facts:{width:number;height:number;bitDepth:number;alpha:boolean}|undefined;
 const components=new Set<number>();
 while(position<data.length){
  if(data[position]!==255)invalid();
  while(position<data.length && data[position]===255)position++;
  if(position>=data.length)invalid();
  const marker=data[position++];
  if(marker===0xd9){if(position!==data.length || !facts || !scans)invalid();return facts!;}
  if([0,1,0xd8].includes(marker) || marker>=0xd0 && marker<=0xd7)invalid();
  if(position+2>data.length)invalid();
  const length=data.readUInt16BE(position),end=position+length;
  if(length<2 || end>data.length)invalid();
  const payload=data.subarray(position+2,end);position=end;
  if(sof.has(marker)){
   if(![0xc0,0xc1,0xc2].includes(marker))unsupported();
   if(facts || payload.length<6)invalid();
   const precision=payload[0],height=payload.readUInt16BE(1),width=payload.readUInt16BE(3),total=payload[5];
   if(precision!==8)unsupported();
   if(!width || !height || ![1,3,4].includes(total) || payload.length!==6+3*total)invalid();
   for(let index=0;index<total;index++){
    const identifier=payload[6+3*index],sampling=payload[7+3*index],table=payload[8+3*index];
    if(components.has(identifier) || (sampling>>4)<1 || (sampling>>4)>4 || (sampling&15)<1 || (sampling&15)>4 || table>3)invalid();
    components.add(identifier);
   }
   facts={width,height,bitDepth:8,alpha:false};
  }else if(marker===0xda){
   if(!facts || !payload.length)invalid();
   const total=payload[0];
   if(total<1 || total>components.size || payload.length!==4+2*total)invalid();
   const ids=new Set<number>();
   for(let index=0;index<total;index++){
    const identifier=payload[1+2*index],table=payload[2+2*index];
    if(!components.has(identifier) || ids.has(identifier) || (table>>4)>3 || (table&15)>3)invalid();
    ids.add(identifier);
   }
   scans++;let entropy=false;
   while(position<data.length){
    if(data[position]!==255){entropy=true;position++;continue;}
    const start=position;while(position<data.length && data[position]===255)position++;
    if(position>=data.length)invalid();
    const next=data[position];
    if(next===0 || next>=0xd0 && next<=0xd7){entropy=true;position++;continue;}
    position=start;break;
   }
   if(!entropy)invalid();
  }else if([0xcc,0xdc,0xde,0xdf].includes(marker))unsupported();
 }
 return invalid();
}
