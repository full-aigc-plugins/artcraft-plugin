/** 源码监督器取消安装后的原生技能执行；发布版首次使用另行验证。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {TaskLedger} from '../src/harness/task_ledger.ts';
import {LocalRunner} from '../src/harness/local_runner.ts';
import {planHash} from '../src/protocol/contracts.ts';
const exec=promisify(execFile),hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const skill=process.env.CRAFT_INSTALLED_EFFECT_ANIMATION_SKILL;
test('live native skill cancellation settles after the child group closes',{skip:!skill},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-native-cancel-')),ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const python='/opt/anaconda3/bin/python3',planPath=join(root,'plan.json'),out=join(root,'output');
  await writeFile(planPath,JSON.stringify({document:{name:'Native cancellation',width:1280,height:720,frameRate:24,duration:30},operations:[{command:'layer.newText',params:{name:'Title',text:'NOVA',font:'Arial',size:64,position:[600,360]}}],frames:[0],exports:[{format:'mp4'}]}));
  const payload={schemaVersion:'native-cancel-test/v1'};
  ledger.register('test',out,{protocolVersion:'craft-task/v1',taskId:'native-cancel',idempotencyKey:'cancel-key',planHash:planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:{pluginId:'effectcraft',pluginVersion:'0.1.0-dev.7',cliVersion:'0.2.0',sha256:hash(await readFile(python)),mode:'headless',capabilitySnapshotSha256:hash('native-cancel')},authorizationRef:'test',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+120000).toISOString(),payload});
  ledger.ready('native-cancel');
  const runner=new LocalRunner(ledger,async()=>{});
  const executing=runner.execute('native-cancel',{prepare:async()=>({executable:python,args:['-I','-B',join(skill!,'scripts/workflow.py'),planPath,'--output',out],cwd:root,actualRevision:null,budgetUsage:{minorUnits:0,externalCalls:0}}),verify:async()=>{throw Error('cancelled_render_must_not_publish')}});
  let observed=false;
  for(let n=0;n<1200;n++){
   const {stdout}=await exec('/bin/ps',['-axo','command=']);
   if(stdout.split('\n').some(line=>line.includes(root)&&line.includes('effectcraft-cli')&&line.includes(' render '))){observed=true;break;}
   if(ledger.execution('native-cancel')?.status==='stopped')break;
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.ok(observed,'actual native render must precede cancellation');
  assert.equal(ledger.cancel('native-cancel').state,'cancel_requested');
  assert.equal(ledger.leases().length,1);
  const result=await executing;
  assert.equal(result.state,'cancelled',JSON.stringify({state:result.state,execution:ledger.execution('native-cancel'),events:ledger.events('native-cancel').map(e=>({state:e.toState,detail:e.detail}))}));assert.equal(ledger.execution('native-cancel')?.groupStopped,true);assert.equal(ledger.leases().length,0);
  const events=ledger.events('native-cancel');assert.equal(events.filter(e=>(e.detail as any)?.execution==='spawned').length,1);
  assert.equal(result.outputRefs.length,0);
 }finally{
  const pid=ledger.execution('native-cancel')?.pid;if(pid){try{process.kill(-pid,'SIGKILL');}catch{}}
  ledger.close();await rm(root,{recursive:true});
 }
});
