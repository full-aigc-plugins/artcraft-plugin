/** 真实原生保存后的协议故障：运行实际发布的编排引擎，测试钩子不进入产品。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const installationFile=process.env.CRAFT_PROTOCOL_INSTALLATION;
const candidateSkill=process.env.CRAFT_PROTOCOL_VECTOR_SKILL;
const output=process.env.CRAFT_PROTOCOL_WORKFLOW_EVIDENCE;
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const exec=promisify(execFile),records:any[]=[];
for(const fault of ['malformed','scalar','missing','ambiguous','nonfinite','tool-content']){
 test(`published Art engine preserves failed native ${fault} attempt and blocks consumers`,{skip:!installationFile||!candidateSkill},async()=>{
  const installation=JSON.parse(await readFile(installationFile!,'utf8'));
  const load=async(path:string)=>import(pathToFileURL(join(installation.runtimeRoot,'src',path)).href);
  const {TaskLedger}=await load('harness/task_ledger.ts');
  const {LocalRunner}=await load('harness/local_runner.ts');
  const {WorkflowEngine}=await load('planning/workflow_engine.ts');
  const {publicSkillFactory}=await load('adapters/public_skill.ts');
  const root=await mkdtemp(join(tmpdir(),'art-native-protocol-'));
  const ledger=new TaskLedger(join(root,'tasks.sqlite'));
  try{
   const domain=installation.skills.vectorcraft;
   const skillRoot=candidateSkill!;
   const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py'].map(async name=>({path:join(skillRoot,'scripts',name),sha256:sha(await readFile(join(skillRoot,'scripts',name)))})));
   const nativeHash=sha(await readFile(domain.executable));
   const identity={...domain.runtimeIdentity,pluginVersion:'0.1.0-candidate',sha256:nativeHash};
   const factory=publicSkillFactory({pluginId:'vectorcraft',skillRoot,python:installation.pythonExecutable,pythonSha256:installation.pythonSha256,nativeExecutable:domain.executable,runtimeHome:installation.runtimeHome,files,outputRoot:join(root,'deliveries')});
   const proxy=fileURLToPath(new URL('./fixtures/protocol_proxy.py',import.meta.url));
   const wrapper=fileURLToPath(new URL('./fixtures/workflow_protocol_injection.py',import.meta.url));
   const log=join(root,'native-saves.jsonl'),capture=join(root,'saved.vectorcraft'),replyFile=join(root,'public-workflow-reply.json');
   let preparations=0;
   const injected=async(node:any,inputs:any[],taskId:string)=>{
    const compiled=await factory(node,inputs,taskId);
    return {...compiled,adapter:{...compiled.adapter,prepare:async(request:any)=>{
     preparations++;
     const plan=await compiled.adapter.prepare(request);
     return {...plan,args:['-I','-B',wrapper,proxy,fault,log,capture,replyFile,...plan.args.slice(2)],launcherIdentity:{...plan.launcherIdentity,files:[...plan.launcherIdentity.files,{path:wrapper,sha256:sha(await readFile(wrapper))},{path:proxy,sha256:sha(await readFile(proxy))}]}};
    }}};
   };
   const payload={schemaVersion:'craft-skill-workflow/v1',plan:{document:{name:'Protocol fixture',width:32,height:32,units:'Pixels'},operations:[{command:'shape.rectangle',params:{x:4,y:4,width:8,height:8},as:'shape'}],exports:[{format:'png',artboard:0}]},assetBindings:[],outputs:[{assetId:'logo-png',location:'artboard-1.png',mediaType:'image/png'}]};
   const node=(id:string,dependsOn:string[])=>({id,dependsOn,projectKey:id,runtimeIdentity:identity,expectedRevision:null,payload});
   const plan={workflowId:'native-protocol-'+fault,ownerId:'fixture',revision:'v1',authorizationRef:'native-protocol-test',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:1,maxExternalCalls:0},deadline:new Date(Date.now()+120000).toISOString(),nodes:[node('logo',[]),node('consumer',['logo'])]};
   const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async request=>assert.equal(request.authorizationRef,'native-protocol-test')),{vectorcraft:injected});
   const first=await engine.run(plan);
   assert.equal(first.state,'failed',JSON.stringify(first));
   assert.equal(first.nodes.consumer.status,'blocked');
   assert.equal(first.nodes.consumer.taskId,undefined);
   assert.deepEqual(first.nodes.logo.outputs,[]);
   const taskId=first.nodes.logo.taskId,receipt=ledger.status(taskId),execution=ledger.execution(taskId);
   assert.equal(receipt.state,'failed');assert.equal(execution.status,'stopped');assert.equal(execution.groupStopped,true);
   assert.equal(preparations,1);
   const publicReply=JSON.parse(await readFile(replyFile,'utf8'));
   assert.deepEqual(Object.keys(publicReply),['error']);
   assert.ok(publicReply.error.startsWith('outcome_unknown:'));
   assert.equal(execution.diagnostics.stdout.sha256,sha(await readFile(replyFile)));
   const saveLog=await readFile(log,'utf8');
   const saves=saveLog.trim().split('\n').map(line=>JSON.parse(line));
   assert.equal(saves.length,1);assert.equal(saves[0].saveSucceeded,true);
   const capturedHash=sha(await readFile(capture));assert.equal(capturedHash,saves[0].sha256);
   const info=JSON.parse((await exec(domain.executable,['info',capture])).stdout);
   assert.ok(info);
   const second=await engine.run(plan);
   assert.equal(preparations,1);assert.equal(second.nodes.logo.taskId,taskId);
   assert.equal(ledger.status(taskId).attemptId,receipt.attemptId);assert.deepEqual(second.budget,first.budget);
   assert.equal(await readFile(log,'utf8'),saveLog);
   assert.equal(sha(await readFile(capture)),capturedHash);assert.equal(sha(await readFile(domain.executable)),nativeHash);
   for(const file of files)assert.equal(sha(await readFile(file.path)),file.sha256);
   records.push({fault,result:'PASS',runtimeVersion:installation.version,nativeSha256:nativeHash,clientSha256:files.find(file=>file.path.endsWith('mcp_session.py'))!.sha256,saveCount:1,nativeReopen:true,consumerBlocked:true,publicUnknownReply:true,attemptPreserved:true,budgetPreserved:true,noReplay:true});
   if(output)await writeFile(output,JSON.stringify({schema:'art-native-protocol-workflow-candidate/v1',result:records.length===6?'PASS':'RUNNING',cases:records,scope:'actual published runtime + trusted public Vector adapter; transparent post-save response test hook; current candidate client',excluded:['updated fixed domain and Art installation','all four domain public workflow fault injection','new native partial file preservation by product: capture is test-only']},null,2)+'\n');
  }finally{ledger.close();await rm(root,{recursive:true,force:true});}
 });
}
