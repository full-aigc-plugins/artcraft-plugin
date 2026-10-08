/** 真实固定运行时的旧账本只读会话拒写验收；只在明确环境下运行。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec=promisify(execFile),sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
test('installed schema1 readonly session rejects every mutation family and public cancel preserves legacy state',{skip:process.env.CRAFT_INSTALLED_READONLY!=='1'},async()=>{
 const root=process.env.CRAFT_READONLY_OUTPUT!,legacy=process.env.CRAFT_LEGACY_RUNTIME_ROOT!,skill=process.env.CRAFT_INSTALLED_UPGRADE_SKILL!,home=process.env.CRAFT_INSTALLED_UPGRADE_HOME!,python=process.env.CRAFT_INSTALLED_UPGRADE_PYTHON!;
 assert.ok(root && legacy && skill && home && python);await assert.rejects(access(root),/ENOENT/);await mkdir(root,{recursive:true});
 const distribution=JSON.parse(await readFile(join(skill,'scripts/distribution.lock.json'),'utf8')),entry=distribution.bundles['artcraft-runtime'];
 const runtime=join(home,'artcraft/bundles/artcraft-runtime',entry.version,entry.sha256);
 for(const [name,digest] of Object.entries(entry.files))assert.equal(sha(await readFile(join(runtime,name))),digest);
 const current=await import(pathToFileURL(join(runtime,'src/harness/task_ledger.ts')).href),old=await import(pathToFileURL(join(legacy,'src/harness/task_ledger.ts')).href);
 const contracts=await import(pathToFileURL(join(runtime,'src/protocol/contracts.ts')).href);
 const payload={schemaVersion:'readonly-acceptance/v1'},request={protocolVersion:'craft-task/v1',taskId:'original',idempotencyKey:'original',planHash:contracts.planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:{pluginId:'qa',pluginVersion:'1',cliVersion:'1',sha256:'a'.repeat(64),mode:'headless',capabilitySnapshotSha256:'a'.repeat(64)},authorizationRef:'scope',budget:{currency:'USD',maxMinorUnits:0,maxExternalCalls:0,maxRevisions:0},deadline:'2030-01-01T00:00:00Z',payload};
 const plan={ownerId:'owner',workflowId:'workflow',revision:'v1',authorizationRef:'scope',budget:request.budget,deadline:request.deadline,nodes:[]};
 const database=join(root,'tasks.sqlite'),writer=new old.TaskLedger(database);
 writer.register('owner','project',request);const workflowKey=writer.beginWorkflow(plan);writer.close();
 const dump=(path=database)=>{const db=new DatabaseSync(path,{readOnly:true});try{return JSON.stringify({version:db.prepare('PRAGMA user_version').get(),schema:db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY type,name').all(),tables:db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row=>[row.name,db.prepare('SELECT * FROM "'+String(row.name).replaceAll('"','""')+'"').all()])});}finally{db.close();}};
 const before=dump(),reader=new current.TaskLedger(database,{legacyReadOnly:true}),refusals:unknown[]=[];
 try{
  assert.equal(reader.legacySchemaReadOnly,true);assert.equal(reader.status('original').state,'planned');assert.deepEqual(reader.budgetAccounts(),[]);
  const actions:[string,()=>unknown][]=[
   ['register',()=>reader.register('owner','project',request)],['ready',()=>reader.ready('original')],['claim-budget',()=>reader.claim('original',null)],['unknown',()=>reader.unknown('original',0,'qa')],['cancel',()=>reader.cancel('original')],
   ['prepareExecution',()=>reader.prepareExecution('original',0,'a'.repeat(64))],['attachExecution',()=>reader.attachExecution('original',0,'token',123)],['recordExit',()=>reader.recordExit('original',0,'token',{exitCode:0,signal:null,groupStopped:true})],['settleStopped',()=>reader.settleStopped('original',0,'token','cancelled','qa')],['reviewReady',()=>reader.reviewReady('original',0,'token',root,[],[])],
   ['beginWorkflow-budget',()=>reader.beginWorkflow(plan)],['saveWorkflowNode',()=>reader.saveWorkflowNode(workflowKey,'node',{status:'pending'})],['packageSnapshot',()=>reader.packageSnapshot(workflowKey,'owner','scope')],
  ];
  for(const [method,action] of actions){await assert.rejects(async()=>action(),/runtime_upgrade_busy/);assert.equal(dump(),before);refusals.push({method,error:'runtime_upgrade_busy',allSchemaAndDataPreserved:true});}
  // 直接UPDATE方法和SQLite本身仍受query_only保护，不能依赖仅有的transaction包装。
  await assert.rejects(async()=>reader.cancelWorkflow(workflowKey),/readonly|read.only/i);assert.equal(dump(),before);refusals.push({method:'cancelWorkflow',error:'SQLite readonly',allSchemaAndDataPreserved:true});
  await assert.rejects(async()=>(reader as any).database.exec("UPDATE tasks SET state='cancelled'"),/readonly|read.only/i);assert.equal(dump(),before);refusals.push({method:'SQLite query_only defense',error:'SQLite readonly',allSchemaAndDataPreserved:true});
 }finally{reader.close();}
 const calls=[];
 for(const args of [['status','--database',database],['cancel','--database',database,'--task','original']]){
  let stdout='',stderr='',code=0;
  try{const r=await exec(python,['-I','-B',join(skill,'scripts/cli.py'),'--runtime-home',home,'--',...args],{timeout:300000});stdout=r.stdout;stderr=r.stderr;}
  catch(error){const r=error as {stdout:string;stderr:string;code:number};stdout=r.stdout;stderr=r.stderr;code=r.code;}
  const value=JSON.parse(stdout);
  if(args[0]==='status'){assert.equal(code,0);assert.equal(value.budgetTracking,'untracked-legacy-schema');assert.deepEqual(value.budgets,[]);}
  else{assert.equal(code,1);assert.match(value.error,/runtime_upgrade_busy/);}
  assert.equal(dump(),before);calls.push({command:args[0],args,exitCode:code,stdout,stderr});
 }
 const unknownSchemas=[];
 for(const version of [0,77]){
  const path=join(root,'unknown-'+version+'.sqlite'),db=new DatabaseSync(path);
  db.exec('CREATE TABLE user_data(value TEXT); INSERT INTO user_data VALUES(\'preserve\'); PRAGMA application_id=1129464134; PRAGMA user_version='+version);db.close();
  const state=dump(path),args=['upgrade','--database',path];
  let failed=false;
  try{await exec(python,['-I','-B',join(skill,'scripts/cli.py'),'--runtime-home',home,'--',...args],{timeout:300000});}
  catch(error){const result=error as {code:number;stdout:string;stderr:string};assert.equal(result.code,1);assert.match(JSON.parse(result.stdout).error,/ledger_schema_incompatible/);failed=true;calls.push({command:'upgrade',args,exitCode:result.code,stdout:result.stdout,stderr:result.stderr});}
  assert.equal(failed,true);assert.equal(dump(path),state);unknownSchemas.push({version,allSchemaAndDataPreserved:true,stateSha256:sha(state)});
 }
 await writeFile(join(root,'proof.json'),JSON.stringify({schema:'artcraft-fixed-legacy-readonly/v1',result:'PASS',runtimeVersion:distribution.version,runtimeFilesVerified:Object.keys(entry.files).length,ledgerModuleSha256:sha(await readFile(join(runtime,'src/harness/task_ledger.ts'))),refusals,calls,unknownSchemas,legacyStateSha256:sha(before),scope:'Actual installed immutable runtime module and public Python entry; genuine retained schema1 constructor, controlled valid task/workflow fixtures and SQLite query_only enforcement; unknown schema0/77 public upgrade refusals. No native editing or GUI claimed.'},null,2)+'\n');
});
