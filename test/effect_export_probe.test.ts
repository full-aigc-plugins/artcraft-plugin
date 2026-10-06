/** 原生媒体探测响应绑定；不从合成设置推测成片属性。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEffectExportProbe } from '../src/adapters/effect_export_probe.ts';
const fixture=()=>[{command:'file.import',result:{items:[1],errors:[]}},{command:'project.summary',result:{items:[{id:1,type:'Video',size:[320,180],duration:1}]}},{command:'file.interpretFootage',result:{items:[{item:1,frameRate:12}]}}];
test('Effect probe reads uniquely imported video facts',()=>{
 assert.deepEqual(parseEffectExportProbe(JSON.stringify(fixture())),{width:320,height:180,frameRate:12,duration:1});
});
test('Effect probe refuses import errors, extra items and malformed media timing',()=>{
 for(const change of [(r:any)=>r[0].result.errors.push('failed'),(r:any)=>r[0].result.items.push(2),(r:any)=>r[1].result.items[0].type='Image',(r:any)=>r[1].result.items[0].duration=0,(r:any)=>r[1].result.items[0].size[0]=320.5,(r:any)=>r[2].result.items[0].item=2,(r:any)=>r[2].result.items[0].frameRate=0]){const responses=fixture();change(responses);assert.throws(()=>parseEffectExportProbe(JSON.stringify(responses)),/brief_export_probe_invalid/);}
 assert.throws(()=>parseEffectExportProbe('{}'),/brief_export_probe_invalid/);
});
