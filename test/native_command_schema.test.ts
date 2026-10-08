/** 完整命令参数合同须在编辑前拒绝漂移；纯协议夹具不代替原生验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {strictMcpRunner} from '../src/adapters/strict_mcp_runner.ts';
const exec=promisify(execFile);
const commands=[{id:'alpha',params:'{"x":number}',enabled:true,label:'Alpha'},{id:'beta',enabled:false,label:'Beta'}];
const faults=['matching','context-only','missing','changed','presence','duplicate','extra','malformed','invalid-json','duplicate-json','wrong-param-type','query-error','caught-refusal','cached','explicit-drift'] as const;
for(const mode of ['headless','bridge','desktop'])for(const pluginId of ['effectcraft','filmcraft','photocraft','vectorcraft'])for(const fault of faults)test(mode+' '+pluginId+' command schema: '+fault,async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-command-schema-'));
 try{
  await mkdir(join(root,'scripts'));await mkdir(join(root,'references'));
  const catalog=['effectcraft','vectorcraft'].includes(pluginId)?'list_commands':'command_list';
  const tools=[catalog,'edit'].map(name=>({name,inputSchema:{type:'object'}}));
  await writeFile(join(root,'references/native-command-snapshot.json'),JSON.stringify({pluginId,tools,commands}));
  if(mode!=='headless'&&pluginId==='effectcraft'){
   await writeFile(join(root,'references/bridge-tools.json'),JSON.stringify({schema:'craft-bridge-tools/v1',pluginId,mode:'bridge',runtimeSha256:'a'.repeat(64),desktopBinarySha256:'b'.repeat(64),tools:[{name:'ui_edit',inputSchema:{type:'object'}}]}));
   await writeFile(join(root,'scripts/desktop.lock.json'),JSON.stringify({binarySha256:'b'.repeat(64)}));
   await writeFile(join(root,'references/native-command-snapshot.json'),JSON.stringify({pluginId,tools,commands,runtimeSha256:'a'.repeat(64)}));
   tools.push({name:'ui_edit',inputSchema:{type:'object'}});
  }
  const edit=mode!=='headless'&&pluginId==='effectcraft'?'ui_edit':'edit';
  const config={fault,pluginId,catalog,tools,commands,edit};await writeFile(join(root,'config.json'),JSON.stringify(config));
  const module=join(root,'scripts/mcp_session.py'),entry=join(root,mode==='desktop'?'desktop.py':'entry.py'),runner=join(root,'runner.py');
  let runnerSource=strictMcpRunner;
  if(mode!=='headless'){
   const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
   const snapshot=JSON.stringify({pluginId,tools:tools.filter(t=>t.name!=='ui_edit'),commands,runtimeSha256:'a'.repeat(64)});
   const desktop=JSON.stringify({version:'0.2.0',binarySha256:'b'.repeat(64)});
   await writeFile(join(root,'references/native-command-snapshot.json'),snapshot);
   await writeFile(join(root,'scripts/desktop.lock.json'),desktop);
   const resource=JSON.stringify({schema:'artcraft-mode-command-catalog/v1',platform:'darwin-arm64',modes:['bridge','desktop'],domains:{[pluginId]:{snapshotSha256:hash(snapshot),desktopLockSha256:hash(desktop),runtimeSha256:'a'.repeat(64),desktopBinarySha256:'b'.repeat(64),desktopVersion:'0.2.0',commands}}});
   await writeFile(join(root,'references/mode-command-catalog.json'),resource);
   runnerSource=runnerSource.replace('69aa578e1685996cea4fa5aa99260697a8c61d2273ad639e0885410baa07ce2c',hash(resource));
   await mkdir(join(root,'launch')); // Real launcher lives under scripts, with resources beside that directory.
   // The fixture runner is rooted at root/launch; source uses parent.parent for resources.
  }
  const launcher=mode==='headless'?runner:join(root,'launch/runner.py');
  await writeFile(launcher,runnerSource);
  await writeFile(module,String.raw`import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
cfg=json.loads((root/'config.json').read_text())
class Session:
 def request(self,method,params):
  with (root/'calls').open('a') as f:f.write(json.dumps({'method':method,'params':params})+'\n')
  if method=='tools/list':return {'tools':cfg['tools']}
  if params['name']!=cfg['catalog']:return {'content':[{'type':'text','text':'{"edited":true}'}]}
  self.queries=getattr(self,'queries',0)+1
  commands=json.loads(json.dumps(cfg['commands']));fault=cfg['fault']
  if fault=='context-only':commands[0].update(enabled=False,label='Localized label',shortcut='Other',menu=['Changed'])
  if fault in ('missing','caught-refusal'):commands.pop()
  if fault=='changed' or (fault=='explicit-drift' and self.queries>1):commands[0]['params']='{"x":string}'
  if fault=='presence':commands[1]['params']=''
  if fault=='duplicate':commands.append(commands[0])
  if fault=='extra':commands.append({'id':'extra','params':'{}'})
  if fault=='wrong-param-type':commands[0]['params']=True
  value={'commands':commands,'count':len(commands)} if cfg['pluginId']=='vectorcraft' else commands
  if fault=='malformed':value={'commands':True}
  text=json.dumps(value)
  if fault=='invalid-json':text='invalid JSON'
  if fault=='duplicate-json':text='[{"id":"alpha","id":"beta"}]'
  if fault=='query-error':return {'isError':True,'content':[{'type':'text','text':'native catalog refused'}]}
  return {'content':[{'type':'text','text':text}]}
`);
  await writeFile(entry,String.raw`import importlib.util,sys
s=importlib.util.spec_from_file_location('fixture',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
c=m.Session()
if m.cfg['fault']=='caught-refusal':
 try:c.request('tools/call',{'name':m.cfg['edit'],'arguments':{}})
 except RuntimeError:pass
if m.cfg['fault']=='explicit-drift':
 c.request('tools/call',{'name':m.cfg['catalog'],'arguments':{}})
 c.request('tools/call',{'name':m.cfg['catalog'],'arguments':{}})
c.request('tools/call',{'name':m.cfg['edit'],'arguments':{}})
if m.cfg['fault']=='cached':c.request('tools/call',{'name':m.cfg['edit'],'arguments':{}})
`);
  const result=await exec(process.env.CRAFT_TEST_PYTHON||'python3',['-I','-B',launcher,module,entry,module,...(mode==='bridge'?['--mode','bridge']:[])]).then(value=>({code:0,...value}),error=>({code:error.code,stderr:error.stderr}));
  const valid=['matching','context-only','cached'].includes(fault);assert.equal(result.code===0,valid,JSON.stringify(result));
  if(!valid)assert.match(result.stderr,/capability_missing: native_command_schema/);
  const calls=(await readFile(join(root,'calls'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(calls.filter(c=>c.method==='tools/list').length,1);
  assert.equal(calls.filter(c=>c.method==='tools/call'&&c.params.name===catalog).length,fault==='explicit-drift'?2:1,'catalog query is readonly and not retried');
  assert.equal(calls.filter(c=>c.method==='tools/call'&&c.params.name===edit).length,valid?(fault==='cached'?2:1):0,'no edit on refusal');
 }finally{await rm(root,{recursive:true,force:true});}
});
