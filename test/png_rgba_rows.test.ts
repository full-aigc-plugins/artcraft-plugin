/** 独立 PNG 编码器核验五种滤波的多行、回绕和前行依赖。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { inspectPng } from '../src/protocol/png_inspection.ts';
function crc(bytes:Buffer){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;}
function chunk(kind:string,body:Buffer){const data=Buffer.concat([Buffer.from(kind),body]),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(body.length);checksum.writeUInt32BE(crc(data));return Buffer.concat([size,data,checksum]);}
function paeth(a:number,b:number,c:number){const p=a+b-c,distances=[Math.abs(p-a),Math.abs(p-b),Math.abs(p-c)];return [a,b,c][distances.indexOf(Math.min(...distances))];}
function png(rows:Buffer[],filters:number[]){
 const head=Buffer.alloc(13);head.writeUInt32BE(rows[0].length/4);head.writeUInt32BE(rows.length,4);head[8]=8;head[9]=6;
 let previous=Buffer.alloc(rows[0].length);const encoded:Buffer[]=[];
 for(let y=0;y<rows.length;y++){const row=rows[y],filter=filters[y],data=Buffer.alloc(row.length+1);data[0]=filter;
  for(let x=0;x<row.length;x++){const a=x>=4?row[x-4]:0,b=previous[x],c=x>=4?previous[x-4]:0;data[x+1]=(row[x]-[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}
  previous=row;encoded.push(data);
 }
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',deflateSync(Buffer.concat(encoded))),chunk('IEND',Buffer.alloc(0))]);
}
test('RGBA rows preserve five filters, wraparound and prior-row dependencies',async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-rgba-rows-'));
 try{const rows=Array.from({length:5},(_,y)=>Buffer.from(Array.from({length:32},(_,x)=>(x*37+y*71)%256)));
  for(const filters of [[0,1,2,3,4],[4,3,2,1,0],[2,2,2,2,2],[4,4,4,4,4]]){const data=png(rows,filters),path=join(root,'frame.png');await writeFile(path,data);const facts=await inspectPng(path,data.length,true),alpha=rows.flatMap(row=>Array.from(row).filter((_,i)=>i%4===3));assert.equal(facts.rgbaSha256,createHash('sha256').update(Buffer.concat(rows)).digest('hex'));assert.deepEqual(facts.alphaExtrema,[Math.min(...alpha),Math.max(...alpha)]);}
 }finally{await rm(root,{recursive:true});}
});
test('RGBA repeated rows preserve zero residual predictors',async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-rgba-zero-'));
 try{for(const row of [Buffer.alloc(32),Buffer.alloc(32,255),Buffer.from(Array.from({length:32},(_,i)=>[0,255,128,0][i%4]))])for(let filter=0;filter<5;filter++){const data=png([row,row,row],[filter,filter,filter]),path=join(root,'frame.png');await writeFile(path,data);const facts=await inspectPng(path,data.length,true);assert.equal(facts.rgbaSha256,createHash('sha256').update(Buffer.concat([row,row,row])).digest('hex'));}}
 finally{await rm(root,{recursive:true});}
});
