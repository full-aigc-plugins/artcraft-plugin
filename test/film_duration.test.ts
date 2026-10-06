/** 摘要绑定的 Film 时长验收，不以伪媒体证明原生渲染。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyFilmDuration } from '../src/planning/film_duration.ts';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
async function fixture(native:string|number='254016000000',exported=native){
 const root=await mkdtemp(join(tmpdir(),'craft-film-duration-'));
 const files:Record<string,string>={};
 const values={'project.fcproj':'fixture project','film.mp4':'fixture media','native.json':JSON.stringify({sequence:{duration:native,settings:{frame_rate:{num:12,den:1}}}}),'export-probe.json':JSON.stringify({duration:exported,video:{frame_rate:{num:12,den:1}}})};
 for(const [name,value] of Object.entries(values)){await writeFile(join(root,name),value);files[name]=sha(value);}
 const manifest=JSON.stringify({schema:'filmcraft-delivery/v1',files});await writeFile(join(root,'manifest.json'),manifest);
 const ref=(location:string,digest:string)=>({assetId:location,version:digest,sha256:digest,location});
 const output={protocolVersion:'craft-artifact/v1',assetId:'film',version:files['film.mp4'],sha256:files['film.mp4'],bytes:Buffer.byteLength(values['film.mp4']),mediaType:'application/octet-stream',producerTaskId:'task',sourceRefs:[],nativeProjectRef:ref('project.fcproj',files['project.fcproj']),renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[ref('manifest.json',sha(manifest))],location:'film.mp4'};
 return {root,output,cleanup:()=>rm(root,{recursive:true})};
}
test('native duration matches Brief and export accepts one frame mux tolerance',async()=>{
 const f=await fixture('254016000000','275184000000');try{await verifyFilmDuration(f.root,[f.output],1);}finally{await f.cleanup();}
});
test('native mismatch cannot pass using a correct export declaration',async()=>{
 const f=await fixture('508032000000','254016000000');try{await assert.rejects(verifyFilmDuration(f.root,[f.output],1),/film_duration_mismatch/);}finally{await f.cleanup();}
});
test('export outside one frame fails even when native duration matches',async()=>{
 const f=await fixture('254016000000','275184000001');try{await assert.rejects(verifyFilmDuration(f.root,[f.output],1),/film_duration_mismatch/);}finally{await f.cleanup();}
});
test('changed inspection evidence is rejected on reuse',async()=>{
 const f=await fixture();try{await verifyFilmDuration(f.root,[f.output],1);await writeFile(join(f.root,'native.json'),'{}');await assert.rejects(verifyFilmDuration(f.root,[f.output],1));}finally{await f.cleanup();}
});
test('numeric and overflowing ticks cannot lose precision silently',async()=>{
 for(const value of [254016000000,'9223372036854775808','0254016000000']){const f=await fixture(value);try{await assert.rejects(verifyFilmDuration(f.root,[f.output],1),/film_duration_evidence_invalid/);}finally{await f.cleanup();}}
});
test('changed exported probe is rejected before using its duration',async()=>{
 const f=await fixture();try{await writeFile(join(f.root,'export-probe.json'),'{}');await assert.rejects(verifyFilmDuration(f.root,[f.output],1));}finally{await f.cleanup();}
});
test('missing manifest binding cannot publish a Film duration requirement',async()=>{
 const f=await fixture();try{f.output.evidenceRefs=[];await assert.rejects(verifyFilmDuration(f.root,[f.output],1),/film_duration_evidence_missing/);}finally{await f.cleanup();}
});
