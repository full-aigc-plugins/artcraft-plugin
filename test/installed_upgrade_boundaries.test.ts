/** 固定技能公开入口的旧账本边界验收；显式环境启用，保留逐次输出。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { chmod, mkdir, readFile, readdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { planHash } from '../src/protocol/contracts.ts';

const exec=promisify(execFile),enabled=process.env.CRAFT_INSTALLED_UPGRADE_BOUNDARIES==='1';
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');

test('fixed installed public upgrade preserves blocked legacy and future ledgers, including actual snapshot write refusal', {skip:!enabled},async()=>{
 const root=process.env.CRAFT_UPGRADE_BOUNDARIES_OUTPUT!,oldRoot=process.env.CRAFT_LEGACY_RUNTIME_ROOT!;
 const skill=process.env.CRAFT_INSTALLED_UPGRADE_SKILL!,home=process.env.CRAFT_INSTALLED_UPGRADE_HOME!,python=process.env.CRAFT_INSTALLED_UPGRADE_PYTHON!;
 assert.ok(root && oldRoot && skill && home && python);
 await assert.rejects(access(root),/ENOENT/);await mkdir(root,{recursive:true});
 const entry=join(skill,'scripts/cli.py'),entryBefore=sha(await readFile(entry));
 const old=await import(pathToFileURL(join(oldRoot,'src/harness/task_ledger.ts')).href);
 const oldBefore=sha(await readFile(join(oldRoot,'src/harness/task_ledger.ts')));
 const calls:unknown[]=[],cases:unknown[]=[];
 const call=async(args:string[],failure?:string)=>{
  const argv=['-I','-B',entry,'--runtime-home',home,'--',...args];
  let stdout='',stderr='',code=0;
  try{const r=await exec(python,argv,{timeout:300000,maxBuffer:8*1024*1024});stdout=r.stdout;stderr=r.stderr;}
  catch(error){const r=error as {stdout:string;stderr:string;code:number};stdout=r.stdout;stderr=r.stderr;code=r.code;}
  calls.push({args,exitCode:code,stdout,stderr});
  assert.equal(code,failure?1:0,stdout+stderr);const result=JSON.parse(stdout);
  if(failure)assert.ok(result.error.includes(failure),stdout);
  return result;
 };
 const dump=(path:string)=>{
  const db=new DatabaseSync(path,{readOnly:true});
  try{return JSON.stringify({version:db.prepare('PRAGMA user_version').get(),schema:db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY type,name').all(),tables:db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(row=>[row.name,db.prepare('SELECT * FROM "'+String(row.name).replaceAll('"','""')+'"').all()])});}
  finally{db.close();}
 };
 for(const fault of ['planned','ready','running','reconciling','cancel_requested','verifying','unknown-future','lease','prepared','unconfirmed-stop','future-schema','snapshot-write']){
  const dir=join(root,fault);await mkdir(dir);const database=join(dir,'tasks.sqlite');
  const ledger=new old.TaskLedger(database),payload={schemaVersion:'installed-upgrade-boundary/v1'};
  ledger.register('qa','project',{protocolVersion:'craft-task/v1',taskId:'original',idempotencyKey:'original',planHash:planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:{pluginId:'qa',pluginVersion:'1',cliVersion:'1',sha256:'a'.repeat(64),mode:'headless',capabilitySnapshotSha256:'a'.repeat(64)},authorizationRef:'scope',budget:{currency:'USD',maxMinorUnits:0,maxExternalCalls:0,maxRevisions:0},deadline:'2030-01-01T00:00:00Z',payload});ledger.close();
  const db=new DatabaseSync(database);
  try{
   if(['lease','prepared','unconfirmed-stop','future-schema','snapshot-write'].includes(fault))db.exec("UPDATE tasks SET state='cancelled'");
   else db.prepare('UPDATE tasks SET state=?').run(fault);
   if(fault==='lease')db.exec("INSERT INTO leases VALUES('project','original',1)");
   if(fault==='prepared' || fault==='unconfirmed-stop')db.prepare('INSERT INTO executions(task_id,attempt_id,epoch,token,command_hash,status,group_stopped) VALUES(?,?,?,?,?,?,?)').run('original','attempt',1,'token','a'.repeat(64),fault==='prepared'?'prepared':'stopped',0);
   if(fault==='future-schema')db.exec('PRAGMA user_version=3');
   db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }finally{db.close();}
  const marker=join(dir,'prior-schema-v1.sqlite');await writeFile(marker,'retained prior snapshot');
  const before=dump(database),markerBefore=sha(await readFile(marker));
  if(fault!=='future-schema'){
   const status=await call(['status','--database',database]);
   assert.equal(status.budgetTracking,'untracked-legacy-schema');assert.deepEqual(status.budgets,[]);
   assert.equal(dump(database),before);
  }
  if(fault==='snapshot-write')await chmod(dir,0o500);
  const expected=fault==='future-schema'?'ledger_schema_incompatible':fault==='snapshot-write'?'ledger_upgrade_snapshot_failed':'runtime_upgrade_busy';
  try{await call(['upgrade','--database',database],expected);}
  finally{if(fault==='snapshot-write')await chmod(dir,0o700);}
  assert.equal(dump(database),before);assert.equal(sha(await readFile(marker)),markerBefore);
  assert.equal((await readdir(dir)).filter(name=>name.includes('.schema-v1-')).length,0);
  cases.push({fault,expected,statePreserved:true,priorSnapshotPreserved:true,partialSnapshotAbsent:true,ledgerStateSha256:sha(before)});
 }
 const missing=join(root,'missing.sqlite');await call(['upgrade','--database',missing],'ENOENT');await assert.rejects(access(missing),/ENOENT/);
 assert.equal(sha(await readFile(entry)),entryBefore);assert.equal(sha(await readFile(join(oldRoot,'src/harness/task_ledger.ts'))),oldBefore);
 await writeFile(join(root,'proof.json'),JSON.stringify({schema:'artcraft-installed-upgrade-boundaries/v1',result:'PASS',entrySha256:entryBefore,retainedLegacyModuleSha256:oldBefore,cases,missingLedgerAbsent:true,calls,scope:'Actual fixed public Python entry and genuine retained-schema1 database constructor; controlled SQLite state/lease/stop fixtures and real directory permission denial. No native editing or GUI asserted; complements separate actual native drain proof.'},null,2)+'\n');
});
