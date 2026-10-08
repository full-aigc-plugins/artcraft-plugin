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
