#!/usr/bin/env python3
"""逐技能空运行时验收；证明安装和 CLI 发现，不代表场景或模型验收。"""
import argparse
import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

_host_spec = importlib.util.spec_from_file_location('craft_cold_host_verifier', Path(__file__).with_name('verify_codex_host.py'))
_host_module = importlib.util.module_from_spec(_host_spec)
_host_spec.loader.exec_module(_host_module)
skill_hash = _host_module.skill_hash
verify_installed_skill = _host_module.verify_installed_skill


def native_version_matches(output, domain, expected):
    if domain == "artcraft":
        try:
            identity = json.loads(output)
        except (ValueError, TypeError):
            return False
        return isinstance(identity, dict) and identity.get("name") == "artcraft" and identity.get("version") == expected
    tokens = output.strip().split()
    return len(tokens) >= 2 and tokens[0] == domain + "-cli" and tokens[1] == expected


def locked_native_version(directory, domain):
    filename = 'distribution.lock.json' if domain == 'artcraft' else 'runtime.lock.json'
    locked = json.loads((Path(directory) / 'scripts' / filename).read_text())
    expected = locked['bundles']['artcraft-runtime']['version'] if domain == 'artcraft' else locked['resolvedVersion']
    if not isinstance(expected, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?', expected):
        raise ValueError('cold_runtime_lock_invalid')
    return expected


def verify(host, lock, python, output):
    if output.exists():
        raise ValueError('evidence_output_exists')
    expected_count = sum(len(item['skills']) for item in lock['plugins'].values())
    records = []
    started = time.monotonic()
    environment = dict(os.environ, PATH='/usr/bin:/bin')
    for name in ('CRAFT_RUNTIME_HOME', 'CRAFT_NODE_ARCHIVE', 'CRAFT_BUNDLE_DIRECTORY', 'CRAFT_NATIVE_ARCHIVE_DIRECTORY'):
        environment.pop(name, None)
    python_version = subprocess.check_output([python, '-I', '-B', '--version'], text=True).strip()
    for domain, directory in host['skillDirectories'].items():
        entry = lock['plugins'][domain]
        for name, expected_digest in entry['skills'].items():
            original = Path(directory).parent / name
            verify_installed_skill(original, entry)
            # 每项技能均使用独立临时目录，后续技能无法复用本项运行时。
            with tempfile.TemporaryDirectory(prefix='craft-cold-single-') as temporary:
                root = Path(temporary)
                target = root / '.agents' / 'skills' / name
                home = root / 'runtime'
                shutil.copytree(original, target, ignore=shutil.ignore_patterns('__pycache__'))
                if skill_hash(target) != expected_digest or home.exists():
                    raise ValueError('cold_skill_identity_invalid')
                def call(arguments):
                    result = subprocess.run([python, '-I', '-B', str(target / 'scripts/cli.py'), '--runtime-home', str(home), '--', *arguments], env=environment, text=True, capture_output=True, timeout=300)
                    if result.returncode:
                        raise RuntimeError(name + ': ' + result.stdout + result.stderr)
                    return result.stdout
                version = call(['--version'])
                expected_version = locked_native_version(target, domain)
                if not native_version_matches(version, domain, expected_version):
                    raise ValueError('unexpected_native_version:' + name)
                discovery = call(['--help'] if domain == 'artcraft' else ['commands', *([] if domain == 'vectorcraft' else ['--json'])])
                command_count = None
                if domain == 'artcraft':
                    if 'verify-package' not in discovery:
                        raise ValueError('runtime_command_missing')
                else:
                    commands = json.loads(discovery)
                    contract = json.loads((target / 'references/commands.json').read_text())
                    if not {row['id'] for row in contract['commands']}.issubset({row['id'] for row in commands}):
                        raise ValueError('native_contract_command_missing:' + name)
                    command_count = len(commands)
                if not home.is_dir() or skill_hash(target) != expected_digest or list(target.rglob('*.pyc')):
                    raise ValueError('installed_skill_mutated:' + name)
                records.append({'pluginId': domain, 'skill': name, 'expectedSkillSha256': expected_digest, 'nativeVersion': version.strip(), 'coldRuntimeForSkill': True, 'commandCount': command_count, 'discoverySha256': hashlib.sha256(discovery.encode()).hexdigest(), 'isolated': True})
            verify_installed_skill(original, entry)
            print(name + ' cold first use passed', flush=True)
    if len(records) != expected_count:
        raise ValueError('skill_inventory_incomplete')
    proof = {'schema': 'craft-installed-single-skill-cold-cli/v1', 'result': 'passed', 'python': python_version, 'runtimeMode': 'one empty independent runtime home per skill; skill and runtime removed before the next skill', 'systemOnlyPath': True, 'records': records, 'seconds': round(time.monotonic() - started, 3), 'excluded': ['generic Skills CLI installation', 'all scene-specific creative tasks', 'model dispatch', 'GUI', 'other platforms', 'production']}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x') as stream:
        json.dump(proof, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print('all', expected_count, 'independent cold starts passed', proof['seconds'], flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host-receipt', required=True, type=Path)
    parser.add_argument('--lock', required=True, type=Path)
    parser.add_argument('--python', required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    verify(json.loads(args.host_receipt.read_text()), json.loads(args.lock.read_text()), args.python, args.output)
