/** Art 自有长导出调用预算；受控代理测试不替代原生整片导出。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {publicSkillFactory} from '../src/adapters/public_skill.ts';
import {lockNativeSchema} from './fixtures/native_schema_lock.ts';
import {createHash} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import {strictMcpRunner} from '../src/adapters/strict_mcp_runner.ts';
const begin='# ART_NATIVE_BUDGET_BEGIN',end='# ART_NATIVE_BUDGET_END';
test('Film long-call budget is deadline-bound, identity-bound and leaves other calls unchanged',async()=>{
 assert.ok(strictMcpRunner.includes(begin)&&strictMcpRunner.includes(end),'native export budget behavior missing');
 const root=await mkdtemp(join(tmpdir(),'art-export-budget-'));
 try{
  const helper=strictMcpRunner.slice(strictMcpRunner.indexOf(begin)+begin.length,strictMcpRunner.indexOf(end));
  const script=`import subprocess,time,math,hashlib,json\nfrom pathlib import Path\nfrom datetime import datetime,timezone,timedelta\n${helper}\nroot=Path(${JSON.stringify(root)})\ncli=root/'filmcraft-cli';cli.write_bytes(b'trusted native')\nclass Original:\n def __init__(self):self.calls=[]\n def run(self,args,**kwargs):self.calls.append((args,kwargs));return kwargs\noriginal=Original()\ncfg={'executable':str(cli),'sha256':hashlib.sha256(cli.read_bytes()).hexdigest(),'deadline':(datetime.now(timezone.utc)+timedelta(minutes=20)).isoformat()}\nproxy=ArtNativeBudget(original,cfg)\nfor args in [[str(cli),'export','movie.mp4'],[str(cli),'--data-dir',str(root),'--project','a.fcproj','export','movie.mp4'],[str(cli),'bench-decode','movie.mp4']]:\n value=proxy.run(args,timeout=180);assert 180<value['timeout']<=1200\nassert proxy.run([str(cli),'probe','movie.mp4'],timeout=180)['timeout']==180\nassert proxy.run([str(cli),'--project','export','inspect'],timeout=180)['timeout']==180\nassert proxy.run(['/other/filmcraft-cli','export','movie.mp4'],timeout=180)['timeout']==180\nshort=ArtNativeBudget(original,{**cfg,'deadline':(datetime.now(timezone.utc)+timedelta(seconds=5)).isoformat()});assert 0<short.run([str(cli),'export','x'],timeout=180)['timeout']<=5\nlong=ArtNativeBudget(original,{**cfg,'deadline':(datetime.now(timezone.utc)+timedelta(hours=24)).isoformat()});assert long.run([str(cli),'export','x'],timeout=180)['timeout']<=3600\nexpired=ArtNativeBudget(original,{**cfg,'deadline':(datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()});before=len(original.calls)\ntry:expired.run([str(cli),'export','x'],timeout=180);assert False\nexcept subprocess.TimeoutExpired:pass\nassert len(original.calls)==before\ncli.write_bytes(b'changed');before=len(original.calls)\ntry:proxy.run([str(cli),'export','x'],timeout=180);assert False\nexcept ValueError as error:assert 'native_call_identity_mismatch' in str(error)\nassert len(original.calls)==before\nfor change in [{'deadline':'bad'},{'deadline':'2030-01-01T00:00:00'},{'sha256':'bad'},{'extra':True},{'executable':'relative'}]:\n try:ArtNativeBudget(original,{**cfg,**change});assert False\n except ValueError:pass\nprint('deadline,identity,command-scope,expiry and3600-second cap passed')\n`;
  const path=join(root,'check.py');await writeFile(path,script);assert.match(execFileSync(process.env.CRAFT_TEST_PYTHON||'python3',['-I','-B',path],{encoding:'utf8'}),/passed/);
 }finally{await rm(root,{recursive:true});}
});

// 实际 OS 子进程证明代理扩展超时；不代替完整原生影片验收。
test('deadline budget extends an actual OS child timeout and expired budgets never launch',async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-export-os-'));
 try{
  const helper=strictMcpRunner.slice(strictMcpRunner.indexOf(begin)+begin.length,strictMcpRunner.indexOf(end));
  const script=`import subprocess,time,math,hashlib,sys\nfrom pathlib import Path\nfrom datetime import datetime,timezone,timedelta\n${helper}\nroot=Path(${JSON.stringify(root)})\ncli=root/'filmcraft-cli'\ncli.write_text('#!'+sys.executable+'\\nimport time\\ntime.sleep(.2)\\nprint("done")\\n');cli.chmod(0o700)\ncfg={'executable':str(cli),'sha256':hashlib.sha256(cli.read_bytes()).hexdigest(),'deadline':(datetime.now(timezone.utc)+timedelta(seconds=10)).isoformat()}\ntry:subprocess.run([str(cli),'export'],timeout=.05,capture_output=True);assert False\nexcept subprocess.TimeoutExpired:pass\nassert ArtNativeBudget(subprocess,cfg).run([str(cli),'export'],timeout=.05,capture_output=True,text=True).stdout.strip()=='done'\nexpired=ArtNativeBudget(subprocess,{**cfg,'deadline':(datetime.now(timezone.utc)-timedelta(seconds=1)).isoformat()})\ntry:expired.run([str(cli),'export'],timeout=.05);assert False\nexcept subprocess.TimeoutExpired:pass\nprint('passed')\n`;
  const path=join(root,'check.py');await writeFile(path,script);assert.match(execFileSync(process.env.CRAFT_TEST_PYTHON||'python3',['-I','-B',path],{encoding:'utf8'}),/passed/);
 }finally{await rm(root,{recursive:true});}
});
test('only Film adapter binds trusted executable, runtime identity and current request deadline',async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-budget-prepare-'));const sha=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
 try{
  for(const pluginId of ['filmcraft','effectcraft'] as const){
   const skillRoot=join(root,pluginId);await mkdir(join(skillRoot,'scripts'),{recursive:true});
   const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(skillRoot,'scripts',name);await writeFile(path,'fixture');return {path,sha256:sha('fixture')};}));await lockNativeSchema(files,true);
   const executable=join(root,'filmcraft-cli');
   const factory=publicSkillFactory({pluginId,skillRoot,python:process.execPath,pythonSha256:sha(await readFile(process.execPath)),nativeExecutable:executable,runtimeHome:root,files,outputRoot:join(root,'out',pluginId)});
   const runtimeIdentity={pluginId,sha256:'a'.repeat(64),mode:'headless'};
   const node={id:'node',dependsOn:[],projectKey:'project',runtimeIdentity,expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{},assetBindings:[],outputs:[{assetId:'render',location:'movie.mp4',mediaType:'video/mp4'}]}};
   const made=await factory(node as any,[],'task');const deadline='2030-01-01T00:00:00.000Z';
   const prepared=await made.adapter.prepare({runtimeIdentity,deadline,expectedRevision:null} as any);
   const flags=prepared.args.filter(arg=>arg.startsWith('--art-native-budget='));
   if(pluginId==='filmcraft')assert.deepEqual(JSON.parse(flags[0].split('=').slice(1).join('=')),{executable,sha256:runtimeIdentity.sha256,deadline});else assert.deepEqual(flags,[]);
  }
 }finally{await rm(root,{recursive:true});}
});
