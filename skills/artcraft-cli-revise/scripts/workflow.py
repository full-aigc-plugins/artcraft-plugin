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
import struct
import sys
import importlib.util
import shutil



class WorkflowFailure(RuntimeError):
    """保留非零工作流回执的对象快照，同时兼容已有error字符串。"""
    def __init__(self, receipt):
        serialized = json.dumps(receipt, ensure_ascii=False)
        super().__init__(serialized)
        self.receipt = json.loads(serialized)


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


def provided_metadata(path):
    """按内容登记 PNG、JPEG 和标准 PCM WAV；未知格式不推断媒体属性。"""
    before = path.stat()
    with path.open('rb') as stream:
        header = stream.read(12)
        if header[:8] == b'\x89PNG\r\n\x1a\n':
            spec=importlib.util.spec_from_file_location('craft_png',Path(__file__).with_name('png_inspection.py'))
            module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
            facts=module.inspect_png(path)
            after=path.stat()
            if (before.st_ino,before.st_size,before.st_mtime_ns)!=(after.st_ino,after.st_size,after.st_mtime_ns):raise ValueError('provided_asset_changed')
            return 'image/png',facts
        if header[:2]==b'\xff\xd8':
            spec=importlib.util.spec_from_file_location('craft_jpeg',Path(__file__).with_name('jpeg_inspection.py'))
            module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
            facts=module.inspect_jpeg(path)
            after=path.stat()
            if (before.st_ino,before.st_size,before.st_mtime_ns)!=(after.st_ino,after.st_size,after.st_mtime_ns):raise ValueError('provided_asset_changed')
            return 'image/jpeg',facts
        if path.suffix.lower()=='.png':raise ValueError('provided_png_invalid')
        if path.suffix.lower() in ('.jpg','.jpeg'):raise ValueError('provided_jpeg_invalid')
        recognized = header[:4] == b'RIFF' and header[8:12] == b'WAVE'
        if not recognized:
            if path.suffix.lower() == '.wav':raise ValueError('provided_wav_invalid')
            return 'application/octet-stream', {}
        if len(header) != 12 or struct.unpack_from('<I', header, 4)[0]+8 != before.st_size:
            raise ValueError('provided_wav_invalid')
        position, audio_format, data_bytes = 12, None, None
        while position < before.st_size:
            stream.seek(position);chunk = stream.read(8)
            if len(chunk) != 8:raise ValueError('provided_wav_invalid')
            length = struct.unpack_from('<I', chunk, 4)[0];end = position+8+length
            if end+length%2 > before.st_size:raise ValueError('provided_wav_invalid')
            if chunk[:4] == b'fmt ':
                if audio_format is not None or not 16 <= length <= 4096:raise ValueError('provided_wav_invalid')
                audio_format = struct.unpack('<HHIIHH', stream.read(16))
            elif chunk[:4] == b'data':
                if audio_format is None or data_bytes is not None:raise ValueError('provided_wav_invalid')
                data_bytes = length
            position = end+length%2
        if audio_format is None or data_bytes is None:raise ValueError('provided_wav_invalid')
        tag, channels, rate, byte_rate, align, bits = audio_format
        if tag != 1:raise ValueError('provided_wav_format_unsupported')
        if not channels or not rate or bits not in (8,16,24,32) or align != channels*bits//8 or byte_rate != rate*align or data_bytes%align:
            raise ValueError('provided_wav_invalid')
    after = path.stat()
    if (before.st_ino,before.st_size,before.st_mtime_ns) != (after.st_ino,after.st_size,after.st_mtime_ns):raise ValueError('provided_asset_changed')
    return 'audio/wav', {'audio':{'sampleRate':rate,'channels':channels},'bitDepth':bits,'durationTicks':str(data_bytes//align),'timeBase':{'num':1,'den':rate}}


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


def execute(plan_path, output, owner, authorization, runtime_home=None, node_archive=None, bundle_directory=None, native_archive_directory=None, assignments=(), video_factory_root=None, ffmpeg=None, ffprobe=None, brief_root=None, brief_sha=None):
    root = Path(output).expanduser().resolve()
    if root.exists() and not (root/'.artcraft-project.json').exists() and any(path.name != '.artcraft-write.lock' for path in root.iterdir()):
        raise ValueError('project_directory_not_owned')
    root.mkdir(parents=True, exist_ok=True)
    lock = root/'.artcraft-write.lock'
    if lock.is_symlink():raise ValueError('project_lock_invalid')
    with lock.open('a+b') as ownership:
        fcntl.flock(ownership.fileno(), fcntl.LOCK_EX)
        return _execute(plan_path, root, owner, authorization, runtime_home, node_archive, bundle_directory, native_archive_directory, assignments, video_factory_root, ffmpeg, ffprobe, brief_root, brief_sha)


def _execute(plan_path, output, owner, authorization, runtime_home=None, node_archive=None, bundle_directory=None, native_archive_directory=None, assignments=(), video_factory_root=None, ffmpeg=None, ffprobe=None, brief_root=None, brief_sha=None):
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
    image_staging = []
    for assignment in assignments:
        name, filename = assignment.split('=', 1)
        if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]{0,63}', name) or name in assets:
            raise ValueError('provided_asset_invalid')
        path = Path(filename).expanduser().resolve(strict=True)
        if not path.is_file():
            raise ValueError('provided_asset_invalid')
        sha, size = file_digest(path)
        media_type, metadata = provided_metadata(path)
        if media_type in ('audio/wav','image/png','image/jpeg') and file_digest(path) != (sha, size):raise ValueError('provided_asset_changed')
        # 部分原生导入器按扩展名选解码器；按内容识别的图片复制为规范暂存名。
        # 原文件不改名不写入，暂存副本必须与原摘要完全相同并进入项目交付。
        extension={ 'image/png':'.png','image/jpeg':'.jpg' }.get(media_type)
        suffixes=('.jpg','.jpeg') if media_type=='image/jpeg' else ('.png',)
        if extension and path.suffix.lower() not in suffixes:
            directory=output/'provided-assets'
            staged=directory/(sha+extension)
            image_staging.append((path,staged,sha,size))
            path=staged
        assets[name] = {'root': str(path.parent), 'artifact': {'protocolVersion': 'craft-artifact/v1', 'assetId': name, 'version': sha, 'sha256': sha, 'bytes': size, 'mediaType': media_type, 'producerTaskId': 'provided-'+name, 'sourceRefs': [], 'nativeProjectRef': None, 'renditions': [], 'dependencies': [], 'technicalMetadata': metadata, 'lossReportRef': None, 'evidenceRefs': [], 'location': path.name}}
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
    # Brief 是需求元数据，不作为领域媒体输入；必须在安装前拒绝歧义或冲突。
    if (brief_root is None) != (brief_sha is None):raise ValueError('brief_binding_required')
    if brief_root is not None or 'projectBrief' in plan:
        import importlib.util
        spec = importlib.util.spec_from_file_location('artcraft_project_brief', Path(__file__).with_name('brief.py'))
        brief_module = importlib.util.module_from_spec(spec);spec.loader.exec_module(brief_module)
        value = brief_module.verify(brief_root, brief_sha) if brief_root is not None else plan['projectBrief']
        if 'projectBrief' in plan and plan['projectBrief'] != value:raise ValueError('brief_binding_conflict')
        assessment = brief_module.assess(value, plan, owner, authorization)
        if not brief_module.pending_native_assessment(assessment,plan):raise ValueError('brief_plan_blocked: '+json.dumps(assessment,ensure_ascii=False))
        plan['projectBrief'] = value
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
    for original_path,staged,sha,size in image_staging:
        if staged.parent.is_symlink() or staged.is_symlink():raise ValueError('provided_asset_staging_invalid')
        staged.parent.mkdir(exist_ok=True)
        if file_digest(original_path)!=(sha,size):raise ValueError('provided_asset_changed')
        if not staged.exists():
            with original_path.open('rb') as original,staged.open('xb') as target:shutil.copyfileobj(original,target,1024*1024)
        if file_digest(original_path)!=(sha,size) or file_digest(staged)!=(sha,size):raise ValueError('provided_asset_changed')
    if not registry_path.exists():registry_path.write_bytes(canonical(registry))
    (output/'installation-receipt.json').write_bytes(canonical(setup))
    result = subprocess.run([setup['nodeExecutable'], setup['entryPoint'], 'run', '--database', str(output/'tasks.sqlite'), '--registry', str(registry_path), '--plan', str(compiled_path), '--owner', owner, '--authorization', authorization], capture_output=True, text=True, timeout=600)
    if not result.stdout.strip():raise RuntimeError('artcraft_result_missing')
    receipt = json.loads(result.stdout)
    receipt['projectRoot'] = str(output)
    (output/('result-'+key+'.json')).write_bytes(canonical(receipt))
    if result.returncode != 0:raise WorkflowFailure(receipt)
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
    parser.add_argument('--brief', type=Path, help='已保存的版本化 Brief 目录')
    parser.add_argument('--brief-sha', help='Brief manifest.json 的 SHA256')
    args = parser.parse_args()
    try:
        print(json.dumps(execute(args.plan, args.output, args.owner, args.authorization, args.runtime_home, args.node_archive, args.bundle_dir, args.native_archive_dir, args.asset, args.video_factory_root, args.ffmpeg, args.ffprobe, args.brief, args.brief_sha), ensure_ascii=False))
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError) as error:
        reply = {'error': str(error)}
        if isinstance(error, WorkflowFailure):
            reply['workflowReceipt'] = error.receipt
        print(json.dumps(reply, ensure_ascii=False));raise SystemExit(1)

if __name__ == '__main__':main()
