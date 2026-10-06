/** 输出只作为报告解析；非结构化文本、冲突和超限不能变成可信领域原因。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { OutputObservation, nativeDiagnostics } from '../src/harness/native_diagnostics.ts';

async function observe(value:string){
 const stream=Readable.from([Buffer.from(value)]),observation=new OutputObservation(stream);
 await finished(stream);return observation;
}
test('only closed known JSON error reports become domain codes',async()=>{
 for(const value of ['private log protected_region_changed','{"error":"missing_fonts","extra":"secret"}','{"error":["missing_fonts"]}','{"error":"unknown_code"}','{"error":"missing_fonts_suffix"}']){
  const result=nativeDiagnostics(await observe(value),await observe(''));
  assert.equal(result.domainCode,null);assert.equal(result.source,null);
  assert.equal(result.stdout.sha256,createHash('sha256').update(value).digest('hex'));
 }
 const result=nativeDiagnostics(await observe(''),await observe('{"error":"missing_fonts: sensitive-font-name"}'));
 assert.equal(result.domainCode,'missing_fonts');assert.equal(result.source,'stderr');
 assert.ok(!JSON.stringify(result).includes('sensitive-font-name'));
});
test('conflicting stdout and stderr codes retain digests without guessing a cause',async()=>{
 const result=nativeDiagnostics(await observe('{"error":"revision_conflict"}'),await observe('{"error":"missing_fonts"}'));
 assert.equal(result.domainCode,null);assert.equal(result.source,null);
 assert.equal(result.stdout.complete,true);assert.equal(result.stderr.complete,true);
});
test('required audio failure retains its closed domain code without user text',async()=>{
 const result=nativeDiagnostics(await observe('{"error":"export_audio_missing"}'),await observe(''));
 assert.equal(result.domainCode,'export_audio_missing');assert.equal(result.source,'stdout');
 const rejected=nativeDiagnostics(await observe('{"error":"export_audio_missing_suffix"}'),await observe(''));
 assert.equal(rejected.domainCode,null);
});
test('unclosed stream remains incomplete and cannot report a domain code',async()=>{
 const stream=new Readable({read(){}}),observation=new OutputObservation(stream);
 stream.push('{"error":"missing_fonts"}');await new Promise(resolve=>setImmediate(resolve));stream.destroy();
 const result=nativeDiagnostics(observation,await observe(''));
 assert.equal(result.stdout.complete,false);assert.equal(result.domainCode,null);
});
