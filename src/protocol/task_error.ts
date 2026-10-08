/** 公开拒绝响应的结构化错误，不改变已有账本状态或错误字符串。 */
/** craft-task/v1 已定义的公开错误；未知领域诊断不得提升为协议错误。 */
export const publicTaskErrorCodes=Object.freeze(['runtime_missing','capability_missing','revision_conflict','idempotency_conflict','outcome_unknown','artifact_invalid','budget_exhausted','authorization_required'] as const);

export interface TaskErrorDetail {code:string;message:string;}

/** 保留已知错误标识；非 Error 异常也返回稳定可查询的错误对象。 */
export function taskErrorDetail(value:unknown):TaskErrorDetail {
 const message=typeof value==='string' ? value : value instanceof Error ? value.message : 'operation_failed';
 const candidate=message.split(':',1)[0];
 // 内部事务异常和兼容消息保持原样，公开错误码按 craft-task/v1 归一化。
 const code=candidate==='budget_exceeded' ? 'budget_exhausted' : candidate;
 return {code:/^[a-z][a-z0-9_]*$/.test(code) ? code : 'operation_failed',message};
}
