#!/usr/bin/env python3
"""完整领域命令的Art公开交接组件；回执通过不是DAG交付完成。"""
import importlib.util
import argparse,hashlib,json,os,re,subprocess,sys,tempfile
from pathlib import Path
SPEC_PUBLIC = importlib.util.spec_from_file_location('craft_public_call', Path(__file__).with_name('public_call.py'))
P = importlib.util.module_from_spec(SPEC_PUBLIC)
SPEC_PUBLIC.loader.exec_module(P)
ROOT=Path(__file__).resolve().parent.parent
NAMES=('filmcraft','effectcraft','photocraft','vectorcraft')
COUNTS=dict(zip(NAMES,(666,640,755,585)))
MARKER='artcraft-command-call.json'
def sha(path):
 with Path(path).open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def json_value(text):
 def unique(pairs):
  result={}
  for key,value in pairs:
   if key in result:raise ValueError('duplicate_json_key')
   result[key]=value
  return result
 value=json.loads(text,object_pairs_hook=unique,parse_constant=lambda v:(_ for _ in ()).throw(ValueError('invalid_json_number')))
 json.dumps(value,allow_nan=False)
 return value
def load_index():
 index=json_value((ROOT/'references/domain-command-index.json').read_text());lock=json_value((ROOT/'scripts/distribution.lock.json').read_text())
 if index.get('schema')!='artcraft-domain-command-index/v1' or set(index.get('domains',{}))!=set(NAMES):raise ValueError('command_index_invalid')
 result={}
 for domain in NAMES:
  value=index['domains'][domain];bundle=lock['bundles'][domain+'-skills'];key='skills/'+domain+'-use/references/command-coverage.json'
  if (value.get('version')!=bundle['version'] or value.get('sourceCommit')!=bundle['sourceCommit'] or value.get('bundleSha256')!=bundle['sha256'] or hashlib.sha256(value['catalogText'].encode()).hexdigest()!=bundle['files'][key]):raise ValueError('command_index_identity')
  snapshot_key='skills/'+domain+'-use/references/native-command-snapshot.json'
  if hashlib.sha256(value['snapshotText'].encode()).hexdigest()!=bundle['files'][snapshot_key]:raise ValueError('command_index_identity')
  snapshot=json_value(value['snapshotText']);catalog=json_value(value['catalogText']);rows=catalog['commands']
  if snapshot.get('pluginId')!=domain or not isinstance(snapshot.get('tools'),list) or {item['name'] for item in snapshot['tools']}!=set(catalog['nativeTools']):raise ValueError('command_index_invalid')
  if catalog['pluginId']!=domain or len(rows)!=COUNTS[domain] or len({row['id'] for row in rows})!=len(rows):raise ValueError('command_index_invalid')
  bridge_key='skills/'+domain+'-use/references/bridge-tools.json';bridge_tools=[]
  if ('bridgeSnapshotText' in value)!=(bridge_key in bundle['files']):raise ValueError('command_index_identity')
  if bridge_key in bundle['files']:
   text=value['bridgeSnapshotText']
   if hashlib.sha256(text.encode()).hexdigest()!=bundle['files'][bridge_key]:raise ValueError('command_index_identity')
   bridge=json_value(text);bridge_tools=bridge.get('tools')
   if bridge.get('schema')!='craft-bridge-tools/v1' or bridge.get('pluginId')!=domain or bridge.get('mode')!='bridge' or bridge.get('runtimeSha256')!=snapshot['runtimeSha256'] or not isinstance(bridge_tools,list) or any(not isinstance(t,dict) or not isinstance(t.get('name'),str) or not isinstance(t.get('inputSchema'),dict) for t in bridge_tools) or len({t['name'] for t in bridge_tools})!=len(bridge_tools) or {t['name'] for t in bridge_tools}&set(catalog['nativeTools']):raise ValueError('command_index_invalid')
  result[domain]={**catalog,'domain':domain,'sourceVersion':bundle['version'],'bundleSha256':bundle['sha256'],'catalogSha256':bundle['files'][key],'toolSchemas':snapshot['tools'],'bridgeToolSchemas':bridge_tools}
 return result
def domain_entry(domain):
 if domain not in NAMES:raise ValueError('domain_unsupported')
 return load_index()[domain]
def tool_schemas(entry,mode='headless'):
 if mode not in ['headless','bridge','desktop']:raise ValueError('invalid_mode')
 return entry['toolSchemas']+(entry.get('bridgeToolSchemas',[]) if mode in ['bridge','desktop'] else [])
