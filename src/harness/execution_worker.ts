/** 独立执行监督进程；调度器退出后仍持久化同一原生进程的停止证据。 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { TaskLedger } from './task_ledger.ts';
import { planHash } from '../protocol/contracts.ts';
import type { ExecutionPlan } from './local_runner.ts';
import { groupAlive } from './process_group.ts';
import { OutputObservation, nativeDiagnostics } from './native_diagnostics.ts';

const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>2*1024*1024)throw new Error('worker_input_too_large');}
 const {database,taskId,epoch,token,plan}:{database:string;taskId:string;epoch:number;token:string;plan:ExecutionPlan}=JSON.parse(input);
 if(!isAbsolute(database) || !isAbsolute(plan.executable) || !isAbsolute(plan.cwd) || !Array.isArray(plan.args) || !plan.args.every(a=>typeof a==='string'))throw new Error('worker_plan_invalid');
 const ledger=new TaskLedger(database);
 try{
  const request=ledger.request(taskId),execution=ledger.execution(taskId),status=ledger.status(taskId);
  const command=planHash({executable:plan.executable,args:plan.args,cwd:plan.cwd,launcherIdentity:plan.launcherIdentity ?? null});
  if(status.epoch!==epoch || !['running','cancel_requested'].includes(status.state) || execution?.token!==token || execution.status!=='prepared' || execution.commandHash!==command)throw new Error('worker_binding_invalid');
  const digest=async(path:string)=>createHash('sha256').update(await readFile(path)).digest('hex');
  const launcher=plan.launcherIdentity;
  if(await digest(launcher?.runtimeExecutable ?? plan.executable)!==request.runtimeIdentity.sha256)throw new Error('runtime_identity_mismatch');
  if(launcher){
   if(await digest(plan.executable)!==launcher.sha256)throw new Error('launcher_identity_mismatch');
   for(const file of launcher.files)if(await digest(file.path)!==file.sha256)throw new Error('launcher_file_identity_mismatch');
  }
  // 提交之前已取消/到期时明确记录未启动；并不推断进程消失就是成功。
  if(status.state==='cancel_requested' || ledger.taskWorkflowCancelled(taskId) || Date.parse(request.deadline)<=Date.now()){
   if(status.state!=='cancel_requested')ledger.cancel(taskId);
   ledger.recordExit(taskId,epoch,token,{exitCode:null,signal:null,groupStopped:true,spawnError:'cancelled_before_spawn'});return;
  }
  const child=spawn(plan.executable,plan.args,{cwd:plan.cwd,detached:true,shell:false,stdio:['ignore','pipe','pipe']});
  const stdout=new OutputObservation(child.stdout),stderr=new OutputObservation(child.stderr);
  // 后代可能继承管道；主进程 exit 后只等待有界排空，进程组停止仍另行核验。
  let drain:ReturnType<typeof setTimeout>|undefined;
  child.once('exit',()=>{drain=setTimeout(()=>{child.stdout.destroy();child.stderr.destroy();},250);});
  const closed=new Promise<{code:number|null;signal:string|null;spawnError?:string}>(resolve=>{
   let spawnError:string|undefined;child.once('error',error=>{spawnError=String(error)});
   child.once('close',(code,signal)=>resolve({code,signal,spawnError}));
  });
  if(child.pid)ledger.attachExecution(taskId,epoch,token,child.pid);
  let signalled=false,observationError:unknown,escalation:ReturnType<typeof setTimeout>|undefined;
  const monitor=setInterval(()=>{
   try{
    let status=ledger.status(taskId);
    if(status.state==='cancel_requested' || ledger.taskWorkflowCancelled(taskId) || Date.parse(request.deadline)<=Date.now()){
     if(status.state!=='cancel_requested')status=ledger.cancel(taskId);
     if(!signalled && child.pid){
      signalled=true;if(groupAlive(child.pid))process.kill(-child.pid,'SIGTERM');
      escalation=setTimeout(()=>{try{if(child.pid && groupAlive(child.pid))process.kill(-child.pid,'SIGKILL');}catch(error){observationError=error;}},500);
     }
    }
   }catch(error){observationError=error;}
  },50);
  const result=await closed;clearInterval(monitor);if(drain)clearTimeout(drain);
  let stopped=true;
  try{if(child.pid){stopped=!groupAlive(child.pid);for(let n=0;!stopped && n<10;n++){await delay(50);stopped=!groupAlive(child.pid);}}}catch(error){stopped=false;observationError=error;}
  if(escalation)clearTimeout(escalation);
  ledger.recordExit(taskId,epoch,token,{exitCode:result.code,signal:result.signal,groupStopped:stopped && !observationError,spawnError:result.spawnError,diagnostics:nativeDiagnostics(stdout,stderr)});
  if(!stopped || observationError)ledger.unknown(taskId,epoch,'process_group_stop_unverified');
 }finally{ledger.close();}
}
try{await main();}catch{process.exitCode=1;} // 没有可信停止证据的故障保留工程占用，交由接管者核对。
