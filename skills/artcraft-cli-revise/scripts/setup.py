#!/usr/bin/env python3
"""安装固定 ArtCraft 运行时与独立领域技能快照，只使用领域公开安装入口。"""
import fcntl
import importlib.util
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import zipfile

NAMES = ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft')
LOCK_WAIT_SECONDS = 120


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            digest.update(block)
    return digest.hexdigest()


def safe_path(name):
    parts = name.split('/')
    return bool(parts) and not name.startswith('/') and not any(part in ('', '..', '.') for part in parts) and '\\' not in name and ':' not in name and '\0' not in name


def verify_bundle(target, lock):
    if target.is_symlink():
        raise ValueError('bundle_path_invalid')
    for name, digest in lock['files'].items():
        path = target/name
        if not safe_path(name) or path.is_symlink() or not path.is_file() or sha(path) != digest:
            raise ValueError('bundle_file_digest_mismatch')
    actual = {str(p.relative_to(target)) for p in target.rglob('*') if p.is_file()}
    if actual != set(lock['files']):
        raise ValueError('bundle_unexpected_file')
    return target


def validate_bundle_lock(lock):
    """提前验证制品结构，不写目录或发起下载；保留既有来源与格式规则。"""
    if (not isinstance(lock, dict) or not isinstance(lock.get('url'), str)
            or not isinstance(lock.get('sha256'), str)
            or not isinstance(lock.get('files'), dict)
            or type(lock.get('bytes')) is not int or lock['bytes'] <= 0):
        raise ValueError('bundle_lock_invalid')
    filename = lock.get('filename')
    if not isinstance(filename, str) or not safe_path(filename) or '/' in filename:
        raise ValueError('bundle_path_invalid')
    if 'version' in lock and (not isinstance(lock['version'], str)
            or not re.fullmatch(r'\d+\.\d+\.\d+(?:-dev\.\d+(?:-runtime\.\d+)?)?', lock['version'])):
        raise ValueError('bundle_version_invalid')
    if 'archiveFormat' in lock and lock['archiveFormat'] not in ('canonical-skills-zip', 'git-archive-zip'):
        raise ValueError('bundle_lock_invalid')
    if any(not isinstance(name, str) or not isinstance(value, str)
           for name, value in lock['files'].items()):
        raise ValueError('bundle_lock_invalid')
    url = urllib.parse.urlparse(lock['url'])
    if url.scheme != 'https' or url.netloc != 'github.com' or url.query or url.fragment or not re.fullmatch(r'/(full-aigc-plugins/artcraft-plugin|full-aigc-skills/(filmcraft|effectcraft|photocraft|vectorcraft)-skills)/releases/download/v[^/]+/[^/]+\.zip', url.path):
        raise ValueError('bundle_url_invalid')
    if 'archivePrefix' in lock:
        repository = url.path.split('/')[2]
        expected = {repository+'/'}
        if isinstance(lock.get('version'), str) and url.path.split('/')[5] == 'v'+lock['version']:
            expected.add(repository+'-'+lock['version']+'/')
            expected.add(repository+'-v'+lock['version']+'/')
        if (lock.get('archiveFormat') != 'git-archive-zip' or url.path.split('/')[1] != 'full-aigc-skills'
                or not isinstance(lock['archivePrefix'], str) or lock['archivePrefix'] not in expected):
            raise ValueError('bundle_prefix_invalid')
    if not re.fullmatch(r'[a-f0-9]{64}', lock['sha256']) or 'LICENSE' not in lock['files'] or not 0 < len(lock['files']) <= 2000:
        raise ValueError('bundle_lock_invalid')
    if any(not safe_path(name) or not re.fullmatch(r'[a-f0-9]{64}', value) for name, value in lock['files'].items()):
        raise ValueError('bundle_lock_invalid')


def validate_distribution(lock):
    """验证完整分发锁，包括未选择的依赖身份；本函数没有安装副作用。"""
    if (not isinstance(lock, dict) or lock.get('schema') != 'artcraft-distribution/v1'
            or not isinstance(lock.get('version'), str)
            or not re.fullmatch(r'\d+\.\d+\.\d+(?:-dev\.\d+(?:-runtime\.\d+)?)?', lock['version'])
            or not isinstance(lock.get('bundles'), dict)
            or set(lock['bundles']) != {'artcraft-runtime', *[name+'-skills' for name in NAMES]}):
        raise ValueError('distribution_lock_invalid')
    for entry in lock['bundles'].values():
        validate_bundle_lock(entry)


