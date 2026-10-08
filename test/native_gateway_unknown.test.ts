import {lockNativeSchema} from './fixtures/native_schema_lock.ts';
/** 实际网关工作流保存后异常：原暂存工程是恢复输入，测试代理副本不算交付。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {publicSkillFactory} from '../src/adapters/public_skill.ts';
import {TaskLedger} from '../src/harness/task_ledger.ts';
import {LocalRunner} from '../src/harness/local_runner.ts';
import {WorkflowEngine} from '../src/planning/workflow_engine.ts';
const exec=promisify(execFile),hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const skills=process.env.CRAFT_NATIVE_SKILLS_ROOT,runtime=process.env.CRAFT_NATIVE_RUNTIME_HOME;
test('gateway workflow unknown saved replies preserve originals and block downstream without replay',{skip:!skills||!runtime},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-gateway-unknown-'));const evidence=[];
 try{
  const python='/opt/anaconda3/bin/python3',skill=join(skills!,'effectcraft-skills/skills/effectcraft-use'),cli=join(runtime!,'effectcraft/0.2.0/effectcraft-cli');
  const files=await Promise.all(['scripts/workflow.py','scripts/bootstrap.py','scripts/mcp_session.py','scripts/runtime.lock.json','scripts/exchange_loss.py','scripts/preserved_stage.py','scripts/native_workflow.py','scripts/commands.py','references/command-coverage.json'].map(async name=>({path:join(skill,name),sha256:hash(await readFile(join(skill,name)))})));
  await lockNativeSchema(files);
  const identity={pluginId:'effectcraft',pluginVersion:'source-candidate',cliVersion:'0.2.0',sha256:hash(await readFile(cli)),mode:'headless',capabilitySnapshotSha256:hash(JSON.stringify(files))};
  for(const fault of ['malformed','scalar','missing','ambiguous','nonfinite','tool-content']){
   const ledger=new TaskLedger(join(root,fault+'.sqlite'));
   try{
    const factory=publicSkillFactory({pluginId:'effectcraft',skillRoot:skill,python,pythonSha256:hash(await readFile(python)),nativeExecutable:cli,runtimeHome:runtime!,files,outputRoot:join(root,fault)});
    const log=join(root,fault+'-saves.jsonl'),capture=join(root,fault+'-proxy-copy.ecproj'),reply=join(root,fault+'-reply.json');
    // 可信测试钩子包裹已编译启动计划，不替换或修改任何领域发布文件。
    const wrapped=async(...args:any[])=>{
     const made=await (factory as any)(...args),prepare=made.adapter.prepare;
     made.adapter.prepare=async(request:any)=>{
      const plan=await prepare(request),script=plan.args[2];
      const injection=new URL('./fixtures/workflow_protocol_injection.py',import.meta.url).pathname,proxy=new URL('./fixtures/protocol_proxy.py',import.meta.url).pathname;
      plan.args=['-I','-B',injection,proxy,fault,log,capture,reply,script,...plan.args.slice(3)];
      plan.launcherIdentity.files.push(...await Promise.all([injection,proxy].map(async path=>({path,sha256:hash(await readFile(path))}))));return plan;
     };return made;
    };
    let downstreamCalls=0;
    const sink=async()=>{downstreamCalls++;throw Error('unknown_must_block_downstream');};
    const payload={schemaVersion:'craft-skill-workflow/v1',plan:{document:{name:'Unknown gateway',width:32,height:32,frameRate:12,duration:1},operations:[{command:'native.command',params:{command:'layer.newShape',params:{kind:'rounded',name:'Badge',size:[8,8],position:[16,16],fill:'#ff0000'}}}],frames:[0],exports:[]},assetBindings:[],outputs:[{assetId:'intro',location:'frame-0.png',mediaType:'image/png'}]};
    const plan={workflowId:'gateway-'+fault,ownerId:'test',revision:'v1',authorizationRef:'test',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),nodes:[{id:'intro',dependsOn:[],projectKey:'intro',runtimeIdentity:identity,expectedRevision:null,payload},{id:'consumer',dependsOn:['intro'],projectKey:'consumer',runtimeIdentity:{...identity,pluginId:'photocraft'},expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1'}}]};
    const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),{effectcraft:wrapped,photocraft:sink});
    const result=await engine.run(plan);assert.equal(result.state,'failed');assert.equal(downstreamCalls,0);assert.equal(result.nodes.consumer.status,'blocked');
    const output=result.nodes.intro.root!;const failure=JSON.parse(await readFile(join(output,'failure.json'),'utf8'));assert.equal(failure.outcome,'outcome_unknown');assert.equal(failure.replayAllowed,false);
    const stage=join(output,failure.stage),project=join(stage,'project.ecproj'),saved=JSON.parse((await readFile(log,'utf8')).trim());assert.equal(hash(await readFile(project)),saved.sha256);
    const inspection=join(root,fault+'-inspection.json');await writeFile(inspection,JSON.stringify({schema:'craft-command-plan/v1',operations:[{tool:'open_project',params:{path:{'$ref':'source.path'}}},{tool:'get_project',params:{}}]}));
    await exec(python,['-I','-B',join(skill,'scripts/commands.py'),'run',inspection,'--input','source='+project,'--output',join(root,fault+'-inspected'),'--runtime-home',runtime!],{timeout:60000});assert.equal(hash(await readFile(project)),saved.sha256);
    const before=ledger.workflowBudget(result.runKey);const repeated=await engine.run(plan);assert.equal(repeated.nodes.intro.taskId,result.nodes.intro.taskId);assert.equal((await readFile(log,'utf8')).trim().split('\n').length,1);assert.deepEqual(ledger.workflowBudget(result.runKey),before);assert.equal(downstreamCalls,0);
    evidence.push({fault,result:'PASS',originalStageReopened:true,savedSha256:saved.sha256,nativeSaveCount:1,downstreamCalls:0});
   }finally{ledger.close();}
  }
  if(process.env.CRAFT_NATIVE_GATEWAY_UNKNOWN_REPORT)await writeFile(process.env.CRAFT_NATIVE_GATEWAY_UNKNOWN_REPORT,JSON.stringify({schema:'craft-native-gateway-unknown/v1',result:'PASS',cases:evidence,installedRelease:'NOT_RUN'},null,2));
 }finally{await rm(root,{recursive:true});}
});
