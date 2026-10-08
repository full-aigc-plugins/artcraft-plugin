/** 编辑前实际工具发现必须匹配受信快照；控制夹具不代替原生验收。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {publicSkillFactory} from '../src/adapters/public_skill.ts';
import {strictMcpRunner} from '../src/adapters/strict_mcp_runner.ts';
const exec=promisify(execFile);
const tool={name:'save',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}};
const queryTool={name:'list_commands',inputSchema:{type:'object'}};
const commands=[{id:'fixture.command',params:'{}'}];
const cases=[
 {name:'matching',tools:[tool],valid:true},
 {name:'matching calls reuse discovery',tools:[tool],repeatCall:true,valid:true},
 {name:'caught refusal cannot retry discovery or edit',tools:[],recover:true,valid:false},
 {name:'extra tool does not widen locked names',tools:[tool,{name:'extra',inputSchema:{type:'object'}}],call:'extra',valid:false},
 {name:'missing tool',tools:[],valid:false},
 {name:'schema drift',tools:[{...tool,inputSchema:{type:'object'}}],valid:false},
 {name:'duplicate tool',tools:[tool,tool],valid:false},
 {name:'missing schema',tools:[{name:'save'}],valid:false},
 {name:'scalar schema',tools:[{name:'save',inputSchema:1}],valid:false},
 {name:'non-object tool',tools:[null],valid:false},
 {name:'malformed tools',tools:{},valid:false},
 {name:'explicit discovery is reused',tools:[tool],discover:true,valid:true},
];
for(const item of cases)test('native schema boundary: '+item.name,async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-schema-'));
 try{
  await mkdir(join(root,'scripts'));await mkdir(join(root,'references'));
  const module=join(root,'scripts/mcp_session.py'),entry=join(root,'entry.py'),runner=join(root,'runner.py'),log=join(root,'requests');
  await writeFile(join(root,'references/native-command-snapshot.json'),JSON.stringify({pluginId:'effectcraft',tools:[tool,queryTool],commands}));
  await writeFile(runner,strictMcpRunner);
  await writeFile(module,`import json,sys
from pathlib import Path
class Session:
 def request(self,method,params):
  with Path(sys.argv[2]).open('a') as f:f.write(method+(':'+params['name'] if method=='tools/call' else '')+'\\n')
  if method=='tools/list':return json.loads(sys.argv[1])
  if method=='tools/call' and params.get('name')=='list_commands':return {'content':[{'type':'text','text':'[{"id":"fixture.command","params":"{}"}]'}]}
  return {'content':[{'type':'text','text':'{"saved":true}'}]}
`);
  await writeFile(entry,`import importlib.util,sys
s=importlib.util.spec_from_file_location('fixture',sys.argv[3]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
c=m.Session()
if sys.argv[5]=='yes':c.request('tools/list',{})
if sys.argv[6]=='recover':
 try:c.request('tools/call',{'name':'save','arguments':{}})
 except RuntimeError:pass
c.request('tools/call',{'name':sys.argv[4],'arguments':{'path':'project'}})
if sys.argv[6]=='repeat':c.request('tools/call',{'name':'save','arguments':{'path':'second'}})
`);
  const result=await exec(process.env.CRAFT_TEST_PYTHON||'python3',['-I','-B',runner,module,entry,JSON.stringify({tools:Array.isArray(item.tools)?[...item.tools,queryTool]:item.tools}),log,module,item.call||'save',item.discover?'yes':'no',item.recover?'recover':item.repeatCall?'repeat':'once']).then(value=>({code:0,...value}),error=>({code:error.code,stderr:error.stderr}));
  assert.equal(result.code===0,item.valid,JSON.stringify(result));
  if(!item.valid)assert.match(result.stderr,/capability_missing: native_tool_schema/);
  const methods=(await readFile(log,'utf8')).trim().split('\n');
  assert.equal(methods.filter(x=>x==='tools/list').length,1);
  assert.equal(methods.filter(x=>x==='tools/call:list_commands').length,item.valid?1:0);
  assert.equal(methods.filter(x=>x==='tools/call:save').length,item.valid?(item.repeatCall?2:1):0,'no edit on refusal; no retry');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('native snapshot must be locked and unchanged before preparing task files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-schema-lock-'));
 const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
 try{
  await mkdir(join(root,'scripts'));await mkdir(join(root,'references'));
  const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(root,'scripts',name);await writeFile(path,'fixture');return {path,sha256:hash('fixture')};}));
  const config={pluginId:'effectcraft' as const,skillRoot:root,python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:process.execPath,runtimeHome:root,files,outputRoot:join(root,'outputs')};
  const node={runtimeIdentity:{pluginId:'effectcraft',mode:'headless'},expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{},assetBindings:[],outputs:[{assetId:'native',location:'project.ecproj',mediaType:'application/octet-stream'}]}};
  await assert.rejects(publicSkillFactory(config)(node,[],'missing'),/capability_missing: native_tool_schema snapshot unlocked/);
  const path=join(root,'references/native-command-snapshot.json');await writeFile(path,JSON.stringify({pluginId:'effectcraft',tools:[tool,queryTool],commands}));
  files.push({path,sha256:hash(await readFile(path))});
  const locked=publicSkillFactory(config);await writeFile(path,JSON.stringify({tools:[]}));
  await assert.rejects(locked(node,[],'drift'),/launcher_file_identity_mismatch/);
  await assert.rejects(access(join(root,'outputs')),/ENOENT/);
 }finally{await rm(root,{recursive:true,force:true});}
});
