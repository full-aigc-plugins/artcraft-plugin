/** 有界读取标准 RIFF PCM WAV 的块目录，不加载整段配音到内存。 */
import { open } from 'node:fs/promises';

export async function inspectPcmWav(path:string,bytes:number):Promise<{sampleRate:number;channels:number;bitDepth:number;frames:number}> {
 const file=await open(path,'r');
 const invalid=()=>{throw new Error('wav_invalid');};
 const read=async(position:number,length:number)=>{
  const buffer=Buffer.alloc(length);const result=await file.read(buffer,0,length,position);
  if(result.bytesRead!==length)invalid();return buffer;
 };
 try{
  if(bytes<12)invalid();const header=await read(0,12);
  if(header.toString('ascii',0,4)!=='RIFF'||header.toString('ascii',8,12)!=='WAVE'||header.readUInt32LE(4)+8!==bytes)invalid();
  let position=12,format:Buffer|undefined,dataBytes:number|undefined;
  while(position<bytes){
   if(position+8>bytes)invalid();const chunk=await read(position,8);const length=chunk.readUInt32LE(4),name=chunk.toString('ascii',0,4);
   const end=position+8+length;if(end+(length%2)>bytes)invalid();
   if(name==='fmt '){
    if(format||length<16||length>4096)invalid();format=await read(position+8,length);
   }else if(name==='data'){
    if(!format||dataBytes!==undefined)invalid();dataBytes=length;
   }
   position=end+(length%2);
  }
  if(!format||dataBytes===undefined)invalid();
  const fmt=format!,tag=fmt.readUInt16LE(0),channels=fmt.readUInt16LE(2),sampleRate=fmt.readUInt32LE(4),byteRate=fmt.readUInt32LE(8),blockAlign=fmt.readUInt16LE(12),bitDepth=fmt.readUInt16LE(14);
  if(tag!==1)throw new Error('wav_format_unsupported');
  if(!channels||!sampleRate||![8,16,24,32].includes(bitDepth)||blockAlign!==channels*bitDepth/8||byteRate!==sampleRate*blockAlign||dataBytes!%blockAlign)invalid();
  return {sampleRate,channels,bitDepth,frames:dataBytes!/blockAlign};
 }finally{await file.close();}
}
