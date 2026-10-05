#!/usr/bin/env python3
"""在新建隔离配置中安装固定发布、核验技能源并读取真实 app-server 技能发现结果。"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import subprocess
import tempfile
import threading
import time

NAMES=('filmcraft','effectcraft','photocraft','vectorcraft','artcraft')

def skill_hash(root):
    digest=hashlib.sha256()
    for path in sorted(p for p in root.rglob('*') if p.is_file()):
        if path.is_symlink():raise ValueError('host_skill_symlink')
        digest.update(path.relative_to(root).as_posix().encode());digest.update(b'\0')
        digest.update(hashlib.sha256(path.read_bytes()).hexdigest().encode());digest.update(b'\n')
    return digest.hexdigest()


def verify_installed_skill(directory,expected):
    directory=Path(directory);plugin=directory.parent.parent
    for path in [plugin/'plugin.json',plugin/'skills.lock.json']:
        if path.is_symlink() or not path.is_file():raise ValueError('host_installed_metadata_invalid')
    installed=json.loads((plugin/'plugin.json').read_text());sources=json.loads((plugin/'skills.lock.json').read_text()).get('sources',[])
    if len(sources)!=1:raise ValueError('host_installed_skill_identity_mismatch')
    source=sources[0]
    expected_hash=expected.get('skills',{}).get(directory.name,expected['skillSha256'])
    if hashlib.sha256((plugin/'plugin.json').read_bytes()).hexdigest()!=expected['pluginManifestSha256'] or installed['version']!=expected['version'] or source['ref']!=expected['skillSourceRef'] or source['sha']!=expected['skillSourceSha'] or source['sha256'][directory.name]!=expected_hash or skill_hash(directory)!=expected_hash:raise ValueError('host_installed_skill_identity_mismatch')
    return installed,source


def discover(codex,root,environment):
    with tempfile.TemporaryFile(mode='w+') as errors:
        process=subprocess.Popen([codex,'app-server','--stdio'],cwd=root,env=environment,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=errors,text=True,bufsize=1)
        messages=queue.Queue()
        def reader():
            for line in process.stdout:
                try:messages.put(json.loads(line))
                except json.JSONDecodeError:messages.put({'error':{'message':'host_non_json_response'}})
            messages.put(None)
        thread=threading.Thread(target=reader,daemon=True);thread.start()
        def request(identifier,method,params):
            process.stdin.write(json.dumps({'id':identifier,'method':method,'params':params})+'\n');process.stdin.flush()
            deadline=time.monotonic()+45
            while True:
                try:message=messages.get(timeout=max(.01,deadline-time.monotonic()))
                except queue.Empty:raise TimeoutError('host_rpc_timeout')
                if message is None:raise RuntimeError('host_app_server_stopped')
                if message.get('id')==identifier:
                    if 'error' in message:raise RuntimeError('host_rpc_error: '+str(message['error'].get('message','unknown')))
                    return message['result']
        try:
            initialization=request(1,'initialize',{'clientInfo':{'name':'craft-host-acceptance','version':'0.2.0'},'capabilities':{'experimentalApi':True}})
            process.stdin.write(json.dumps({'method':'initialized','params':{}})+'\n');process.stdin.flush()
            skills=request(2,'skills/list',{'cwds':[str(root)],'forceReload':True})
            return initialization,skills
        finally:
            process.stdin.close();process.terminate()
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=10)
            thread.join(timeout=2);process.stdout.close()


def validate_lock(lock):
    if not isinstance(lock,dict) or lock.get('schema')!='craft-host-release-lock/v1' or set(lock.get('plugins',{}))!=set(NAMES):raise ValueError('host_release_lock_invalid')
    for name,entry in lock['plugins'].items():
        if not isinstance(entry,dict) or entry.get('repository')!='https://github.com/full-aigc-plugins/'+name+'-plugin.git' or not re.fullmatch(r'0\.1\.0-dev\.\d+',entry.get('version','')) or entry.get('ref')!='v'+entry['version']:raise ValueError('host_release_identity_invalid')
        for key,length in [('sha',40),('skillSourceSha',40),('skillSha256',64),('pluginManifestSha256',64)]:
            if not isinstance(entry.get(key),str) or not re.fullmatch('[a-f0-9]{'+str(length)+'}',entry[key]):raise ValueError('host_release_identity_invalid')
        if not re.fullmatch(r'v0\.1\.0-dev\.\d+',entry.get('skillSourceRef','')):raise ValueError('host_release_identity_invalid')
        if 'skills' in entry:
            skills=entry['skills']
            if not isinstance(skills,dict) or skills.get(name+'-use')!=entry['skillSha256'] or any(not re.fullmatch(re.escape(name)+r'-[a-z0-9]+(?:-[a-z0-9]+)*',skill) or not isinstance(digest,str) or not re.fullmatch('[a-f0-9]{64}',digest) for skill,digest in skills.items()):raise ValueError('host_skill_suite_identity_invalid')


def verify(codex,lock_path,output):
    codex=str(Path(codex).resolve());lock=json.loads(Path(lock_path).read_text());root=Path(output).absolute()
    validate_lock(lock)
    root.mkdir(mode=0o700) # 不复用或覆盖已有用户目录。
    host=root/'host-config';host.mkdir(mode=0o700)
    environment=os.environ.copy();environment['CODEX_HOME']=str(host) # 只作用于本测试子进程。
    def run(args):
        result=subprocess.run([codex,*args],cwd=root,env=environment,capture_output=True,text=True,timeout=180)
        if result.returncode:raise RuntimeError('host_command_failed: '+args[0])
        return result.stdout
    cli_version=run(['--version']).strip()
    schemas=root/'protocol';run(['app-server','generate-json-schema','--out',str(schemas)])
    if not (schemas/'v2/SkillsListParams.json').is_file() or not (schemas/'v1/InitializeParams.json').is_file():raise ValueError('host_protocol_missing')
    market=root/'market';manifest=market/'.agents/plugins/marketplace.json';manifest.parent.mkdir(parents=True)
    entries=[]
    for name in NAMES:
        entry=lock['plugins'][name]
        remote=subprocess.run(['git','ls-remote',entry['repository'],'refs/tags/'+entry['ref']],check=True,capture_output=True,text=True,timeout=45).stdout.split()
        if not remote or remote[0]!=entry['sha']:raise ValueError('host_release_ref_mismatch')
        entries.append({'name':name,'source':{'source':'url','url':entry['repository'],'ref':entry['ref']},'policy':{'installation':'AVAILABLE','authentication':'ON_USE'},'version':entry['version'],'category':'Creativity'})
    manifest.write_text(json.dumps({'name':'craft-current-host-test','description':'Isolated development acceptance only','owner':{'name':'Full AIGC Plugins'},'plugins':entries}))
    run(['plugin','marketplace','add',str(market),'--json'])
    for name in NAMES:run(['plugin','add',name+'@craft-current-host-test','--json'])
    listed=json.loads(run(['plugin','list','--json']))
    (root/'plugin-list.json').write_text(json.dumps(listed,ensure_ascii=False,indent=2)+'\n')
    initialization,response=discover(codex,root,environment)
    rows=response.get('data',[])
    if any(row.get('errors') for row in rows):raise ValueError('host_skill_loading_errors')
    found={};records=[]
    for name in NAMES:
        expected=lock['plugins'][name];skill_names=expected.get('skills',{name+'-use':expected['skillSha256']});discovered=[]
        actual_names={skill['name'] for row in rows for skill in row.get('skills',[]) if skill.get('name','').startswith(name+':')}
        if actual_names!={name+':'+skill_name for skill_name in skill_names}:raise ValueError('host_skill_suite_inventory_mismatch')
        for skill_name,skill_digest in skill_names.items():
            matches=[skill for row in rows for skill in row.get('skills',[]) if skill.get('name')==name+':'+skill_name and skill.get('enabled')]
            if len(matches)!=1:raise ValueError('host_skill_not_discovered: '+name+':'+skill_name)
            skill=matches[0];directory=Path(skill['path']).resolve().parent
            if not directory.is_relative_to(host.resolve()):raise ValueError('host_skill_outside_isolation')
            installed,source=verify_installed_skill(directory,expected)
            discovered.append({'name':skill['name'],'sha256':skill_digest,'scope':skill.get('scope'),'enabled':True})
            if skill_name==name+'-use':found[name]=str(directory)
        records.append({'pluginId':name,'version':installed['version'],'pluginManifestSha256':expected['pluginManifestSha256'],'sourceSha':expected['sha'],'skillSourceSha':source['sha'],'skillSha256':expected['skillSha256'],'discoveredName':name+':'+name+'-use','scope':skill.get('scope'),'enabled':True,'skills':discovered})
    receipt={'schema':'craft-codex-host-evidence/v2','result':'passed','cliVersion':cli_version,'appServerUserAgent':initialization.get('userAgent'),'platform':os.uname().sysname.lower()+'-'+os.uname().machine,'plugins':records,'loadingErrors':0,'scope':['isolated fixed public-tag install','installed immutable skill content identity','app-server skill discovery'],'skillDirectories':found,'excluded':['agent model dispatch','desktop GUI interaction','production acceptance']}
    (root/'host-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
    return receipt


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--codex',required=True);parser.add_argument('--lock',required=True,type=Path);parser.add_argument('--output',required=True,type=Path);args=parser.parse_args()
    receipt=verify(args.codex,args.lock,args.output);print(json.dumps({key:value for key,value in receipt.items() if key!='skillDirectories'},ensure_ascii=False))
if __name__=='__main__':main()
