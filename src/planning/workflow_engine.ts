/** 可恢复 DAG 调度，显式依赖和已核验资产版本是交接依据。 */
import { verifyNativeBriefOutput } from './native_brief_output.ts';
import { verifyFilmDuration } from './film_duration.ts';
import { assessBrief, nodeBriefConstraints, pendingNativeAssessment } from './project_brief.ts';
import type { SourceInspection } from './project_brief.ts';
import { orderGraph } from '../protocol/dependency_graph.ts';
import { planHash, validateTask, verifyArtifact } from '../protocol/contracts.ts';
import { TaskLedger } from '../harness/task_ledger.ts';
import { LocalRunner } from '../harness/local_runner.ts';
import type { BudgetSnapshot } from '../harness/budget.ts';
import type { ExecutionAdapter } from '../harness/local_runner.ts';

export interface ArtifactInput {root:string;artifact:Record<string,any>;}
export interface WorkflowNode {
  id:string;dependsOn:string[];projectKey:string;runtimeIdentity:Record<string,any>;
  payload:Record<string,any>;expectedRevision:string|null;
  inputBindings?:{from:string;assetId:string}[];externalInputs?:ArtifactInput[];
}
export interface WorkflowPlan {
  workflowId:string;ownerId:string;revision:string;authorizationRef:string;
  budget:Record<string,any>;deadline:string;nodes:WorkflowNode[];projectBrief?:Record<string,any>;
}
export type AdapterFactory=((node:WorkflowNode,inputs:ArtifactInput[],taskId:string)=>Promise<{adapter:ExecutionAdapter;root:string}>) & {verifyBriefExport?:(node:WorkflowNode,root:string,outputs:Record<string,any>[],brief:Record<string,any>)=>Promise<void>};
type NodeResult={status:string;fingerprint?:string;taskId?:string;root?:string;outputs?:Record<string,any>[];error?:string;failure?:unknown;sourceInspection?:SourceInspection};
export type WorkflowResult={runKey:string;state:string;nodes:Record<string,NodeResult>;budget:BudgetSnapshot};

/** 领域工厂只通过公开接口编译；图中不允许模型自行注入可执行代码。 */
export class WorkflowEngine {
  private ledger:TaskLedger;
  private runner:LocalRunner;
  private factories:Record<string,AdapterFactory>;
  constructor(ledger:TaskLedger,runner:LocalRunner,factories:Record<string,AdapterFactory>){this.ledger=ledger;this.runner=runner;this.factories=factories;}

  private request(plan:WorkflowPlan,node:WorkflowNode,taskId:string,key:string,inputs:ArtifactInput[]):Record<string,any> {
    return {protocolVersion:'craft-task/v1',taskId,idempotencyKey:key,planHash:planHash(node.payload),
      inputRefs:inputs.map(item=>({assetId:item.artifact.assetId,version:item.artifact.version,sha256:item.artifact.sha256})),
      expectedRevision:node.expectedRevision,runtimeIdentity:node.runtimeIdentity,authorizationRef:plan.authorizationRef,
      budget:plan.budget,deadline:plan.deadline,payload:node.payload};
  }

  private validate(plan:WorkflowPlan):string[] {
    for(const id of [plan.workflowId,plan.ownerId,plan.revision])if(typeof id!=='string' || !id.length || id.length>128)throw new Error('workflow_identity_invalid');
    if(!Array.isArray(plan.nodes) || !plan.nodes.length || plan.nodes.length>1000)throw new Error('workflow_nodes_invalid');
    const order=orderGraph(plan.nodes);
    for(const node of plan.nodes){
      if(typeof node.id!=='string' || node.id.length>128 || typeof node.projectKey!=='string' || !node.projectKey.length || node.projectKey.length>4096)throw new Error('workflow_node_invalid');
      if(!Object.hasOwn(this.factories,node.runtimeIdentity.pluginId))throw new Error('capability_missing: '+node.runtimeIdentity.pluginId);
      if(node.inputBindings?.some(binding=>!node.dependsOn.includes(binding.from)))throw new Error('dependency_binding_invalid');
      validateTask(this.request(plan,node,'preflight','preflight',[]));
    }
    if(plan.projectBrief!==undefined){
      const assessment=assessBrief(plan.projectBrief,plan);
      if(!pendingNativeAssessment(assessment,plan))throw new Error('brief_plan_blocked: '+JSON.stringify(assessment));
    }
    return order;
  }

