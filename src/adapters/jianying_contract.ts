/** 固定剪映公开 CLI 契约；本模块只判断证据，绝不提交或重试副作用。 */
import {isAbsolute,normalize} from 'node:path';

export interface JianyingIdentity {version:string;releaseRef:string;sourceCommit:string;}
export interface JianyingIntent {jobPath:string;outputPath:string;stateRoot:string;}
export type JianyingReconciliation =
 | {state:'waiting';reason:'worker_not_stopped'}
 | {state:'unknown';reason:string;taskId?:string}
 | {state:'verify_candidate'|'failed'|'cancelled';taskId:string};
const object=(value:unknown):value is Record<string,any>=>!!value && typeof value==='object' && !Array.isArray(value);
const absolute=(value:unknown):value is string=>typeof value==='string' && isAbsolute(value) && normalize(value)===value && !value.includes('\0');
/** 保留失败类别和持久任务 ID；恢复建议文本不进入可执行命令。 */
export class JianyingCliError extends Error {
 readonly errorType:string;
 readonly taskId:string|null;
 constructor(errorType:string,taskId:string|null){super('jianying_cli_failed:'+errorType);this.errorType=errorType;this.taskId=taskId;}
}
const states=new Set(['queued','running','succeeded','failed','cancelled']);

/** 解包真实 JSON envelope；失败只保留机器类别，不执行 CLI 的 recovery 文本。 */
export function unwrapJianying(value:unknown):any {
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{throw new Error('jianying_envelope_invalid');}}
 if(!object(value) || typeof value.ok!=='boolean')throw new Error('jianying_envelope_invalid');
 if(value.ok){
  if(Object.keys(value).sort().join(',')!=='data,ok' || (!object(value.data) && !Array.isArray(value.data)))throw new Error('jianying_envelope_invalid');
  return structuredClone(value.data);
 }
 if(Object.keys(value).sort().join(',')!=='error,ok' || !object(value.error) || typeof value.error.type!=='string' || typeof value.error.message!=='string' || !object(value.error.details) || !Array.isArray(value.error.recovery) || !value.error.recovery.every((item:unknown)=>typeof item==='string'))throw new Error('jianying_envelope_invalid');
 const taskId=value.error.details.task_id;
 if(taskId!==undefined && (typeof taskId!=='string' || !/^jy-[a-f0-9]{32}$/.test(taskId)))throw new Error('jianying_envelope_invalid');
 throw new JianyingCliError(value.error.type,taskId ?? null);
}

/** 登记固定发行身份；返回 supported 能力集合，不提升 partial 或外部依赖状态。 */
export function validateJianyingCapabilities(manifest:unknown,identity:JianyingIdentity):Set<string> {
 if(!object(identity) || !/^\d+\.\d+\.\d+$/.test(identity.version) || identity.releaseRef!=='v'+identity.version || !/^[a-f0-9]{40}$/.test(identity.sourceCommit))throw new Error('jianying_identity_invalid');
 if(!object(manifest) || manifest.schema!=='jianying-capabilities/v1' || !Array.isArray(manifest.capabilities))throw new Error('jianying_capabilities_invalid');
 if(manifest.cli_version!==identity.version || manifest.release_ref!==identity.releaseRef || manifest.source_commit!==identity.sourceCommit || manifest.contract_state!=='released')throw new Error('jianying_identity_mismatch');
 const seen=new Set<string>(),supported=new Set<string>();
 for(const capability of manifest.capabilities){
  if(!object(capability) || typeof capability.id!=='string' || !capability.id || seen.has(capability.id) || !['supported','partial','external_dependency','unsupported'].includes(capability.status))throw new Error('jianying_capabilities_invalid');
  seen.add(capability.id);if(capability.status==='supported')supported.add(capability.id);
 }
 for(const id of ['schema.job_v2','job.run','job.list','job.show','project.inspect','project.verify'])if(!supported.has(id))throw new Error('jianying_capability_unavailable:'+id);
 return supported;
}

/** 显式支持的 Job 操作；native/archive 在固定执行器未实现时始终拒绝。 */
export function requireJianyingOperation(operation:string,supported:Set<string>):void {
 const capabilities:Record<string,string>={create:'project.create',edit:'project.edit_isolated',inspect:'project.inspect',verify:'project.verify',proxy:'render.proxy'};
 if(!Object.hasOwn(capabilities,operation))throw new Error('jianying_operation_unavailable');
 for(const id of ['schema.job_v2','job.run',capabilities[operation]])if(!supported.has(id))throw new Error('jianying_capability_unavailable:'+id);
}

/** 核对持久记录内部一致性，禁止将 CLI 外观相似的伪造回执采纳。 */
function validateRecord(value:unknown):asserts value is Record<string,any> {
 if(!object(value) || !/^jy-[a-f0-9]{32}$/.test(value.task_id) || !states.has(value.state) || !absolute(value.job_path) || (value.output_path!==null && !absolute(value.output_path)) || !Number.isSafeInteger(value.revision) || value.revision<0 || !Number.isSafeInteger(value.attempts) || value.attempts<0 || (value.last_error!==null && typeof value.last_error!=='string') || !Array.isArray(value.history) || value.history.length!==value.revision+1)throw new Error('jianying_record_invalid');
 let attempts=0,previous='',lastError:string|null=null;
 for(const [index,event] of value.history.entries()){
  if(!object(event) || event.sequence!==index+1 || !states.has(event.state) || typeof event.reason!=='string' || !Number.isSafeInteger(event.epoch_seconds) || event.epoch_seconds<0)throw new Error('jianying_record_invalid');
  if(index===0 && event.state!=='queued')throw new Error('jianying_record_invalid');
  if(index>0 && !((previous==='queued' && ['running','cancelled'].includes(event.state)) || (previous==='running' && ['succeeded','failed','cancelled'].includes(event.state)) || (previous==='failed' && event.state==='queued')))throw new Error('jianying_record_invalid');
  if(event.state==='running')attempts++;if(event.state==='failed')lastError=event.reason;previous=event.state;
 }
 if(previous!==value.state || attempts!==value.attempts || lastError!==value.last_error)throw new Error('jianying_record_invalid');
}

/** 根据独占状态根查询结果收敛；成功仅返回待验产物，调用者还需实际 inspect/verify。 */
export function reconcileJianyingRecords(records:unknown,intent:JianyingIntent,workerStopped:boolean):JianyingReconciliation {
 if(!object(intent) || ![intent.jobPath,intent.outputPath,intent.stateRoot].every(absolute) || new Set([intent.jobPath,intent.outputPath,intent.stateRoot]).size!==3 || typeof workerStopped!=='boolean')throw new Error('jianying_intent_invalid');
 if(!workerStopped)return {state:'waiting',reason:'worker_not_stopped'};
 if(!Array.isArray(records))throw new Error('jianying_record_invalid');
 const seen=new Set<string>();
 for(const record of records){validateRecord(record);if(seen.has(record.task_id))throw new Error('jianying_record_invalid');seen.add(record.task_id);}
 const matches=records.filter(record=>record.job_path===intent.jobPath && record.output_path===intent.outputPath);
 if(matches.length!==1)return {state:'unknown',reason:matches.length?'multiple_matching_records':'no_matching_record'};
 const record=matches[0],taskId=record.task_id;
 if(record.state==='succeeded')return {state:'verify_candidate',taskId};
 if(record.state==='failed' || record.state==='cancelled')return {state:record.state,taskId};
 return {state:'unknown',reason:'child_nonterminal',taskId};
}
