import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyArtifact } from '../src/protocol/contracts.ts';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DQAAAEgQGALFXOsAAAAABJRU5ErkJggg==','base64');
function artifact(data:Buffer,metadata:Record<string,any>){return {protocolVersion:'craft-artifact/v1',assetId:'product',version:'v1',sha256:createHash('sha256').update(data).digest('hex'),location:'product.bin',mediaType:'image/png',bytes:data.length,technicalMetadata:metadata,producerTaskId:'t1',sourceRefs:[],dependencies:[],nativeProjectRef:null,renditions:[],evidenceRefs:[],lossReportRef:null};}
test('PNG real dimensions and alpha are verified even with a binary filename',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-png-'));
 try{
  await writeFile(join(root,'product.bin'),png);
  await verifyArtifact(artifact(png,{width:1,height:1,bitDepth:8,alpha:true}),root);
  for(const metadata of [{width:2},{height:2},{bitDepth:16},{alpha:false}])await assert.rejects(verifyArtifact(artifact(png,metadata),root),/image_metadata_mismatch/);
 }finally{await rm(root,{recursive:true});}
});
test('PNG correct digest cannot hide truncated or CRC-corrupt contents',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-png-bad-'));
 try{
  const crc=Buffer.from(png);crc[29]^=1;
  for(const data of [png.subarray(0,33),crc]){
   await writeFile(join(root,'product.bin'),data);
   await assert.rejects(verifyArtifact(artifact(data,{}),root),/png_artifact_invalid/);
  }
 }finally{await rm(root,{recursive:true});}
});

// 固定 Python stdlib 编码样本，覆盖全部标准位深与颜色类型、Adam7。
const fixtures=[{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==","metadata":{"width":1,"height":1,"bitDepth":1,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAgAAAABwzoP0AAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==","metadata":{"width":1,"height":1,"bitDepth":2,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABBAAAAAD/jnZUAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==","metadata":{"width":1,"height":1,"bitDepth":4,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==","metadata":{"width":1,"height":1,"bitDepth":8,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABEAAAAABq7kcWAAAAC0lEQVR4nGNgYAAAAAMAAbitOmMAAAAASUVORK5CYII=","metadata":{"width":1,"height":1,"bitDepth":16,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC","metadata":{"width":1,"height":1,"bitDepth":8,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABEAIAAADA54+dAAAAC0lEQVR4nGNgAAMAAAcAAbKGrPQAAAAASUVORK5CYII=","metadata":{"width":1,"height":1,"bitDepth":16,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==","metadata":{"width":1,"height":1,"bitDepth":1,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAgMAAABieywaAAAAA1BMVEUAAACnej3aAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==","metadata":{"width":1,"height":1,"bitDepth":2,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABBAMAAADtO9m6AAAAA1BMVEUAAACnej3aAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==","metadata":{"width":1,"height":1,"bitDepth":4,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAAAA1BMVEUAAACnej3aAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==","metadata":{"width":1,"height":1,"bitDepth":8,"alpha":false}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAbitOmMAAAAASUVORK5CYII=","metadata":{"width":1,"height":1,"bitDepth":8,"alpha":true}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABEAQAAADljNBBAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=","metadata":{"width":1,"height":1,"bitDepth":16,"alpha":true}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=","metadata":{"width":1,"height":1,"bitDepth":8,"alpha":true}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABEAYAAABPhRjKAAAAC0lEQVR4nGNggAIAAAkAAftSuKkAAAAASUVORK5CYII=","metadata":{"width":1,"height":1,"bitDepth":16,"alpha":true}},{"base64":"iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAAEhL4UpAAAADElEQVR4nGNgIBYAAAAqAAFi4XRDAAAAAElFTkSuQmCC","metadata":{"width":3,"height":3,"bitDepth":8,"alpha":true}}];
test('PNG standard depth/color and Adam7 corpus agrees with declared facts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-png-corpus-'));
 try{for(const sample of fixtures){const bytes=Buffer.from(sample.base64,'base64');await writeFile(join(root,'product.bin'),bytes);await verifyArtifact(artifact(bytes,sample.metadata),root);}}finally{await rm(root,{recursive:true});}
});
