/** 公开拒绝响应的结构化错误，不改变已有账本状态或错误字符串。 */
export interface TaskErrorDetail {code:string;message:string;}

/** 保留已知错误标识；非 Error 异常也返回稳定可查询的错误对象。 */
export function taskErrorDetail(value:unknown):TaskErrorDetail {
 const message=typeof value==='string' ? value : value instanceof Error ? value.message : 'operation_failed';
 const candidate=message.split(':',1)[0];
 return {code:/^[a-z][a-z0-9_]*$/.test(candidate) ? candidate : 'operation_failed',message};
}
