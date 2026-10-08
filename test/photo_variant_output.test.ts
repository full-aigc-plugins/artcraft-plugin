/** 摘要绑定的尺寸变体证据；夹具用于门禁，不代表原生创作验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {verifyPhotoVariantOutput} from '../src/planning/photo_variant_output.ts';
const hash=(x:Buffer|string)=>createHash('sha256').update(x).digest('hex');
async function fixture(change:(x:any)=>void=()=>{}){
 const root=await mkdtemp(join(tmpdir(),'craft-photo-variant-'));const runtime='b'.repeat(64),source='c'.repeat(64);
 const config={width:120,height:80,safeArea:[10,10,100,60],roles:{background:1,product:2,text:3}};
 const native={width:120,height:80,layers:[{id:1,name:'Background',kind:'Pixel',visible:true,bounds:[10,-10,100,100]},{id:2,name:'Product',kind:'Pixel',visible:true,bounds:[30,20,20,20]},{id:3,name:'Title',kind:'Type',visible:true,bounds:[30,10,30,10],text:{text:'NOVA',font:'Arial'}}]};
 const layout={schema:'photocraft-layout-variant/v1',sourceSize:[100,100],targetSize:[120,80],safeArea:[10,10,100,60],steps:[{command:'image.canvasSize',before:[100,100],after:[120,80],offset:[10,-10],crop:{left:0,top:10,right:0,bottom:10},padding:{left:10,top:0,right:10,bottom:0}}],roles:Object.fromEntries(['background','product','text'].map((role,index)=>[role,{...native.layers[index]}]))};
 const operations=[{tool:'doc_inspect',arguments:{},result:{width:100,height:100}},{tool:'command_run',arguments:{id:'image.canvasSize',params:{width:120,height:80}},result:{width:120,height:80,offset:[10,-10]}}];
 const data={config,native,layout,operations};change(data);
 const files:any={'project.pcraft':'unit-native','design.png':'unit-export','native.json':JSON.stringify(data.native),'layout-variant.json':JSON.stringify(data.layout),'operations.json':JSON.stringify(data.operations),'plan.json':JSON.stringify({variant:data.config})};
 const digests:any={};for(const [name,bytes]of Object.entries(files) as [string,string][]){await writeFile(join(root,name),bytes);digests[name]=hash(bytes);}
 const manifest={schema:'photocraft-delivery/v1',runtimeSha256:runtime,sourceProjectSha256:source,files:digests,bindings:{},layoutVariant:{path:'layout-variant.json',sha256:digests['layout-variant.json']}};const bytes=JSON.stringify(manifest);await writeFile(join(root,'manifest.json'),bytes);
 const ref=(location:string,sha256:string)=>({assetId:'ref-'+location,version:sha256,location,sha256});
 const output={protocolVersion:'craft-artifact/v1',assetId:'poster',version:digests['design.png'],sha256:digests['design.png'],bytes:11,mediaType:'application/octet-stream',producerTaskId:'test',sourceRefs:[],nativeProjectRef:ref('project.pcraft',digests['project.pcraft']),renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[ref('manifest.json',hash(bytes))],location:'design.png'};
 const node:any={runtimeIdentity:{pluginId:'photocraft',sha256:runtime},expectedRevision:source,payload:{plan:{variant:config,operations:[{command:'image.canvasSize',params:{width:120,height:80}}]}}};
 return {root,node,output,cleanup:()=>rm(root,{recursive:true})};
}
test('valid variant binds native roles and actual resize receipts',async()=>{const f=await fixture();try{await verifyPhotoVariantOutput(f.root,[f.output],f.node);}finally{await f.cleanup();}});
for(const [name,change]of Object.entries({
 'unsafe native bounds':(x:any)=>{x.native.layers[1].bounds=[0,0,20,20];x.layout.roles.product.bounds=[0,0,20,20];},
 'flattened text role':(x:any)=>{x.native.layers[2].kind='Pixel';x.layout.roles.text.kind='Pixel';},
 'false padding record':(x:any)=>{x.layout.steps[0].padding.left=9;},
 'wrong returned offset':(x:any)=>{x.operations[1].result.offset=[0,0];},
 'wrong final dimensions':(x:any)=>{x.native.width=121;},
 'duplicate role ids':(x:any)=>{x.layout.roles.text.id=2;},
 'missing resize receipt':(x:any)=>{x.operations=[];}
})){test(name+' is rejected even with consistent file hashes',async()=>{const f=await fixture(change);try{await assert.rejects(verifyPhotoVariantOutput(f.root,[f.output],f.node),/photo_variant_evidence_invalid/);}finally{await f.cleanup();}});}
test('a stale layout record cannot pass reuse',async()=>{const f=await fixture();try{await writeFile(join(f.root,'layout-variant.json'),'{}');await assert.rejects(verifyPhotoVariantOutput(f.root,[f.output],f.node),/photo_variant_evidence_stale/);}finally{await f.cleanup();}});

test('legacy cache without manifest-bound geometry is refused despite matching outer hashes',async()=>{
 const f=await fixture();
 try{
  const {readFile}=await import('node:fs/promises');
  const manifest=JSON.parse(await readFile(join(f.root,'manifest.json'),'utf8'));
  delete manifest.layoutVariant;
  const bytes=JSON.stringify(manifest);await writeFile(join(f.root,'manifest.json'),bytes);
  f.output.evidenceRefs[0].sha256=hash(bytes);f.output.evidenceRefs[0].version=hash(bytes);
  await assert.rejects(verifyPhotoVariantOutput(f.root,[f.output],f.node),/photo_variant_evidence_missing/);
 }finally{await f.cleanup();}
});
