import test from 'node:test';
import assert from 'node:assert/strict';
import {validateArtifact} from '../src/protocol/contracts.ts';
const sha='a'.repeat(64), other='b'.repeat(64);
const inspection={assetId:'inspection',version:sha,sha256:sha,location:'native.json'};
function sample():any{return {protocolVersion:'craft-artifact/v1',assetId:'poster',version:sha,sha256:sha,bytes:1,mediaType:'application/octet-stream',producerTaskId:'task',sourceRefs:[],nativeProjectRef:{assetId:'native',version:sha,sha256:sha,location:'project.pcraft'},renditions:[],dependencies:[{assetRef:null,kind:'font',packaged:false,missingReason:'font_file_not_collected',fontRequirement:{family:'Arial',nativeProjectSha256:sha,inspectionRef:inspection}}],technicalMetadata:{},lossReportRef:null,evidenceRefs:[inspection],location:'poster.bin'};}
test('uncollected font has a real inspection identity without inventing font bytes',()=>{
 assert.equal(validateArtifact(sample()).dependencies[0].assetRef,null);
});
test('null dependency cannot disguise packaged font or missing media',()=>{
 for(const patch of [{packaged:true,missingReason:null},{kind:'media'},{fontRequirement:undefined}]){
  const value=sample();Object.assign(value.dependencies[0],patch);if(patch.fontRequirement===undefined&&Object.hasOwn(patch,'fontRequirement'))delete value.dependencies[0].fontRequirement;
  assert.throws(()=>validateArtifact(value),/font_dependency_invalid|protocol_invalid/);
 }
});
test('font requirement must bind current native project and listed evidence',()=>{
 for(const patch of [{nativeProjectSha256:other},{inspectionRef:{...inspection,sha256:other,version:other}}]){
  const value=sample();Object.assign(value.dependencies[0].fontRequirement,patch);assert.throws(()=>validateArtifact(value),/font_dependency_invalid/);
 }
 const value=sample();value.evidenceRefs=[];assert.throws(()=>validateArtifact(value),/font_dependency_invalid/);
});

import {photoFontDependencies} from '../src/adapters/font_dependencies.ts';
test('Photo native inspection collects editable fonts including hidden and grouped layers',()=>{
 const dependencies=photoFontDependencies({layers:[{kind:'Type',visible:false,text:{font:'Arial',text:'A'}},{kind:'Group',layers:[{kind:'Type',text:{font:'Noto Sans',text:'B'}},{kind:'Type',text:{font:'Arial',text:'C'}}]},{kind:'Pixel',name:'Arial'}]},sha,inspection);
 assert.deepEqual(dependencies.map(item=>item.fontRequirement.family),['Arial','Noto Sans']);
 const value=sample();value.dependencies=dependencies;validateArtifact(value);
});
test('Photo inspection cannot silently omit an unknown editable font',()=>{
 for(const text of [{text:'A'},{font:''},{font:42}])assert.throws(()=>photoFontDependencies({layers:[{kind:'Type',text}]},sha,inspection),/font_inspection_invalid/);
 assert.deepEqual(photoFontDependencies({layers:[{kind:'Pixel'}]},sha,inspection),[]);
});

import {domainFontDependencies} from '../src/adapters/font_dependencies.ts';
test('Vector full tree preserves text runs in nested hidden groups and ignores image names',()=>{
 const native={layers:[{kind:{type:'layer',children:[{visible:false,kind:{type:'group',children:[{kind:{type:'text',runs:[{text:'A',style:{font_family:'Arial'}},{text:'B',style:{font_family:'Source Sans 3'}}]}}]}},{kind:{type:'image',name:'Noto Sans'}}]}}]};
 assert.deepEqual(domainFontDependencies('vectorcraft',native,sha,inspection).map(d=>d.fontRequirement.family),['Arial','Source Sans 3']);
});
test('Film raw project finds captions, graphic parameters, character overrides and future font keys',()=>{
 const native:any={format:'filmcraft.project',schema_version:12,project:{items:{},source_graphics:{}}};
 native.project.items['7']={kind:{Sequence:{caption_tracks:[{style:{font:'Arial'}}]}}};
 native.project.source_graphics['8']={layers:[{effect:'graphic_text',params:{font:{value:{Text:'Inter'},keyframes:[{time:'9007199254740993',value:{Text:'Noto Sans'}}]}},layer:{runs:[{style:{font:'Source Sans 3'}},{style:{font:null}}]}}]};
 assert.deepEqual(domainFontDependencies('filmcraft',native,sha,inspection).map(d=>d.fontRequirement.family),['Arial','Inter','Noto Sans','Source Sans 3']);
});
test('Effect full TextDoc retains base, character-run and keyframed fonts',()=>{
 const property={node:'Prop',match:'sourceText',value:{t:'Text',v:{font:'Arial',runs:[{style:{font:'Source Sans 3'}}]}},keys:[{value:{t:'Text',v:{font:'Noto Sans'}}}]};
 const native={schema:1,items:{'1':{kind:{type:'Composition',layers:[{source:{type:'Text'},props:{children:[property]}}]}}}};
 assert.deepEqual(domainFontDependencies('effectcraft',native,sha,inspection).map(d=>d.fontRequirement.family),['Arial','Noto Sans','Source Sans 3']);
});
test('unsupported native versions and malformed editable fonts cannot become empty requirements',()=>{
 for(const [domain,native] of [['filmcraft',{format:'filmcraft.project',schema_version:13,project:{}}],['effectcraft',{schema:2,items:{}}],['vectorcraft',{layers:[{kind:{type:'text',runs:[{style:{}}]}}]}],['effectcraft',{schema:1,items:{'1':{value:{t:'Text',v:{font:42}}}}}]])assert.throws(()=>domainFontDependencies(domain as string,native,sha,inspection),/font_inspection_invalid/);
});

test('font extraction bounds recursion and rejects structurally incomplete native projects',()=>{
 let deep:any={type:'text',runs:[{style:{font_family:'Arial'}}]};for(let i=0;i<130;i++)deep={children:[deep]};
 assert.throws(()=>domainFontDependencies('vectorcraft',{layers:[deep]},sha,inspection),/font_inspection_invalid/);
 assert.throws(()=>domainFontDependencies('filmcraft',{format:'filmcraft.project',schema_version:12,project:{}},sha,inspection),/font_inspection_invalid/);
});
test('legacy Effect string keyframes retain the native Inter default and reject unknown typed text',()=>{
 const property:any={node:'Prop',match:'sourceText',value:{t:'Text',v:{font:'Arial'}},keys:[{value:{t:'Str',v:'Legacy text'}}]};
 const native={schema:1,items:{'1':{props:{children:[property]}}}};
 assert.deepEqual(domainFontDependencies('effectcraft',native,sha,inspection).map(d=>d.fontRequirement.family),['Arial','Inter']);
 property.keys[0].value={t:'FutureText',v:'Opaque'};
 assert.throws(()=>domainFontDependencies('effectcraft',native,sha,inspection),/font_inspection_invalid/);
});
