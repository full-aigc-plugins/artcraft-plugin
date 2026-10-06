#!/usr/bin/env python3
"""完整领域命令的Art公开交接组件；回执通过不是DAG交付完成。"""
import argparse,hashlib,json,os,re,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
NAMES=('filmcraft','effectcraft','photocraft','vectorcraft')
COUNTS=dict(zip(NAMES,(666,640,748,585)))
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
  result[domain]={**catalog,'domain':domain,'sourceVersion':bundle['version'],'bundleSha256':bundle['sha256'],'catalogSha256':bundle['files'][key],'toolSchemas':snapshot['tools']}
 return result
def domain_entry(domain):
 if domain not in NAMES:raise ValueError('domain_unsupported')
 return load_index()[domain]
def validate_plan(plan,entry,inputs):
 if not isinstance(plan,dict) or set(plan)!={'schema','operations'} or plan['schema']!='craft-command-plan/v1' or not isinstance(plan['operations'],list) or not 1<=len(plan['operations'])<=1000:raise ValueError('invalid_command_plan')
 aliases={'output',*inputs};commands={row['id'] for row in entry['commands']};tools=set(entry['nativeTools'])
 def references(value):
  if isinstance(value,dict):
   if set(value)=={'$ref'}:
    text=value['$ref']
    if not isinstance(text,str) or not re.fullmatch(r'[a-zA-Z][\w-]*(?:\.[\w-]+)*',text) or text.split('.')[0] not in aliases:raise ValueError('invalid_reference')
   elif set(value)=={'$output'}:
    text=value['$output']
    if not isinstance(text,str) or not text or Path(text).is_absolute() or '\\' in text or any(x in ('','.','..') for x in text.split('/')) or text.split('/')[0] in {MARKER,'journal.json','success.json','failure.json','inputs','tool-images'}:raise ValueError('invalid_output_path')
   else:
    for child in value.values():references(child)
  elif isinstance(value,list):
   for child in value:references(child)
 for step in plan['operations']:
  if not isinstance(step,dict) or set(step)-{'command','tool','params','as'} or ('command' in step)==('tool' in step) or not isinstance(step.get('params'),dict):raise ValueError('invalid_operation')
  kind='command' if 'command' in step else 'tool'
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
 for action in ['check','run']:
  q=sub.add_parser(action);q.add_argument('domain',choices=NAMES);q.add_argument('plan',type=Path);q.add_argument('--input',action='append',default=[])
  q.add_argument('--runtime-home',type=Path,default=Path(os.environ.get('CRAFT_RUNTIME_HOME',str(Path.home()/'.local/share/craft-runtimes'))))
  if action=='run':
   q.add_argument('--output',type=Path,required=True);q.add_argument('--mode',choices=['headless','bridge'],default='headless');q.add_argument('--connect');q.add_argument('--control-token-file',type=Path)
 return p
