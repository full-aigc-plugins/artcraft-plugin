/** 受信bridge目录必须绑定原生和桌面身份；夹具不代表GUI验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {strictMcpRunner} from '../src/adapters/strict_mcp_runner.ts';
const exec=promisify(execFile);
for(const mode of ['bridge','desktop'])for(const fault of ['runtime','desktop','domain','mode','schema','duplicate','collision','missing','malformed','scalar','desktop-scalar','bad-tools','nonhex'])test(mode+' rejects untrusted bridge '+fault+' before importing native session',async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-bridge-identity-'));
 try{
  await mkdir(join(root,'scripts'));await mkdir(join(root,'references'));
  const tool={name:'list_commands',inputSchema:{type:'object'}},ui={name:'ui_inspect',inputSchema:{type:'object'}};
  const snapshot={pluginId:'effectcraft',runtimeSha256:'a'.repeat(64),tools:[tool],commands:[{id:'alpha',params:'{}'}]};
  const bridge:any={schema:'craft-bridge-tools/v1',pluginId:'effectcraft',mode:'bridge',runtimeSha256:'a'.repeat(64),desktopBinarySha256:'b'.repeat(64),tools:[ui]};
  if(fault==='runtime')bridge.runtimeSha256='c'.repeat(64);
  if(fault==='desktop')bridge.desktopBinarySha256='c'.repeat(64);
  if(fault==='domain')bridge.pluginId='filmcraft';
  if(fault==='mode')bridge.mode='headless';
  if(fault==='schema')bridge.schema='unknown';
  if(fault==='duplicate')bridge.tools.push(ui);
  if(fault==='collision')bridge.tools.push(tool);
  if(fault==='bad-tools')bridge.tools[0].inputSchema=[];
  if(fault==='nonhex')bridge.desktopBinarySha256='z'.repeat(64);
  await writeFile(join(root,'references/native-command-snapshot.json'),JSON.stringify(snapshot));
  await writeFile(join(root,'scripts/desktop.lock.json'),JSON.stringify(fault==='desktop-scalar'?[]:{binarySha256:(fault==='nonhex'?'z':'b').repeat(64)}));
  if(fault!=='missing')await writeFile(join(root,'references/bridge-tools.json'),fault==='malformed'?'invalid JSON':JSON.stringify(fault==='scalar'?[]:bridge));
  const module=join(root,'scripts/mcp_session.py'),entry=join(root,mode==='desktop'?'desktop.py':'entry.py'),runner=join(root,'runner.py');
  await writeFile(runner,strictMcpRunner);
  await writeFile(module,"raise AssertionError('native module must not load')\n");
  await writeFile(entry,"raise AssertionError('entry must not execute')\n");
  const result=await exec(process.env.CRAFT_TEST_PYTHON||'python3',['-I','-B',runner,module,entry,...(mode==='bridge'?['--mode','bridge']:[])]).then(value=>({code:0,...value}),error=>({code:error.code,stderr:error.stderr}));
  assert.notEqual(result.code,0);assert.match(result.stderr,/capability_missing: native_tool_schema snapshot invalid/);
  assert.doesNotMatch(result.stderr,/AssertionError/);
 }finally{await rm(root,{recursive:true,force:true});}
});
