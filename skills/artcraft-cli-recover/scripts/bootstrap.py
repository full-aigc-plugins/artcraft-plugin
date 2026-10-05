#!/usr/bin/env python3
"""安装锁定 Node 运行时；仅用户目录，不依赖全局 Node。"""
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import platform
import re
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def verify(target, lock):
    executable = target / 'bin/node'
    if target.is_symlink() or executable.is_symlink() or not executable.is_file() or sha(executable) != lock['binarySha256']:
        raise ValueError('node_digest_mismatch')
    if not (target/'LICENSE').is_file():
        raise ValueError('node_license_missing')
    version = subprocess.run([str(executable), '--version'], capture_output=True, text=True, timeout=10, check=True).stdout.strip()
    if version != 'v' + lock['version']:
        raise ValueError('node_version_mismatch')
    return {'nodeExecutable': str(executable), 'nodeSha256': lock['binarySha256'], 'nodeVersion': lock['version']}


def install_node(lock, runtime_home, archive=None, platform_key=None):
    actual = platform_key or (platform.system().lower() + '-' + {'arm64': 'arm64', 'aarch64': 'arm64', 'x86_64': 'x64'}.get(platform.machine(), platform.machine()))
    if actual != 'darwin-arm64' or lock.get('platform') != actual:
        raise ValueError('unsupported_platform')
    version = lock.get('version', '')
    if lock.get('schema') != 'artcraft-node-lock/v1' or not re.fullmatch(r'24\.\d+\.\d+', version):
        raise ValueError('node_lock_invalid')
    expected_url = f'https://nodejs.org/dist/v{version}/node-v{version}-darwin-arm64.tar.gz'
    if lock.get('url') != expected_url or any(not re.fullmatch(r'[a-f0-9]{64}', lock.get(key, '')) for key in ('archiveSha256', 'binarySha256')):
        raise ValueError('node_lock_invalid')
    home = Path(runtime_home).expanduser().resolve()
    home.mkdir(parents=True, exist_ok=True)
    with (home/'.artcraft-node-install.lock').open('a+b') as ownership:
        fcntl.flock(ownership.fileno(), fcntl.LOCK_EX)
        target = home/'artcraft/node'/version
        if target.exists() or target.is_symlink():
            return verify(target, lock)
        target.parent.mkdir(parents=True, exist_ok=True)
        stage = Path(tempfile.mkdtemp(prefix='.node-', dir=target.parent))
        try:
            archive_path = Path(archive) if archive else stage/'download.tar.gz'
            if archive is None:
                with urllib.request.urlopen(expected_url, timeout=60) as response, archive_path.open('wb') as output:
                    count = 0
                    while block := response.read(1024 * 1024):
                        count += len(block)
                        if count > 512 * 1024 * 1024:
                            raise ValueError('archive_size_limit')
                        output.write(block)
            if archive_path.stat().st_size > 512 * 1024 * 1024 or sha(archive_path) != lock['archiveSha256']:
                raise ValueError('archive_digest_mismatch')
            prefix = f'node-v{version}-darwin-arm64'
            selected = {}
            seen = set()
            with tarfile.open(archive_path, 'r:gz') as tar:
                for member in tar:
                    parts = PurePosixPath(member.name).parts
                    if not parts or member.name.startswith('/') or '..' in parts or parts[0] != prefix or '\\' in member.name or member.name in seen:
                        raise ValueError('archive_path_invalid')
                    seen.add(member.name)
                    if member.name not in (prefix+'/bin/node', prefix+'/LICENSE'):
                        continue
                    if not member.isfile() or member.size > 256 * 1024 * 1024:
                        raise ValueError('archive_member_invalid')
                    stream = tar.extractfile(member)
                    if stream is None:
                        raise ValueError('archive_member_invalid')
                    destination = stage/('bin/node' if member.name.endswith('/bin/node') else 'LICENSE')
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    with destination.open('wb') as output:
                        shutil.copyfileobj(stream, output)
                    destination.chmod(0o755 if destination.name == 'node' else 0o644)
                    selected[destination.name] = True
            if set(selected) != {'node', 'LICENSE'}:
                raise ValueError('archive_members_missing')
            verify(stage, lock)
            if archive is None:
                archive_path.unlink()
            (stage/'installation.json').write_text(json.dumps({'schema': 'artcraft-node-installation/v1', 'lock': lock})+'\n')
            stage.rename(target)
            return verify(target, lock)
        finally:
            if stage.exists():
                shutil.rmtree(stage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-home', type=Path, default=Path(os.environ.get('CRAFT_RUNTIME_HOME', str(Path.home()/'.local/share/craft-runtimes'))))
    parser.add_argument('--node-archive', type=Path)
    parser.add_argument('--node-only', action='store_true', help='仅验证 Node 安装，不代表完整 ArtCraft setup')
    parser.add_argument('--bundle-dir', type=Path, help='离线发布包目录；强制校验锁定摘要')
    parser.add_argument('--native-archive-dir', type=Path, help='领域 CLI 锁定 ZIP 目录；强制校验领域锁')
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument('--plugin', action='append', choices=['filmcraft','effectcraft','photocraft','vectorcraft'], help='仅安装所需领域，可重复；省略保持完整安装兼容')
    selection.add_argument('--runtime-only', action='store_true', help='仅安装 Node 与 ArtCraft 运行时，不安装领域工具')
    args = parser.parse_args()
    try:
        if args.plugin and len(set(args.plugin)) != len(args.plugin):raise ValueError('plugin_selection_invalid')
        lock = json.loads(Path(__file__).with_name('node.lock.json').read_text())
        node = install_node(lock, args.runtime_home, args.node_archive)
        if args.node_only:
            result = node
        else:
            path = Path(__file__).with_name('setup.py')
            spec = importlib.util.spec_from_file_location('artcraft_setup', path)
            module = importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
            distribution = json.loads(Path(__file__).with_name('distribution.lock.json').read_text())
            result = module.setup(distribution, args.runtime_home, node, args.bundle_dir, args.native_archive_dir, plugins=[] if args.runtime_only else args.plugin)
        print(json.dumps(result))
    except (OSError, ValueError, subprocess.SubprocessError, tarfile.TarError) as error:
        print(json.dumps({'error': str(error)}))
        raise SystemExit(1)

if __name__ == '__main__':
    main()
