#!/usr/bin/env python3
"""核验四个固定安装的来源、许可、原子拒绝、并发复用与超时保全。"""
import argparse
import copy
import hashlib
import importlib.util
import json
import selectors
from pathlib import Path
import subprocess
import sys
import tempfile
from unittest.mock import patch

DOMAINS = ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft')


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def inventory(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file()}


def verify(host_path, lock_path, runtime_home):
    host = json.loads(host_path.read_text())
    lock = json.loads(lock_path.read_text())
    if host.get('result') != 'passed' or host.get('loadingErrors') != 0:
        raise ValueError('runtime_host_receipt_invalid')
    host_module = load_module(Path(__file__).with_name('verify_codex_host.py'), 'integrity_host')
    rows = []
    for domain in DOMAINS:
        skill = Path(host['skillDirectories'][domain])
        host_module.verify_installed_skill(skill, lock['plugins'][domain])
        boot = load_module(skill/'scripts/bootstrap.py', 'integrity_'+domain)
        runtime_lock = json.loads((skill/'scripts/runtime.lock.json').read_text())
        version = runtime_lock['resolvedVersion']
        expected = runtime_lock['artifacts']['darwin-arm64']
        destination = runtime_home/domain/version
        before = inventory(destination)
        if not before or not any(Path(name).name.startswith('LICENSE') for name in before):
            raise ValueError('runtime_license_missing: '+domain)
        if boot.LOCK_WAIT_SECONDS != 120:
            raise ValueError('runtime_mutex_budget_mismatch')
        with patch.object(boot, 'download', side_effect=AssertionError('unexpected download')):
            reused = boot.install(runtime_lock, runtime_home, platform_key='darwin-arm64')
        if not reused['reused']:
            raise ValueError('runtime_expected_existing_verified_install')
        executable = Path(reused['executable'])
        actual = subprocess.run([str(executable), '--version'], capture_output=True, text=True, check=True, timeout=20)
        expected_version = expected.get('versionOutput', runtime_lock['artifact']+' '+version)
        if actual.stdout.strip() != expected_version:
            raise ValueError('runtime_version_mismatch')
        receipt = json.loads((destination/'installation.json').read_text())
        for key in ('url', 'archiveSha256', 'binarySha256'):
            if receipt.get(key) != expected[key]:
                raise ValueError('runtime_receipt_identity_mismatch: '+key)
        if receipt.get('version') != version or receipt.get('platform') != 'darwin-arm64':
            raise ValueError('runtime_receipt_version_platform_mismatch')
        if expected.get('provenanceSha256') and before.get('PROVENANCE.json') != expected['provenanceSha256']:
            raise ValueError('runtime_provenance_mismatch')
        receipt_checks = []
        if domain == 'filmcraft':
            receipt_path = destination/'installation.json'
            receipt_bytes = receipt_path.read_bytes()
            invalid = [None, b'broken JSON', b'null', b'[]', b'{"version":"a","version":"b"}']
            for key in ('name', 'version', 'platform', 'source', 'url', 'archiveSha256', 'binarySha256', 'versionOutput'):
                invalid.append(json.dumps(dict(receipt, **{key: 'changed'})).encode())
            try:
                for index, content in enumerate(invalid):
                    if content is None:
                        receipt_path.unlink()
                    else:
                        receipt_path.write_bytes(content)
                    rejected_before = inventory(destination)
                    with patch.object(boot, 'download', side_effect=AssertionError('download on receipt refusal')), patch.object(boot.subprocess, 'run', side_effect=AssertionError('execute on receipt refusal')):
                        try:
                            boot.install(runtime_lock, runtime_home, platform_key='darwin-arm64')
                        except ValueError as error:
                            if 'installation_receipt_' not in str(error):
                                raise
                        else:
                            raise AssertionError('invalid receipt accepted')
                    if inventory(destination) != rejected_before:
                        raise ValueError('runtime_receipt_refusal_changed_files')
                    receipt_checks.append(index)
            finally:
                receipt_path.write_bytes(receipt_bytes)
        # 本地损坏制品模拟独立新版本；旧版真实二进制及许可/回执必须完整保留。
        damaged = copy.deepcopy(runtime_lock)
        damaged['resolvedVersion'] = '999.0.0'
        candidate = runtime_home/domain/damaged['resolvedVersion']
        if candidate.exists():
            raise ValueError('runtime_negative_target_exists')
        with tempfile.TemporaryDirectory() as temporary:
            archive = Path(temporary)/'corrupt.zip'
            archive.write_bytes(b'corrupt fixed artifact')
            with patch.object(boot, 'download', side_effect=AssertionError('unexpected download')), patch.object(boot.subprocess, 'run', side_effect=AssertionError('unverified execution')):
                try:
                    boot.install(damaged, runtime_home, archive, 'darwin-arm64')
                except ValueError as error:
                    if 'archive_checksum_mismatch' not in str(error):
                        raise
                else:
                    raise AssertionError('damaged artifact accepted')
        if candidate.exists() or inventory(destination) != before:
            raise ValueError('runtime_existing_install_changed')
        # 两个真实进程均只能复用同一已核验原子发布版本。
        code = "import importlib.util,json,sys; s=importlib.util.spec_from_file_location('b',sys.argv[1]); b=importlib.util.module_from_spec(s); s.loader.exec_module(b); print(json.dumps(b.install(json.loads(sys.argv[2]),sys.argv[3],platform_key='darwin-arm64')))"
        argv = [sys.executable, '-I', '-B', '-c', code, str(skill/'scripts/bootstrap.py'), json.dumps(runtime_lock), str(runtime_home)]
        children = []
        try:
            for _ in range(2):
                children.append(subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True))
            for child in children:
                stdout, stderr = child.communicate(timeout=30)
                if child.returncode or not json.loads(stdout).get('reused'):
                    raise ValueError('runtime_concurrent_reuse_failed: '+stderr)
        finally:
            for child in children:
                if child.poll() is None:
                    child.kill()
                    child.communicate()
        holder_code = "import fcntl,sys; f=open(sys.argv[1],'a'); fcntl.flock(f,fcntl.LOCK_EX); print('locked',flush=True); sys.stdin.readline()"
        holder = subprocess.Popen([sys.executable, '-I', '-B', '-c', holder_code, str(runtime_home/domain/'.install.lock')], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            with selectors.DefaultSelector() as ready:
                ready.register(holder.stdout, selectors.EVENT_READ)
                if not ready.select(timeout=10) or holder.stdout.readline().strip() != 'locked':
                    raise ValueError('runtime_holder_not_ready')
            # 不等待生产120秒：只缩短本次验收进程内预算，不改变安装文件。
            with patch.object(boot, 'LOCK_WAIT_SECONDS', .15), patch.object(boot, 'download', side_effect=AssertionError('download on busy')), patch.object(boot.subprocess, 'run', side_effect=AssertionError('execute on busy')):
                try:
                    boot.install(runtime_lock, runtime_home, platform_key='darwin-arm64')
                except TimeoutError as error:
                    if 'runtime_install_busy' not in str(error):
                        raise
                else:
                    raise AssertionError('busy installation accepted')
        finally:
            try:
                holder.communicate('release\n', timeout=10)
            except subprocess.TimeoutExpired:
                holder.kill()
                holder.communicate()
        if inventory(destination) != before:
            raise ValueError('runtime_existing_install_changed')
        rows.append({'plugin': domain, 'pluginRef': lock['plugins'][domain]['ref'],
                     'skillSourceRef': lock['plugins'][domain]['skillSourceRef'],
                     'skillSha256': host_module.skill_hash(skill),
                     'runtimeVersion': version, 'artifact': expected,
                     'files': before, 'actualVersionOutput': actual.stdout.strip(),
                     'checks': ['fixed source/version/platform/archive/binary identity', 'license retained', 'receipt retained', 'damaged new artifact rejected before execution', 'old installation preserved', 'two actual concurrent reuse processes', 'real lock owner timeout and preservation'],
                     'productionMutexSeconds': 120, 'testMutexSeconds': .15,
                     'filmReceiptRefusalCases': len(receipt_checks)})
    return {'schema': 'craft-fixed-runtime-integrity/v1', 'result': 'PASS', 'domains': rows,
            'scope': 'Current installed macOS arm64 CLI identity and integrity; corruption targets new version only. Native edits are not run. Cold download and concurrent first publication have separate exact-source evidence.',
            'excluded': ['Runtime upgrade lifecycle', 'Other platforms', 'Desktop applications', 'Complete V1']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host-receipt', type=Path, required=True)
    parser.add_argument('--lock', type=Path, required=True)
    parser.add_argument('--runtime-home', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('runtime_evidence_output_exists')
    result = verify(args.host_receipt, args.lock, args.runtime_home.resolve())
    with args.output.open('x') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps({'result': result['result'], 'domains': len(result['domains'])}))


if __name__ == '__main__':
    main()
