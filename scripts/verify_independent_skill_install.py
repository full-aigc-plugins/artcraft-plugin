#!/usr/bin/env python3
"""核验真实 Skills CLI 项目安装；不安装工具或修改全局技能目录。"""
import argparse
import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path
import subprocess
import sys

_version_spec = importlib.util.spec_from_file_location('craft_native_version_gate', Path(__file__).with_name('verify_single_skill_cold_start.py'))
_version_module = importlib.util.module_from_spec(_version_spec)
_version_spec.loader.exec_module(_version_module)
native_version_matches = _version_module.native_version_matches

ROOT = Path(__file__).resolve().parents[1]
NAMES = ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft', 'artcraft')

def skill_hash(directory):
    """核验独立技能普通文件树；保留既有普通文件摘要算法。"""
    directory = Path(directory)
    if directory.is_symlink() or directory.parent.is_symlink():
        raise ValueError('independent_skill_symlink')
    if not directory.is_dir():
        raise ValueError('independent_skill_directory_missing')
    paths = sorted(directory.rglob('*'))
    # 先检查全部条目，不能用 is_file() 丢弃目录链接、悬空链接及特殊文件。
    for path in paths:
        if path.is_symlink():
            raise ValueError('independent_skill_symlink')
        if not path.is_dir() and not path.is_file():
            raise ValueError('independent_skill_entry_invalid')
    result = hashlib.sha256()
    for path in (path for path in paths if path.is_file()):
        result.update(path.relative_to(directory).as_posix().encode() + b'\0')
        result.update(hashlib.sha256(path.read_bytes()).hexdigest().encode() + b'\n')
    return result.hexdigest()

def installation_plan(lock):
    if not isinstance(lock,dict) or not isinstance(lock.get('plugins'),dict) or set(lock['plugins']) != set(NAMES):
        raise ValueError('five_plugin_lock_required')
    plans = []
    for name in NAMES:
        entry = lock['plugins'][name]
        if not isinstance(entry,dict):
            raise ValueError('independent_install_lock_invalid')
        skills = entry.get('skills', {})
        # 外部安装前先拒绝浮动来源和可被解释为 CLI 选项／路径的名称。
        if (not isinstance(entry.get('skillSourceRef'),str)
                or not re.fullmatch(r'v0\.1\.0-dev\.\d+',entry['skillSourceRef'])
                or not isinstance(entry.get('skillSourceSha'),str)
                or not re.fullmatch(r'[0-9a-f]{40}',entry['skillSourceSha'])
                or not isinstance(skills,dict) or not skills
                or name+'-cli' not in skills):
            raise ValueError('independent_install_lock_invalid')
        for skill,digest in skills.items():
            if (not isinstance(skill,str)
                    or not re.fullmatch(re.escape(name)+r'-(?:use|cli(?:-[a-z0-9]+)*)',skill)
                    or not isinstance(digest,str) or not re.fullmatch(r'[0-9a-f]{64}',digest)):
                raise ValueError('independent_install_lock_invalid')
        source = 'https://github.com/full-aigc-skills/' + name + '-skills/tree/' + entry['skillSourceRef']
        plans.append({'plugin': name, 'source': source, 'sourceSha': entry['skillSourceSha'],
                      'skills': skills, 'argv': ['add', source, '--skill', *sorted(skills), '--agent', 'codex', '--copy', '--yes']})
    return plans

