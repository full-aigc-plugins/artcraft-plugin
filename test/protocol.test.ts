import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTask, validateArtifact, verifyArtifact, planHash } from '../src/protocol/contracts.ts';
import { orderGraph, invalidated } from '../src/protocol/dependency_graph.ts';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const digest = 'a'.repeat(64);
const task = () => ({ protocolVersion:'craft-task/v1',taskId:'t1',idempotencyKey:'key',planHash:digest,inputRefs:[],expectedRevision:null,
 runtimeIdentity:{pluginId:'filmcraft',pluginVersion:'0.1.0',cliVersion:'0.2.0',sha256:digest,mode:'headless',capabilitySnapshotSha256:digest},
 authorizationRef:'user-request',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:2,maxExternalCalls:0},deadline:'2030-01-01T00:00:00Z',payload:{schemaVersion:'filmcraft-plan/v1',plan:{}} });
const artifact = () => ({protocolVersion:'craft-artifact/v1',assetId:'logo',version:'v1',sha256:digest,bytes:5,mediaType:'application/octet-stream',producerTaskId:'t1',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'logo.bin'});

test('strict versioned tasks accept explicit empty creation inputs',()=>assert.equal(validateTask(task()).taskId,'t1'));
test('invalid calendar deadlines and unknown nested runtime fields are rejected',()=>{
 assert.throws(()=>validateTask({...task(),deadline:'2030-02-30T00:00:00Z'}),/protocol_invalid/);
 assert.throws(()=>validateTask({...task(),runtimeIdentity:{...task().runtimeIdentity,secret:'token'}}),/protocol_invalid/);
});
test('unknown protocol, fields, implicit budget and imprecise integers fail before execution',()=>{
 for(const changed of [{...task(),protocolVersion:'craft-task/v2'},{...task(),secret:'credential'},{...task(),budget:{}},{...task(),budget:{...task().budget,maxMinorUnits:2**53}}]) assert.throws(()=>validateTask(changed),/protocol_invalid/);
});
test('canonical hashes ignore key order but preserve values and reject unsafe numbers',()=>{
 assert.equal(planHash({b:2,a:1}),planHash({a:1,b:2}));
 assert.notEqual(planHash({a:1}),planHash({a:2}));
 assert.throws(()=>planHash({tick:2**53}),/unsafe_number/);
});
test('artifact large ticks must be strings with rational timebase',()=>{
 validateArtifact({...artifact(),technicalMetadata:{durationTicks:'25401600000000000',timeBase:{num:1,den:254016000000},frameRate:{num:30000,den:1001}}});
 assert.throws(()=>validateArtifact({...artifact(),technicalMetadata:{durationTicks:25401600000000000}}),/protocol_invalid/);
 assert.throws(()=>validateArtifact({...artifact(),technicalMetadata:{durationTicks:'254016000000'}}),/timebase_required/);
});
test('JSON evidence is checked as complete syntax after content hashing',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-json-artifact-'));
 try{
  const value='{"decision":"review"}';await writeFile(join(root,'logo.bin'),value);
  await verifyArtifact({...artifact(),mediaType:'application/json',bytes:Buffer.byteLength(value),sha256:createHash('sha256').update(value).digest('hex')},root);
  await writeFile(join(root,'logo.bin'),'{broken');
  await assert.rejects(verifyArtifact({...artifact(),mediaType:'application/json',bytes:7,sha256:createHash('sha256').update('{broken').digest('hex')},root),/json_artifact_invalid/);
 }finally{await rm(root,{recursive:true});}
});
test('actual file content, size and containment are verified',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-protocol-'));
 try {
  await writeFile(join(root,'logo.bin'),'hello');
  const item={...artifact(),sha256:createHash('sha256').update('hello').digest('hex')};
  await verifyArtifact(item,root);
  await assert.rejects(verifyArtifact({...item,bytes:6},root),/artifact_digest_mismatch/);
  await assert.rejects(verifyArtifact({...item,mediaType:'image/png'},root),/media_type_mismatch/);
  await assert.rejects(verifyArtifact({...item,location:'../logo.bin'},root),/location_invalid/);
  await writeFile(join(root,'logo.bin'),'changed');
  await assert.rejects(verifyArtifact(item,root),/artifact_digest_mismatch/);
 } finally {await rm(root,{recursive:true});}
});
test('symlink escaping the delivery root is rejected',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-protocol-link-'));
 try {
  const delivery=join(root,'delivery');
  const {mkdir}=await import('node:fs/promises');
  await mkdir(delivery);
  await writeFile(join(root,'outside.bin'),'hello');
  await symlink(join(root,'outside.bin'),join(delivery,'logo.bin'));
  await assert.rejects(verifyArtifact(artifact(),delivery),/location_invalid/);
 } finally {await rm(root,{recursive:true});}
});
test('missing dependencies cannot claim successful packaging',()=>{
 const dependency={assetRef:{assetId:'font',version:'v1',sha256:digest},kind:'font',packaged:false,missingReason:null};
 assert.throws(()=>validateArtifact({...artifact(),dependencies:[dependency]}),/dependency_packaging_invalid/);
 validateArtifact({...artifact(),dependencies:[{...dependency,missingReason:'font_missing'}]});
});
test('DAG rejects cycles and missing nodes',()=>{
 assert.deepEqual(orderGraph([{id:'logo',dependsOn:[]},{id:'poster',dependsOn:['logo']}]),['logo','poster']);
 assert.throws(()=>orderGraph([{id:'a',dependsOn:['b']},{id:'b',dependsOn:['a']}]),/dependency_cycle/);
 assert.throws(()=>orderGraph([{id:'a',dependsOn:['missing']}]),/dependency_missing/);
});
test('logo invalidates only its transitive consumers, independent voice remains reusable',()=>{
 const graph=[{id:'logo',dependsOn:[]},{id:'poster',dependsOn:['logo']},{id:'intro',dependsOn:['logo']},{id:'voice',dependsOn:[]},{id:'film',dependsOn:['intro','voice']}];
 assert.deepEqual([...invalidated(graph,['logo'])].sort(),['film','intro','logo','poster']);
});

