/** 可信领域适配器编译的本地子进程；不接受模型拼接 shell。 */
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
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

function groupAlive(pid:number):boolean {
  try{process.kill(-pid,0);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return false;throw error;}
}
const delay=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));

/** 监督器拥有唯一重试责任；未知结果永不自动启动第二次子任务。 */
export class LocalRunner {
  private ledger:TaskLedger;
  private authorize:(request:Record<string,any>)=>Promise<void>;
  constructor(ledger:TaskLedger,authorize:(request:Record<string,any>)=>Promise<void>){this.ledger=ledger;this.authorize=authorize;}

  /** 登记意图、监督真实 close、核对进程组停止，最后验证产物。 */
  async execute(taskId:string,adapter:ExecutionAdapter):Promise<TaskReceipt> {
    if(!['darwin','linux'].includes(process.platform))throw new Error('unsupported_platform');
    const original=this.ledger.status(taskId);
    if(original.state!=='ready') return original;
    const request=this.ledger.request(taskId);
    await this.authorize(request);
    const plan=await adapter.prepare(request);
    if(!isAbsolute(plan.executable) || !isAbsolute(plan.cwd) || !plan.args.every(value=>typeof value==='string')) throw new Error('execution_plan_invalid');
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
    let claimed:TaskReceipt;
    try{claimed=this.ledger.claim(taskId,plan.actualRevision,plan.budgetUsage);}
    catch(error){if(['task_not_ready','project_busy'].includes((error as Error).message))return this.ledger.status(taskId);throw error;}
    const epoch=claimed.epoch;
    const token=this.ledger.prepareExecution(taskId,epoch,planHash({executable:plan.executable,args:plan.args,cwd:plan.cwd,launcherIdentity:launcher ?? null}));
    let child:ReturnType<typeof spawn>;
    try{child=spawn(plan.executable,plan.args,{cwd:plan.cwd,detached:true,shell:false,stdio:['ignore','pipe','pipe']});}
    catch(error){this.ledger.recordExit(taskId,epoch,token,{exitCode:null,signal:null,groupStopped:true,spawnError:String(error)});return this.ledger.settleStopped(taskId,epoch,token,'failed','runtime_spawn_failed');}
    child.stdout?.on('data',()=>{});
    child.stderr?.on('data',()=>{});
    const closed=new Promise<{code:number|null;signal:string|null;spawnError?:string}>(resolve=>{
      let spawnError:string|undefined;
      child.once('error',error=>{spawnError=String(error);});
      child.once('close',(code,signal)=>resolve({code,signal,spawnError}));
    });
    if(child.pid)this.ledger.attachExecution(taskId,epoch,token,child.pid);
    let signalled=false;
    let escalation:ReturnType<typeof setTimeout>|undefined;
    let observationError:unknown;
    const monitor=setInterval(()=>{
      try{
        const status=this.ledger.status(taskId);
        if(status.state==='cancel_requested' || Date.parse(request.deadline)<=Date.now()){
          if(status.state!=='cancel_requested')this.ledger.cancel(taskId);
          if(!signalled && child.pid){
            signalled=true;
            if(groupAlive(child.pid))process.kill(-child.pid,'SIGTERM');
            escalation=setTimeout(()=>{try{if(child.pid && groupAlive(child.pid))process.kill(-child.pid,'SIGKILL');}catch(error){observationError=error;}},500);
          }
        }
      }catch(error){observationError=error;}
    },50);
    const result=await closed;
    clearInterval(monitor);
    let stopped=true;
    try{
      if(child.pid){
        stopped=!groupAlive(child.pid);
        for(let count=0;!stopped && count<10;count++){await delay(50);stopped=!groupAlive(child.pid);}
      }
    }catch(error){stopped=false;observationError=error;}
    if(escalation)clearTimeout(escalation);
    this.ledger.recordExit(taskId,epoch,token,{exitCode:result.code,signal:result.signal,groupStopped:stopped,spawnError:result.spawnError});
    if(!stopped || observationError){return this.ledger.unknown(taskId,epoch,'process_group_stop_unverified');}
    if(this.ledger.status(taskId).state==='cancel_requested')return this.ledger.settleStopped(taskId,epoch,token,'cancelled','process_stopped');
    if(result.spawnError || result.code!==0)return this.ledger.settleStopped(taskId,epoch,token,'failed',result.spawnError ? 'runtime_spawn_failed' : 'native_execution_failed');
    try{
      const verified=await adapter.verify(request);
      return await this.ledger.reviewReady(taskId,epoch,token,verified.root,verified.outputs,verified.evidenceRefs);
    }catch(error){
      if(this.ledger.status(taskId).state==='cancel_requested')return this.ledger.settleStopped(taskId,epoch,token,'cancelled','process_stopped');
      return this.ledger.settleStopped(taskId,epoch,token,'failed','artifact_invalid');
    }
  }
}
