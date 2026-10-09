/** 公共继承依赖字段的行为测试，文件摘要核验由公开适配器和原生联调覆盖。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {collectedDependencies} from '../src/adapters/collected_dependencies.ts';
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
const ref=(assetId:string,sha256=a)=>({assetId,version:sha256,sha256});
const dep=(assetRef:any,kind='media')=>({assetRef,kind,packaged:true,missingReason:null});
const asset=(path:string,sha256=a,kind?:string)=>({path,sha256,...(kind?{kind}:{})});
const manifest=(assets:any)=>({assets,files:Object.fromEntries(Object.values(assets).map((x:any)=>[x.path,x.sha256]))});
test('reopen retains all inherited media and LUT logical identities, not font records',()=>{
 const m=manifest({logo:asset('assets/logo.png'),grade:asset('luts/grade.cube',b,'lut')});
 const source={assetId:'source',dependencies:[dep(ref('logo')),dep(ref('grade',b),'lut'),{assetRef:null,kind:'font'}],sourceRefs:[]};
 const result=collectedDependencies(m,[],source,m,'project');
 assert.deepEqual(result,[dep({...ref('logo'),location:'assets/logo.png'}),dep({...ref('grade',b),location:'luts/grade.cube'},'lut')]);
});
test('legacy missing dependency metadata can recover known input identity from sourceRefs',()=>{
 const m=manifest({voice:asset('media/voice.wav')});
 assert.deepEqual(collectedDependencies(m,[],{assetId:'film',sourceRefs:[ref('voice')],dependencies:[]},m,'project'),[dep({...ref('voice'),location:'media/voice.wav'})]);
});
test('unknown legacy provenance becomes a stable collected identity without invented input lineage',()=>{
 const m=manifest({logo:asset('assets/logo.png')});
 const first=collectedDependencies(m,[],{assetId:'legacy',dependencies:[],sourceRefs:[]},m,'project');
 assert.equal(first.length,1);assert.match(first[0].assetRef.assetId,/^collected-[a-f0-9]{32}$/);assert.equal(first[0].assetRef.sha256,a);assert.equal(first[0].assetRef.location,'assets/logo.png');
 const second=collectedDependencies(m,[],{assetId:'reopened',dependencies:first,sourceRefs:[ref('legacy',c)]},m,'different-project-key');assert.deepEqual(second,first);
});
test('explicit replacement uses its new logical identity and removes old or removed dependencies',()=>{
 const old=manifest({logo:asset('assets/old.png'),gone:asset('gone.png',c)}),m=manifest({logo:asset('assets/new.png',b)});
 assert.deepEqual(collectedDependencies(m,[{alias:'logo',artifact:ref('new-logo',b)}],{assetId:'old',dependencies:[dep(ref('old-logo')),dep(ref('gone',c))],sourceRefs:[]},old,'project'),[dep({...ref('new-logo',b),location:'assets/new.png'})]);
});
test('same collected content preserves multiple known identities and deduplicates exact repeats',()=>{
 const m=manifest({logo:asset('logo.png')});
 const result=collectedDependencies(m,[],{assetId:'source',dependencies:[dep(ref('one')),dep(ref('two')),dep(ref('one'))],sourceRefs:[ref('one')]},m,'project');
 assert.deepEqual(result,[dep({...ref('one'),location:'logo.png'}),dep({...ref('two'),location:'logo.png'})]);
});
test('normalized sequence dependency describes actual collected bytes and retains identity on reopen',()=>{
 const m=manifest({animation:{...asset('sequence/sequence.json',b,'image-sequence'),sourceSequenceSha256:a}});
 const first=collectedDependencies(m,[{alias:'animation',artifact:ref('animation',a)}],null,null,'project');
 assert.equal(first.length,1);assert.notEqual(first[0].assetRef.assetId,'animation');assert.equal(first[0].assetRef.sha256,b);assert.equal(first[0].assetRef.version,b);
 assert.deepEqual(collectedDependencies(m,[],{assetId:'source',dependencies:first,sourceRefs:[ref('animation',a)]},m,'other'),first);
});
