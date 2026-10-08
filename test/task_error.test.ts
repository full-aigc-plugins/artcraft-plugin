/** 公开预算错误码遵循协议；兼容字符串不变，不吞掉其他错误身份。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { taskErrorDetail } from '../src/protocol/task_error.ts';

for(const dimension of ['minorUnits','externalCalls','revisions'])test(`public ${dimension} exhaustion preserves message with canonical code`,()=>{
 const message='budget_exceeded: '+dimension;
 assert.deepEqual(taskErrorDetail(new Error(message)),{code:'budget_exhausted',message});
 assert.deepEqual(taskErrorDetail(message),{code:'budget_exhausted',message});
});
test('unrelated budget and authorization errors retain their own identities',()=>{
 for(const code of ['budget_policy_invalid','budget_usage_overflow','authorization_scope_mismatch','budget_exhausted']){
  assert.deepEqual(taskErrorDetail(code),{code,message:code});
 }
});