def validate_plan(plan,entry,inputs,mode='headless'):
 if not isinstance(plan,dict) or set(plan)!={'schema','operations'} or plan['schema']!='craft-command-plan/v1' or not isinstance(plan['operations'],list) or not 1<=len(plan['operations'])<=1000:raise ValueError('invalid_command_plan')
 aliases={'output',*inputs};commands={row['id'] for row in entry['commands']};tools={t['name'] for t in tool_schemas(entry,mode)}
 def references(value):
  if isinstance(value,dict):
   if set(value)=={'$ref'}:
    text=value['$ref']
    if not isinstance(text,str) or not re.fullmatch(r'[a-zA-Z][\w-]*(?:\.[\w-]+)*',text) or text.split('.')[0] not in aliases:raise ValueError('invalid_reference')
   elif set(value)=={'$output'}:
    text=value['$output']
    if not isinstance(text,str) or not text or Path(text).is_absolute() or '\\' in text or any(x in ('','.','..') for x in text.split('/')) or text.split('/')[0] in {MARKER,'journal.json','success.json','failure.json','inputs','tool-images','desktop-session.json','desktop.log','.desktop-data'}:raise ValueError('invalid_output_path')
   else:
    for child in value.values():references(child)
  elif isinstance(value,list):
   for child in value:references(child)
 for step in plan['operations']:
  if not isinstance(step,dict) or set(step)-{'command','tool','params','as'} or ('command' in step)==('tool' in step) or not isinstance(step.get('params'),dict):raise ValueError('invalid_operation')
  kind='command' if 'command' in step else 'tool'
  if kind=='tool' and mode=='headless' and isinstance(step[kind],str) and step[kind] in {t['name'] for t in entry.get('bridgeToolSchemas',[])}:raise ValueError('bridge_tool_requires_bridge')
  if not isinstance(step[kind],str) or step[kind] not in (commands if kind=='command' else tools):raise ValueError('unknown_'+kind)
  json.dumps(step['params'],allow_nan=False);references(step['params'])
  if 'as' in step:
   name=step['as']
   if not isinstance(name,str) or not re.fullmatch(r'[a-zA-Z][\w-]*',name) or name in aliases:raise ValueError('invalid_alias')
   aliases.add(name)
def validate_receipt(value,domain,plan,runtime_sha,catalog_sha):
 expected=hashlib.sha256(json.dumps(plan,ensure_ascii=False,sort_keys=True,allow_nan=False).encode()).hexdigest()
 if not isinstance(value,dict) or value.get('schema')!='craft-command-receipt/v1' or value.get('pluginId')!=domain or value.get('result')!='PASS' or value.get('planSha256')!=expected or value.get('runtimeSha256')!=runtime_sha or value.get('catalogSha256')!=catalog_sha or not isinstance(value.get('steps'),list) or len(value['steps'])!=len(plan['operations']):raise ValueError('outcome_unknown: command_receipt_identity')
 for index,(step,record) in enumerate(zip(plan['operations'],value['steps'])):
  if not isinstance(record,dict) or record.get('index')!=index or record.get('state')!='succeeded' or record.get('command')!=step.get('command') or record.get('tool')!=step.get('tool'):raise ValueError('outcome_unknown: command_receipt_step')
def installed_files(receipt,domain,lock):
 if set(receipt.get('skills',{}))!={domain}:raise ValueError('selected_domain_identity')
 entry=receipt['skills'][domain];root=Path(entry['skillRoot']);bundle=lock['bundles'][domain+'-skills'];prefix='skills/'+domain+'-use/';identity=entry['runtimeIdentity']
 if identity.get('pluginId')!=domain or identity.get('pluginVersion')!=bundle['version']:raise ValueError('selected_domain_identity')
 protected={}
 for relative,expected in bundle['files'].items():
  if not relative.startswith(prefix):continue
  path=root/relative[len(prefix):]
  if path.is_symlink() or not path.is_file() or sha(path)!=expected:raise ValueError('domain_file_identity')
  protected[str(path)]=expected
 executable=Path(entry['executable']);native=json_value((root/'scripts/runtime.lock.json').read_text());expected=native['artifacts']['darwin-arm64']['binarySha256']
 if executable.is_symlink() or sha(executable)!=expected or identity.get('sha256')!=expected:raise ValueError('native_runtime_identity')
 protected[str(executable)]=expected
 return root,expected,protected