  private async verifyResult(result:NodeResult,duration?:number,brief?:Record<string,any>,node?:WorkflowNode):Promise<void> {
    if(!result.taskId || !result.root || !result.outputs?.length)throw new Error('artifact_missing');
    const state=this.ledger.status(result.taskId).state;
    if(!['review_ready','completed'].includes(state))throw new Error('dependency_not_verified');
    for(const artifact of result.outputs){
      await verifyArtifact(artifact,result.root);
      if(artifact.producerTaskId!==result.taskId)throw new Error('artifact_task_mismatch');
    }
    if(brief){
      await verifyNativeBriefOutput(result.root,result.outputs,brief,node!.runtimeIdentity.sha256);
      if(node!.runtimeIdentity.pluginId==='effectcraft' && result.outputs.some(item=>item.mediaType==='video/mp4') && !this.factories.effectcraft.verifyBriefExport)throw new Error('brief_export_inspector_missing');
      await this.factories[node!.runtimeIdentity.pluginId].verifyBriefExport?.(node!,result.root,result.outputs,brief);
    }
    if(duration!==undefined)await verifyFilmDuration(result.root,result.outputs,duration);
  }

  /** 复用只核对历史产物；未终结子任务继续等待，不重新提交原生副作用。 */
  async run(value:WorkflowPlan,concurrency=2):Promise<WorkflowResult> {
    if(!Number.isInteger(concurrency) || concurrency<1 || concurrency>16)throw new Error('concurrency_invalid');
    const plan=structuredClone(value),order=this.validate(plan),key=this.ledger.beginWorkflow(plan);
    const byId=new Map(plan.nodes.map(node=>[node.id,node]));
    const inspections=new Map<string,SourceInspection>();
    const duration=(id:string):number|undefined=>plan.projectBrief?.deliverables.find((item:any)=>item.id===id && item.nativeFormat==='.fcproj')?.durationSeconds;
    const brief=(id:string)=>plan.projectBrief?.deliverables.find((item:any)=>item.id===id);
    const results:Record<string,NodeResult>={};
    const pending=new Set(order),active=new Map<string,Promise<void>>(),resources=new Set<string>();
    const activeTasks=new Set<string>();
    const save=(id:string,result:NodeResult)=>{results[id]=result;this.ledger.saveWorkflowNode(key,id,result);};
    // 所有已有就绪产物先核对，禁止在损坏缓存旁继续编译下游。
    try{
      for(const id of order){
        const existing=this.ledger.workflowNode(key,id) as NodeResult;
        if(['review_ready','reused'].includes(existing.status))await this.verifyResult(existing,duration(id),brief(id),byId.get(id)!);
      }
      for(const node of plan.nodes)for(const input of node.externalInputs ?? [])await verifyArtifact(input.artifact,input.root);
    }catch(error){return {runKey:key,state:'blocked',nodes:{preflight:{status:'blocked',error:(error as Error).message}},budget:this.ledger.workflowBudget(key)};}
    const monitor=setInterval(()=>{
      if(Date.parse(plan.deadline)<=Date.now())this.ledger.cancelWorkflow(key);
      if(this.ledger.workflowCancelled(key))for(const taskId of activeTasks)this.ledger.cancel(taskId);
    },50);
    const execute=async(id:string):Promise<void>=>{
      const node=byId.get(id)!;
      let fingerprint:string|undefined,taskId:string|undefined,root:string|undefined;
      try{
        let inputs:ArtifactInput[]=[];
        for(const parent of node.dependsOn){
          const result=results[parent];await this.verifyResult(result,duration(parent),brief(parent),byId.get(parent)!);
          const requested=node.inputBindings?.filter(binding=>binding.from===parent);
          const selected=requested ? result.outputs!.filter(artifact=>requested.some(binding=>binding.assetId===artifact.assetId)) : result.outputs!;
          if(requested && selected.length!==requested.length)throw new Error('dependency_asset_missing');
          inputs.push(...selected.map(artifact=>({root:result.root!,artifact})));
        }
        inputs.push(...(node.externalInputs ?? []));
        for(const input of inputs)await verifyArtifact(input.artifact,input.root);
        const refs=inputs.map(input=>({assetId:input.artifact.assetId,version:input.artifact.version,sha256:input.artifact.sha256}));
        const content={payload:node.payload,inputRefs:refs,runtimeIdentity:node.runtimeIdentity,projectKey:node.projectKey,expectedRevision:node.expectedRevision};
        // 无 Brief 时保留历史指纹；按节点提取约束，不引入全局修订号。
        fingerprint=planHash(plan.projectBrief===undefined ? content : {...content,briefConstraints:nodeBriefConstraints(plan.projectBrief,id)});
        const cached=this.ledger.cachedWorkflowNode(plan.ownerId,plan.workflowId,id,fingerprint,plan.authorizationRef) as NodeResult|null;
        if(cached){await this.verifyResult(cached,duration(id),brief(id),byId.get(id)!);save(id,{...cached,status:'reused',fingerprint});return;}
        taskId='wf-'+planHash({owner:plan.ownerId,workflow:plan.workflowId,revision:plan.revision,node:id,fingerprint}).slice(0,48);
        const request=this.request(plan,node,taskId,'wf-node:'+planHash({key,id,fingerprint}),inputs);
        const registered=this.ledger.register(plan.ownerId,node.projectKey,request,key);
        taskId=registered.taskId;
        const previous=this.ledger.workflowNode(key,id) as NodeResult;
        root=previous.root;
        const recovering=['running','reconciling','cancel_requested','verifying'].includes(registered.state);
        const stopped=this.ledger.execution(taskId);
        if(recovering && !(stopped?.status==='stopped' && stopped.groupStopped)){
          save(id,{status:'waiting',fingerprint,taskId,root,error:'outcome_pending'});return;
        }
        if(['failed','cancelled'].includes(registered.state)){save(id,{status:registered.state,fingerprint,taskId,root,...(registered.state==='failed' ? {failure:registered.error} : {})});return;}
        if(registered.state==='review_ready' || registered.state==='completed'){
          const result={status:'review_ready',fingerprint,taskId,root,outputs:registered.outputRefs as Record<string,any>[]};
          await this.verifyResult(result,duration(id),brief(id),byId.get(id)!);save(id,result);return;
        }
        save(id,{status:'preparing',fingerprint,taskId,root});
        const compiled=await this.factories[node.runtimeIdentity.pluginId](node,inputs,taskId);
        root=compiled.root;
        if(plan.projectBrief && Object.hasOwn(node.payload,'sourceProject')){
          if(!compiled.adapter.inspectSource)throw new Error('brief_source_inspector_missing');
          const inspected=await compiled.adapter.inspectSource();
          if(inspected.schema!=='craft-source-inspection/v1' || inspected.pluginId!==node.runtimeIdentity.pluginId || !/^[a-f0-9]{64}$/.test(inspected.nativeInspectionSha256) || inspected.nativeProjectSha256!==node.expectedRevision || inspected.nativeRuntimeSha256!==node.runtimeIdentity.sha256)throw new Error('brief_source_inspection_binding_mismatch');
          inspections.set(id,inspected);
          const assessment=assessBrief(plan.projectBrief,plan,inspections);
          const blocked=assessment.blocked.find(item=>item.nodeId===id);
          // 上游已通过实际输出核验；其静态时长未知不应再次阻塞已核验的依赖交接。
          if(blocked && node.dependsOn.every(parent=>['review_ready','reused'].includes(results[parent]?.status)))blocked.reasons=blocked.reasons.filter(reason=>reason!=='dependency_blocked');
          // 未知时长变化只可交给复制后的原生执行；同一分支必然套用保存后时长门禁。
          const nativeOutputCheck=blocked && blocked.reasons.every(reason=>reason==='native_output_inspection_required' || (duration(id)!==undefined && reason==='duration_inspection_required'));
          if(blocked?.reasons.length && !nativeOutputCheck)throw new Error('brief_source_plan_blocked: '+JSON.stringify(blocked));
        }
        if(brief(id)){
          const verify=compiled.adapter.verify.bind(compiled.adapter);
          compiled.adapter={...compiled.adapter,verify:async(request)=>{
            const verified=await verify(request);
            await verifyNativeBriefOutput(verified.root,verified.outputs as Record<string,any>[],brief(id)!,node.runtimeIdentity.sha256);
            if(node.runtimeIdentity.pluginId==='effectcraft' && verified.outputs.some((item:any)=>item.mediaType==='video/mp4') && !this.factories.effectcraft.verifyBriefExport)throw new Error('brief_export_inspector_missing');
            await this.factories[node.runtimeIdentity.pluginId].verifyBriefExport?.(node,verified.root,verified.outputs as Record<string,any>[],brief(id)!);
            if(duration(id)!==undefined)await verifyFilmDuration(verified.root,verified.outputs as Record<string,any>[],duration(id)!);
            return verified;
          }};
        }
        save(id,{status:'running',fingerprint,taskId,root});
        if(registered.state==='planned')this.ledger.ready(taskId);
        if(this.ledger.workflowCancelled(key)){this.ledger.cancel(taskId);save(id,{status:'cancelled',fingerprint,taskId,root});return;}
        activeTasks.add(taskId);
        const receipt=recovering ? await this.runner.reconcile(taskId,compiled.adapter) : await this.runner.execute(taskId,compiled.adapter);
        const result={status:['review_ready','completed'].includes(receipt.state) ? 'review_ready' : ['failed','cancelled'].includes(receipt.state) ? receipt.state : 'waiting',fingerprint,taskId,root,outputs:receipt.outputRefs as Record<string,any>[],...(receipt.state==='failed' ? {failure:receipt.error} : {}),...(inspections.has(id)?{sourceInspection:inspections.get(id)}:{})};
        if(result.status==='review_ready')await this.verifyResult(result,duration(id),brief(id),byId.get(id)!);
        save(id,result);
      }catch(error){save(id,{status:'blocked',fingerprint,taskId,root,error:(error as Error).message,...(inspections.has(id)?{sourceInspection:inspections.get(id)}:{})});}
      finally{if(taskId)activeTasks.delete(taskId);}
    };
    try{
      while(pending.size || active.size){
        for(const id of order){
          if(!pending.has(id))continue;
          const node=byId.get(id)!;
          if(this.ledger.workflowCancelled(key)){
            pending.delete(id);const previous=this.ledger.workflowNode(key,id) as NodeResult;
            if(previous.taskId){
              this.ledger.cancel(previous.taskId);
              const receipt=await this.runner.reconcile(previous.taskId,{prepare:async()=>{throw new Error('cancel_recovery_must_not_prepare');},verify:async()=>{throw new Error('cancel_recovery_must_not_verify');}});
              save(id,{...previous,status:receipt.state==='cancelled' ? 'cancelled' : 'waiting',error:receipt.state==='cancelled' ? undefined : 'outcome_pending'});
            }else save(id,{status:'cancelled'});
            continue;
          }
          if(node.dependsOn.some(parent=>results[parent] && !['review_ready','reused'].includes(results[parent].status) && !active.has(parent))){pending.delete(id);save(id,{status:'blocked',error:'dependency_not_verified'});continue;}
          if(node.dependsOn.some(parent=>!results[parent] || !['review_ready','reused'].includes(results[parent].status)))continue;
          if(active.size>=concurrency || resources.has(node.projectKey))continue;
          pending.delete(id);resources.add(node.projectKey);
          const promise=execute(id).finally(()=>{active.delete(id);resources.delete(node.projectKey);});
          active.set(id,promise);
        }
        if(active.size)await Promise.race(active.values());
        else if(pending.size)throw new Error('workflow_no_progress');
      }
    }finally{clearInterval(monitor);}
    const states=Object.values(results).map(result=>result.status);
    const state=this.ledger.workflowCancelled(key) ? (states.includes('waiting') ? 'cancel_requested' : 'cancelled') : states.every(status=>['review_ready','reused'].includes(status)) ? 'review_ready' : states.includes('failed') ? 'failed' : states.includes('waiting') ? 'waiting' : 'blocked';
    return {runKey:key,state,nodes:results,budget:this.ledger.workflowBudget(key)};
  }
}
