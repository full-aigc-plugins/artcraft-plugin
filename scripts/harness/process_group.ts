/** 进程组存在性探测；权限不足不能作为已停止证明。 */
export function groupAlive(pid:number, probe:(target:number,signal:0)=>unknown=(target,signal)=>process.kill(target,signal)):boolean {
 try{probe(-pid,0);return true;}catch(error){
  const code=(error as NodeJS.ErrnoException).code;
  if(code==='ESRCH')return false;
  // EPERM 保守视作存在，监督器继续有界观察；发信号的权限失败仍单独拒绝。
  if(code==='EPERM')return true;
  throw error;
 }
}

/** 发送取消信号；组刚退出的 ESRCH 不替代后续 close 和停止核验。 */
export function signalGroup(pid:number, signal:NodeJS.Signals, send:(target:number,signal:NodeJS.Signals)=>unknown=(target,signal)=>process.kill(target,signal)):boolean {
 try{send(-pid,signal);return true;}catch(error){
  if((error as NodeJS.ErrnoException).code==='ESRCH')return false;
  throw error;
 }
}
