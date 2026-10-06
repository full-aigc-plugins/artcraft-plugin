/** 完整网关的真实原生取消：固定公开适配器、进程组停止、原工程保全、不重放。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,readdir,stat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {publicSkillFactory} from '../src/adapters/public_skill.ts';
import {TaskLedger} from '../src/harness/task_ledger.ts';
import {LocalRunner} from '../src/harness/local_runner.ts';
import {planHash} from '../src/protocol/contracts.ts';
const exec=promisify(execFile),hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const skills=process.env.CRAFT_NATIVE_SKILLS_ROOT,runtime=process.env.CRAFT_NATIVE_RUNTIME_HOME;
test('public native gateway cancellation preserves saved stage and never repeats an execution',{skip:!skills||!runtime},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-gateway-cancel-')),ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const python='/opt/anaconda3/bin/python3',skill=join(skills!,'effectcraft-skills/skills/effectcraft-use'),cli=join(runtime!,'effectcraft/0.2.0/effectcraft-cli');
  const files=await Promise.all(['scripts/workflow.py','scripts/bootstrap.py','scripts/mcp_session.py','scripts/runtime.lock.json','scripts/exchange_loss.py','scripts/preserved_stage.py','scripts/native_workflow.py','scripts/commands.py','references/command-coverage.json'].map(async name=>({path:join(skill,name),sha256:hash(await readFile(join(skill,name)))})));
  const identity={pluginId:'effectcraft',pluginVersion:'source-candidate',cliVersion:'0.2.0',sha256:hash(await readFile(cli)),mode:'headless',capabilitySnapshotSha256:hash(JSON.stringify(files))};
  const payload={schemaVersion:'craft-skill-workflow/v1',plan:{document:{name:'Gateway cancel',width:1280,height:720,frameRate:24,duration:30},operations:[{command:'native.command',params:{command:'layer.newText',params:{name:'Title',text:'NOVA',font:'Arial',size:64,position:[600,360]}}}],frames:[0],exports:[{format:'mp4'}]},assetBindings:[],outputs:[{assetId:'intro',location:'intro.mp4',mediaType:'video/mp4'}]};
  const node={runtimeIdentity:identity,expectedRevision:null,payload};
  const factory=publicSkillFactory({pluginId:'effectcraft',skillRoot:skill,python,pythonSha256:hash(await readFile(python)),nativeExecutable:cli,runtimeHome:runtime!,files,outputRoot:join(root,'deliveries')});
  const made=await factory(node,[],'gateway-cancel');
  ledger.register('test',made.root,{protocolVersion:'craft-task/v1',taskId:'gateway-cancel',idempotencyKey:'gateway-cancel-key',planHash:planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:identity,authorizationRef:'test',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+120000).toISOString(),payload});
  ledger.ready('gateway-cancel');
  const runner=new LocalRunner(ledger,async request=>assert.equal(request.authorizationRef,'test'));
  const execution=runner.execute('gateway-cancel',made.adapter);
  let observed=false;
  for(let n=0;n<600;n++){
   const {stdout}=await exec('/bin/ps',['-axo','command=']);
   if(stdout.split('\n').some(line=>line.includes(root)&&line.includes('effectcraft-cli')&&line.includes(' render '))){observed=true;break;}
   if(ledger.execution('gateway-cancel')?.status==='stopped')break;
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.ok(observed,'actual native render after the gateway must precede cancellation');
  ledger.cancel('gateway-cancel');
  const result=await execution;assert.equal(result.state,'cancelled');assert.equal(ledger.execution('gateway-cancel')?.groupStopped,true);assert.equal(ledger.leases().length,0);assert.deepEqual(result.outputRefs,[]);
  const stages=(await readdir(dirname(made.root))).filter(name=>name.startsWith('.effectcraft-'));
  assert.equal(stages.length,1);const project=join(dirname(made.root),stages[0],'project.ecproj');assert.ok((await stat(project)).size>0);const original=hash(await readFile(project));
  const inspectPlan=join(root,'inspect.json');await writeFile(inspectPlan,JSON.stringify({schema:'craft-command-plan/v1',operations:[{tool:'open_project',params:{path:{'$ref':'source.path'}}},{tool:'get_project',params:{}}]}));
  const inspected=await exec(python,['-I','-B',join(skill,'scripts/commands.py'),'run',inspectPlan,'--input','source='+project,'--output',join(root,'inspection'),'--runtime-home',runtime!],{timeout:60000});assert.equal(JSON.parse(inspected.stdout).result,'PASS');assert.equal(hash(await readFile(project)),original);
  const replay=await runner.execute('gateway-cancel',made.adapter);assert.equal(replay.state,'cancelled');assert.equal(ledger.events('gateway-cancel').filter(e=>(e.detail as any)?.execution==='spawned').length,1);assert.equal(hash(await readFile(project)),original);
  assert.deepEqual(await runner.reconcile('gateway-cancel',made.adapter),replay);
  if(process.env.CRAFT_NATIVE_GATEWAY_CANCEL_REPORT)await writeFile(process.env.CRAFT_NATIVE_GATEWAY_CANCEL_REPORT,JSON.stringify({schema:'craft-native-gateway-cancel/v1',result:'PASS',nativeRenderObserved:true,groupStopped:true,savedStageReopened:true,projectSha256:original,spawnCount:1,sourceUnchanged:true,installedRelease:'NOT_RUN'},null,2));
 }finally{
  const pid=ledger.execution('gateway-cancel')?.pid;if(pid){try{process.kill(-pid,'SIGKILL');}catch{}}
  ledger.close();await rm(root,{recursive:true});
 }
});