def parser():
 p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='action',required=True)
 q=sub.add_parser('list');q.add_argument('--domain',choices=NAMES);q.add_argument('--filter',default='');q.add_argument('--tools',action='store_true')
 q=sub.add_parser('describe');q.add_argument('domain',choices=NAMES);q.add_argument('command');q.add_argument('--tool',action='store_true')
 for name in ['list','describe']:sub.choices[name].add_argument('--mode',choices=['headless','bridge','desktop'],default='headless')
 for action in ['check','run']:
  q=sub.add_parser(action);q.add_argument('domain',choices=NAMES);q.add_argument('plan',type=Path);q.add_argument('--input',action='append',default=[])
  q.add_argument('--runtime-home',type=Path,default=Path(os.environ.get('CRAFT_RUNTIME_HOME',str(Path.home()/'.local/share/craft-runtimes'))))
  q.add_argument('--mode',choices=['headless','bridge','desktop'],default='headless')
  if action=='run':
   q.add_argument('--output',type=Path,required=True);q.add_argument('--connect');q.add_argument('--control-token-file',type=Path)
 return p
def launch_command(root,args,frozen,runtime_home,inputs):
 desktop=args.action=='run' and args.mode=='desktop'
 command=[sys.executable,'-I','-B',str(root/'scripts'/('desktop.py' if desktop else 'commands.py')),args.action,str(frozen)]
 for name,path in inputs.items():command+=['--input',name+'='+str(path)]
 if args.action=='run':
  command+=['--output',str(args.output),'--runtime-home',runtime_home]
  if not desktop:
   command+=['--mode',args.mode]
   if args.connect is not None:command+=['--connect',args.connect]
   if args.control_token_file is not None:command+=['--control-token-file',str(args.control_token_file)]
 elif args.domain=='effectcraft':command+=['--mode','bridge' if args.mode=='desktop' else args.mode]
 if args.action=='run' and args.mode=='headless':
  command=command[:3]+[str(ROOT/'scripts/native_contract.py'),str(root/'scripts/mcp_session.py')]+command[3:]
 return command

def check_reply(returncode,stdout,stderr,runtime_home):
 # 固定领域版本的结构检查参数不同；保留拒绝原因，不能把非零退出当 JSON 成功。
 if len(stdout)>65536:raise ValueError('command_check_reply_too_large')
 try:result=json_value(stdout)
 except ValueError:result=None
 if returncode or not isinstance(result,dict) or result.get('result')!='PASS' or result.get('nativeExecution')!='NOT_RUN':
  error=P.PublicCallFailure('command_check_failed',result,runtime_home)
  error.diagnostic['domainCall']={'returncode':returncode,'stdout':stdout.decode('utf-8',errors='replace'),'stderr':stderr[:65536].decode('utf-8',errors='replace')}
  raise error
 return result

def validate_desktop_receipt(desktop_proof,domain,result,lock,returncode):
 if not isinstance(desktop_proof,dict) or desktop_proof.get('schema')!='craft-owned-desktop-session/v1' or desktop_proof.get('domain')!=domain or desktop_proof.get('result')!=result or desktop_proof.get('ownedProcessesStopped') is not True or not isinstance(desktop_proof.get('desktop'),dict) or desktop_proof['desktop'].get('binarySha256')!=lock['binarySha256'] or desktop_proof['desktop'].get('version')!=lock['version']:raise ValueError('outcome_unknown: desktop_receipt_identity')
 if returncode==0 and (desktop_proof.get('listenerOwnedByPID') is not True or desktop_proof.get('sessionsStarted')!=1):raise ValueError('outcome_unknown: desktop_session_ownership')

