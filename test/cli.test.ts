/** 公开 CLI 的启动和只读账本边界。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const exec=promisify(execFile),entry=new URL('../src/cli.ts',import.meta.url).pathname;
test('ArtCraft public CLI reports version and supported commands',async()=>{
 assert.equal(JSON.parse((await exec(process.execPath,[entry,'--version'])).stdout).version,JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version);
 assert.deepEqual(JSON.parse((await exec(process.execPath,[entry,'--help'])).stdout).commands,['run','status','upgrade','cancel','package','verify-package','register-video-factory']);
});
test('ArtCraft CLI refuses unknown commands and missing databases without creating user files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-cli-'));
 try{
  await assert.rejects(exec(process.execPath,[entry,'exec','--database',join(root,'tasks.sqlite')]),error=>{const response=JSON.parse((error as {stdout:string}).stdout);assert.equal(response.error,'cli_command_invalid');assert.deepEqual(response.errorDetail,{code:'cli_command_invalid',message:'cli_command_invalid'});return true;});
  await assert.rejects(exec(process.execPath,[entry,'status','--database',join(root,'tasks.sqlite')]),error=>{assert.ok(String((error as {stdout:string}).stdout).includes('ENOENT'));return true;});
  await assert.rejects(access(join(root,'tasks.sqlite')),/ENOENT/);
 }finally{await rm(root,{recursive:true});}
});
