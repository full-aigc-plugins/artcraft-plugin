/** 状态schema迁移前的排空检查与独立旧版快照；调用者必须持有源账本写事务。 */
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

/** 保留的旧schema快照身份；不能据此自动回退或重放历史任务。 */
export interface LedgerUpgradeSnapshot {
 path:string;
 sha256:string;
 schemaVersion:1;
}

/** 参数为写锁中的旧账本及其绝对路径；排空成功返回独立旧版快照，失败不写源账本。 */
export function snapshotLegacyLedger(database:DatabaseSync,path:string):LedgerUpgradeSnapshot {
 const tables=new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
 if(!['tasks','leases','executions'].every(name=>tables.has(name)))throw new Error('ledger_schema_incompatible');
 const pending=database.prepare("SELECT task_id FROM tasks WHERE state NOT IN ('review_ready','completed','failed','cancelled') LIMIT 1").get();
 const lease=database.prepare('SELECT task_id FROM leases LIMIT 1').get();
 const execution=database.prepare("SELECT task_id FROM executions WHERE status!='stopped' OR group_stopped!=1 LIMIT 1").get();
 if(pending || lease || execution)throw new Error('runtime_upgrade_busy');
 const destination=path+'.schema-v1-'+randomUUID()+'.sqlite';
 let reader:DatabaseSync|undefined,created=false;
 try{
  // 源BEGIN IMMEDIATE阻止并发写入；独立只读连接把已提交旧schema复制至全新文件。
  // 先独占创建空目标并限制为本用户可读写，避免复制期间放宽原工程权限。
  writeFileSync(destination,Buffer.alloc(0),{flag:'wx',mode:0o600});created=true;
  reader=new DatabaseSync(path,{readOnly:true});reader.exec('PRAGMA busy_timeout=5000');
  reader.prepare('VACUUM INTO ?').run(destination);
  const snapshot=new DatabaseSync(destination,{readOnly:true});
  try{
   if(snapshot.prepare('PRAGMA application_id').get()?.application_id!==1129464134 || snapshot.prepare('PRAGMA user_version').get()?.user_version!==1 || snapshot.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw new Error('snapshot_invalid');
  }finally{snapshot.close();}
  return {path:destination,sha256:createHash('sha256').update(readFileSync(destination)).digest('hex'),schemaVersion:1};
 }catch(error){
  // 只清理本次独占创建的失败副本，绝不删除源账本或既有快照。
  if(created){try{unlinkSync(destination);}catch{}}
  throw new Error('ledger_upgrade_snapshot_failed',{cause:error});
 }
 finally{reader?.close();}
}
