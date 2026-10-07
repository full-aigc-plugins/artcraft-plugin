#!/usr/bin/env python3
"""核验固定安装技能的缺失运行时诊断；不安装工具，不改写技能或运行时发行。"""
import argparse
import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/(name+'.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

host = load('verify_codex_host')
completion = load('audit_first_use_completion')

def validate_failure(result, skill, runtime, domain):
    """失败必须保留原始错误，且恢复入口属于当前独立技能。"""
    reply = completion.parse_json(result.stdout)
    if (result.returncode != 1 or not isinstance(reply, dict)
            or not isinstance(reply.get('error'), str) or not reply['error']
            or reply.get('result', 'failed') != 'failed'
            or reply.get('installed', False) is not False):
        raise ValueError('setup_failure_reply_invalid')
    expected = {'skill': domain+'-cli-setup',
                'bootstrapScript': str((skill/'scripts/bootstrap.py').resolve()),
                'runtimeHome': str(runtime.resolve()), 'automaticRetry': False}
    if reply.get('dependencySetup') != expected:
        raise ValueError('setup_failure_not_own_skill')
    return reply

GUARD = '''import json,os,runpy,sys
from pathlib import Path
config=json.loads(Path(sys.argv[1]).read_text());script=config['script'];args=config['args']
blocked=[Path(x) for x in config['blockedRoots']];audit={'deniedReads':0,'networkAttempts':0,'bootstrapProcesses':0}
def hook(event,values):
 if event in ('open','os.listdir','os.scandir') and values and isinstance(values[0],(str,bytes,os.PathLike)):
  p=Path(os.path.abspath(os.fsdecode(values[0])))
  if any(p.is_relative_to(root) for root in blocked):
   audit['deniedReads']+=1;raise RuntimeError('private_or_sibling_read_denied')
 if event=='socket.connect':
  audit['networkAttempts']+=1;raise RuntimeError('unexpected_network_attempt')
 if event=='subprocess.Popen':
  argv=values[1]
  if not isinstance(argv,list) or argv[:4]!=[sys.executable,'-I','-B',config['bootstrap']]:raise RuntimeError('unexpected_native_process')
  audit['bootstrapProcesses']+=1
sys.addaudithook(hook);sys.argv=[script,*args]
try:runpy.run_path(script,run_name='__main__')
finally:Path(config['audit']).write_text(json.dumps(audit))
'''

def verify(lock_path, proof_path, receipt_path, python, output):
    """将当前宿主技能分别复制到独立目录，生成真实失败路径证据。"""
    lock = completion.parse_json(Path(lock_path).read_text())
    proof = completion.parse_json(Path(proof_path).read_text())
    receipt = completion.parse_json(Path(receipt_path).read_text())
    host.validate_lock(lock)
    if (proof.get('result') != 'PASS' or proof.get('hostLock') != lock
            or receipt.get('result') != 'passed' or receipt.get('loadingErrors') != 0):
        raise ValueError('setup_boundary_identity_invalid')
    completion.validate_cold_inventory(lock, proof['current64ColdIdentityProof'])
    python = str(Path(python).resolve(strict=True))
    output = Path(output).absolute()
    sources = []
    for domain, entry in lock['plugins'].items():
        for name, digest in entry['skills'].items():
            source = Path(receipt['skillDirectories'][domain]).with_name(name)
            host.verify_installed_skill(source, entry)
            sources.append((domain, name, digest, source))
    output.mkdir(parents=True, exist_ok=False)
    guard = output/'audit_guard.py'; guard.write_text(GUARD)
    blocked = [str(Path(receipt['skillDirectories'][n]).parent.parent.resolve()) for n in host.NAMES]
    environment = {k:v for k,v in os.environ.items() if not k.startswith('CRAFT_')}
    environment['PATH'] = '/usr/bin:/bin'

    def one(item):
        domain, name, digest, source = item
        case = output/name; skill = case/'.agents/skills'/name
        shutil.copytree(source, skill)
        if {p.name for p in skill.parent.iterdir()} != {name} or host.skill_hash(skill) != digest:
            raise ValueError('setup_boundary_copy_invalid')
        if domain == 'artcraft':
            text = (skill/'SKILL.md').read_text()
            if 'Node' not in text or '编排' not in text:
                raise ValueError('art_runtime_dependency_undeclared')
        records = []
        for script in ('bootstrap.py','cli.py'):
            runtime = case/(script+' 空运行时'); archive = case/'unavailable-pinned-archive'
            if runtime.exists() or archive.exists(): raise ValueError('setup_boundary_not_cold')
            flag = '--node-archive' if domain == 'artcraft' else '--archive'
            args = ['--runtime-home', str(runtime), flag, str(archive)]
            if script == 'cli.py': args += ['--','--version']
            audit = case/(script+'.audit.json'); config = case/(script+'.config.json')
            config.write_text(json.dumps({'script':str(skill/'scripts'/script),'args':args,
                'bootstrap':str(skill/'scripts/bootstrap.py'),'blockedRoots':blocked,'audit':str(audit)}))
            result = subprocess.run([python,'-I','-B',str(guard),str(config)],cwd=case,env=environment,
                                    capture_output=True,text=True,timeout=45)
            (case/(script+'.stdout')).write_text(result.stdout)
            (case/(script+'.stderr')).write_text(result.stderr)
            reply = validate_failure(result, skill, runtime, domain)
            observed = json.loads(audit.read_text())
            expected_processes = 1 if domain == 'artcraft' and script == 'cli.py' else 0
            if (str(archive) not in reply['error'] or observed !=
                    {'deniedReads':0,'networkAttempts':0,'bootstrapProcesses':expected_processes}
                    or any(runtime.rglob('installation.json'))):
                raise ValueError('setup_boundary_wrong_failure_or_side_effect')
            records.append({'entry':script,'exitCode':result.returncode,
                'error':reply['error'].replace(str(case),'$CASE'),
                'ownBootstrapRelativePath':'scripts/bootstrap.py','automaticRetry':False,
                'runtimeAbsentBefore':True,'installedAfter':False,'audit':observed})
        if host.skill_hash(skill) != digest or host.skill_hash(source) != digest:
            raise ValueError('setup_boundary_skill_changed')
        return {'pluginId':domain,'skill':name,'sha256':digest,'singleSkill':True,
                'installedSourceUnchanged':True,'copiedSkillUnchanged':True,'cases':records}

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(one, sources))
    for domain, name, digest, source in sources:
        host.verify_installed_skill(source,lock['plugins'][domain])
    value = {'schema':'craft-fixed-setup-boundary/v1','result':'PASS','hostLock':lock,
        'skills':len(records),'failedEntryCases':2*len(records),'records':records,
        'positiveColdProof':proof['current64ColdIdentityProof'],
        'scope':'fixed installed single-skill missing runtime plus explicitly unavailable archive; correct self setup diagnostic, no retry or native process; Python audit denies reads/enumeration of original plugin trees',
        'excluded':['generic Skills CLI installation','all runtime failures','model/GUI/creative/full V1 acceptance']}
    (output/'evidence.json').write_text(json.dumps(value,indent=2)+'\n')
    return value

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lock',required=True,type=Path)
    parser.add_argument('--proof',required=True,type=Path)
    parser.add_argument('--host-receipt',required=True,type=Path)
    parser.add_argument('--python',default=sys.executable)
    parser.add_argument('--output',required=True,type=Path)
    args = parser.parse_args()
    result = verify(args.lock,args.proof,args.host_receipt,args.python,args.output)
    print(json.dumps({k:result[k] for k in ('result','skills','failedEntryCases')}))

if __name__ == '__main__':
    main()
