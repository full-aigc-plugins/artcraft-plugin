#!/usr/bin/env python3
"""首次安装并执行持久化混合计划；JSON 为数据，执行入口固定。"""
import argparse
import hashlib
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def digest(value):
    return hashlib.sha256(value).hexdigest()


def file_digest(path):
    before = path.stat();value = hashlib.sha256();size = 0
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            value.update(block);size += len(block)
    after = path.stat()
    if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns) or size != after.st_size:
        raise ValueError('provided_asset_changed')
    return value.hexdigest(), size


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def required_plugins(plan):
    """只登记任务图声明的执行器，缺失或冲突身份在下载前拒绝。"""
    domains = ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft')
    required = set()
    for node in plan['nodes']:
        if not isinstance(node, dict):raise ValueError('workflow_plan_invalid')
        identity = node.get('runtimeIdentity', {})
        if not isinstance(identity, dict):raise ValueError('workflow_plan_invalid')
        explicit, runtime = node.get('pluginId'), identity.get('pluginId')
        if explicit is not None and runtime is not None and explicit != runtime:
            raise ValueError('runtime_identity_mismatch')
        plugin = explicit if explicit is not None else runtime
        if not isinstance(plugin, str) or plugin not in (*domains, 'video-factory'):
            raise ValueError('capability_missing: '+str(plugin))
        if plugin in domains:required.add(plugin)
    return [name for name in domains if name in required]


def execute(plan_path, output, owner, authorization, runtime_home=None, node_archive=None, bundle_directory=None, native_archive_directory=None, assignments=(), video_factory_root=None, ffmpeg=None, ffprobe=None):
    root = Path(output).expanduser().resolve()
    if root.exists() and not (root/'.artcraft-project.json').exists() and any(path.name != '.artcraft-write.lock' for path in root.iterdir()):
        raise ValueError('project_directory_not_owned')
    root.mkdir(parents=True, exist_ok=True)
    lock = root/'.artcraft-write.lock'
    if lock.is_symlink():raise ValueError('project_lock_invalid')
    with lock.open('a+b') as ownership:
        fcntl.flock(ownership.fileno(), fcntl.LOCK_EX)
        return _execute(plan_path, root, owner, authorization, runtime_home, node_archive, bundle_directory, native_archive_directory, assignments, video_factory_root, ffmpeg, ffprobe)


