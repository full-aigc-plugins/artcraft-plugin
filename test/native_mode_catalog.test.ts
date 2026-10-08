/** 模式独立目录身份；真实桌面交付另行验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {strictMcpRunner} from '../src/adapters/strict_mcp_runner.ts';
const exec=promisify(execFile), hash=(value:string)=>createHash('sha256').update(value).digest('hex');
for(const mode of ['bridge','desktop'])for(const fault of ['matching','digest','snapshot','desktop-lock','runtime','desktop-binary','desktop-version','platform','modes','duplicate'])test(mode+' mode catalog identity '+fault,async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-mode-catalog-'));
 try{
  await mkdir(join(root,'scripts'));await mkdir(join(root,'references'));
  const tools=[{name:'command_list',inputSchema:{type:'object'}},{name:'command_run',inputSchema:{type:'object'}}];
  const headless=[{id:'headless.only',params:'{"rate":number}'}],commands=[{id:'desktop.only',params:'{"name":string}'}];
  const snapshot=JSON.stringify({pluginId:'filmcraft',runtimeSha256:'a'.repeat(64),tools,commands:headless});
  const desktop=JSON.stringify({version:'0.2.0',binarySha256:'b'.repeat(64)});
  await writeFile(join(root,'references/native-command-snapshot.json'),snapshot);await writeFile(join(root,'scripts/desktop.lock.json'),desktop);
  const row:any={snapshotSha256:hash(snapshot),desktopLockSha256:hash(desktop),runtimeSha256:'a'.repeat(64),desktopBinarySha256:'b'.repeat(64),desktopVersion:'0.2.0',commands};
  const value:any={schema:'artcraft-mode-command-catalog/v1',platform:'darwin-arm64',modes:['bridge','desktop'],domains:{filmcraft:row}};
  if(fault==='snapshot')row.snapshotSha256='0'.repeat(64);
  if(fault==='desktop-lock')row.desktopLockSha256='0'.repeat(64);
  if(fault==='runtime')row.runtimeSha256='0'.repeat(64);
  if(fault==='desktop-binary')row.desktopBinarySha256='0'.repeat(64);
  if(fault==='desktop-version')row.desktopVersion='9.9.9';
  if(fault==='platform')value.platform='other';
  if(fault==='modes')value.modes=['headless'];
  if(fault==='duplicate')row.commands=[...commands,...commands];
  const data=JSON.stringify(value);await writeFile(join(root,'references/mode-command-catalog.json'),data+(fault==='digest'?' ':''));
  const runner=join(root,'scripts/guard.py'),native=join(root,'scripts/mcp_session.py'),entry=join(root,'scripts/commands.py');
  await writeFile(runner,strictMcpRunner.replace('69aa578e1685996cea4fa5aa99260697a8c61d2273ad639e0885410baa07ce2c',hash(data)));
  await writeFile(native,`import json\nfrom pathlib import Path\nclass Session:\n def request(self,method,params):\n  if method=='tools/list':return {'tools':${JSON.stringify(tools)}}\n  if params['name']=='command_list':return {'content':[{'type':'text','text':json.dumps(${JSON.stringify(commands)})}]}\n  return {'content':[{'type':'text','text':'{}'}]}\n`);
  await writeFile(entry,String.raw`import importlib.util
from pathlib import Path
def catalog():return {'commands':[{'id':'headless.only'}],'nativeTools':['command_list','command_run']}
def main():
 assert [r['id'] for r in catalog()['commands']]==['desktop.only']
 p=Path(__file__).with_name('mcp_session.py');s=importlib.util.spec_from_file_location('native',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
 m.Session().request('tools/call',{'name':'command_run','arguments':{'id':'desktop.only','params':{}}})
 Path(__file__).with_name('executed').write_text('once')
 return 0
`);
  const argv=['-I','-B',runner,native,entry,'run','--mode','bridge'];
  if(mode==='desktop'){
   const desktopEntry=join(root,'scripts/desktop.py');await writeFile(desktopEntry,String.raw`import importlib.util
from pathlib import Path
p=Path(__file__).with_name('commands.py');s=importlib.util.spec_from_file_location('commands',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);raise SystemExit(m.main())
`);argv.splice(4,1,desktopEntry);argv.splice(6);
  }
  const result=await exec(process.env.CRAFT_TEST_PYTHON||'python3',argv).then(v=>({code:0,...v}),e=>({code:e.code,stderr:e.stderr}));
  assert.equal(result.code===0,fault==='matching',result.stderr);
  if(fault==='matching')assert.equal(await readFile(join(root,'scripts/executed'),'utf8'),'once');
  else {assert.match(result.stderr,/capability_missing: native_command_schema snapshot invalid/);await assert.rejects(readFile(join(root,'scripts/executed')));}
 }finally{await rm(root,{recursive:true,force:true});}
});
