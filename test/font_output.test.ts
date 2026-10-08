/** 摘要绑定字体复用合同；原生结构夹具不代替实际桌面验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyDomainFontOutput} from '../src/adapters/font_output.ts';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const native=(domain:string,text:boolean)=>domain==='photocraft'?{layers:text?[{kind:'Type',text:{font:'Arial'}}]:[]}:domain==='vectorcraft'?{layers:text?[{kind:{type:'text',runs:[{style:{font_family:'Arial'}}]}}]:[]}:domain==='filmcraft'?{format:'filmcraft.project',schema_version:12,project:{items:{},caption_tracks:text?[{style:{font:'Arial'}}]:[]}}:{schema:1,items:text?{'1':{value:{t:'Text',v:{font:'Arial'}}}}:{}};
for(const [domain,extension] of [['photocraft','pcraft'],['vectorcraft','vectorcraft'],['filmcraft','fcproj'],['effectcraft','ecproj']]){
 for(const text of [true,false])test(`${domain} ${text?'editable text':'fontless project'} verifies actual full evidence on reuse`,async()=>{
  const root=await mkdtemp(join(tmpdir(),'art-font-reuse-'));try{
   const project='project.'+extension,location=['filmcraft','effectcraft'].includes(domain)?project:'native.json',data=JSON.stringify(native(domain,text)),runtime=sha('runtime');
   const contents:Record<string,string>={[project]:location===project?data:'binary native fixture','native.json':data,'output.bin':'media'};
   const files:Record<string,string>={};for(const [name,value] of Object.entries(contents)){await writeFile(join(root,name),value);files[name]=sha(value);}
   const manifest=JSON.stringify({schema:domain+'-delivery/v1',runtimeSha256:runtime,files});await writeFile(join(root,'manifest.json'),manifest);
   const ref=(name:string,digest=files[name])=>({assetId:name,location:name,sha256:digest,version:digest});
   const inspectionRef=ref(location),output:any={protocolVersion:'craft-artifact/v1',assetId:'result',version:files['output.bin'],sha256:files['output.bin'],bytes:5,mediaType:'application/octet-stream',producerTaskId:'task',sourceRefs:[],nativeProjectRef:ref(project),renditions:[],evidenceRefs:[ref('manifest.json',sha(manifest)),...(text?[inspectionRef]:[])],lossReportRef:null,technicalMetadata:{},location:'output.bin',dependencies:text?[{assetRef:null,kind:'font',packaged:false,missingReason:'font_file_not_collected',fontRequirement:{family:'Arial',nativeProjectSha256:files[project],inspectionRef}}]:[]};
   await verifyDomainFontOutput(root,output,domain,runtime);
   if(text){
    for(const patch of [[],[...output.dependencies,...output.dependencies],[{...output.dependencies[0],fontRequirement:{...output.dependencies[0].fontRequirement,family:'Fake Font'}}]]){
     await assert.rejects(verifyDomainFontOutput(root,{...output,dependencies:patch},domain,runtime),/font_dependency_mismatch/);
    }
    await assert.rejects(verifyDomainFontOutput(root,{...output,evidenceRefs:output.evidenceRefs.slice(0,1)},domain,runtime),/font_dependency_mismatch/);
   }else{
    await assert.rejects(verifyDomainFontOutput(root,{...output,dependencies:[{kind:'font',fontRequirement:{family:'Arial'}}]},domain,runtime),/font_dependency_mismatch/);
   }
   await assert.rejects(verifyDomainFontOutput(root,output,domain,sha('other-runtime')),/font_inspection_invalid/);
   await writeFile(join(root,location),JSON.stringify(native(domain,!text)));
   await assert.rejects(verifyDomainFontOutput(root,output,domain,runtime),/artifact_digest_mismatch/);
  }finally{await rm(root,{recursive:true});}
 });
}
