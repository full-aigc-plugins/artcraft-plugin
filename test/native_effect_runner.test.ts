/** 显式提供已安装 CLI 的原生渲染执行器联调；不证明宿主安装。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { planHash } from '../src/protocol/contracts.ts';

const exec=promisify(execFile);
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
const cli=process.env.CRAFT_EFFECTCRAFT_CLI;

for(const crash of [false,true])test((crash ? 'scheduler SIGKILL recovery: ' : '')+'real EffectCraft render is supervised, decoded and registered without changing the native project',{skip:!cli},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-native-runner-'));const ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const project=join(root,'source.ecproj'),output=join(root,'intro.mp4');
  await exec(cli!,['--empty','--save-as',project,'run','comp.new',JSON.stringify({name:'Integration intro',width:320,height:180,frameRate:12,duration:1}),'layer.newText',JSON.stringify({name:'Title',text:'NOVA',font:'Arial',size:30,position:[120,90]})]);
  const revision=hash(await readFile(project)),runtime=hash(await readFile(cli!));
  const payload={schemaVersion:'effectcraft-render/v1',project:'source.ecproj',composition:'Integration intro',output:'intro.mp4'};
  ledger.register('native-test',project,{protocolVersion:'craft-task/v1',taskId:'native-render',idempotencyKey:'native-key',planHash:planHash(payload),inputRefs:[{assetId:'intro-project',version:'v1',sha256:revision}],expectedRevision:revision,runtimeIdentity:{pluginId:'effectcraft',pluginVersion:'0.1.0',cliVersion:'0.2.0',sha256:runtime,mode:'headless',capabilitySnapshotSha256:hash('native-render-contract')},authorizationRef:'native-render-test-scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),payload});
  ledger.ready('native-render');
  const runner=new LocalRunner(ledger,async request=>{assert.equal(request.authorizationRef,'native-render-test-scope');});
  const adapter={
   prepare:async()=>({executable:cli!,args:['--project',project,'render','--comp','Integration intro','--out',output,'--format','h264','--start','0','--end','1','--fps','12','--audio','off'],cwd:root,actualRevision:hash(await readFile(project)),budgetUsage:{minorUnits:0,externalCalls:0}}),
   verify:async()=>{
    const decoded=JSON.parse((await exec('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',output])).stdout);
    const video=decoded.streams.find((item:{codec_type:string})=>item.codec_type==='video');
    assert.deepEqual([video.width,video.height,video.avg_frame_rate,video.nb_read_frames],[320,180,'12/1','12']);
    assert.equal(hash(await readFile(project)),revision);
    const bytes=await readFile(output);
    return {root,outputs:[{protocolVersion:'craft-artifact/v1',assetId:'intro-render',version:'v1',sha256:hash(bytes),bytes:bytes.length,mediaType:'video/mp4',producerTaskId:'native-render',sourceRefs:[{assetId:'intro-project',version:'v1',sha256:revision}],nativeProjectRef:{assetId:'intro-project',version:'v1',sha256:revision,location:'source.ecproj'},renditions:[],dependencies:[],technicalMetadata:{width:320,height:180,frameRate:{num:12,den:1},durationTicks:'254016000000',timeBase:{num:1,den:254016000000},alpha:false},lossReportRef:null,evidenceRefs:[],location:'intro.mp4'}],evidenceRefs:[]};
   }
  };
  let receipt;
  if(crash){
   const plan=await adapter.prepare();
   const parentScript=join(root,'scheduler.mjs');
   const {writeFile}=await import('node:fs/promises');
   await writeFile(parentScript,`import{TaskLedger}from${JSON.stringify(new URL('../src/harness/task_ledger.ts',import.meta.url).href)};import{LocalRunner}from${JSON.stringify(new URL('../src/harness/local_runner.ts',import.meta.url).href)};const ledger=new TaskLedger(${JSON.stringify(join(root,'tasks.sqlite'))});await new LocalRunner(ledger,async()=>{}).execute('native-render',{prepare:async()=>(${JSON.stringify(plan)}),verify:async()=>{throw Error('scheduler_should_be_killed')}});`);
   const parent=spawn(process.execPath,[parentScript],{stdio:'ignore'}),closed=new Promise(resolve=>parent.once('close',resolve));
   for(let n=0;!ledger.execution('native-render')?.pid && n<300;n++)await new Promise(resolve=>setTimeout(resolve,5));
   assert.equal(ledger.execution('native-render')?.status,'running');const attempt=ledger.status('native-render').attemptId;
   parent.kill('SIGKILL');await closed;
   for(let n=0;ledger.execution('native-render')?.status!=='stopped' && n<3000;n++)await new Promise(resolve=>setTimeout(resolve,10));
   receipt=await runner.reconcile('native-render',adapter);
   assert.equal(receipt.attemptId,attempt);assert.equal(ledger.events('native-render').filter(e=>(e.detail as any)?.execution==='spawned').length,1);
   assert.equal((await runner.execute('native-render',adapter)).attemptId,attempt);
  }else receipt=await runner.execute('native-render',adapter);
  assert.equal(receipt.state,'review_ready');assert.equal(receipt.outputRefs.length,1);assert.equal(ledger.leases().length,0);assert.equal(ledger.execution('native-render')?.exitCode,0);
 }finally{ledger.close();await rm(root,{recursive:true});}
});
