/** 可恢复 DAG 调度，显式依赖和已核验资产版本是交接依据。 */
import { orderGraph } from '../protocol/dependency_graph.ts';
import { planHash, validateTask, verifyArtifact } from '../protocol/contracts.ts';
import { TaskLedger } from '../harness/task_ledger.ts';
import { LocalRunner } from '../harness/local_runner.ts';
import type { ExecutionAdapter } from '../harness/local_runner.ts';

export interface ArtifactInput {root:string;artifact:Record<string,any>;}
export interface WorkflowNode {
  id:string;dependsOn:string[];projectKey:string;runtimeIdentity:Record<string,any>;
  payload:Record<string,any>;expectedRevision:string|null;
  inputBindings?:{from:string;assetId:string}[];externalInputs?:ArtifactInput[];
}
export interface WorkflowPlan {
  workflowId:string;ownerId:string;revision:string;authorizationRef:string;
  budget:Record<string,any>;deadline:string;nodes:WorkflowNode[];
}
export type AdapterFactory=(node:WorkflowNode,inputs:ArtifactInput[],taskId:string)=>Promise<{adapter:ExecutionAdapter;root:string}>;
type NodeResult={status:string;fingerprint?:string;taskId?:string;root?:string;outputs?:Record<string,any>[];error?:string};
export type WorkflowResult={runKey:string;state:string;nodes:Record<string,NodeResult>};

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
    return order;
  }

  private async verifyResult(result:NodeResult):Promise<void> {
    if(!result.taskId || !result.root || !result.outputs?.length)throw new Error('artifact_missing');
    const state=this.ledger.status(result.taskId).state;
    if(!['review_ready','completed'].includes(state))throw new Error('dependency_not_verified');
    for(const artifact of result.outputs){
      await verifyArtifact(artifact,result.root);
      if(artifact.producerTaskId!==result.taskId)throw new Error('artifact_task_mismatch');
    }
  }

  /** 复用只核对历史产物；未终结子任务继续等待，不重新提交原生副作用。 */
  async run(value:WorkflowPlan,concurrency=2):Promise<WorkflowResult> {
    if(!Number.isInteger(concurrency) || concurrency<1 || concurrency>16)throw new Error('concurrency_invalid');
    const plan=structuredClone(value),order=this.validate(plan),key=this.ledger.beginWorkflow(plan);
    const byId=new Map(plan.nodes.map(node=>[node.id,node]));
    const results:Record<string,NodeResult>={};
    const pending=new Set(order),active=new Map<string,Promise<void>>(),resources=new Set<string>();
    const activeTasks=new Set<string>();
    const save=(id:string,result:NodeResult)=>{results[id]=result;this.ledger.saveWorkflowNode(key,id,result);};
    // 所有已有就绪产物先核对，禁止在损坏缓存旁继续编译下游。
    try{
      for(const id of order){
        const existing=this.ledger.workflowNode(key,id) as NodeResult;
        if(['review_ready','reused'].includes(existing.status))await this.verifyResult(existing);
      }
      for(const node of plan.nodes)for(const input of node.externalInputs ?? [])await verifyArtifact(input.artifact,input.root);
    }catch(error){return {runKey:key,state:'blocked',nodes:{preflight:{status:'blocked',error:(error as Error).message}}};}
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
          const result=results[parent];await this.verifyResult(result);
          const requested=node.inputBindings?.filter(binding=>binding.from===parent);
          const selected=requested ? result.outputs!.filter(artifact=>requested.some(binding=>binding.assetId===artifact.assetId)) : result.outputs!;
          if(requested && selected.length!==requested.length)throw new Error('dependency_asset_missing');
          inputs.push(...selected.map(artifact=>({root:result.root!,artifact})));
        }
        inputs.push(...(node.externalInputs ?? []));
        for(const input of inputs)await verifyArtifact(input.artifact,input.root);
        const refs=inputs.map(input=>({assetId:input.artifact.assetId,version:input.artifact.version,sha256:input.artifact.sha256}));
        fingerprint=planHash({payload:node.payload,inputRefs:refs,runtimeIdentity:node.runtimeIdentity,projectKey:node.projectKey,expectedRevision:node.expectedRevision});
        const cached=this.ledger.cachedWorkflowNode(plan.ownerId,plan.workflowId,id,fingerprint) as NodeResult|null;
        if(cached){await this.verifyResult(cached);save(id,{...cached,status:'reused',fingerprint});return;}
        taskId='wf-'+planHash({owner:plan.ownerId,workflow:plan.workflowId,revision:plan.revision,node:id,fingerprint}).slice(0,48);
        const request=this.request(plan,node,taskId,'wf-node:'+planHash({key,id,fingerprint}),inputs);
        const registered=this.ledger.register(plan.ownerId,node.projectKey,request);
        taskId=registered.taskId;
        const previous=this.ledger.workflowNode(key,id) as NodeResult;
        root=previous.root;
        if(['running','reconciling','cancel_requested','verifying'].includes(registered.state)){
          save(id,{status:'waiting',fingerprint,taskId,root,error:'outcome_pending'});return;
        }
        if(['failed','cancelled'].includes(registered.state)){save(id,{status:registered.state,fingerprint,taskId,root});return;}
        if(registered.state==='review_ready' || registered.state==='completed'){
          const result={status:'review_ready',fingerprint,taskId,root,outputs:registered.outputRefs as Record<string,any>[]};
          await this.verifyResult(result);save(id,result);return;
        }
        save(id,{status:'preparing',fingerprint,taskId,root});
        const compiled=await this.factories[node.runtimeIdentity.pluginId](node,inputs,taskId);
        root=compiled.root;
        save(id,{status:'running',fingerprint,taskId,root});
        if(registered.state==='planned')this.ledger.ready(taskId);
        if(this.ledger.workflowCancelled(key)){this.ledger.cancel(taskId);save(id,{status:'cancelled',fingerprint,taskId,root});return;}
        activeTasks.add(taskId);
        const receipt=await this.runner.execute(taskId,compiled.adapter);
        const result={status:['review_ready','completed'].includes(receipt.state) ? 'review_ready' : ['failed','cancelled'].includes(receipt.state) ? receipt.state : 'waiting',fingerprint,taskId,root,outputs:receipt.outputRefs as Record<string,any>[]};
        if(result.status==='review_ready')await this.verifyResult(result);
        save(id,result);
      }catch(error){save(id,{status:'blocked',fingerprint,taskId,root,error:(error as Error).message});}
      finally{if(taskId)activeTasks.delete(taskId);}
    };
    try{
      while(pending.size || active.size){
        for(const id of order){
          if(!pending.has(id))continue;
          const node=byId.get(id)!;
          if(this.ledger.workflowCancelled(key)){pending.delete(id);save(id,{status:'cancelled'});continue;}
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
    const state=this.ledger.workflowCancelled(key) ? 'cancelled' : states.every(status=>['review_ready','reused'].includes(status)) ? 'review_ready' : states.includes('failed') ? 'failed' : states.includes('waiting') ? 'waiting' : 'blocked';
    return {runKey:key,state,nodes:results};
  }
}
