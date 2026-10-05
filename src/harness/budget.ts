/** 显式预算政策及可信适配器消耗上界；金额使用货币最小单位整数。 */
export interface BudgetLimits {currency:string;maxMinorUnits:number|null;maxRevisions:number|null;maxExternalCalls:number|null;}
export interface BudgetUsage {minorUnits:number;externalCalls:number;}
export interface BudgetAllocation extends BudgetUsage {revisions:number;}
export interface BudgetSnapshot {accountKey:string;limits:BudgetLimits;allocated:BudgetAllocation;}

/** 预算缺失与未知字段不能变成无限额度；显式 null 才表示无该项上限。 */
export function budgetLimits(value:unknown):BudgetLimits {
 const limits=value as BudgetLimits;
 if(!limits || typeof limits!=='object' || Array.isArray(limits) || Object.keys(limits).sort().join(',')!=='currency,maxExternalCalls,maxMinorUnits,maxRevisions' || typeof limits.currency!=='string' || !/^[A-Z]{3}$/.test(limits.currency))throw new Error('budget_policy_invalid');
 for(const key of ['maxMinorUnits','maxRevisions','maxExternalCalls'] as const){const cap=limits[key];if(cap!==null && (!Number.isSafeInteger(cap) || cap<0))throw new Error('budget_policy_invalid');}
 return structuredClone(limits);
}
/** 可信准备阶段必须给出完整上界，模型 payload 中的同名字段不参与计量。 */
export function budgetUsage(value:unknown):BudgetUsage {
 const usage=value as BudgetUsage;
 if(!usage || typeof usage!=='object' || Array.isArray(usage) || Object.keys(usage).sort().join(',')!=='externalCalls,minorUnits' || !Number.isSafeInteger(usage.minorUnits) || usage.minorUnits<0 || !Number.isSafeInteger(usage.externalCalls) || usage.externalCalls<0)throw new Error('budget_usage_invalid');
 return {minorUnits:usage.minorUnits,externalCalls:usage.externalCalls};
}
/** 先检测溢出再核对政策；无限政策也不能丢失整数精度。 */
export function allocateBudget(snapshot:BudgetSnapshot,usage:BudgetAllocation):BudgetAllocation {
 const allocated={...snapshot.allocated};
 for(const [key,limit] of [['minorUnits','maxMinorUnits'],['externalCalls','maxExternalCalls'],['revisions','maxRevisions']] as const){
  const next=allocated[key]+usage[key];
  if(!Number.isSafeInteger(next) || next<0)throw new Error('budget_usage_overflow');
  const cap=snapshot.limits[limit];if(cap!==null && next>cap)throw new Error('budget_exceeded: '+key);
  allocated[key]=next;
 }
 return allocated;
}
