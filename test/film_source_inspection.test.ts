/** 大整数源工程检查记录的精度与原生字段边界。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseFilmSourceInspection } from '../src/adapters/film_source_inspection.ts';
const source=(duration:string)=>`{"sequence":{"duration":${duration},"settings":{"width":320,"height":180,"frame_rate":{"num":12,"den":1}}}}`;
test('native source inspection preserves integer tokens beyond safe Number precision',()=>{
 const json=source('21946982400000001'),record=parseFilmSourceInspection(json,'a'.repeat(64),'b'.repeat(64));
 assert.equal(record.durationTicks,'21946982400000001');assert.equal(record.nativeInspectionSha256,createHash('sha256').update(json).digest('hex'));
 assert.equal(record.nativeProjectSha256,'a'.repeat(64));assert.equal(record.nativeRuntimeSha256,'b'.repeat(64));
});
test('native source inspection refuses noncanonical, overflowing and missing ticks',()=>{
 for(const duration of ['1.0','2.54016e11','-1','0','9223372036854775808','null'])assert.throws(()=>parseFilmSourceInspection(source(duration),'a'.repeat(64),'b'.repeat(64)),/brief_source_inspection_invalid/);
});
test('native source inspection refuses malformed dimensions and frame rate',()=>{
 for(const change of [(n:any)=>n.sequence.settings.width=0,(n:any)=>n.sequence.settings.height=16385,(n:any)=>n.sequence.settings.frame_rate.den=0,(n:any)=>n.sequence.settings.frame_rate.num=300]){const native=JSON.parse(source('254016000000'));change(native);assert.throws(()=>parseFilmSourceInspection(JSON.stringify(native),'a'.repeat(64),'b'.repeat(64)),/brief_source_inspection_invalid/);}
 assert.throws(()=>parseFilmSourceInspection('{}','a'.repeat(64),'b'.repeat(64)),/brief_source_inspection_invalid/);
});
