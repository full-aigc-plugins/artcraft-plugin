/** 副作用之前持久化任务身份、版本绑定和工程写入占用。 */
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { validateTask, planHash, verifyArtifact } from '../protocol/contracts.ts';
import { budgetLimits, budgetUsage, allocateBudget } from './budget.ts';
import type { BudgetSnapshot, BudgetLimits } from './budget.ts';

type TaskRow = {task_id:string;request_json:string;state:string;epoch:number;attempt_id:string|null;project_key:string;binding_hash:string};
export type TaskReceipt = {taskId:string;attemptId:string|null;state:string;epoch:number;runtimeIdentity:Record<string,unknown>;outputRefs:unknown[];evidenceRefs:unknown[];error:unknown};
export type ExecutionRecord = {token:string;status:string;pid:number|null;commandHash:string;exitCode:number|null;signal:string|null;groupStopped:boolean};

/** SQLite 本地账本；关闭连接不会释放不明确结果的工程占用。 */
export class TaskLedger {
  private database: DatabaseSync;
  readonly databasePath:string;
  constructor(path:string) {
    this.databasePath=path===':memory:' ? path : resolve(path);
    this.database=new DatabaseSync(path);
    try {
    this.database.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
    const application=this.database.prepare('PRAGMA application_id').get() as {application_id:number};
    const version=this.database.prepare('PRAGMA user_version').get() as {user_version:number};
    const tables=this.database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    if((application.application_id!==0 && application.application_id!==1129464134) || version.user_version>2 || (tables.length && (application.application_id!==1129464134 || ![1,2].includes(version.user_version)))) throw new Error('ledger_schema_incompatible');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY, caller_id TEXT NOT NULL, plugin_id TEXT NOT NULL,
        idem_key TEXT NOT NULL, project_key TEXT NOT NULL, binding_hash TEXT NOT NULL,
        request_json TEXT NOT NULL, state TEXT NOT NULL, epoch INTEGER NOT NULL DEFAULT 0,
        attempt_id TEXT, error_json TEXT, created_at TEXT NOT NULL,
        UNIQUE(caller_id,plugin_id,idem_key));
      CREATE TABLE IF NOT EXISTS leases (
        project_key TEXT PRIMARY KEY, task_id TEXT NOT NULL UNIQUE, epoch INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL,
        from_state TEXT, to_state TEXT NOT NULL, epoch INTEGER NOT NULL,
        detail_json TEXT NOT NULL, occurred_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS epochs (
        project_key TEXT PRIMARY KEY, epoch INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS executions (
        task_id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL, epoch INTEGER NOT NULL,
        token TEXT NOT NULL, command_hash TEXT NOT NULL, status TEXT NOT NULL,
        pid INTEGER, exit_code INTEGER, signal TEXT, group_stopped INTEGER NOT NULL DEFAULT 0,
        stop_evidence_json TEXT);
      CREATE TABLE IF NOT EXISTS outcomes (
        task_id TEXT PRIMARY KEY, outputs_json TEXT NOT NULL, evidence_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workflow_runs (
        run_key TEXT PRIMARY KEY, owner_id TEXT NOT NULL, workflow_id TEXT NOT NULL,
        revision TEXT NOT NULL, plan_hash TEXT NOT NULL, plan_json TEXT NOT NULL,
        cancel_requested INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS workflow_nodes (
        run_key TEXT NOT NULL, node_id TEXT NOT NULL, fingerprint TEXT,
        record_json TEXT NOT NULL, PRIMARY KEY(run_key,node_id));
      CREATE TABLE IF NOT EXISTS budget_accounts (
        account_key TEXT PRIMARY KEY, limits_json TEXT NOT NULL, allocated_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS workflow_budget_links (
        run_key TEXT PRIMARY KEY, account_key TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS task_budget_links (
        task_id TEXT PRIMARY KEY, account_key TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS budget_reservations (
        task_id TEXT PRIMARY KEY, account_key TEXT NOT NULL, usage_json TEXT NOT NULL,
        status TEXT NOT NULL, created_at TEXT NOT NULL);
      PRAGMA application_id=1129464134; PRAGMA user_version=2;`);
    this.database.exec('COMMIT; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
    }catch(error){try{this.database.exec('ROLLBACK');}catch{}this.database.close();throw error;}
  }

  /** 所有状态、占用和事件变更在同一写事务内提交。 */
  private transaction<T>(operation:()=>T):T {
    this.database.exec('BEGIN IMMEDIATE');
    try {const result=operation();this.database.exec('COMMIT');return result;}
    catch(error){this.database.exec('ROLLBACK');throw error;}
  }

  private row(taskId:string):TaskRow {
    const row=this.database.prepare('SELECT * FROM tasks WHERE task_id=?').get(taskId) as unknown as TaskRow;
    if(!row) throw new Error('task_missing');
    return row;
  }

  private receipt(row:TaskRow):TaskReceipt {
    const request=JSON.parse(row.request_json);
    const error=this.database.prepare('SELECT error_json FROM tasks WHERE task_id=?').get(row.task_id) as {error_json:string|null};
    const outcome=this.database.prepare('SELECT * FROM outcomes WHERE task_id=?').get(row.task_id) as {outputs_json:string;evidence_json:string}|undefined;
    return {taskId:row.task_id,attemptId:row.attempt_id,state:row.state,epoch:row.epoch,runtimeIdentity:request.runtimeIdentity,outputRefs:outcome ? JSON.parse(outcome.outputs_json) : [],evidenceRefs:outcome ? JSON.parse(outcome.evidence_json) : [],error:error.error_json ? JSON.parse(error.error_json) : null};
  }

  private event(taskId:string,from:string|null,to:string,epoch:number,detail:unknown={}):void {
    this.database.prepare('INSERT INTO events(task_id,from_state,to_state,epoch,detail_json,occurred_at) VALUES(?,?,?,?,?,?)').run(taskId,from,to,epoch,JSON.stringify(detail),new Date().toISOString());
  }

  /** 核对真实计划摘要；同一调用方/插件幂等键返回原任务，绑定改变则冲突。 */
  register(callerId:string,projectKey:string,value:unknown,workflowKey?:string):TaskReceipt {
    if(!callerId || !projectKey || callerId.length>256 || projectKey.length>4096) throw new Error('context_invalid');
    const request=validateTask(value);
    if(planHash(request.payload)!==request.planHash) throw new Error('plan_hash_mismatch');
    const {taskId:ignoredTaskId,...binding}=request;
    const bindingHash=planHash({projectKey,request:binding});
    return this.transaction(()=>{
      let accountKey:string;
      if(workflowKey){
        const workflow=this.database.prepare('SELECT owner_id,plan_json FROM workflow_runs WHERE run_key=?').get(workflowKey) as {owner_id:string;plan_json:string}|undefined;
        if(!workflow || workflow.owner_id!==callerId || JSON.parse(workflow.plan_json).authorizationRef!==request.authorizationRef)throw new Error('budget_scope_mismatch');
        const linked=this.database.prepare('SELECT account_key FROM workflow_budget_links WHERE run_key=?').get(workflowKey) as {account_key:string}|undefined;
        if(!linked)throw new Error('budget_history_untracked');accountKey=linked.account_key;
        if(planHash(this.budgetAccount(accountKey).limits)!==planHash(request.budget))throw new Error('budget_policy_conflict');
      }else accountKey=planHash({ownerId:callerId,rootTaskId:request.taskId,authorizationRef:request.authorizationRef});
      const previous=this.database.prepare('SELECT * FROM tasks WHERE caller_id=? AND plugin_id=? AND idem_key=?').get(callerId,request.runtimeIdentity.pluginId,request.idempotencyKey) as unknown as TaskRow|undefined;
      if(previous){
        if(previous.binding_hash!==bindingHash) throw new Error('idempotency_conflict');
        if(workflowKey){
          const link=this.database.prepare('SELECT account_key FROM task_budget_links WHERE task_id=?').get(previous.task_id) as {account_key:string}|undefined;
          if(link?.account_key!==accountKey)throw new Error('budget_scope_mismatch');
        }
        return this.receipt(previous);
      }
      if(this.database.prepare('SELECT task_id FROM tasks WHERE task_id=?').get(request.taskId)) throw new Error('task_identity_conflict');
      this.database.prepare('INSERT INTO tasks(task_id,caller_id,plugin_id,idem_key,project_key,binding_hash,request_json,state,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(request.taskId,callerId,request.runtimeIdentity.pluginId,request.idempotencyKey,projectKey,bindingHash,JSON.stringify(request),'planned',new Date().toISOString());
      this.ensureBudgetAccount(accountKey,budgetLimits(request.budget));
      this.database.prepare('INSERT INTO task_budget_links(task_id,account_key) VALUES(?,?)').run(request.taskId,accountKey);
      this.event(request.taskId,null,'planned',0,{planHash:request.planHash});
      return this.receipt(this.row(request.taskId));
    });
  }

  /** 表示计划已准备；尚未取得写入权或启动原生调用。 */
  ready(taskId:string):TaskReceipt {
    return this.transaction(()=>{
      const row=this.row(taskId);
      if(row.state!=='planned' && row.state!=='blocked') throw new Error('invalid_transition');
      this.database.prepare('UPDATE tasks SET state=? WHERE task_id=?').run('ready',taskId);
      this.event(taskId,row.state,'ready',row.epoch);
      return this.receipt(this.row(taskId));
    });
  }

  /** 在副作用前核对工程版本并获得持久化单写租约；不自动回收旧占用。 */
  claim(taskId:string,actualRevision:string|null,usage?:unknown):TaskReceipt {
    return this.transaction(()=>{
      const row=this.row(taskId);
      if(row.state!=='ready') throw new Error('task_not_ready');
      const request=JSON.parse(row.request_json);
      if(Date.parse(request.deadline)<=Date.now()) throw new Error('deadline_exceeded');
      if(request.expectedRevision!==actualRevision) throw new Error('revision_conflict');
      if(this.database.prepare('SELECT * FROM leases WHERE project_key=?').get(row.project_key)) throw new Error('project_busy');
      const requested=budgetUsage(usage);
      const link=this.database.prepare('SELECT account_key FROM task_budget_links WHERE task_id=?').get(taskId) as {account_key:string}|undefined;
      if(!link)throw new Error('budget_history_untracked');
      const snapshot=this.budgetAccount(link.account_key),allocated=allocateBudget(snapshot,{...requested,revisions:0});
      this.database.prepare('UPDATE budget_accounts SET allocated_json=? WHERE account_key=?').run(JSON.stringify(allocated),link.account_key);
      this.database.prepare('INSERT INTO budget_reservations(task_id,account_key,usage_json,status,created_at) VALUES(?,?,?,?,?)').run(taskId,link.account_key,JSON.stringify(requested),'reserved',new Date().toISOString());
      const previous=this.database.prepare('SELECT epoch FROM epochs WHERE project_key=?').get(row.project_key) as {epoch:number}|undefined;
      const epoch=(previous?.epoch ?? 0)+1;
      const attempt=randomUUID();
      this.database.prepare('INSERT INTO epochs(project_key,epoch) VALUES(?,?) ON CONFLICT(project_key) DO UPDATE SET epoch=excluded.epoch').run(row.project_key,epoch);
      this.database.prepare('INSERT INTO leases(project_key,task_id,epoch) VALUES(?,?,?)').run(row.project_key,taskId,epoch);
      this.database.prepare('UPDATE tasks SET state=?,epoch=?,attempt_id=? WHERE task_id=?').run('running',epoch,attempt,taskId);
      this.event(taskId,'ready','running',epoch,{attemptId:attempt});
      return this.receipt(this.row(taskId));
    });
  }

  private requireLease(row:TaskRow,epoch:number):void {
    const lease=this.database.prepare('SELECT task_id,epoch FROM leases WHERE project_key=?').get(row.project_key) as {task_id:string;epoch:number}|undefined;
    if(!Number.isSafeInteger(epoch) || row.epoch!==epoch || lease?.task_id!==row.task_id || lease?.epoch!==epoch) throw new Error('stale_executor');
  }

  /** 断线或超时只进入核对阶段；不释放写入权，不生成新 attempt。 */
  unknown(taskId:string,epoch:number,reason:string):TaskReceipt {
    return this.transaction(()=>{
      const row=this.row(taskId);this.requireLease(row,epoch);
      if(!['running','reconciling','cancel_requested'].includes(row.state)) throw new Error('invalid_transition');
      const state=row.state==='cancel_requested' ? 'cancel_requested' : 'reconciling';
      this.database.prepare('UPDATE tasks SET state=?,error_json=? WHERE task_id=?').run(state,JSON.stringify({code:'outcome_unknown',reason}),taskId);
      this.event(taskId,row.state,state,epoch,{code:'outcome_unknown',reason});
      return this.receipt(this.row(taskId));
    });
  }

  /** 运行中取消仅登记意图；启动前取消可以立即终结。 */
  cancel(taskId:string):TaskReceipt {
    return this.transaction(()=>{
      const row=this.row(taskId);
      if(['cancelled','cancel_requested','completed','failed'].includes(row.state)) return this.receipt(row);
      if(row.state==='review_ready')this.requireStopped(taskId,this.execution(taskId)!.token);
      const state=['planned','blocked','ready','review_ready'].includes(row.state) ? 'cancelled' : 'cancel_requested';
      this.database.prepare('UPDATE tasks SET state=? WHERE task_id=?').run(state,taskId);
      this.event(taskId,row.state,state,row.epoch);
      return this.receipt(this.row(taskId));
    });
  }

  /** 原生副作用前登记执行意图；同一 attempt 禁止再次创建子调用。 */
  prepareExecution(taskId:string,epoch:number,commandHash:string):string {
    if(!/^[a-f0-9]{64}$/.test(commandHash)) throw new Error('command_hash_invalid');
    return this.transaction(()=>{
      const row=this.row(taskId);this.requireLease(row,epoch);
      if(row.state!=='running' || this.execution(taskId)) throw new Error('execution_conflict');
      const token=randomUUID();
      this.database.prepare('INSERT INTO executions(task_id,attempt_id,epoch,token,command_hash,status) VALUES(?,?,?,?,?,?)').run(taskId,row.attempt_id,epoch,token,commandHash,'prepared');
      this.database.prepare('UPDATE budget_reservations SET status=? WHERE task_id=?').run('committed',taskId);
      this.event(taskId,row.state,row.state,epoch,{execution:'prepared',commandHash});
      return token;
    });
  }

  /** 监督器记录真实 spawn 返回的 PID；token 绑定当前 attempt。 */
  attachExecution(taskId:string,epoch:number,token:string,pid:number):void {
    this.transaction(()=>{
      const row=this.row(taskId);this.requireLease(row,epoch);const execution=this.execution(taskId);
      if(!Number.isSafeInteger(pid) || pid<=0 || execution?.token!==token || execution.status!=='prepared') throw new Error('execution_identity_conflict');
      this.database.prepare('UPDATE executions SET status=?,pid=? WHERE task_id=?').run('running',pid,taskId);
      this.event(taskId,row.state,row.state,epoch,{execution:'spawned',pid});
    });
  }

  /** 仅供可信监督器调用：close 事件与进程组停止核对写入持久证据。 */
  recordExit(taskId:string,epoch:number,token:string,evidence:{exitCode:number|null;signal:string|null;groupStopped:boolean;spawnError?:string}):void {
    this.transaction(()=>{
      const row=this.row(taskId);this.requireLease(row,epoch);const execution=this.execution(taskId);
      if(execution?.token!==token || !['prepared','running'].includes(execution.status)) throw new Error('execution_identity_conflict');
      if(execution.status==='prepared' && !evidence.spawnError) throw new Error('spawn_outcome_unknown');
      if(evidence.exitCode!==null && (!Number.isSafeInteger(evidence.exitCode) || evidence.exitCode<0)) throw new Error('exit_evidence_invalid');
      this.database.prepare('UPDATE executions SET status=?,exit_code=?,signal=?,group_stopped=?,stop_evidence_json=? WHERE task_id=?').run('stopped',evidence.exitCode,evidence.signal,evidence.groupStopped ? 1 : 0,JSON.stringify({...evidence,observedAt:new Date().toISOString()}),taskId);
      this.event(taskId,row.state,row.state,epoch,{execution:'closed',...evidence});
    });
  }

  private requireStopped(taskId:string,token:string):ExecutionRecord {
    const execution=this.execution(taskId);
    if(execution?.token!==token || execution.status!=='stopped' || !execution.groupStopped) throw new Error('execution_stop_unverified');
    return execution;
  }

  /** 已核对停止的失败/取消可以终结；未知结果不得释放工程。 */
  settleStopped(taskId:string,epoch:number,token:string,state:'failed'|'cancelled',code:string):TaskReceipt {
    return this.transaction(()=>{
      const row=this.row(taskId);this.requireLease(row,epoch);this.requireStopped(taskId,token);
      if(state==='cancelled' ? row.state!=='cancel_requested' : !['running','reconciling','verifying'].includes(row.state)) throw new Error('invalid_transition');
      this.database.prepare('UPDATE tasks SET state=?,error_json=? WHERE task_id=?').run(state,state==='failed' ? JSON.stringify({code}) : null,taskId);
      this.database.prepare('DELETE FROM leases WHERE task_id=? AND epoch=?').run(taskId,epoch);
      this.event(taskId,row.state,state,epoch,{code});
      return this.receipt(this.row(taskId));
    });
  }

  /** 实际文件核验之后发布技术就绪产物；创作审阅尚未完成。 */
  async reviewReady(taskId:string,epoch:number,token:string,root:string,outputs:unknown[],evidenceRefs:unknown[]):Promise<TaskReceipt> {
    this.transaction(()=>{
      const row=this.row(taskId);this.requireLease(row,epoch);const execution=this.requireStopped(taskId,token);
      if(execution.exitCode!==0 || !['running','reconciling','verifying'].includes(row.state)) throw new Error('invalid_transition');
      this.database.prepare('UPDATE tasks SET state=? WHERE task_id=?').run('verifying',taskId);
      this.event(taskId,row.state,'verifying',epoch);
    });
    if(!outputs.length) throw new Error('artifact_missing');
    const checked=[];
    for(const output of outputs){
      const artifact=await verifyArtifact(output,root);
      if(artifact.producerTaskId!==taskId) throw new Error('artifact_task_mismatch');
      checked.push(artifact);
    }
    return this.transaction(()=>{
      const row=this.row(taskId);
      if(row.state==='review_ready' && row.epoch===epoch && this.requireStopped(taskId,token))return this.receipt(row);
      this.requireLease(row,epoch);this.requireStopped(taskId,token);
      if(row.state!=='verifying') throw new Error('invalid_transition');
      this.database.prepare('INSERT INTO outcomes(task_id,outputs_json,evidence_json) VALUES(?,?,?)').run(taskId,JSON.stringify(checked),JSON.stringify(evidenceRefs));
      this.database.prepare('UPDATE tasks SET state=?,error_json=NULL WHERE task_id=?').run('review_ready',taskId);
      this.database.prepare('DELETE FROM leases WHERE task_id=? AND epoch=?').run(taskId,epoch);
      this.event(taskId,'verifying','review_ready',epoch,{outputHashes:checked.map(item=>item.sha256)});
      return this.receipt(this.row(taskId));
    });
  }

  /** 独立 worker 从已绑定节点读取父工作流取消意图；无需调度器存活。 */
  taskWorkflowCancelled(taskId:string):boolean {
    return Boolean(this.database.prepare("SELECT 1 FROM workflow_nodes n JOIN workflow_runs w ON n.run_key=w.run_key WHERE json_extract(n.record_json,'$.taskId')=? AND w.cancel_requested=1 LIMIT 1").get(taskId));
  }

  /** 返回副作用的持久身份与停止证据，不把 PID 不存在作为自动重试许可。 */
  execution(taskId:string):ExecutionRecord|null {
    const row=this.database.prepare('SELECT * FROM executions WHERE task_id=?').get(taskId) as {token:string;status:string;pid:number|null;command_hash:string;exit_code:number|null;signal:string|null;group_stopped:number}|undefined;
    return row ? {token:row.token,status:row.status,pid:row.pid,commandHash:row.command_hash,exitCode:row.exit_code,signal:row.signal,groupStopped:row.group_stopped===1} : null;
  }

  /** 执行器读取已锁定请求，不允许更改原始计划绑定。 */
  request(taskId:string):Record<string,any> {return JSON.parse(this.row(taskId).request_json);}

  /** 工作流同一版本绑定固定计划；只登记图，不启动领域任务。 */
  beginWorkflow(plan:Record<string,any>):string {
    const key=planHash({ownerId:plan.ownerId,workflowId:plan.workflowId,revision:plan.revision});
    const digest=planHash(plan);
    return this.transaction(()=>{
      const existing=this.database.prepare('SELECT plan_hash FROM workflow_runs WHERE run_key=?').get(key) as {plan_hash:string}|undefined;
      if(existing){
        if(existing.plan_hash!==digest)throw new Error('workflow_revision_conflict');
        if(!this.database.prepare('SELECT account_key FROM workflow_budget_links WHERE run_key=?').get(key))throw new Error('budget_history_untracked');
        return key;
      }
      const limits=budgetLimits(plan.budget),accountKey=planHash({ownerId:plan.ownerId,workflowId:plan.workflowId,authorizationRef:plan.authorizationRef});
      // 旧账本未计量的执行不得隐式迁成免费历史，调用者仍能读取旧状态。
      const history=this.database.prepare('SELECT w.plan_json,b.account_key FROM workflow_runs w LEFT JOIN workflow_budget_links b ON w.run_key=b.run_key WHERE w.owner_id=? AND w.workflow_id=?').all(plan.ownerId,plan.workflowId) as {plan_json:string;account_key:string|null}[];
      if(history.some(row=>!row.account_key && JSON.parse(row.plan_json).authorizationRef===plan.authorizationRef))throw new Error('budget_history_untracked');
      this.ensureBudgetAccount(accountKey,limits);
      if(history.some(row=>row.account_key===accountKey)){
        const allocated=allocateBudget(this.budgetAccount(accountKey),{minorUnits:0,externalCalls:0,revisions:1});
        this.database.prepare('UPDATE budget_accounts SET allocated_json=? WHERE account_key=?').run(JSON.stringify(allocated),accountKey);
      }
      this.database.prepare('INSERT INTO workflow_budget_links(run_key,account_key) VALUES(?,?)').run(key,accountKey);
      this.database.prepare('INSERT INTO workflow_runs(run_key,owner_id,workflow_id,revision,plan_hash,plan_json) VALUES(?,?,?,?,?,?)').run(key,plan.ownerId,plan.workflowId,plan.revision,digest,JSON.stringify(plan));
      for(const node of plan.nodes)this.database.prepare('INSERT INTO workflow_nodes(run_key,node_id,record_json) VALUES(?,?,?)').run(key,node.id,JSON.stringify({status:'pending'}));
      return key;
    });
  }

  private ensureBudgetAccount(key:string,limits:BudgetLimits):void {
    const existing=this.database.prepare('SELECT limits_json FROM budget_accounts WHERE account_key=?').get(key) as {limits_json:string}|undefined;
    if(existing){if(planHash(JSON.parse(existing.limits_json))!==planHash(limits))throw new Error('budget_policy_conflict');return;}
    this.database.prepare('INSERT INTO budget_accounts(account_key,limits_json,allocated_json) VALUES(?,?,?)').run(key,JSON.stringify(limits),JSON.stringify({minorUnits:0,externalCalls:0,revisions:0}));
  }
  private budgetAccount(key:string):BudgetSnapshot {
    const row=this.database.prepare('SELECT limits_json,allocated_json FROM budget_accounts WHERE account_key=?').get(key) as {limits_json:string;allocated_json:string}|undefined;
    if(!row)throw new Error('budget_account_missing');return {accountKey:key,limits:JSON.parse(row.limits_json),allocated:JSON.parse(row.allocated_json)};
  }
  /** 工作流修订共享授权范围的预算快照，读取不会核销未知消耗。 */
  workflowBudget(key:string):BudgetSnapshot {
    const row=this.database.prepare('SELECT account_key FROM workflow_budget_links WHERE run_key=?').get(key) as {account_key:string}|undefined;
    if(!row)throw new Error('budget_history_untracked');return this.budgetAccount(row.account_key);
  }
  /** 全部已计量预算账户；用于本地状态检查，历史未计量记录不伪造账户。 */
  budgetAccounts():BudgetSnapshot[] {
    return (this.database.prepare('SELECT account_key FROM budget_accounts ORDER BY account_key').all() as {account_key:string}[]).map(row=>this.budgetAccount(row.account_key));
  }

  /** 保存节点与子任务引用；产物只在公共核验后登记为就绪。 */
  saveWorkflowNode(key:string,nodeId:string,record:Record<string,any>):void {
    this.transaction(()=>{
      const result=this.database.prepare('UPDATE workflow_nodes SET fingerprint=?,record_json=? WHERE run_key=? AND node_id=?').run(record.fingerprint ?? null,JSON.stringify(record),key,nodeId);
      if(result.changes!==1)throw new Error('workflow_node_missing');
    });
  }
  /** 读取持久节点状态；读取不触发子调用。 */
  workflowNode(key:string,nodeId:string):Record<string,any> {
    const row=this.database.prepare('SELECT record_json FROM workflow_nodes WHERE run_key=? AND node_id=?').get(key,nodeId) as {record_json:string}|undefined;
    if(!row)throw new Error('workflow_node_missing');return JSON.parse(row.record_json);
  }
  /** 只在同一用户与逻辑项目内寻找同参数/输入版本的历史产物。 */
  cachedWorkflowNode(ownerId:string,workflowId:string,nodeId:string,fingerprint:string):Record<string,any>|null {
    const rows=this.database.prepare('SELECT n.record_json FROM workflow_nodes n JOIN workflow_runs w ON n.run_key=w.run_key WHERE w.owner_id=? AND w.workflow_id=? AND n.node_id=? AND n.fingerprint=? ORDER BY n.rowid DESC').all(ownerId,workflowId,nodeId,fingerprint) as {record_json:string}[];
    for(const row of rows){const record=JSON.parse(row.record_json);if(['review_ready','reused'].includes(record.status))return record;}return null;
  }
  /** 父取消登记为意图，实际子进程停止由监督器负责。 */
  cancelWorkflow(key:string):void {
    const result=this.database.prepare('UPDATE workflow_runs SET cancel_requested=1 WHERE run_key=?').run(key);
    if(result.changes!==1)throw new Error('workflow_missing');
  }
  /** 是否已经要求停止新依赖调度。 */
  workflowCancelled(key:string):boolean {
    const row=this.database.prepare('SELECT cancel_requested FROM workflow_runs WHERE run_key=?').get(key) as {cancel_requested:number}|undefined;
    if(!row)throw new Error('workflow_missing');return row.cancel_requested===1;
  }

  /** 只读状态不会触发恢复、重试或租约释放。 */
  status(taskId:string):TaskReceipt {return this.receipt(this.row(taskId));}
  /** 列出全部登记任务供显式核对。 */
  list():TaskReceipt[] {return (this.database.prepare('SELECT * FROM tasks ORDER BY created_at,task_id').all() as unknown as TaskRow[]).map(row=>this.receipt(row));}
  /** 列出未释放工程占用；占用超时不证明原生调用已经停止。 */
  leases():{projectKey:string;taskId:string;epoch:number}[] {return (this.database.prepare('SELECT * FROM leases ORDER BY project_key').all() as unknown as {project_key:string;task_id:string;epoch:number}[]).map(row=>({projectKey:row.project_key,taskId:row.task_id,epoch:row.epoch}));}
  /** 读取状态事件，不包含素材内容或凭据。 */
  events(taskId:string):{toState:string;epoch:number;detail:unknown}[] {return (this.database.prepare('SELECT * FROM events WHERE task_id=? ORDER BY sequence').all(taskId) as unknown as {to_state:string;epoch:number;detail_json:string}[]).map(row=>({toState:row.to_state,epoch:row.epoch,detail:JSON.parse(row.detail_json)}));}
  /** 读取经授权的工作流快照，供离线交付打包；不提升审核状态。 */
  packageSnapshot(key:string,owner:string,authorization:string):Record<string,any> {
    return this.transaction(()=>{
      const row=this.database.prepare('SELECT plan_json,plan_hash FROM workflow_runs WHERE run_key=?').get(key) as {plan_json:string;plan_hash:string}|undefined;
      if(!row)throw new Error('workflow_missing');
      const plan=JSON.parse(row.plan_json);
      if(plan.ownerId!==owner || plan.authorizationRef!==authorization)throw new Error('authorization_scope_mismatch');
      if(this.workflowCancelled(key))throw new Error('package_workflow_not_ready');
      if(this.leases().some(lease=>plan.nodes.some((node:any)=>node.projectKey===lease.projectKey)))throw new Error('package_workflow_busy');
      const nodes=Object.fromEntries(plan.nodes.map((node:any)=>[node.id,this.workflowNode(key,node.id)]));
      const tasks=plan.nodes.map((node:any)=>{
        const record=nodes[node.id];
        if(!['review_ready','completed','reused'].includes(record.status) || !record.taskId || !record.root || !record.outputs?.length)throw new Error('package_workflow_not_ready');
        const receipt=this.status(record.taskId),execution=this.execution(record.taskId);
        if(!['review_ready','completed'].includes(receipt.state) || !execution?.groupStopped)throw new Error('package_workflow_not_ready');
        if(planHash(record.outputs)!==planHash(receipt.outputRefs))throw new Error('package_artifact_binding_mismatch');
        return {nodeId:node.id,receipt,request:this.request(record.taskId),execution,events:this.events(record.taskId)};
      });
      return {runKey:key,plan,planSha256:row.plan_hash,nodes,tasks,budget:this.workflowBudget(key),state:'review_ready'};
    });
  }

  /** 关闭连接；活跃租约保留在 SQLite 中。 */
  close():void {this.database.close();}
}
