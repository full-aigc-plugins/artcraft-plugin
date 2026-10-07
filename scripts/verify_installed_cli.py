#!/usr/bin/env python3
"""以现有 Python 验证宿主固定技能的独立公开 CLI；不安装通用工具。"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parents[1]
def host_module():
 spec=importlib.util.spec_from_file_location('craft_host_verifier',Path(__file__).with_name('verify_codex_host.py'))
 result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result

def matches_version(text,expected):
 return re.search(r'(?<![0-9A-Za-z.-])'+re.escape(expected)+r'(?![0-9A-Za-z.-])',text) is not None

def evidence_scope(records,domains):
 return f'{len(records)} separately copied single skills; existing selected Python; {len(domains)} fresh public domain caches, later probes reuse each domain cache; system-only native PATH'

def verify(python,lock_path,receipt_path,output):
 python=Path(python)
 if not python.is_file():raise ValueError('existing_python_required')
 python=python.resolve(strict=True);host=host_module();lock=json.loads(Path(lock_path).read_text());host.validate_lock(lock)
 receipt=json.loads(Path(receipt_path).read_text());directories=receipt.get('skillDirectories',{})
 if receipt.get('schema')!='craft-codex-host-evidence/v2' or receipt.get('result')!='passed' or set(directories)!=set(host.NAMES):raise ValueError('installed_cli_receipt_invalid')
 # 校验全部来源后才创建验收目录或调用领域安装器。
 for name,use in directories.items():
  for skill in lock['plugins'][name]['skills']:host.verify_installed_skill(Path(use).with_name(skill),lock['plugins'][name])
 output=Path(output).absolute();output.mkdir(mode=0o700)
 environment={**os.environ,'PATH':'/usr/bin:/bin'}
 # 排除验收调用者的离线归档覆盖，首次依赖来自各技能的固定公开锁。
 for key in ('CRAFT_RUNTIME_HOME','CRAFT_NODE_ARCHIVE','CRAFT_BUNDLE_DIRECTORY','CRAFT_NATIVE_ARCHIVE_DIRECTORY'):environment.pop(key,None)
 def run(arguments):
  result=subprocess.run(list(map(str,arguments)),env=environment,capture_output=True,text=True,timeout=600)
  if result.returncode:raise RuntimeError('installed_cli_call_failed: '+result.stdout[-2000:]+result.stderr[-2000:])
  return result.stdout.strip()
 python_version=run([python,'--version']);records=[];start=time.monotonic()
 for name in host.NAMES:
  entry=lock['plugins'][name];runtime=output/'runtimes'/name
  for index,skill_name in enumerate(sorted(entry['skills'])):
   source=Path(directories[name]).with_name(skill_name)
   destination=output/'projects'/skill_name/'.agents/skills'/skill_name
   shutil.copytree(source,destination)
   if {p.name for p in destination.parent.iterdir()}!={skill_name} or host.skill_hash(destination)!=entry['skills'][skill_name]:raise ValueError('isolated_cli_skill_drift')
   scripts=destination/'scripts'
   native_lock=json.loads((scripts/('distribution.lock.json' if name=='artcraft' else 'runtime.lock.json')).read_text())
   expected=native_lock['bundles']['artcraft-runtime']['version'] if name=='artcraft' else native_lock['resolvedVersion']
   argv=[python,'-I','-B',scripts/'cli.py','--runtime-home',runtime,'--']
   version=run([*argv,'--version'])
   if not matches_version(version,expected):raise ValueError('installed_cli_runtime_version_mismatch: '+skill_name)
   catalog_count=None
   if skill_name==name+'-cli':
    if name=='artcraft':
     help_text=run([*argv,'--help'])
     if 'run' not in help_text or 'package' not in help_text:raise ValueError('installed_cli_help_missing')
    else:
     catalog=json.loads(run([*argv,'commands',*(['--json'] if name!='vectorcraft' else [])]))
     if not isinstance(catalog,list) or not catalog or any(not isinstance(row,dict) or not row.get('id') for row in catalog):raise ValueError('installed_cli_catalog_invalid')
     catalog_count=len(catalog)
   if host.skill_hash(destination)!=entry['skills'][skill_name] or any(destination.rglob('*.pyc')):raise ValueError('isolated_cli_skill_changed')
   records.append({'plugin':name,'skill':skill_name,'skillSha256':entry['skills'][skill_name],'runtimeVersion':expected,'actualVersion':version,'installation':'fresh-domain-cache' if index==0 else 'verified-domain-cache-reuse','catalogCommands':catalog_count})
 for name,use in directories.items():
  for skill in lock['plugins'][name]['skills']:host.verify_installed_skill(Path(use).with_name(skill),lock['plugins'][name])
 result={'schema':'craft-installed-cli-evidence/v1','result':'passed','pythonVersion':python_version,'platform':os.uname().sysname.lower()+'-'+os.uname().machine,'skills':records,'versionProbes':len(records),'freshDomainCaches':len(host.NAMES),'sourceHashesAfterUse':'unchanged','seconds':round(time.monotonic()-start,3),'scope':evidence_scope(records,host.NAMES),'unverified':['actual npx independent installation','agent model dispatch','native creative workflows have separate evidence','GUI','human acceptance']}
 (output/'receipt.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');return result

def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--python',type=Path,default=Path(sys.executable));parser.add_argument('--lock',type=Path,default=ROOT/'host-acceptance-art99.lock.json');parser.add_argument('--receipt',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
 result=verify(args.python,args.lock,args.receipt,args.output);print(json.dumps({'result':result['result'],'versionProbes':result['versionProbes'],'pythonVersion':result['pythonVersion'],'seconds':result['seconds']}))
if __name__=='__main__':main()
