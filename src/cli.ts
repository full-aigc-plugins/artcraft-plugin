import { readFileSync } from 'node:fs';
/** ArtCraft 本地公共 CLI；仅解释 JSON 数据和锁定领域适配器。 */
import { readFile, access, mkdir } from 'node:fs/promises';
import { isAbsolute, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TaskLedger } from './harness/task_ledger.ts';
import { LocalRunner } from './harness/local_runner.ts';
import { assessBrief, pendingNativeAssessment } from './planning/project_brief.ts';
import { WorkflowEngine } from './planning/workflow_engine.ts';
import { publicSkillFactory } from './adapters/public_skill.ts';
import { videoFactoryFactory, videoFactoryConfiguration } from './adapters/video_factory.ts';
import { packageProject,verifyProjectPackage } from './artifacts/project_package.ts';
import { planHash } from './protocol/contracts.ts';
import { taskErrorDetail } from './protocol/task_error.ts';

const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const options:Record<string,string[]>={run:['database','registry','plan','owner','authorization','concurrency'],status:['database','task'],cancel:['database','task','workflow'],package:['database','workflow','owner','authorization','output'],'verify-package':['package','sha'],'register-video-factory':['plugin-root','ffmpeg','ffprobe','output-root']};
function parse(argv:string[]):{command:string;flags:Record<string,string>} {
 const [command,...rest]=argv;
 if(!Object.hasOwn(options,command))throw new Error('cli_command_invalid');
 const flags:Record<string,string>={};
 for(let index=0;index<rest.length;index+=2){
  const key=rest[index]?.slice(2),value=rest[index+1];
  if(!rest[index]?.startsWith('--') || !options[command].includes(key) || Object.hasOwn(flags,key) || !value || value.startsWith('--'))throw new Error('cli_arguments_invalid');
  flags[key]=value;
 }
 if(!['verify-package','register-video-factory'].includes(command) && (!flags.database || !isAbsolute(flags.database)))throw new Error('cli_database_required');
 return {command,flags};
}

/** 执行一个命令；调用者通过 argv 明确声明本地授权和所有者。 */
export async function main(argv:string[]):Promise<unknown> {
 if(argv.length===1 && argv[0]==='--version')return {name:'artcraft',version};
 if(argv.length===1 && argv[0]==='--help')return {name:'artcraft',version,commands:['run','status','cancel','package','verify-package','register-video-factory'],run:'run --database ABS --registry ABS --plan ABS --owner ID --authorization REF [--concurrency 1..16]',status:'status --database ABS [--task ID]',cancel:'cancel --database ABS --task ID | --workflow RUN_KEY',package:'package --database ABS --workflow RUN_KEY --owner ID --authorization REF --output ABS',verifyPackage:'verify-package --package ABS --sha MANIFEST_SHA256',registerVideoFactory:'register-video-factory --plugin-root ABS --ffmpeg ABS --ffprobe ABS --output-root ABS'};
 const {command,flags}=parse(argv);
 if(command==='register-video-factory')return videoFactoryConfiguration(flags['plugin-root'],process.execPath,flags.ffmpeg,flags.ffprobe,flags['output-root']);
 if(command==='verify-package'){if(!flags.package || !isAbsolute(flags.package) || !flags.sha)throw new Error('cli_verify_package_arguments_required');return verifyProjectPackage(flags.package,flags.sha);}
 if(command==='package' && (!flags.owner || !flags.authorization || !flags.workflow || !flags.output || !isAbsolute(flags.output)))throw new Error('cli_package_arguments_required');
 if(command!=='run'){
  await access(flags.database); // 只读状态和取消不能静默创建空账本。
  const ledger=new TaskLedger(flags.database,{legacyReadOnly:command==='status'});
  try{
   if(command==='package')return await packageProject(ledger,flags.workflow,flags.owner,flags.authorization,flags.output);
   if(command==='status')return flags.task?ledger.status(flags.task):{tasks:ledger.list(),leases:ledger.leases(),budgets:ledger.budgetAccounts(),...(ledger.legacySchemaReadOnly?{budgetTracking:'untracked-legacy-schema'}:{})};
   if(Boolean(flags.task)===Boolean(flags.workflow))throw new Error('cli_cancel_target_required');
   if(flags.task)return ledger.cancel(flags.task);
   ledger.cancelWorkflow(flags.workflow);return {workflow:flags.workflow,state:'cancel_requested'};
  }finally{ledger.close();}
 }
 for(const key of ['registry','plan'])if(!flags[key] || !isAbsolute(flags[key]))throw new Error('cli_'+key+'_required');
 if(!flags.owner || !flags.authorization)throw new Error('authorization_required');
 const registry=JSON.parse(await readFile(flags.registry,'utf8'));
 if(registry.schemaVersion!=='craft-skill-registry/v1' || !registry.plugins || typeof registry.plugins!=='object')throw new Error('skill_registry_invalid');
 const factories:Record<string,ReturnType<typeof publicSkillFactory>>={};
 for(const [id,entry] of Object.entries(registry.plugins) as [string,any][]){
  if(entry.config?.pluginId!==id || entry.runtimeIdentity?.pluginId!==id)throw new Error('skill_registry_invalid');
  factories[id]=id==='video-factory'?videoFactoryFactory(entry.config):publicSkillFactory(entry.config);
 }
 const plan=JSON.parse(await readFile(flags.plan,'utf8'));
 if(plan.ownerId && plan.ownerId!==flags.owner || plan.authorizationRef && plan.authorizationRef!==flags.authorization)throw new Error('authorization_scope_mismatch');
 plan.ownerId=flags.owner;plan.authorizationRef=flags.authorization;
 if(!Array.isArray(plan.nodes))throw new Error('workflow_nodes_invalid');
 for(const node of plan.nodes){
  const id=node.pluginId ?? node.runtimeIdentity?.pluginId,entry=registry.plugins[id];
  if(!entry)throw new Error('capability_missing: '+id);
  if(node.runtimeIdentity && planHash(node.runtimeIdentity)!==planHash(entry.runtimeIdentity))throw new Error('runtime_identity_mismatch');
  delete node.pluginId;node.runtimeIdentity=structuredClone(entry.runtimeIdentity);
 }
 if(plan.projectBrief!==undefined){const assessment=assessBrief(plan.projectBrief,plan);if(!pendingNativeAssessment(assessment,plan))throw new Error('brief_plan_blocked: '+JSON.stringify(assessment));}
 const concurrency=flags.concurrency?Number(flags.concurrency):2;
 if(!Number.isInteger(concurrency) || concurrency<1 || concurrency>16)throw new Error('concurrency_invalid');
 await mkdir(dirname(flags.database),{recursive:true});
 const ledger=new TaskLedger(flags.database);
 try{
  const runner=new LocalRunner(ledger,async request=>{if(request.authorizationRef!==flags.authorization)throw new Error('authorization_scope_mismatch');});
  return await new WorkflowEngine(ledger,runner,factories).run(plan,concurrency);
 }finally{ledger.close();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await main(process.argv.slice(2));process.stdout.write(JSON.stringify(result)+'\n');if((result as {state?:string}).state && !['review_ready','completed','cancel_requested','cancelled'].includes((result as {state:string}).state))process.exitCode=2;}
 catch(error){process.stdout.write(JSON.stringify({error:taskErrorDetail(error).message,errorDetail:taskErrorDetail(error)})+'\n');process.exitCode=1;}
}
