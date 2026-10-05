/** 可信领域适配器编译的本地子进程；不接受模型拼接 shell。 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planHash } from '../protocol/contracts.ts';
import { TaskLedger } from './task_ledger.ts';
import type { TaskReceipt } from './task_ledger.ts';
import type { BudgetUsage } from './budget.ts';

/** 可信适配器的锁定启动器；模型 payload 不能提供此对象。 */
export interface LauncherIdentity {
  runtimeExecutable:string;
  sha256:string;
  files:{path:string;sha256:string}[];
}
export interface ExecutionPlan {executable:string;args:string[];cwd:string;actualRevision:string|null;budgetUsage?:BudgetUsage;launcherIdentity?:LauncherIdentity;}
export interface ExecutionAdapter {
  /** 只读准备和编译；授权已检查，不启动副作用。 */
  prepare(request:Record<string,any>):Promise<ExecutionPlan>;
  /** 专业技术核验后返回公共素材；执行器再次核对文件摘要。 */
  verify(request:Record<string,any>):Promise<{root:string;outputs:unknown[];evidenceRefs:unknown[]}>;
}

/** 监督器拥有唯一重试责任；未知结果永不自动启动第二次子任务。 */
export class LocalRunner {
  private ledger:TaskLedger;
  private authorize:(request:Record<string,any>)=>Promise<void>;
  constructor(ledger:TaskLedger,authorize:(request:Record<string,any>)=>Promise<void>){this.ledger=ledger;this.authorize=authorize;}

  private async validatePlan(plan:ExecutionPlan,request:Record<string,any>):Promise<void> {
    if(!isAbsolute(plan.executable) || !isAbsolute(plan.cwd) || !Array.isArray(plan.args) || !plan.args.every(value=>typeof value==='string')) throw new Error('execution_plan_invalid');
    const digest=async(path:string)=>createHash('sha256').update(await readFile(path)).digest('hex');
    const launcher=plan.launcherIdentity;
    if(launcher){
      if(!isAbsolute(launcher.runtimeExecutable) || !/^[a-f0-9]{64}$/.test(launcher.sha256) || !Array.isArray(launcher.files) || launcher.files.length===0)throw new Error('launcher_identity_invalid');
      if(await digest(plan.executable)!==launcher.sha256)throw new Error('launcher_identity_mismatch');
      const paths=new Set<string>();
      for(const file of launcher.files){
        if(!isAbsolute(file.path) || !/^[a-f0-9]{64}$/.test(file.sha256) || paths.has(file.path))throw new Error('launcher_identity_invalid');
        paths.add(file.path);
        if(await digest(file.path)!==file.sha256)throw new Error('launcher_file_identity_mismatch');
      }
    }
    const runtimeHash=await digest(launcher?.runtimeExecutable ?? plan.executable);
    if(runtimeHash!==request.runtimeIdentity.sha256) throw new Error('runtime_identity_mismatch');
  }

  /** 登记意图、监督真实 close、核对进程组停止，最后验证产物。 */
  async execute(taskId:string,adapter:ExecutionAdapter):Promise<TaskReceipt> {
    if(!['darwin','linux'].includes(process.platform))throw new Error('unsupported_platform');
    if(this.ledger.databasePath===':memory:')throw new Error('durable_ledger_required');
    const original=this.ledger.status(taskId);
    if(original.state!=='ready') return original;
    const request=this.ledger.request(taskId);
    await this.authorize(request);
    const plan=await adapter.prepare(request);
    await this.validatePlan(plan,request);
    const launcher=plan.launcherIdentity;
    if(Buffer.byteLength(JSON.stringify(plan))>2*1024*1024-8192)throw new Error('worker_plan_too_large');
    let claimed:TaskReceipt;
    try{claimed=this.ledger.claim(taskId,plan.actualRevision,plan.budgetUsage);}
    catch(error){if(['task_not_ready','project_busy'].includes((error as Error).message))return this.ledger.status(taskId);throw error;}
    const epoch=claimed.epoch;
    const token=this.ledger.prepareExecution(taskId,epoch,planHash({executable:plan.executable,args:plan.args,cwd:plan.cwd,launcherIdentity:launcher ?? null}));
    // 独立 worker 使用固定运行时源码；只接收可信适配器已编译的结构化计划。
    const child=spawn(process.execPath,[fileURLToPath(new URL('./execution_worker.ts',import.meta.url))],{detached:true,shell:false,stdio:['pipe','ignore','ignore']});
    const closed=new Promise<void>(resolve=>{child.once('error',()=>resolve());child.once('close',()=>resolve());});
    child.stdin?.on('error',()=>{});
    child.stdin?.end(JSON.stringify({database:this.ledger.databasePath,taskId,epoch,token,plan}));
    await closed;
    const execution=this.ledger.execution(taskId);
    if(execution?.status!=='stopped')return this.ledger.unknown(taskId,epoch,'worker_exit_without_stop_evidence');
    return this.adopt(taskId,adapter,plan);
  }

  /** 只接管原任务的停止证据；从不重新提交原生副作用或预算申请。 */
  async reconcile(taskId:string,adapter:ExecutionAdapter):Promise<TaskReceipt> {
    return this.adopt(taskId,adapter);
  }

  private async adopt(taskId:string,adapter:ExecutionAdapter,preparedPlan?:ExecutionPlan):Promise<TaskReceipt> {
    const status=this.ledger.status(taskId);
    if(!['running','reconciling','cancel_requested','verifying'].includes(status.state))return status;
    const request=this.ledger.request(taskId);if(!preparedPlan)await this.authorize(request);
    const execution=this.ledger.execution(taskId);
    if(!execution || execution.status!=='stopped' || !execution.groupStopped)return status;
    const settle=(state:'failed'|'cancelled',code:string)=>{
      const current=this.ledger.status(taskId);
      if(!['running','reconciling','cancel_requested','verifying'].includes(current.state))return current;
      return this.ledger.settleStopped(taskId,status.epoch,execution.token,state,code);
    };
    if(status.state==='cancel_requested')return settle('cancelled','process_stopped');
    if(execution.exitCode!==0)return settle('failed','native_execution_failed');
    // 重编译仅验证身份，不运行 prepare 的输出命令。
    const plan=preparedPlan ?? await adapter.prepare(request);
    await this.validatePlan(plan,request);
    if(planHash({executable:plan.executable,args:plan.args,cwd:plan.cwd,launcherIdentity:plan.launcherIdentity ?? null})!==execution.commandHash)throw new Error('recovery_command_identity_mismatch');
    try{
      const verified=await adapter.verify(request);
      return await this.ledger.reviewReady(taskId,status.epoch,execution.token,verified.root,verified.outputs,verified.evidenceRefs);
    }catch(error){
      if(this.ledger.status(taskId).state==='cancel_requested')return settle('cancelled','process_stopped');
      return settle('failed','artifact_invalid');
    }
  }
}