def _execute(plan_path, output, owner, authorization, runtime_home=None, node_archive=None, bundle_directory=None, native_archive_directory=None, assignments=(), video_factory_root=None, ffmpeg=None, ffprobe=None):
    source_plan = json.loads(Path(plan_path).read_text())
    if not isinstance(source_plan, dict) or not isinstance(source_plan.get('nodes'), list) or not source_plan.get('workflowId') or not source_plan.get('revision'):
        raise ValueError('workflow_plan_invalid')
    required = required_plugins(source_plan)
    external = any(node.get('pluginId') == 'video-factory' or node.get('runtimeIdentity', {}).get('pluginId') == 'video-factory' for node in source_plan['nodes'])
    if external and not all((video_factory_root, ffmpeg, ffprobe)):
        raise ValueError('video_factory_registration_required')
    if not external and any((video_factory_root, ffmpeg, ffprobe)):
        raise ValueError('video_factory_registration_unused')
    if external:
        video_factory_root = Path(video_factory_root).expanduser().resolve(strict=True)
        ffmpeg = Path(ffmpeg).expanduser().absolute()
        ffprobe = Path(ffprobe).expanduser().absolute()
        if not (video_factory_root / 'bin/video-factory').is_file() or not ffmpeg.is_file() or not ffprobe.is_file():
            raise ValueError('video_factory_registration_required')
    assets = {}
    for assignment in assignments:
        name, filename = assignment.split('=', 1)
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{0,63}', name) or name in assets:
            raise ValueError('provided_asset_invalid')
        path = Path(filename).expanduser().resolve(strict=True)
        if not path.is_file():
            raise ValueError('provided_asset_invalid')
        sha, size = file_digest(path)
        assets[name] = {'root': str(path.parent), 'artifact': {'protocolVersion': 'craft-artifact/v1', 'assetId': name, 'version': sha, 'sha256': sha, 'bytes': size, 'mediaType': 'application/octet-stream', 'producerTaskId': 'provided-'+name, 'sourceRefs': [], 'nativeProjectRef': None, 'renditions': [], 'dependencies': [], 'technicalMetadata': {}, 'lossReportRef': None, 'evidenceRefs': [], 'location': path.name}}
    used = set()
    plan = json.loads(json.dumps(source_plan))
    for node in plan['nodes']:
        names = node.pop('providedAssets', [])
        if not isinstance(names, list) or len(set(names)) != len(names):
            raise ValueError('provided_asset_invalid')
        for name in names:
            if name not in assets:
                raise ValueError('provided_asset_missing: '+str(name))
            used.add(name);node.setdefault('externalInputs', []).append(assets[name])
    if used != set(assets):
        raise ValueError('provided_asset_unused')
    output = Path(output).expanduser().resolve()
    marker = output/'.artcraft-project.json'
    if output.exists() and not marker.exists() and any(path.name != '.artcraft-write.lock' for path in output.iterdir()):
        raise ValueError('project_directory_not_owned')
    identity = {'schema': 'artcraft-project/v1', 'ownerId': owner, 'workflowId': plan['workflowId']}
    if marker.exists() and json.loads(marker.read_text()) != identity:
        raise ValueError('project_owner_mismatch')
    args = [sys.executable, '-I', '-B', str(Path(__file__).with_name('bootstrap.py'))]
    for flag, value in [('runtime-home', runtime_home), ('node-archive', node_archive), ('bundle-dir', bundle_directory), ('native-archive-dir', native_archive_directory)]:
        if value:args += ['--'+flag, str(value)]
    if required:
        for name in required:args += ['--plugin', name]
    else:args += ['--runtime-only']
    installed = subprocess.run(args, capture_output=True, text=True, timeout=600)
    if installed.returncode:
        raise ValueError('setup_failed: '+installed.stdout.strip())
    setup = json.loads(installed.stdout)
    if setup.get('schema') != 'artcraft-setup/v1' or set(setup.get('skills', {})) != set(required):
        raise ValueError('setup_incomplete')
    output.mkdir(parents=True, exist_ok=True)
    plugins = {}
    for name, skill in setup['skills'].items():
        plugins[name] = {'runtimeIdentity': skill['runtimeIdentity'], 'config': {'pluginId': name, 'skillRoot': skill['skillRoot'], 'python': setup['pythonExecutable'], 'pythonSha256': setup['pythonSha256'], 'nativeExecutable': skill['executable'], 'runtimeHome': setup['runtimeHome'], 'files': skill['files'], 'outputRoot': str(output/'outputs')}}
    if external:
        registered = subprocess.run([setup['nodeExecutable'], setup['entryPoint'], 'register-video-factory',
                                     '--plugin-root', str(video_factory_root), '--ffmpeg', str(ffmpeg),
                                     '--ffprobe', str(ffprobe), '--output-root', str(output/'outputs')],
                                    capture_output=True, text=True, timeout=120)
        if registered.returncode:
            raise ValueError('video_factory_registration_failed: ' + registered.stdout.strip())
        plugins['video-factory'] = json.loads(registered.stdout)
    registry = {'schemaVersion': 'craft-skill-registry/v1', 'plugins': plugins}
    registry_hash = digest(canonical(registry));registry_path = output/('registry-'+registry_hash+'.json')
    if registry_path.exists() and registry_path.read_bytes() != canonical(registry):raise ValueError('registry_modified')
    binding_hash = digest(canonical({'plan': plan, 'registrySha256': registry_hash, 'ownerId': owner, 'authorizationRef': authorization}))
    key = digest(canonical([plan['workflowId'], plan['revision']]))
    plan_dir = output/'plans';plan_dir.mkdir(exist_ok=True)
    compiled_path = plan_dir/(key+'.json');receipt_path = plan_dir/(key+'.binding.json')
    if compiled_path.exists():
        stored = json.loads(receipt_path.read_text())
        if stored['bindingSha256'] != binding_hash or stored['compiledSha256'] != digest(compiled_path.read_bytes()):
            raise ValueError('workflow_revision_conflict')
    else:
        if 'deadline' not in plan:
            from datetime import datetime, timedelta, timezone
            plan['deadline'] = (datetime.now(timezone.utc)+timedelta(hours=24)).isoformat(timespec='milliseconds').replace('+00:00','Z')
        compiled_path.write_bytes(canonical(plan))
        receipt_path.write_bytes(canonical({'bindingSha256': binding_hash, 'compiledSha256': digest(compiled_path.read_bytes())}))
    # 冻结修订绑定通过后才发布当前安装身份，冲突不得改变旧项目材料。
    if not marker.exists():marker.write_bytes(canonical(identity))
    if not registry_path.exists():registry_path.write_bytes(canonical(registry))
    (output/'installation-receipt.json').write_bytes(canonical(setup))
    result = subprocess.run([setup['nodeExecutable'], setup['entryPoint'], 'run', '--database', str(output/'tasks.sqlite'), '--registry', str(registry_path), '--plan', str(compiled_path), '--owner', owner, '--authorization', authorization], capture_output=True, text=True, timeout=600)
    if not result.stdout.strip():raise RuntimeError('artcraft_result_missing')
    receipt = json.loads(result.stdout)
    receipt['projectRoot'] = str(output)
    (output/('result-'+key+'.json')).write_bytes(canonical(receipt))
    if result.returncode != 0:raise RuntimeError(json.dumps(receipt, ensure_ascii=False))
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--owner', default='local-user')
    parser.add_argument('--authorization', required=True, help='本次已授权的任务范围引用')
    parser.add_argument('--runtime-home', type=Path, default=Path(os.environ.get('CRAFT_RUNTIME_HOME', str(Path.home()/'.local/share/craft-runtimes'))))
    parser.add_argument('--node-archive', type=Path)
    parser.add_argument('--bundle-dir', type=Path)
    parser.add_argument('--native-archive-dir', type=Path)
    parser.add_argument('--asset', action='append', default=[])
    parser.add_argument('--video-factory-root', type=Path, help='宿主实际安装的 Video Factory 插件根目录')
    parser.add_argument('--ffmpeg', type=Path)
    parser.add_argument('--ffprobe', type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(execute(args.plan, args.output, args.owner, args.authorization, args.runtime_home, args.node_archive, args.bundle_dir, args.native_archive_dir, args.asset, args.video_factory_root, args.ffmpeg, args.ffprobe), ensure_ascii=False))
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError) as error:
        print(json.dumps({'error': str(error)}, ensure_ascii=False));raise SystemExit(1)

if __name__ == '__main__':main()
