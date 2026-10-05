/** 交换报告的结构与损失声明验证；未知保真不提升为已验证。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateExchangeLossReport } from '../src/protocol/contracts.ts';
const digest='a'.repeat(64);
const report=()=>({schema:'craft-exchange-loss/v1',pluginId:'vectorcraft',native:{location:'project.vectorcraft',sha256:digest},inspection:{location:'native.json',sha256:digest},acceptance:'technical-observations-only',outputs:[{location:'logo.svg',sha256:digest,format:'svg',role:'derivative',nativeSubstitute:false,changes:[{code:'font-portability',status:'unknown',reason:'consumer not verified'}],observations:{},warnings:[]}]});
test('exchange report explicitly preserves unknown fidelity and native identity',()=>{assert.equal(validateExchangeLossReport(report()).outputs[0].changes[0].status,'unknown');});
test('lossy native substitute, bad source identity and false acceptance are rejected',()=>{
 for(const mutate of [(r:any)=>r.outputs[0].nativeSubstitute=true,(r:any)=>r.native.location='../outside',(r:any)=>r.native.sha256='bad',(r:any)=>r.acceptance='approved',(r:any)=>r.outputs[0].changes[0].status='verified']){
  const value=report();mutate(value);assert.throws(()=>validateExchangeLossReport(value));
 }
});
test('actual report references bind native, output and reopened inspection hashes',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {join}=await import('node:path');const {tmpdir}=await import('node:os');const {createHash}=await import('node:crypto');const {verifyArtifact}=await import('../src/protocol/contracts.ts');
 const sha=(value:string)=>createHash('sha256').update(value).digest('hex'),root=await mkdtemp(join(tmpdir(),'craft-loss-'));
 try{
  const svg='<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L1 1"/></svg>';
  await writeFile(join(root,'logo.svg'),svg);await writeFile(join(root,'project.vectorcraft'),'native');await writeFile(join(root,'native.json'),'{}');
  const value=report();value.native.sha256=sha('native');value.inspection.sha256=sha('{}');value.outputs[0].sha256=sha(svg);
  const ref=(location:string,hash:string)=>({assetId:location,version:hash,sha256:hash,location});
  const artifact:any={protocolVersion:'craft-artifact/v1',assetId:'logo',version:sha(svg),sha256:sha(svg),bytes:Buffer.byteLength(svg),mediaType:'image/svg+xml',producerTaskId:'task',sourceRefs:[],nativeProjectRef:ref('project.vectorcraft',sha('native')),renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'logo.svg'};
  const save=async()=>{const text=JSON.stringify(value);await writeFile(join(root,'exchange-loss.json'),text);artifact.lossReportRef=ref('exchange-loss.json',sha(text));};
  await save();await verifyArtifact(artifact,root);
  value.outputs[0].sha256=sha('wrong output');await save();await assert.rejects(verifyArtifact(artifact,root),/loss_report_output_mismatch/);
  value.outputs[0].sha256=sha(svg);value.native.sha256=sha('wrong native');await save();await assert.rejects(verifyArtifact(artifact,root),/loss_report_native_mismatch/);
  value.native.sha256=sha('native');await save();await writeFile(join(root,'native.json'),'changed');await assert.rejects(verifyArtifact(artifact,root),/loss_report_evidence_mismatch/);
 }finally{await rm(root,{recursive:true});}
});
