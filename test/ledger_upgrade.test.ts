/** 旧版账本排空、原schema快照及不兼容回退的真实SQLite测试。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { planHash } from '../src/protocol/contracts.ts';

const digest='a'.repeat(64);
function legacy(){
 const root=mkdtempSync(join(tmpdir(),'craft-ledger-upgrade-')),path=join(root,'tasks.sqlite');
 const ledger=new TaskLedger(path),payload={schemaVersion:'upgrade-fixture/v1'};
 ledger.register('owner','project',{protocolVersion:'craft-task/v1',taskId:'original',idempotencyKey:'original',planHash:planHash(payload),inputRefs:[],expectedRevision:null,runtimeIdentity:{pluginId:'fixture',pluginVersion:'1',cliVersion:'1',sha256:digest,mode:'headless',capabilitySnapshotSha256:digest},authorizationRef:'scope',budget:{currency:'USD',maxMinorUnits:0,maxExternalCalls:0,maxRevisions:0},deadline:'2030-01-01T00:00:00Z',payload});ledger.close();
 const db=new DatabaseSync(path);db.exec("DROP TABLE task_budget_links;DROP TABLE workflow_budget_links;DROP TABLE budget_reservations;DROP TABLE budget_accounts;PRAGMA user_version=1;");
 const state=()=>JSON.stringify({version:db.prepare('PRAGMA user_version').get(),schema:db.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY type,name").all(),tasks:db.prepare('SELECT * FROM tasks').all(),leases:db.prepare('SELECT * FROM leases').all(),executions:db.prepare('SELECT * FROM executions').all()});
 return {root,path,db,state,cleanup(){db.close();rmSync(root,{recursive:true});}};
}
for(const state of ['planned','ready','running','reconciling','cancel_requested','verifying','unknown-future'])test(`legacy ${state} task cannot be migrated or reset`,()=>{
 const f=legacy();try{
  f.db.prepare('UPDATE tasks SET state=?').run(state);const before=f.state();
  assert.throws(()=>new TaskLedger(f.path),/runtime_upgrade_busy/);
  assert.equal(f.state(),before);assert.equal(readdirSync(f.root).filter(name=>name.includes('schema-v1')).length,0);
 }finally{f.cleanup();}
});
for(const fault of ['lease','prepared','unconfirmed-stop'])test(`legacy ${fault} cannot be lost during schema upgrade`,()=>{
 const f=legacy();try{
  f.db.exec("UPDATE tasks SET state='failed'");
  if(fault==='lease')f.db.exec("INSERT INTO leases VALUES('project','original',1)");
  else f.db.prepare('INSERT INTO executions(task_id,attempt_id,epoch,token,command_hash,status,group_stopped) VALUES(?,?,?,?,?,?,?)').run('original','attempt',1,'token',digest,fault==='prepared'?'prepared':'stopped',0);
  const before=f.state();assert.throws(()=>new TaskLedger(f.path),/runtime_upgrade_busy/);assert.equal(f.state(),before);
 }finally{f.cleanup();}
});
test('drained legacy migration preserves a usable old-schema snapshot and never snapshots current schema twice',()=>{
 const f=legacy();try{
  f.db.exec("UPDATE tasks SET state='cancelled'");const before=f.state();
  const upgraded=new TaskLedger(f.path);
  try{
   const receipt=(upgraded as any).upgradeSnapshot;assert.ok(receipt,'migration must expose the retained snapshot identity');
   assert.equal(receipt.schemaVersion,1);assert.equal(statSync(receipt.path).mode&0o777,0o600);assert.equal(createHash('sha256').update(readFileSync(receipt.path)).digest('hex'),receipt.sha256);
   const old=new DatabaseSync(receipt.path,{readOnly:true});
   try{
    assert.equal(old.prepare('PRAGMA user_version').get()!.user_version,1);
    assert.equal(old.prepare('SELECT state FROM tasks').get()!.state,'cancelled');
    assert.equal(old.prepare("SELECT name FROM sqlite_master WHERE name='budget_accounts'").get(),undefined);
    assert.equal(JSON.stringify({version:old.prepare('PRAGMA user_version').get(),schema:old.prepare("SELECT type,name,sql FROM sqlite_master ORDER BY type,name").all(),tasks:old.prepare('SELECT * FROM tasks').all(),leases:old.prepare('SELECT * FROM leases').all(),executions:old.prepare('SELECT * FROM executions').all()}),before);
   }finally{old.close();}
   assert.equal(f.db.prepare('PRAGMA user_version').get()!.user_version,2);
   assert.equal(upgraded.status('original').state,'cancelled');
   const reopened=new TaskLedger(f.path);try{assert.equal((reopened as any).upgradeSnapshot,undefined);}finally{reopened.close();}
   assert.equal(readdirSync(f.root).filter(name=>name.includes('schema-v1')).length,1);
  }finally{upgraded.close();}
 }finally{f.cleanup();}
});
test('higher state schema rejects downgrade without changing source or touching prior snapshots',()=>{
 const f=legacy();try{
  f.db.exec('PRAGMA user_version=3');const marker=join(f.root,'prior-schema-v1.sqlite');writeFileSync(marker,'keep');const before=f.state();
  assert.throws(()=>new TaskLedger(f.path),/ledger_schema_incompatible/);assert.equal(f.state(),before);assert.equal(readFileSync(marker,'utf8'),'keep');
 }finally{f.cleanup();}
});

test('snapshot write failure rolls back migration and preserves the original ledger',context=>{
 const f=legacy();try{
  f.db.exec("UPDATE tasks SET state='cancelled'");const before=f.state(),prepare=DatabaseSync.prototype.prepare;
  // 明确注入快照写失败，不能依赖测试账号是否可绕过目录权限。
  context.mock.method(DatabaseSync.prototype,'prepare',function(this:DatabaseSync,sql:string){
   if(sql==='VACUUM INTO ?')return {run(){throw new Error('controlled snapshot disk failure');}} as any;
   return prepare.call(this,sql);
  });
  assert.throws(()=>new TaskLedger(f.path),/ledger_upgrade_snapshot_failed/);assert.equal(f.state(),before);
  assert.equal(readdirSync(f.root).filter(name=>name.includes('schema-v1')).length,0);
 }finally{f.cleanup();}
});

test('active legacy status stays readable without migration or invented free historical budgets',()=>{
 const f=legacy();try{
  const before=f.state(),reader=new TaskLedger(f.path,{legacyReadOnly:true});
  try{
   assert.equal(reader.legacySchemaReadOnly,true);assert.equal(reader.status('original').state,'planned');
   assert.deepEqual(reader.budgetAccounts(),[]);assert.equal(reader.upgradeSnapshot,undefined);
   assert.throws(()=>reader.ready('original'),/runtime_upgrade_busy/);assert.equal(f.state(),before);
  }finally{reader.close();}
 }finally{f.cleanup();}
});

test('public status lists active old tasks and explicitly reports untracked legacy budgets',async()=>{
 const {execFileSync}=await import('node:child_process');
 const f=legacy();try{
  const before=f.state(),entry=new URL('../src/cli.ts',import.meta.url);
  const {fileURLToPath}=await import('node:url');
  const result=JSON.parse(execFileSync(process.execPath,[fileURLToPath(entry),'status','--database',f.path],{encoding:'utf8'}));
  assert.equal(result.tasks[0].taskId,'original');assert.equal(result.tasks[0].state,'planned');
  assert.equal(result.budgetTracking,'untracked-legacy-schema');assert.deepEqual(result.budgets,[]);assert.equal(f.state(),before);
 }finally{f.cleanup();}
});

test('a snapshot call returning without a valid old-schema database cannot authorize migration',context=>{
 const f=legacy();try{
  f.db.exec("UPDATE tasks SET state='cancelled'");const before=f.state(),prepare=DatabaseSync.prototype.prepare;
  context.mock.method(DatabaseSync.prototype,'prepare',function(this:DatabaseSync,sql:string){
   if(sql==='VACUUM INTO ?')return {run(){return {changes:0};}} as any;
   return prepare.call(this,sql);
  });
  assert.throws(()=>new TaskLedger(f.path),/ledger_upgrade_snapshot_failed/);assert.equal(f.state(),before);
  assert.equal(readdirSync(f.root).filter(name=>name.includes('schema-v1')).length,0);
 }finally{f.cleanup();}
});

test('public upgrade returns a verified snapshot once and preserves old runtime rollback inputs',async()=>{
 const {main}=await import('../src/cli.ts');const f=legacy();
 try{
  const before=f.state();await assert.rejects(main(['upgrade','--database',f.path]),/runtime_upgrade_busy/);assert.equal(f.state(),before);
  f.db.exec("UPDATE tasks SET state='cancelled'");
  const result:any=await main(['upgrade','--database',f.path]);
  assert.equal(result.state,'completed');assert.equal(result.schemaVersion,2);assert.equal(result.migrated,true);
  assert.equal(result.snapshot.schemaVersion,1);assert.equal(createHash('sha256').update(readFileSync(result.snapshot.path)).digest('hex'),result.snapshot.sha256);
  assert.equal(result.runtimeVersion,JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version);
  const repeated:any=await main(['upgrade','--database',f.path]);assert.equal(repeated.migrated,false);assert.equal(repeated.snapshot,null);
  assert.equal(readdirSync(f.root).filter(name=>name.includes('schema-v1')).length,1);
 }finally{f.cleanup();}
});

test('public upgrade refuses missing and future databases without changing user files',async()=>{
 const {main}=await import('../src/cli.ts');const f=legacy();
 try{
  const missing=join(f.root,'missing.sqlite');await assert.rejects(main(['upgrade','--database',missing]),/ENOENT/);assert.equal(readdirSync(f.root).includes('missing.sqlite'),false);
  f.db.exec('PRAGMA user_version=3');const before=f.state();await assert.rejects(main(['upgrade','--database',f.path]),/ledger_schema_incompatible/);assert.equal(f.state(),before);
 }finally{f.cleanup();}
});
