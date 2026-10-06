/** 保存后原生记录的摘要与目标绑定；合成导出检查另行验证。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyNativeBriefOutput } from '../src/planning/native_brief_output.ts';
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
async function fixture(plugin:string,native:any,location='output.bin',outputBytes=Buffer.from('unit-output')){
 const root=await mkdtemp(join(tmpdir(),'craft-native-brief-'));const extension={photocraft:'pcraft',effectcraft:'ecproj',vectorcraft:'vectorcraft',filmcraft:'fcproj'}[plugin]!;
 const project='project.'+extension,runtime='b'.repeat(64),projectBytes=Buffer.from('unit-native-project'),nativeBytes=JSON.stringify(native);
 const manifest:any={schema:plugin+'-delivery/v1',runtimeSha256:runtime,bindings:{composition:{comp:7}},files:{[project]:hash(projectBytes),'native.json':hash(nativeBytes),[location]:hash(outputBytes)}};
 const ref=(location:string,sha256:string)=>({assetId:'ref-'+location,version:sha256,sha256,location});
 const manifestBytes=JSON.stringify(manifest);
 for(const [name,bytes] of [[project,projectBytes],['native.json',nativeBytes],[location,outputBytes],['manifest.json',manifestBytes]] as const)await writeFile(join(root,name),bytes);
 const output:any={protocolVersion:'craft-artifact/v1',assetId:'output',version:hash(outputBytes),sha256:hash(outputBytes),bytes:outputBytes.length,mediaType:'application/octet-stream',producerTaskId:'unit',sourceRefs:[],nativeProjectRef:ref(project,hash(projectBytes)),renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[ref('manifest.json',hash(manifestBytes))],location};
 const brief:any={nativeFormat:'.'+extension,width:320,height:180};
 return {root,output,brief,runtime,cleanup:()=>rm(root,{recursive:true})};
}
test('saved Photo native canvas must match Brief and remain hash bound',async()=>{
 const f=await fixture('photocraft',{width:320,height:180});try{
  await verifyNativeBriefOutput(f.root,[f.output],f.brief,f.runtime);
  await assert.rejects(verifyNativeBriefOutput(f.root,[f.output],{...f.brief,width:321},f.runtime),/brief_native_size_mismatch/);
  await writeFile(join(f.root,'native.json'),JSON.stringify({width:321,height:180}));
  await assert.rejects(verifyNativeBriefOutput(f.root,[f.output],f.brief,f.runtime),/artifact_digest_mismatch|brief_native_evidence_stale/);
 }finally{await f.cleanup();}
});
test('saved Vector native selects exported board bounds rather than document default',async()=>{
 const f=await fixture('vectorcraft',{artboards:[{rect:{x0:0,y0:0,x1:256,y1:256}},{rect:{x0:256,y0:0,x1:576,y1:180}}]},'artboard-2.svg');try{
  await verifyNativeBriefOutput(f.root,[f.output],f.brief,f.runtime);
  await assert.rejects(verifyNativeBriefOutput(f.root,[f.output],{...f.brief,width:256,height:256},f.runtime),/brief_native_size_mismatch/);
 }finally{await f.cleanup();}
});
test('saved Effect native checks composition binding, frame rate and duration',async()=>{
 const f=await fixture('effectcraft',{composition:{id:7,width:320,height:180,frameRate:12,duration:1}});try{
  const brief={...f.brief,frameRate:{num:12,den:1},durationSeconds:1};await verifyNativeBriefOutput(f.root,[f.output],brief,f.runtime);
  await assert.rejects(verifyNativeBriefOutput(f.root,[f.output],{...brief,frameRate:{num:24,den:1}},f.runtime),/brief_native_frame_rate_mismatch/);
  await assert.rejects(verifyNativeBriefOutput(f.root,[f.output],{...brief,durationSeconds:2},f.runtime),/brief_native_duration_mismatch/);
  await assert.rejects(verifyNativeBriefOutput(f.root,[f.output],brief,'c'.repeat(64)),/brief_native_evidence_invalid/);
 }finally{await f.cleanup();}
 const wrong=await fixture('effectcraft',{composition:{id:8,width:320,height:180,frameRate:12,duration:1}});try{await assert.rejects(verifyNativeBriefOutput(wrong.root,[wrong.output],wrong.brief,wrong.runtime),/brief_native_evidence_invalid/);}finally{await wrong.cleanup();}
});

test('matching native canvas cannot substitute for the exported PNG dimensions',async()=>{
 const f=await fixture('photocraft',{width:320,height:180},'design.png');try{
  await assert.rejects(verifyNativeBriefOutput(f.root,[f.output],f.brief,f.runtime),/brief_export_image_invalid/);
 }finally{await f.cleanup();}
});

test('a valid one-pixel PNG cannot satisfy a 320-pixel native canvas Brief',async()=>{
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=','base64');
 const f=await fixture('photocraft',{width:320,height:180},'design.png',png);try{await assert.rejects(verifyNativeBriefOutput(f.root,[f.output],f.brief,f.runtime),/brief_export_size_mismatch/);}finally{await f.cleanup();}
});