def dispatch(args):
 index=load_index()
 if args.action=='list':return [{'domain':domain,**row} for domain,entry in index.items() if not args.domain or domain==args.domain for row in (entry['toolSchemas'] if args.tools else entry['commands']) if args.filter.lower() in ((row['name']+' '+row.get('description','')) if args.tools else row['id']+' '+row['label']).lower()],0
 entry=index[args.domain]
 if args.action=='describe':
  matches=[row for row in (entry['toolSchemas'] if args.tool else entry['commands']) if row['name' if args.tool else 'id']==args.command]
  if not matches:raise ValueError('unknown_command')
  return {'domain':args.domain,**matches[0]},0
 plan_bytes=args.plan.read_bytes();plan=json_value(plan_bytes);inputs={};input_hashes={}
 for item in args.input:
  name,separator,path=item.partition('=');source=Path(path).absolute()
  if not separator or not re.fullmatch(r'[a-zA-Z][\w-]*',name) or name=='output' or name in inputs or source.is_symlink() or not source.is_file():raise ValueError('invalid_input')
  inputs[name]=source;input_hashes[name]=sha(source)
 validate_plan(plan,entry,inputs)
 if args.action=='run':
  args.output=args.output.absolute()
  if args.output.exists() or args.output.is_symlink():raise ValueError('output_exists')
  if not args.output.parent.is_dir():raise ValueError('output_parent_missing')
 lock=json_value((ROOT/'scripts/distribution.lock.json').read_text())
 boot=subprocess.run([sys.executable,'-I','-B',str(ROOT/'scripts/bootstrap.py'),'--runtime-home',str(args.runtime_home),'--plugin',args.domain],capture_output=True,text=True)
 if boot.returncode:raise ValueError('domain_setup_failed: '+boot.stdout.strip())
 receipt=json_value(boot.stdout);root,runtime_sha,protected=installed_files(receipt,args.domain,lock)
 def preserved():
  if any(Path(path).is_symlink() or sha(path)!=expected for path,expected in protected.items()):raise ValueError('outcome_unknown: installed_identity_changed')
  if any(sha(inputs[name])!=expected for name,expected in input_hashes.items()):raise ValueError('outcome_unknown: input_changed')
 preserved()
 with tempfile.TemporaryDirectory(prefix='art-domain-command-') as temporary:
  temporary=Path(temporary);frozen=temporary/'plan.json';frozen.write_bytes(plan_bytes)
  command=[sys.executable,'-I','-B',str(root/'scripts/commands.py'),args.action,str(frozen)]
  for name,path in inputs.items():command+=['--input',name+'='+str(path)]
  if args.action=='run':
   command+=['--output',str(args.output),'--runtime-home',receipt['runtimeHome'],'--mode',args.mode]
   if args.connect is not None:command+=['--connect',args.connect]
   if args.control_token_file is not None:command+=['--control-token-file',str(args.control_token_file)]
  with (temporary/'stdout').open('wb') as stdout,(temporary/'stderr').open('wb') as stderr:child=subprocess.run(command,stdout=stdout,stderr=stderr)
  preserved()
  if args.action=='check':
   text=(temporary/'stdout').read_bytes()
   if len(text)>65536:raise ValueError('command_check_reply_too_large')
   result=json_value(text)
   if child.returncode or not isinstance(result,dict) or result.get('result')!='PASS' or result.get('nativeExecution')!='NOT_RUN':raise ValueError('command_check_failed')
   return {'schema':'artcraft-domain-command-call/v1','domain':args.domain,'result':'PASS','phase':'structure-check','nativeExecution':'NOT_RUN','dagDeliveryAcceptance':'NOT_RUN','sourceBundleSha256':entry['bundleSha256'],'commandReceipt':result},0
  evidence=args.output/('success.json' if child.returncode==0 else 'failure.json')
  if evidence.is_symlink() or not evidence.is_file() or evidence.stat().st_size>16*1024*1024:raise ValueError('outcome_unknown: command_receipt_missing')
  result=json_value(evidence.read_bytes())
  expected_plan=hashlib.sha256(json.dumps(plan,ensure_ascii=False,sort_keys=True,allow_nan=False).encode()).hexdigest()
  if (not isinstance(result,dict) or result.get('planSha256')!=expected_plan or result.get('runtimeSha256')!=runtime_sha or result.get('catalogSha256')!=entry['catalogSha256'] or result.get('mode')!=args.mode or not isinstance(result.get('inputs'),dict) or set(result['inputs'])!=set(inputs) or any(result['inputs'][name].get('sha256')!=input_hashes[name] for name in inputs)):raise ValueError('outcome_unknown: command_receipt_identity')
  if child.returncode==0:validate_receipt(result,args.domain,plan,runtime_sha,entry['catalogSha256'])
  else:
   if not isinstance(result,dict) or result.get('schema')!='craft-command-receipt/v1' or result.get('pluginId')!=args.domain or result.get('result') not in ['FAIL','unknown']:raise ValueError('outcome_unknown: invalid_failure_receipt')
  value={'schema':'artcraft-domain-command-call/v1','domain':args.domain,'result':result['result'],'phase':'native-call-only','dagDeliveryAcceptance':'NOT_RUN','sourceBundleSha256':entry['bundleSha256'],'runtimeSha256':runtime_sha,'commandReceiptSha256':sha(evidence),'commandReceiptLocation':evidence.name,'commandReceipt':result}
  with (args.output/MARKER).open('x') as output:output.write(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
  return value,child.returncode
if __name__=='__main__':
 try:
  result,code=dispatch(parser().parse_args());print(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False));raise SystemExit(code)
 except (ValueError,OSError,subprocess.SubprocessError,KeyError,TypeError) as error:
  print(json.dumps({'error':str(error)},ensure_ascii=False));raise SystemExit(1)