def dispatch(args):
 index=load_index()
 if args.action=='list':return [{'domain':domain,**row} for domain,entry in index.items() if not args.domain or domain==args.domain for row in (tool_schemas(entry,args.mode) if args.tools else entry['commands']) if args.filter.lower() in ((row['name']+' '+row.get('description','')) if args.tools else row['id']+' '+row['label']).lower()],0
 entry=index[args.domain]
 if args.action=='describe':
  matches=[row for row in (tool_schemas(entry,args.mode) if args.tool else entry['commands']) if row['name' if args.tool else 'id']==args.command]
  if not matches:raise ValueError('unknown_command')
  return {'domain':args.domain,**matches[0]},0
 plan_bytes=args.plan.read_bytes();plan=json_value(plan_bytes);inputs={};input_hashes={}
 for item in args.input:
  name,separator,path=item.partition('=');source=Path(path).absolute()
  if not separator or not re.fullmatch(r'[a-zA-Z][\w-]*',name) or name=='output' or name in inputs or source.is_symlink() or not source.is_file():raise ValueError('invalid_input')
  inputs[name]=source;input_hashes[name]=sha(source)
 validate_plan(plan,entry,inputs,mode=args.mode)
 if args.action=='run':
  if args.mode=='desktop' and (args.connect is not None or args.control_token_file is not None):raise ValueError('desktop_owns_connection')
  args.output=args.output.absolute()
  if args.output.exists() or args.output.is_symlink():raise ValueError('output_exists')
  if not args.output.parent.is_dir():raise ValueError('output_parent_missing')
 lock=json_value((ROOT/'scripts/distribution.lock.json').read_text())
 receipt=P.run([sys.executable,'-I','-B',str(ROOT/'scripts/bootstrap.py'),'--runtime-home',str(args.runtime_home),'--plugin',args.domain], 'domain_setup_failed: ', args.runtime_home, parser=json_value, installation=True)
 root,runtime_sha,protected=installed_files(receipt,args.domain,lock)
 def preserved():
  if any(Path(path).is_symlink() or sha(path)!=expected for path,expected in protected.items()):raise ValueError('outcome_unknown: installed_identity_changed')
  if any(sha(inputs[name])!=expected for name,expected in input_hashes.items()):raise ValueError('outcome_unknown: input_changed')
 preserved()
 with tempfile.TemporaryDirectory(prefix='art-domain-command-') as temporary:
  temporary=Path(temporary);frozen=temporary/'plan.json';frozen.write_bytes(plan_bytes)
  command=launch_command(root,args,frozen,receipt['runtimeHome'],inputs)
  with (temporary/'stdout').open('wb') as stdout,(temporary/'stderr').open('wb') as stderr:child=subprocess.run(command,stdout=stdout,stderr=stderr)
  preserved()
  if args.action=='check':
   with (temporary/'stdout').open('rb') as stream:text=stream.read(65537)
   with (temporary/'stderr').open('rb') as stream:errors=stream.read(65536)
   result=check_reply(child.returncode,text,errors,args.runtime_home)
   return {'schema':'artcraft-domain-command-call/v1','domain':args.domain,'result':'PASS','phase':'structure-check','nativeExecution':'NOT_RUN','dagDeliveryAcceptance':'NOT_RUN','sourceBundleSha256':entry['bundleSha256'],'commandReceipt':result},0
  evidence=args.output/('success.json' if child.returncode==0 else 'failure.json')
  if evidence.is_symlink() or not evidence.is_file() or evidence.stat().st_size>16*1024*1024:raise ValueError('outcome_unknown: command_receipt_missing')
  result=json_value(evidence.read_bytes())
  expected_plan=hashlib.sha256(json.dumps(plan,ensure_ascii=False,sort_keys=True,allow_nan=False).encode()).hexdigest()
  if (not isinstance(result,dict) or result.get('planSha256')!=expected_plan or result.get('runtimeSha256')!=runtime_sha or result.get('catalogSha256')!=entry['catalogSha256'] or result.get('mode')!=('bridge' if args.mode=='desktop' else args.mode) or not isinstance(result.get('inputs'),dict) or set(result['inputs'])!=set(inputs) or any(result['inputs'][name].get('sha256')!=input_hashes[name] for name in inputs)):raise ValueError('outcome_unknown: command_receipt_identity')
  desktop_proof=None
  if args.mode=='desktop':
   path=args.output/'desktop-session.json'
   if path.is_symlink() or not path.is_file() or path.stat().st_size>1024*1024:raise ValueError('outcome_unknown: desktop_receipt_missing')
   desktop_proof=json_value(path.read_bytes());desktop_lock=json_value((root/'scripts/desktop.lock.json').read_text())
   validate_desktop_receipt(desktop_proof,args.domain,result['result'],desktop_lock,child.returncode)
  if child.returncode==0:validate_receipt(result,args.domain,plan,runtime_sha,entry['catalogSha256'])
  else:
   if not isinstance(result,dict) or result.get('schema')!='craft-command-receipt/v1' or result.get('pluginId')!=args.domain or result.get('result') not in ['FAIL','unknown']:raise ValueError('outcome_unknown: invalid_failure_receipt')
  value={'schema':'artcraft-domain-command-call/v1','domain':args.domain,'result':result['result'],'phase':'native-call-only','dagDeliveryAcceptance':'NOT_RUN','sourceBundleSha256':entry['bundleSha256'],'runtimeSha256':runtime_sha,'commandReceiptSha256':sha(evidence),'commandReceiptLocation':evidence.name,'commandReceipt':result}
  if desktop_proof is not None:value['desktopReceiptSha256']=sha(args.output/'desktop-session.json');value['desktopReceipt']=desktop_proof
  with (args.output/MARKER).open('x') as output:output.write(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
  return value,child.returncode
if __name__=='__main__':
 try:
  result,code=dispatch(parser().parse_args());print(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False));raise SystemExit(code)
 except (ValueError,RuntimeError,OSError,subprocess.SubprocessError,KeyError,TypeError) as error:
  reply={'error':str(error)}
  if isinstance(error,P.PublicCallFailure):reply.update(error.diagnostic)
  print(json.dumps(reply,ensure_ascii=False));raise SystemExit(1)