def install_bundle(lock, target, archive=None):
    validate_bundle_lock(lock)
    target = Path(target).absolute()
    if target.exists() or target.is_symlink():
        return verify_bundle(target, lock)
    target.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.bundle-', dir=target.parent))
    try:
        archive_path = Path(archive) if archive else stage/'download.zip'
        if archive is None:
            spec = importlib.util.spec_from_file_location('craft_download', Path(__file__).with_name('download.py'))
            module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
            module.download(lock['url'], archive_path, 32*1024*1024, 'bundle_size_limit')
        if archive_path.stat().st_size != lock['bytes'] or sha(archive_path) != lock['sha256']:
            raise ValueError('bundle_archive_digest_mismatch')
        seen = set();total = 0
        prefix = lock.get('archivePrefix', '')
        with zipfile.ZipFile(archive_path) as zip:
            for member in zip.infolist():
                mode = member.external_attr >> 16
                # 只按来源锁的精确前缀归一化，先拒绝原始路径别名和逃逸。
                original = member.filename
                raw_path = original[:-1] if member.is_dir() else original
                if not safe_path(raw_path) or prefix and not original.startswith(prefix):
                    raise ValueError('bundle_path_invalid')
                name = original[len(prefix):] if prefix else original

                if member.is_dir():
                    directory = name[:-1] if name.endswith('/') else name
                    ancestors = {'/'.join(name.split('/')[:index]) for name in lock['files'] for index in range(1, len(name.split('/')))}
                    if (lock.get('archiveFormat') != 'git-archive-zip' or (not safe_path(directory) and not (prefix and original == prefix))
                            or (directory not in ancestors and not (prefix and original == prefix)) or name in seen
                            or member.file_size != 0 or stat.S_ISLNK(mode)
                            or stat.S_IFMT(mode) not in (0, stat.S_IFDIR)):
                        raise ValueError('bundle_path_invalid')
                    seen.add(name)
                    if len(seen) > 2000:
                        raise ValueError('bundle_size_limit')
                    continue
                if (not safe_path(name) or name in seen or stat.S_ISLNK(mode)
                        or stat.S_IFMT(mode) not in (0, stat.S_IFREG)):
                    raise ValueError('bundle_path_invalid')
                seen.add(name);total += member.file_size
                if member.file_size > 16*1024*1024 or total > 64*1024*1024 or len(seen)>2000:
                    raise ValueError('bundle_size_limit')
                if name not in lock['files']:
                    raise ValueError('bundle_unexpected_file')
                path = stage/name;path.parent.mkdir(parents=True, exist_ok=True)
                with zip.open(member) as content, path.open('wb') as output:
                    shutil.copyfileobj(content, output)
                path.chmod(0o644)
        if archive is None:
            archive_path.unlink()
        verify_bundle(stage, lock)
        stage.rename(target)
        return verify_bundle(target, lock)
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def bundle_version(lock, entry):
    """组合版本升级不改变未升级的领域技能身份；缺失字段兼容旧锁。"""
    version = entry.get('version', lock['version'])
    if not isinstance(version, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:-dev\.\d+(?:-runtime\.\d+)?)?', version):
        raise ValueError('bundle_version_invalid')
    return version


