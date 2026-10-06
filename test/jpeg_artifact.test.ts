import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyArtifact } from '../src/protocol/contracts.ts';
const images=JSON.parse(await readFile(new URL('./fixtures/jpeg-images.json',import.meta.url),'utf8')).images;
function artifact(data:Buffer,metadata:Record<string,any>){return {protocolVersion:'craft-artifact/v1',assetId:'product',version:'v1',sha256:createHash('sha256').update(data).digest('hex'),location:'product.bin',mediaType:'image/jpeg',bytes:data.length,technicalMetadata:metadata,producerTaskId:'t1',sourceRefs:[],dependencies:[],nativeProjectRef:null,renditions:[],evidenceRefs:[],lossReportRef:null};}
test('JPEG baseline progressive gray and CMYK dimensions checked by content',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-jpeg-'));
 try{for(const value of Object.values(images)){
  const data=Buffer.from(value as string,'base64');await writeFile(join(root,'product.bin'),data);
  await verifyArtifact(artifact(data,{width:7,height:5,bitDepth:8,alpha:false}),root);
  for(const metadata of [{width:8},{height:6},{bitDepth:16},{alpha:true}])await assert.rejects(verifyArtifact(artifact(data,metadata),root),/image_metadata_mismatch/);
 }}finally{await rm(root,{recursive:true});}
});
test('JPEG full hash cannot hide truncation or missing scan',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-jpeg-bad-'));const jpeg=Buffer.from(images.rgb,'base64');
 try{for(const data of [jpeg.subarray(0,20),jpeg.subarray(0,jpeg.length-1),Buffer.concat([jpeg,Buffer.from('trailing')]),Buffer.from([255,216,255,217])]){
  await writeFile(join(root,'product.bin'),data);await assert.rejects(verifyArtifact(artifact(data,{}),root),/jpeg_artifact_invalid/);
 }}finally{await rm(root,{recursive:true});}
});