def verify(node, cli, python, lock, output):
    plans = installation_plan(lock)
    # 工具缺失时不下载安装，也不创建输出目录。
    for value in (node, cli, python):
        if not Path(value).is_file():
            raise ValueError('existing_tool_required')
    node, cli, python = (str(Path(value).resolve(strict=True)) for value in (node, cli, python))
    output = Path(output).absolute()
    output.mkdir(mode=0o700)  # 拒绝复用已有项目，避免覆盖用户技能。
    env = dict(os.environ, DO_NOT_TRACK='1', SKILLS_NO_TELEMETRY='1')
    for key in ('CRAFT_RUNTIME_HOME', 'CRAFT_NODE_ARCHIVE', 'CRAFT_BUNDLE_DIRECTORY', 'CRAFT_NATIVE_ARCHIVE_DIRECTORY'):
        env.pop(key, None)
    calls = output / 'calls'
    calls.mkdir(mode=0o700)
    call_number = 0
    def run(argv, cwd, native=False):
        nonlocal call_number
        call_number += 1
        stem = f'{call_number:04d}'
        argv = list(map(str, argv))
        record = {'argv': argv, 'cwd': str(cwd), 'native': native, 'timeoutSeconds': 600,
                  'stdout': stem+'.stdout.log', 'stderr': stem+'.stderr.log'}
        def preserve(status, stdout, stderr, returncode=None):
            # TimeoutExpired 即使 text=True 也可能携带 bytes；仅存进程输出，不存环境。
            def as_text(value):
                return value.decode('utf-8', errors='replace') if isinstance(value, bytes) else (value or '')
            (calls / record['stdout']).write_text(as_text(stdout), encoding='utf-8')
            (calls / record['stderr']).write_text(as_text(stderr), encoding='utf-8')
            record.update(status=status, returncode=returncode)
            (calls / (stem+'.json')).write_text(json.dumps(record, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        try:
            value = subprocess.run(argv, cwd=cwd, env=dict(env, PATH="/usr/bin:/bin") if native else env, capture_output=True, text=True, timeout=600)
        except subprocess.TimeoutExpired as error:
            preserve('timeout', error.stdout, error.stderr)
            raise
        except OSError as error:
            preserve('launch', '', str(error))
            raise
        preserve('exit' if value.returncode else 'success', value.stdout, value.stderr, value.returncode)
        if value.returncode:
            raise RuntimeError('independent_install_call_failed: ' + value.stdout[-2000:] + value.stderr[-2000:] + '\nEvidence: ' + str(calls / (stem+'.json')))
        return value.stdout
    version = run([node, cli, '--version'], output).strip()
    records = []
    for item in plans:
        project = output / item['plugin'];project.mkdir()
        run([node, cli, *item['argv']], project)
        directory = project / '.agents/skills'
        if {p.name for p in directory.iterdir() if p.is_dir()} != set(item['skills']):
            raise ValueError('independent_installed_inventory_mismatch')
        before = {name: skill_hash(directory/name) for name in item['skills']}
        if before != item['skills']:
            raise ValueError('independent_installed_source_drift')
        runtime = project / 'runtime'
        native_versions = {}
        for name in sorted(item['skills']):
            script = directory/name/'scripts/cli.py'
            locked = json.loads((script.parent / ('distribution.lock.json' if item['plugin']=='artcraft' else 'runtime.lock.json')).read_text())
            expected = locked['bundles']['artcraft-runtime']['version'] if item['plugin']=='artcraft' else locked['resolvedVersion']
            if not isinstance(expected, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?', expected):
                raise ValueError('independent_runtime_lock_invalid')
            actual = run([python, '-I', '-B', script, '--runtime-home', runtime, '--', '--version'], project, native=True).strip()
            if not native_version_matches(actual, item['plugin'], expected):
                raise ValueError('independent_runtime_version_mismatch: '+name)
            native_versions[name] = {'expected': expected, 'actual': actual}
        after = {name: skill_hash(directory/name) for name in item['skills']}
        if after != before:
            raise ValueError('independent_skill_changed_after_use')
        records.append({'plugin': item['plugin'], 'source': item['source'], 'sourceSha': item['sourceSha'],
                        'skills': before, 'versionProbes': len(before), 'nativeVersions': native_versions, 'afterUseHashes': 'unchanged'})
    probes = sum(record['versionProbes'] for record in records)
    receipt = {'schema': 'craft-independent-install-evidence/v1', 'skillsCliVersion': version,
               'plugins': records, 'versionProbes': probes,
               'scope': f'actual public Skills CLI installation and {probes} public native version probes',
               'unverified': ['model dispatch', 'GUI', 'creative acceptance; native workflows have separate evidence']}
    (output/'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
    return receipt

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--lock', type=Path, default=ROOT/'host-acceptance-art-photo34.lock.json')
    p.add_argument('--plan', action='store_true')
    p.add_argument('--node');p.add_argument('--cli');p.add_argument('--python',default=sys.executable)
    p.add_argument('--output',type=Path)
    a=p.parse_args();lock=json.loads(a.lock.read_text())
    if a.plan:
        print(json.dumps(installation_plan(lock),ensure_ascii=False,indent=2));return
    if not a.node or not a.cli or not a.output:p.error('--node, --cli and --output are required')
    print(json.dumps(verify(a.node,a.cli,a.python,lock,a.output),ensure_ascii=False))
if __name__=='__main__':main()
