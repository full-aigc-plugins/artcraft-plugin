/** 三种设计源工程的原生元数据边界，不将声明当作原生响应。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDesignSourceInspection } from '../src/adapters/design_source_inspection.ts';
const sha='a'.repeat(64),runtime='b'.repeat(64);
const parse=(id:any,value:any,selection:any={})=>parseDesignSourceInspection(id,JSON.stringify(value),sha,runtime,selection);
test('Photo source inspection reads canvas dimensions and binds identities',()=>{
 const record=parse('photocraft',{width:320,height:400});
 assert.deepEqual(record.document,{width:320,height:400});assert.equal(record.nativeProjectSha256,sha);assert.equal(record.nativeRuntimeSha256,runtime);
 assert.match(record.nativeInspectionSha256,/^[a-f0-9]{64}$/);
 for(const value of [{width:0,height:400},{width:320.5,height:400},{width:320,height:16385},{}])assert.throws(()=>parse('photocraft',value),/brief_source_inspection_invalid/);
});
test('Vector source inspection selects the requested board without fallback',()=>{
 const native={artboards:[{rect:[0,0,256,256]},{rect:[280,0,320,180]}]};
 assert.deepEqual(parse('vectorcraft',native,{artboard:1}).document,{width:320,height:180});
 for(const artboard of [undefined,-1,2,0.5])assert.throws(()=>parse('vectorcraft',native,{artboard}),/brief_source_inspection_invalid/);
 for(const rect of [[0,0,0,256],[0,0,256.5,256],[0,0,256],[null,0,256,256]])assert.throws(()=>parse('vectorcraft',{artboards:[{rect}]},{artboard:0}),/brief_source_inspection_invalid/);
});
test('Effect source inspection binds composition identity and validates timing',()=>{
 const comp={id:7,width:320,height:180,frameRate:12,duration:1};
 assert.deepEqual(parse('effectcraft',{activeComp:comp},{composition:7}).document,{width:320,height:180,frameRate:12,duration:1});
 assert.deepEqual(parse('effectcraft',[{command:'comp.info',result:comp}],{composition:7}).document,{width:320,height:180,frameRate:12,duration:1});
 for(const selection of [{},{composition:8}])assert.throws(()=>parse('effectcraft',{activeComp:comp},selection),/brief_source_inspection_invalid/);
 for(const change of [{duration:0},{duration:-1},{frameRate:241},{frameRate:0},{width:0}])assert.throws(()=>parse('effectcraft',{activeComp:{...comp,...change}},{composition:7}),/brief_source_inspection_invalid/);
});