def setup(lock, runtime_home, node, bundle_directory=None, native_archive_directory=None, plugins=None):
    validate_distribution(lock)
    selected = list(NAMES) if plugins is None else plugins
    if (not isinstance(selected, list) or any(not isinstance(name, str) or name not in NAMES for name in selected)
            or len(set(selected)) != len(selected)):
        raise ValueError('plugin_selection_invalid')
    selected = [name for name in NAMES if name in selected]
    home = Path(runtime_home).expanduser().resolve();home.mkdir(parents=True, exist_ok=True)
    with (home/'.artcraft-setup.lock').open('a+b') as ownership:
        # 锁超时发生在任何下载、领域启动及发布安装目录之前。
        deadline = time.monotonic() + LOCK_WAIT_SECONDS
        while True:
            try:
                fcntl.flock(ownership.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise TimeoutError('runtime_install_busy: ArtCraft setup lock wait expired') from None
                time.sleep(min(.05, remaining))
        installed = {}
        for name in ['artcraft-runtime', *[plugin+'-skills' for plugin in selected]]:
            entry = lock['bundles'][name]
            if Path(entry['filename']).name != entry['filename']:
                raise ValueError('bundle_path_invalid')
            target = home/'artcraft/bundles'/name/bundle_version(lock, entry)/entry['sha256']
            archive = Path(bundle_directory)/entry['filename'] if bundle_directory else None
            installed[name] = install_bundle(entry, target, archive)
        runtime = installed['artcraft-runtime'];entry_point = runtime/'src/cli.ts'
        actual = json.loads(subprocess.run([node['nodeExecutable'], str(entry_point), '--version'], check=True, capture_output=True, text=True, timeout=30).stdout)
        if actual != {'name': 'artcraft', 'version': lock['version']}:
            raise ValueError('artcraft_version_mismatch')
        skills = {}
        for name in selected:
            root = installed[name+'-skills']/'skills'/(name+'-use')
            args = [sys.executable, '-I', '-B', str(root/'scripts/bootstrap.py'), '--runtime-home', str(home)]
            native_lock = json.loads((root/'scripts/runtime.lock.json').read_text())
            if native_archive_directory:
                filename = urllib.parse.urlparse(native_lock['artifacts']['darwin-arm64']['url']).path.rsplit('/',1)[-1]
                args += ['--archive', str(Path(native_archive_directory)/filename)]
            bootstrapped = subprocess.run(args, capture_output=True, text=True, timeout=180)
            if bootstrapped.returncode:
                raise ValueError('domain_setup_failed: '+name+': '+bootstrapped.stdout.strip())
            result = json.loads(bootstrapped.stdout)
            cli = Path(result['executable'])
            catalog = subprocess.run([str(cli), 'commands', '--json'], check=True, capture_output=True, timeout=30).stdout
            if not json.loads(catalog):
                raise ValueError('capability_missing')
            files = [{'path': str(root/'scripts'/file), 'sha256': sha(root/'scripts'/file)} for file in ('workflow.py', 'bootstrap.py', 'mcp_session.py', 'runtime.lock.json', 'exchange_loss.py', 'preserved_stage.py')]
            for file in ('scripts/brand_variants.py','scripts/delivery.py','scripts/native_workflow.py','scripts/commands.py','references/command-coverage.json','scripts/desktop.py','scripts/desktop_session.py','scripts/desktop.lock.json'):
                if (root/file).is_file():
                    files.append({'path':str(root/file),'sha256':sha(root/file)})
            snapshot = {'commandCatalogSha256': hashlib.sha256(catalog).hexdigest(), 'skillBundleSha256': lock['bundles'][name+'-skills']['sha256'], 'artcraftRuntimeSha256': lock['bundles']['artcraft-runtime']['sha256'], 'scriptHashes': {Path(file['path']).name:file['sha256'] for file in files}}
            snapshot_hash = hashlib.sha256(json.dumps(snapshot, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            skills[name] = {'capabilitySnapshot': snapshot, 'skillRoot': str(root), 'executable': str(cli), 'files': files, 'runtimeIdentity': {'pluginId': name, 'pluginVersion': bundle_version(lock, lock['bundles'][name+'-skills']), 'cliVersion': native_lock['resolvedVersion'], 'sha256': result['binarySha256'], 'mode': 'headless', 'capabilitySnapshotSha256': snapshot_hash}}
        return {'schema': 'artcraft-setup/v1', **node, 'version': lock['version'], 'runtimeRoot': str(runtime), 'entryPoint': str(entry_point), 'pythonExecutable': str(Path(sys.executable).resolve()), 'pythonSha256': sha(Path(sys.executable).resolve()), 'runtimeHome': str(home), 'bundleHashes': {key:value['sha256'] for key,value in lock['bundles'].items() if key in installed}, 'skills': skills}