test('native project and rendition references must match actual files, not only the primary render',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-native-ref-'));
 try{
  await writeFile(join(root,'logo.bin'),'hello');await writeFile(join(root,'project.bin'),'native');
  const item={...artifact(),sha256:createHash('sha256').update('hello').digest('hex'),nativeProjectRef:{assetId:'project',version:'v1',sha256:createHash('sha256').update('native').digest('hex'),location:'project.bin'}};
  await verifyArtifact(item,root);await writeFile(join(root,'project.bin'),'modified');
  await assert.rejects(verifyArtifact(item,root),/artifact_reference_mismatch/);
 }finally{await rm(root,{recursive:true});}
});

function pcmWave(){
 const data=Buffer.alloc(44+16);data.write('RIFF');data.writeUInt32LE(data.length-8,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(2,22);data.writeUInt32LE(48000,24);data.writeUInt32LE(192000,28);data.writeUInt16LE(4,32);data.writeUInt16LE(16,34);data.write('data',36);data.writeUInt32LE(16,40);return data;
}
test('PCM WAV content verifies declared audio facts and rejects malformed or mismatched media',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-wave-artifact-'));
 try{
  const data=pcmWave();const facts={audio:{sampleRate:48000,channels:2},bitDepth:16,durationTicks:'4',timeBase:{num:1,den:48000}};
  const value=(bytes:Buffer,metadata:any=facts)=>({...artifact(),mediaType:'audio/wav',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,technicalMetadata:metadata});
  await writeFile(join(root,'logo.bin'),data);await verifyArtifact(value(data),root);
  for(const metadata of [{...facts,audio:{sampleRate:44100,channels:2}},{...facts,audio:{sampleRate:48000,channels:1}},{...facts,bitDepth:24},{...facts,durationTicks:'5'},{}])await assert.rejects(verifyArtifact(value(data,metadata),root),/audio_metadata_mismatch/);
  const bads=[data.subarray(0,data.length-1),Buffer.from(data),Buffer.from(data),Buffer.from(data)];bads[1].writeUInt32LE(14,40);bads[2].writeUInt16LE(3,20);bads[3].writeUInt32LE(1,28);
  for(const bad of bads){await writeFile(join(root,'logo.bin'),bad);await assert.rejects(verifyArtifact(value(bad),root),/wav_invalid|wav_format_unsupported/);}
  const text=Buffer.from('not WAV');await writeFile(join(root,'logo.bin'),text);await assert.rejects(verifyArtifact(value(text),root),/media_type_mismatch|wav_invalid/);
 }finally{await rm(root,{recursive:true});}
});
