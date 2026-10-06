/** 关闭后的不存在、存在但无权限与未知探测错误使用不同停止语义。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {groupAlive} from '../src/harness/process_group.ts';
test('permission-denied existence probe must retain writer ownership',()=>{
 assert.equal(groupAlive(123,()=>{throw Object.assign(new Error('permission denied'),{code:'EPERM'});}),true);
});
test('only ESRCH can prove group absent through a failed probe',()=>{
 assert.equal(groupAlive(123,()=>{throw Object.assign(new Error('absent'),{code:'ESRCH'});}),false);
 const error=Object.assign(new Error('unknown observation'),{code:'EINVAL'});
 assert.throws(()=>groupAlive(123,()=>{throw error;}),error);
});
test('successful group probe records possible live processes',()=>{
 const observed:number[]=[];
 assert.equal(groupAlive(321,(target,signal)=>{observed.push(target,signal);}),true);
 assert.deepEqual(observed,[-321,0]);
});
