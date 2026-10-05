#!/usr/bin/env python3
"""从显式固定发行标签生成宿主矩阵；不读工作树，不隐式选择最新版本。"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import tempfile

def module(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).with_name(name+'.py'))
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result

verifier=module('verify_codex_host')
bundler=module('build_runtime_bundle')
skill_hash=verifier.skill_hash

def release_entry(repository,name,version):
    if name not in verifier.NAMES or not re.fullmatch(r'0\.1\.0-dev\.\d+',version):raise ValueError('immutable_host_version_required')
    with tempfile.TemporaryDirectory(prefix='craft-host-source-') as temporary:
        source=Path(temporary)
        try:sha=bundler.tagged_source(Path(repository),version,source,['plugin.json','skills.lock.json','skills'])
        except Exception as exc:raise ValueError('host_release_tag_invalid') from exc
        manifest_path=source/'plugin.json';manifest=json.loads(manifest_path.read_text());lock=json.loads((source/'skills.lock.json').read_text())
        if manifest.get('name')!=name or manifest.get('version')!=version:raise ValueError('host_release_version_mismatch')
        sources=lock.get('sources',[])
        if len(sources)!=1:raise ValueError('host_source_inventory_invalid')
        entry=sources[0];names=entry.get('skills',[])
        if not isinstance(names,list) or not names or len(names)!=len(set(names)) or any(not re.fullmatch(re.escape(name)+r'-[a-z0-9]+(?:-[a-z0-9]+)*',n) for n in names):raise ValueError('host_source_inventory_invalid')
        if entry.get('package')!=name+'-skills' or entry.get('repo')!='https://github.com/full-aigc-skills/'+name+'-skills.git':raise ValueError('host_source_repository_invalid')
        if {p.name for p in (source/'skills').iterdir()}!=set(names):raise ValueError('host_source_inventory_invalid')
        hashes={n:skill_hash(source/'skills'/n) for n in sorted(names)}
        if hashes!=entry.get('sha256'):raise ValueError('host_tagged_skill_drift')
        return {'repository':'https://github.com/full-aigc-plugins/'+name+'-plugin.git','version':version,'ref':'v'+version,'sha':sha,'skillSourceSha':entry['sha'],'skillSourceRef':entry['ref'],'skillSha256':hashes[name+'-use'],'pluginManifestSha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),'skills':hashes}

def write_lock(lock,path):
    path=Path(path)
    if path.is_symlink() or (path.exists() and json.loads(path.read_text())!=lock):raise ValueError('existing_host_lock_conflict')
    if path.exists():return
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('x') as stream:stream.write(json.dumps(lock,ensure_ascii=False,indent=2)+'\n')

def build(repositories,versions,output):
    if set(versions)!=set(verifier.NAMES):raise ValueError('host_release_set_required')
    lock={'schema':'craft-host-release-lock/v1','plugins':{name:release_entry(Path(repositories)/(name+'-plugin'),name,versions[name]) for name in verifier.NAMES}}
    verifier.validate_lock(lock);write_lock(lock,output);return lock

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--repositories',required=True,type=Path);parser.add_argument('--plugin',action='append',required=True,help='name=explicit-version');parser.add_argument('--output',required=True,type=Path);args=parser.parse_args()
    pairs=[value.split('=',1) for value in args.plugin]
    if any(len(pair)!=2 for pair in pairs) or len({pair[0] for pair in pairs})!=len(pairs):raise ValueError('host_release_set_required')
    lock=build(args.repositories,dict(pairs),args.output);print(json.dumps({'plugins':len(lock['plugins']),'skills':sum(len(e['skills']) for e in lock['plugins'].values())}))
if __name__=='__main__':main()
