/** 剪映公开契约：失回执恢复不重放，状态成功不直接成为产物成功。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {unwrapJianying,validateJianyingCapabilities,requireJianyingOperation,reconcileJianyingRecords,JianyingCliError} from '../src/adapters/jianying_contract.ts';
const commit='6fe623096f1ce281d5f0a06f93ca23989b901cff';
const identity={version:'1.6.31',releaseRef:'v1.6.31',sourceCommit:commit};
const ids=['schema.job_v2','job.run','job.list','job.show','project.create','project.edit_isolated','project.inspect','project.verify','render.proxy'];
const manifest=()=>({schema:'jianying-capabilities/v1',cli_version:identity.version,release_ref:identity.releaseRef,source_commit:commit,contract_state:'released',capabilities:ids.map(id=>({id,status:'supported'}))});
const intent={jobPath:'/work/node/job.json',outputPath:'/work/node/draft',stateRoot:'/work/node/state'};
const task='jy-'+ 'a'.repeat(32);
const record=(state='succeeded')=>({task_id:task,state,revision:2,job_path:intent.jobPath,output_path:intent.outputPath,attempts:1,last_error:state==='failed'?'execution finished':null,history:[{sequence:1,state:'queued',reason:'created',epoch_seconds:1},{sequence:2,state:'running',reason:'execution started',epoch_seconds:2},{sequence:3,state,reason:'execution finished',epoch_seconds:3}]});

test('unwrap actual success envelopes without accepting exit-zero or accepted objects',()=>{
 assert.deepEqual(unwrapJianying('{"ok":true,"data":{"task_id":"x"}}'),{task_id:'x'});
 assert.deepEqual(unwrapJianying({ok:true,data:[]}),[]);
 for(const value of [{accepted:true},{ok:true},{ok:true,data:{},error:{}},'{}\n{}'])assert.throws(()=>unwrapJianying(value),/jianying_envelope_invalid/);
 assert.throws(()=>unwrapJianying({ok:false,error:{type:'invalid_job',message:'bad',details:{task_id:task},recovery:[]}}),(error:any)=>error instanceof JianyingCliError && error.errorType==='invalid_job' && error.taskId===task);
});

test('registration binds released identity and rejects partial or duplicate capabilities',()=>{
 assert.equal(validateJianyingCapabilities(manifest(),identity).size,ids.length);
 for(const field of ['cli_version','release_ref','source_commit','contract_state'])assert.throws(()=>validateJianyingCapabilities({...manifest(),[field]:'wrong'},identity),/jianying_identity_mismatch/);
 for(const status of ['partial','external_dependency']){const m=manifest();m.capabilities[0].status=status;assert.throws(()=>validateJianyingCapabilities(m,identity),/jianying_capability_unavailable/);}
 const duplicate=manifest();duplicate.capabilities.push({...duplicate.capabilities[0]});assert.throws(()=>validateJianyingCapabilities(duplicate,identity),/jianying_capabilities_invalid/);
});

test('native and archive exports remain unavailable even with advertised enum or capability',()=>{
 const supported=new Set([...ids,'render.native','store.archive']);
 for(const operation of ['create','edit','inspect','verify','proxy'])assert.doesNotThrow(()=>requireJianyingOperation(operation,supported));
 for(const operation of ['native','draft_archive','shell'])assert.throws(()=>requireJianyingOperation(operation,supported),/jianying_operation_unavailable/);
 assert.throws(()=>requireJianyingOperation('edit',new Set(ids.filter(id=>id!=='project.edit_isolated'))),/jianying_capability_unavailable/);
});

test('unique succeeded record is a verification candidate, never completion',()=>{
 const result=reconcileJianyingRecords([record()],intent,true);
 assert.deepEqual(result,{state:'verify_candidate',taskId:task});
 assert.deepEqual(reconcileJianyingRecords([],intent,true),{state:'unknown',reason:'no_matching_record'});
 assert.deepEqual(reconcileJianyingRecords([record(),{...record(),task_id:'jy-'+'b'.repeat(32)}],intent,true),{state:'unknown',reason:'multiple_matching_records'});
});

test('live worker, unrelated paths and malformed records never justify replay or adoption',()=>{
 assert.deepEqual(reconcileJianyingRecords([record()],intent,false),{state:'waiting',reason:'worker_not_stopped'});
 assert.deepEqual(reconcileJianyingRecords([{...record(),output_path:'/work/other/draft'}],intent,true),{state:'unknown',reason:'no_matching_record'});
 for(const change of [{state:'completed'},{revision:9},{attempts:2},{task_id:'forged'},{history:[]},{last_error:'invented failure'},{job_path:'/work/node/../node/job.json'}])assert.throws(()=>reconcileJianyingRecords([{...record(),...change}],intent,true),/jianying_record_invalid/);
 assert.throws(()=>reconcileJianyingRecords([record()],{...intent,stateRoot:'relative'},true),/jianying_intent_invalid/);
});

test('queued/running retain unknown outcome; failed/cancelled require distinct settlement',()=>{
 const running={...record(),state:'running',revision:1,history:record().history.slice(0,2)};
 assert.deepEqual(reconcileJianyingRecords([running],intent,true),{state:'unknown',reason:'child_nonterminal',taskId:task});
 for(const state of ['failed','cancelled'])assert.deepEqual(reconcileJianyingRecords([record(state)],intent,true),{state,taskId:task});
});
