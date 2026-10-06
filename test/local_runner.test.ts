/** 真实子进程的退出、产物核验、取消和幂等执行测试。 */
import test from 'node:test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { planHash } from '../src/protocol/contracts.ts';

const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
async function context(mode='success') {
 const root=await mkdtemp(join(tmpdir(),'craft-runner-'));const ledger=new TaskLedger(join(root,'tasks.sqlite'));
 const executableHash=hash(await readFile(process.execPath));
 const payload={schemaVersion:'fixture/v1',mode};
 const request={protocolVersion:'craft-task/v1',taskId:'task1',idempotencyKey:'key',planHash:planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:{pluginId:'fixture',pluginVersion:'0.1.0',cliVersion:process.version,sha256:executableHash,mode:'headless',capabilitySnapshotSha256:hash('fixture')},authorizationRef:'test-scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),payload};
 ledger.register('test',root,request);ledger.ready('task1');
 const script=join(root,'worker.mjs');const output=join(root,'output.bin');
 await writeFile(script,mode==='success' ? `import{writeFileSync}from'node:fs';writeFileSync(process.argv[2],'result');` : mode==='failure' ? 'process.exit(3)' : 'setInterval(()=>{},1000)');
 let starts=0;
 const adapter={prepare:async()=>({executable:process.execPath,args:[script,output],cwd:root,actualRevision:null,budgetUsage:{minorUnits:0,externalCalls:0}}),verify:async()=>{
  const bytes=await readFile(output);return {root,outputs:[{protocolVersion:'craft-artifact/v1',assetId:'output',version:'v1',sha256:hash(bytes),bytes:bytes.length,mediaType:'application/octet-stream',producerTaskId:'task1',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'output.bin'}],evidenceRefs:[]};
 }};
 const runner=new LocalRunner(ledger,async req=>{assert.equal(req.authorizationRef,'test-scope');starts++;});
 return {root,ledger,runner,adapter,get starts(){return starts;},cleanup:async()=>{const pid=ledger.execution('task1')?.pid;if(pid){try{process.kill(-pid,'SIGKILL');}catch{}}ledger.close();await rm(root,{recursive:true});}};
}

test('successful process is verified, review-ready and releases writer ownership',async()=>{
 const fixture=await context();try{
  const receipt=await fixture.runner.execute('task1',fixture.adapter);
  assert.equal(receipt.state,'review_ready');assert.equal(receipt.outputRefs.length,1);assert.equal(fixture.ledger.leases().length,0);
  assert.equal(fixture.ledger.execution('task1')?.status,'stopped');
  assert.equal((await fixture.runner.execute('task1',fixture.adapter)).attemptId,receipt.attemptId);assert.equal(fixture.starts,1);
 }finally{await fixture.cleanup();}
});
test('known nonzero exit fails with recorded stop evidence and releases ownership',async()=>{
 const fixture=await context('failure');try{
  const receipt=await fixture.runner.execute('task1',fixture.adapter);assert.equal(receipt.state,'failed');
  assert.equal(fixture.ledger.execution('task1')?.exitCode,3);assert.equal(fixture.ledger.leases().length,0);
 }finally{await fixture.cleanup();}
});
test('structured native failure is durable and queryable without persisting raw output or replay',async()=>{
 const fixture=await context('failure');try{
  const stdout=JSON.stringify({error:'protected_region_changed: private-title: 7 pixels'})+'\n';
  const stderr='private-path-and-credential\n';
  await writeFile(join(fixture.root,'worker.mjs'),`process.stdout.write(${JSON.stringify(stdout)});process.stderr.write(${JSON.stringify(stderr)});process.exitCode=3;`);
  const receipt=await fixture.runner.execute('task1',fixture.adapter);
  const error=receipt.error as any;
  assert.equal(error.code,'native_execution_failed');assert.equal(error.diagnostics.domainCode,'protected_region_changed');
  assert.equal(error.diagnostics.stdout.bytes,Buffer.byteLength(stdout));assert.equal(error.diagnostics.stdout.sha256,hash(stdout));
  assert.equal(error.diagnostics.stderr.bytes,Buffer.byteLength(stderr));assert.equal(error.diagnostics.stderr.sha256,hash(stderr));
  const reopened=new TaskLedger(join(fixture.root,'tasks.sqlite'));
  try{assert.deepEqual(reopened.status('task1').error,error);}finally{reopened.close();}
  assert.deepEqual((await fixture.runner.reconcile('task1',fixture.adapter)).error,error);assert.equal(fixture.starts,1);
  const events=JSON.stringify(fixture.ledger.events('task1'));
  assert.ok(!events.includes('private-title'));assert.ok(!events.includes('private-path-and-credential'));
 }finally{await fixture.cleanup();}
});
test('excessive or unrecognized child text is hashed and cannot become a domain error',async()=>{
 for(const stdout of ['x'.repeat(70000),JSON.stringify({error:'unknown_secret_material: private-token'})]){
  const fixture=await context('failure');try{
   await writeFile(join(fixture.root,'worker.mjs'),`process.stdout.write(${JSON.stringify(stdout)});process.exitCode=3;`);
   const receipt=await fixture.runner.execute('task1',fixture.adapter);const diagnostics=(receipt.error as any).diagnostics;
   assert.equal(receipt.state,'failed');assert.equal(diagnostics.domainCode,null);
   assert.equal(diagnostics.stdout.bytes,Buffer.byteLength(stdout));assert.equal(diagnostics.stdout.sha256,hash(stdout));
   assert.equal(diagnostics.stdout.truncated,Buffer.byteLength(stdout)>16384);
   assert.equal(fixture.ledger.leases().length,0);
  }finally{await fixture.cleanup();}
 }
});
test('inherited output pipes cannot hang worker close or fake group stop',async()=>{
 const fixture=await context('failure');try{
  await writeFile(join(fixture.root,'worker.mjs'),`import{spawn}from'node:child_process';spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:['ignore','inherit','inherit']}).unref();process.exitCode=3;`);
  const start=Date.now(),receipt=await fixture.runner.execute('task1',fixture.adapter);
  assert.ok(Date.now()-start<5000);assert.equal(receipt.state,'reconciling');
  assert.equal(fixture.ledger.execution('task1')?.groupStopped,false);assert.equal(fixture.ledger.leases().length,1);
  assert.equal(fixture.ledger.execution('task1')?.diagnostics?.stdout.complete,false);
 }finally{await fixture.cleanup();}
});
test('live cancel intent becomes cancelled only after process close and group stop',async()=>{
 const fixture=await context('wait');try{
  const executing=fixture.runner.execute('task1',fixture.adapter);
  for(let count=0;!fixture.ledger.execution('task1')?.pid && count<100;count++) await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(fixture.ledger.execution('task1')?.pid);fixture.ledger.cancel('task1');
  assert.equal(fixture.ledger.status('task1').state,'cancel_requested');assert.equal(fixture.ledger.leases().length,1);
  const receipt=await executing;assert.equal(receipt.state,'cancelled');assert.equal(fixture.ledger.leases().length,0);
 }finally{await fixture.cleanup();}
});
test('no authorization prevents claim and child launch',async()=>{
 const fixture=await context();try{
  const denied=new LocalRunner(fixture.ledger,async()=>{throw new Error('authorization_required');});
  await assert.rejects(denied.execute('task1',fixture.adapter),/authorization_required/);
  assert.equal(fixture.ledger.status('task1').state,'ready');assert.equal(fixture.ledger.execution('task1'),null);assert.equal(fixture.ledger.leases().length,0);
 }finally{await fixture.cleanup();}
});

test('incorrect artifact digest fails technical delivery and never publishes output references',async()=>{
 const fixture=await context();try{
  const verify=fixture.adapter.verify;
  const broken={...fixture.adapter,verify:async()=>{const result=await verify();result.outputs[0].sha256='0'.repeat(64);return result;}};
  const receipt=await fixture.runner.execute('task1',broken);
  assert.equal(receipt.state,'failed');assert.equal(receipt.outputRefs.length,0);assert.equal(fixture.ledger.leases().length,0);
  assert.equal((receipt.error as {code:string}).code,'artifact_invalid');
 }finally{await fixture.cleanup();}
});
test('review-ready task can be cancelled without reviving a stopped writer',async()=>{
 const fixture=await context();try{
  await fixture.runner.execute('task1',fixture.adapter);
  assert.equal(fixture.ledger.cancel('task1').state,'cancelled');assert.equal(fixture.ledger.leases().length,0);
 }finally{await fixture.cleanup();}
});
test('two execute calls cannot create two native attempts',async()=>{
 const fixture=await context();try{
  await Promise.all([fixture.runner.execute('task1',fixture.adapter),fixture.runner.execute('task1',fixture.adapter)]);
  assert.equal(fixture.ledger.events('task1').filter(x=>x.toState==='running' && !('execution' in (x.detail as object))).length,1);
  assert.equal(fixture.ledger.status('task1').state,'review_ready');
 }finally{await fixture.cleanup();}
});

test('unconfirmed process group stop cannot settle or release the native project',async()=>{
 const fixture=await context();try{
  const task=fixture.ledger.claim('task1',null,{minorUnits:0,externalCalls:0});
  const token=fixture.ledger.prepareExecution('task1',task.epoch,hash('command'));
  fixture.ledger.attachExecution('task1',task.epoch,token,12345);
  fixture.ledger.recordExit('task1',task.epoch,token,{exitCode:0,signal:null,groupStopped:false});
  assert.throws(()=>fixture.ledger.settleStopped('task1',task.epoch,token,'failed','native_execution_failed'),/execution_stop_unverified/);
  assert.equal(fixture.ledger.leases().length,1);
 }finally{await fixture.cleanup();}
});

/** 启动器与原生运行时拥有不同身份；两者均须由可信适配器锁定。 */
async function wrappedContext() {
 const fixture=await context();
 const request=fixture.ledger.request('task1');
 const nativeExecutable='/usr/bin/true';
 const nativeHash=hash(await readFile(nativeExecutable));
 const script=join(fixture.root,'worker.mjs');
 const binding={runtimeExecutable:nativeExecutable,sha256:hash(await readFile(process.execPath)),files:[{path:script,sha256:hash(await readFile(script))}]};
 fixture.ledger.register('test',fixture.root,{...request,taskId:'wrapped',idempotencyKey:'wrapped-key',runtimeIdentity:{...request.runtimeIdentity,sha256:nativeHash}});
 fixture.ledger.ready('wrapped');
 const verify=fixture.adapter.verify;
 const adapter={prepare:async()=>({...await fixture.adapter.prepare(),launcherIdentity:binding}),verify:async()=>{const result=await verify();result.outputs[0].producerTaskId='wrapped';return result;}};
 return {fixture,binding,adapter};
}
test('verified launcher can supervise a separately bound native runtime',async()=>{
 const {fixture,adapter}=await wrappedContext();try{
  assert.equal((await fixture.runner.execute('wrapped',adapter)).state,'review_ready');
 }finally{await fixture.cleanup();}
});
test('changed skill script cannot start a wrapped native attempt',async()=>{
 const {fixture,adapter,binding}=await wrappedContext();try{
  await writeFile(binding.files[0].path,'process.exit(0)');
  await assert.rejects(fixture.runner.execute('wrapped',adapter),/launcher_file_identity_mismatch/);
  assert.equal(fixture.ledger.execution('wrapped'),null);assert.equal(fixture.ledger.leases().length,0);
 }finally{await fixture.cleanup();}
});
test('incorrect launcher or native digest is rejected before any claim',async()=>{
 const {fixture,adapter,binding}=await wrappedContext();try{
  binding.sha256='0'.repeat(64);
  await assert.rejects(fixture.runner.execute('wrapped',adapter),/launcher_identity_mismatch/);
  binding.sha256=hash(await readFile(process.execPath));binding.runtimeExecutable=process.execPath;
  await assert.rejects(fixture.runner.execute('wrapped',adapter),/runtime_identity_mismatch/);
  assert.equal(fixture.ledger.execution('wrapped'),null);
 }finally{await fixture.cleanup();}
});

test('missing or excessive trusted cost stops before spawn and leaves no output or lease',async()=>{
 const fixture=await context();try{
  for(const usage of [undefined,{minorUnits:1,externalCalls:0}]){
   const adapter={...fixture.adapter,prepare:async()=>({...await fixture.adapter.prepare(),budgetUsage:usage})};
   await assert.rejects(fixture.runner.execute('task1',adapter),/budget_usage_invalid|budget_exceeded/);
   assert.equal(fixture.ledger.execution('task1'),null);assert.equal(fixture.ledger.leases().length,0);
   await assert.rejects(readFile(join(fixture.root,'output.bin')),/ENOENT/);
  }
 }finally{await fixture.cleanup();}
});

async function crashedParent(fixture:Awaited<ReturnType<typeof context>>,wait=false){
 const script=join(fixture.root,'parent.mjs');
 await writeFile(join(fixture.root,'worker.mjs'),wait ? `import{appendFileSync}from'node:fs';appendFileSync(process.argv[2]+'.starts','x');setInterval(()=>{},1000);` : `import{appendFileSync,writeFileSync}from'node:fs';appendFileSync(process.argv[2]+'.starts','x');setTimeout(()=>writeFileSync(process.argv[2],'result'),350);`);
 const runnerUrl=new URL('../src/harness/local_runner.ts',import.meta.url).href;
 const ledgerUrl=new URL('../src/harness/task_ledger.ts',import.meta.url).href;
 await writeFile(script,`import{TaskLedger}from${JSON.stringify(ledgerUrl)};import{LocalRunner}from${JSON.stringify(runnerUrl)};const ledger=new TaskLedger(${JSON.stringify(join(fixture.root,'tasks.sqlite'))});await new LocalRunner(ledger,async()=>{}).execute('task1',{prepare:async()=>(${JSON.stringify(await fixture.adapter.prepare())}),verify:async()=>{throw Error('parent_should_be_killed')}});`);
 const parent=spawn(process.execPath,[script],{stdio:'ignore'});
 const closed=new Promise(resolve=>parent.once('close',resolve));
 for(let n=0;!fixture.ledger.execution('task1')?.pid && n<300;n++)await new Promise(r=>setTimeout(r,10));
 assert.ok(fixture.ledger.execution('task1')?.pid);parent.kill('SIGKILL');await closed;
}
async function awaitStopped(fixture:Awaited<ReturnType<typeof context>>){
 for(let n=0;fixture.ledger.execution('task1')?.status!=='stopped' && n<300;n++)await new Promise(r=>setTimeout(r,10));
 assert.equal(fixture.ledger.execution('task1')?.status,'stopped');
}
test('SIGKILL of scheduler preserves worker exit evidence and adopts without native replay',async()=>{
 const fixture=await context();try{
  await crashedParent(fixture);const before=fixture.ledger.status('task1');await awaitStopped(fixture);
  const results=await Promise.all([fixture.runner.reconcile('task1',fixture.adapter),fixture.runner.reconcile('task1',fixture.adapter)]);
  assert.ok(results.every(r=>r.state==='review_ready'));assert.equal(results[0].attemptId,before.attemptId);
  assert.equal(await readFile(join(fixture.root,'output.bin.starts'),'utf8'),'x');assert.equal(fixture.ledger.leases().length,0);
  assert.equal(fixture.ledger.events('task1').filter(e=>e.toState==='review_ready').length,1);
 }finally{await fixture.cleanup();}
});
test('orphan worker observes ledger cancellation after scheduler SIGKILL',async()=>{
 const fixture=await context();try{
  await crashedParent(fixture,true);fixture.ledger.cancel('task1');await awaitStopped(fixture);
  assert.equal((await fixture.runner.reconcile('task1',fixture.adapter)).state,'cancelled');
  assert.equal(fixture.ledger.leases().length,0);
 }finally{await fixture.cleanup();}
});
test('recovery rejects changed command and authorization while preserving the original lease',async()=>{
 const fixture=await context();try{
  await crashedParent(fixture);await awaitStopped(fixture);
  await assert.rejects(new LocalRunner(fixture.ledger,async()=>{throw Error('authorization_required')}).reconcile('task1',fixture.adapter),/authorization_required/);
  const changed={...fixture.adapter,prepare:async()=>({...await fixture.adapter.prepare(),args:['--version']})};
  await assert.rejects(fixture.runner.reconcile('task1',changed),/recovery_command_identity_mismatch/);
  assert.equal(fixture.ledger.leases().length,1);assert.equal(await readFile(join(fixture.root,'output.bin.starts'),'utf8'),'x');
 }finally{await fixture.cleanup();}
});
test('interrupted verifying state resumes the same stopped attempt',async()=>{
 const fixture=await context();try{
  await crashedParent(fixture);await awaitStopped(fixture);
  const status=fixture.ledger.status('task1'),execution=fixture.ledger.execution('task1')!;
  await assert.rejects(fixture.ledger.reviewReady('task1',status.epoch,execution.token,fixture.root,[],[]),/artifact_missing/);
  assert.equal(fixture.ledger.status('task1').state,'verifying');
  assert.equal((await fixture.runner.reconcile('task1',fixture.adapter)).state,'review_ready');
  assert.equal(await readFile(join(fixture.root,'output.bin.starts'),'utf8'),'x');
 }finally{await fixture.cleanup();}
});
test('prepared execution without trustworthy stop evidence never replays or releases ownership',async()=>{
 const fixture=await context();try{
  const task=fixture.ledger.claim('task1',null,{minorUnits:0,externalCalls:0});fixture.ledger.prepareExecution('task1',task.epoch,hash('unknown'));
  assert.equal((await fixture.runner.reconcile('task1',fixture.adapter)).state,'running');
  assert.equal(fixture.ledger.leases().length,1);assert.equal(fixture.ledger.execution('task1')?.status,'prepared');
 }finally{await fixture.cleanup();}
});
test('corrupt recovered output cannot publish artifact references',async()=>{
 const fixture=await context();try{
  await crashedParent(fixture);await awaitStopped(fixture);
  const verify=fixture.adapter.verify;
  const adapter={...fixture.adapter,verify:async()=>{const result=await verify();result.outputs[0].sha256=hash('original expected');return result;}};
  const result=await fixture.runner.reconcile('task1',adapter);assert.equal(result.state,'failed');assert.deepEqual(result.outputRefs,[]);
  assert.equal(await readFile(join(fixture.root,'output.bin.starts'),'utf8'),'x');
 }finally{await fixture.cleanup();}
});
test('worker SIGKILL leaves outcome unknown and cannot authorize native replay',async()=>{
 const fixture=await context('wait');try{
  const executing=fixture.runner.execute('task1',fixture.adapter);
  for(let n=0;!fixture.ledger.execution('task1')?.pid && n<300;n++)await new Promise(resolve=>setTimeout(resolve,10));
  const nativePid=fixture.ledger.execution('task1')?.pid;assert.ok(nativePid);
  const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const exec=promisify(execFile);
  const workerPid=Number((await exec('/bin/ps',['-o','ppid=','-p',String(nativePid)])).stdout.trim());
  assert.ok((await exec('/bin/ps',['-o','command=','-p',String(workerPid)])).stdout.includes('/execution_worker.ts'));
  process.kill(workerPid,'SIGKILL');const result=await executing;
  assert.equal(result.state,'reconciling');assert.equal(fixture.ledger.leases().length,1);
  assert.equal((await fixture.runner.reconcile('task1',fixture.adapter)).attemptId,result.attemptId);
  assert.equal(fixture.ledger.execution('task1')?.status,'running');assert.equal(fixture.ledger.execution('task1')?.groupStopped,false);
 }finally{await fixture.cleanup();}
});
