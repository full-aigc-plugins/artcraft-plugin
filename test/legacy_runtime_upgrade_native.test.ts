/** 保留的真实schema1运行时与当前公开升级入口的原生验收；显式环境启用。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, copyFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { planHash } from '../src/protocol/contracts.ts';
const exec=promisify(execFile),sha=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
const enabled=process.env.CRAFT_LEGACY_NATIVE_UPGRADE==='1';

test('retained schema1 runtime drains a real native task before explicit migration and compatible rollback', {skip:!enabled},async()=>{
 const oldRoot=process.env.CRAFT_LEGACY_RUNTIME_ROOT!,native=process.env.CRAFT_LEGACY_NATIVE_EXECUTABLE!,root=process.env.CRAFT_LEGACY_NATIVE_OUTPUT!;
 assert.ok(oldRoot && native && root);await assert.rejects(access(root),/ENOENT/);await mkdir(root,{recursive:true});
 const oldModule=await import(pathToFileURL(join(oldRoot,'src/harness/task_ledger.ts')).href);
 const runnerModule=await import(pathToFileURL(join(oldRoot,'src/harness/local_runner.ts')).href);
 const oldCli=join(oldRoot,'src/cli.ts'),currentCli=new URL('../src/cli.ts',import.meta.url).pathname;
 const database=join(root,'tasks.sqlite'),project=join(root,'original.ecproj');
 const oldFiles=[oldCli,join(oldRoot,'package.json'),join(oldRoot,'src/harness/task_ledger.ts'),join(oldRoot,'src/harness/local_runner.ts')];
 const oldHashes=await Promise.all(oldFiles.map(async path=>sha(await readFile(path))));
 const nativeVersion=(await exec(native,['--version'],{timeout:30000})).stdout.trim();assert.match(nativeVersion,/0\.2\.0/);
 const nativeHash=sha(await readFile(native));const ledger=new oldModule.TaskLedger(database);
 const payload={schemaVersion:'native-upgrade-test/v1'};
 ledger.register('owner','project',{protocolVersion:'craft-task/v1',taskId:'native-original',idempotencyKey:'native-original',planHash:planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:{pluginId:'effectcraft',pluginVersion:'legacy-qa',cliVersion:'0.2.0',sha256:nativeHash,mode:'headless',capabilitySnapshotSha256:'a'.repeat(64)},authorizationRef:'scope',budget:{currency:'USD',maxMinorUnits:0,maxExternalCalls:0,maxRevisions:0},deadline:new Date(Date.now()+120000).toISOString(),payload});
 ledger.ready('native-original');
 const dump=(path:string)=>{const db=new DatabaseSync(path,{readOnly:true});try{return JSON.stringify({version:db.prepare('PRAGMA user_version').get(),schema:db.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY type,name").all(),tables:db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row=>[row.name,db.prepare('SELECT * FROM "'+String(row.name).replaceAll('"','""')+'"').all()])});}finally{db.close();}};
 const installedSkill=process.env.CRAFT_INSTALLED_UPGRADE_SKILL,installedHome=process.env.CRAFT_INSTALLED_UPGRADE_HOME;
 if(installedSkill)assert.ok(installedHome && process.env.CRAFT_INSTALLED_UPGRADE_PYTHON,'installed upgrade requires explicit runtime home and Python');
 const calls:unknown[]=[];
 const call=async(entry:string,args:string[],failure?:string)=>{
  try{const installed=Boolean(installedSkill && entry===currentCli);const executable=installed?process.env.CRAFT_INSTALLED_UPGRADE_PYTHON!:process.execPath;const argv=installed?['-I','-B',join(installedSkill!,'scripts/cli.py'),'--runtime-home',installedHome!,'--',...args]:[entry,...args];const r=await exec(executable,argv,{timeout:300000,maxBuffer:8*1024*1024});calls.push({entry:entry===oldCli?'retained-schema1':'candidate',args,exitCode:0,stdout:r.stdout});assert.equal(failure,undefined);return JSON.parse(r.stdout);}
  catch(error){if(!failure)throw error;const r=error as {stdout:string;code:number};assert.ok(r.stdout.includes(failure),r.stdout);calls.push({entry:entry===oldCli?'retained-schema1':'candidate',args,exitCode:r.code,stdout:r.stdout});return JSON.parse(r.stdout);}
 };
 try{
  const pending=dump(database);await call(currentCli,['upgrade','--database',database],'runtime_upgrade_busy');assert.equal(dump(database),pending);await assert.rejects(access(project),/ENOENT/);
  const runner=new runnerModule.LocalRunner(ledger,async(request:any)=>{assert.equal(request.authorizationRef,'scope');});
  const receipt=await runner.execute('native-original',{
   async prepare(){return {executable:native,args:['--empty','run','comp.new',JSON.stringify({name:'Upgrade QA',width:320,height:180,frameRate:24,duration:1}),'--save-as',project,'--json'],cwd:root,actualRevision:null};},
   async verify(){const bytes=await readFile(project);assert.ok(bytes.length>0);return {root,outputs:[{protocolVersion:'craft-artifact/v1',assetId:'native-original',version:'v1',sha256:sha(bytes),bytes:bytes.length,mediaType:'application/octet-stream',producerTaskId:'native-original',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'original.ecproj'}],evidenceRefs:[]};}
  });
  assert.equal(receipt.state,'review_ready');assert.equal(ledger.execution('native-original').groupStopped,true);
 }finally{ledger.close();}
 const nativeBytes=await readFile(project),nativeSha256=sha(nativeBytes);
 const reopened=await exec(native,['--project',project,'info','--json'],{timeout:30000});await writeFile(join(root,'native-reopen.json'),reopened.stdout);
 const oldState=dump(database),upgrade=await call(currentCli,['upgrade','--database',database]);assert.equal(upgrade.migrated,true);assert.equal(upgrade.schemaVersion,2);
 assert.equal(sha(await readFile(upgrade.snapshot.path)),upgrade.snapshot.sha256);assert.equal(dump(upgrade.snapshot.path),oldState);
 const rollback=join(root,'explicit-rollback.sqlite');await copyFile(upgrade.snapshot.path,rollback);
 const oldStatus=await call(oldCli,['status','--database',rollback,'--task','native-original']);assert.equal(oldStatus.state,'review_ready');
 const upgradedState=dump(database);await call(oldCli,['status','--database',database,'--task','native-original'],'ledger_schema_incompatible');assert.equal(dump(database),upgradedState);
 const repeated=await call(currentCli,['upgrade','--database',database]);assert.equal(repeated.migrated,false);assert.equal(repeated.snapshot,null);assert.equal(dump(database),upgradedState);
 assert.equal((await readdir(root)).filter(name=>name.includes('.schema-v1-')).length,1);assert.equal(sha(await readFile(project)),nativeSha256);assert.equal(sha(await readFile(upgrade.snapshot.path)),upgrade.snapshot.sha256);
 assert.deepEqual(await Promise.all(oldFiles.map(async path=>sha(await readFile(path)))),oldHashes);
 const proof={schema:'artcraft-legacy-native-upgrade/v1',result:'PASS',oldRuntimeVersion:JSON.parse(await readFile(join(oldRoot,'package.json'),'utf8')).version,currentRuntimeVersion:upgrade.runtimeVersion,nativeVersion,installedEntrypoint:Boolean(installedSkill),nativeSha256:nativeHash,projectSha256:nativeSha256,oldRuntimeFiles:oldHashes,upgrade,oldSchemaDataPreserved:true,oldRuntimePreserved:true,nativeReopened:true,snapshotPreserved:true,noReplay:true,calls,scope:installedSkill?'Retained immutable schema1 source runtime, real headless Effect create/save/reopen, installed fixed skill public CLI migration and explicit copied-snapshot compatibility; no desktop GUI or full RT-002 matrix':'Retained immutable schema1 source runtime, real headless Effect native create/save/reopen, candidate CLI migration and explicit copied-snapshot compatibility; no desktop GUI, fixed candidate release or full RT-002 matrix'};
 await writeFile(join(root,'proof.json'),JSON.stringify(proof,null,2)+'\n');
});
