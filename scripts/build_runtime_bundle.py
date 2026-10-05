#!/usr/bin/env python3
"""从插件运行时与独立技能源生成确定性发布包及锁；不修改上游源。"""
import argparse
import hashlib
import json
from pathlib import Path
from pathlib import PurePosixPath
import io
import re
import subprocess
import tarfile
import tempfile
import zipfile

NAMES = ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def bundle(source, files, destination, repository, version):
    hashes = {}
    with zipfile.ZipFile(destination, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(files):
            if path.is_symlink():
                raise ValueError('source_symlink')
            name = str(path.relative_to(source))
            content = path.read_bytes();hashes[name] = digest(content)
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.create_system = 3;info.external_attr = 0o100644 << 16;info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content)
    return {'version': version, 'filename': destination.name, 'url': f'https://github.com/{repository}/releases/download/v{version}/{destination.name}', 'sha256': digest(destination.read_bytes()), 'bytes': destination.stat().st_size, 'files': hashes, 'sourceRepository': f'https://github.com/{repository}'}


def tagged_source(repository, version, destination, paths):
    """只读取不可变发行标签；拒绝链接及逃逸路径，不读取工作树。"""
    if not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?', version):
        raise ValueError('immutable_version_required')
    tag = 'refs/tags/v' + version
    sha = subprocess.check_output(['git', '-C', str(repository), 'rev-parse', '--verify', tag + '^{commit}'], text=True).strip()
    data = subprocess.check_output(['git', '-C', str(repository), 'archive', '--format=tar', sha, '--', *paths])
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive:
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or not (member.isfile() or member.isdir()):
                raise ValueError('unsafe_source_archive')
            target = destination.joinpath(*path.parts)
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as stream:
                    target.write_bytes(stream.read())
    return sha


def build(plugin_root, skills_root, output, lock_path, input_lock=None):
    """按锁重建五个发行包；全部验证后才输出，不覆盖不同内容的发布包。"""
    input_lock = input_lock or plugin_root / 'skills/artcraft-use/scripts/distribution.lock.json'
    lock = json.loads(input_lock.read_text())
    expected_names = {'artcraft-runtime', *[n + '-skills' for n in NAMES]}
    if lock.get('schema') != 'artcraft-distribution/v1' or set(lock.get('bundles', {})) != expected_names:
        raise ValueError('invalid_distribution_lock')
    with tempfile.TemporaryDirectory(prefix='artcraft-release-') as temporary:
        stage = Path(temporary); entries = {}
        for name, expected in lock['bundles'].items():
            runtime = name == 'artcraft-runtime'
            repository = 'full-aigc-plugins/artcraft-plugin' if runtime else 'full-aigc-skills/' + name
            version = expected['version']; filename = name + '-' + version + '.zip'
            if expected['filename'] != filename or expected['sourceRepository'] != 'https://github.com/' + repository:
                raise ValueError('distribution_source_mismatch')
            source = stage / name; source.mkdir()
            tagged_source(plugin_root if runtime else skills_root / name, version, source,
                          ['LICENSE', 'package.json', 'src', 'schemas'] if runtime else ['LICENSE', 'skills'])
            if runtime:
                files = [source/'LICENSE', source/'package.json', *source.glob('src/**/*.ts'), *source.glob('schemas/*.json')]
            else:
                files = [source/'LICENSE', *[p for p in (source/'skills').rglob('*') if p.is_file() and '__pycache__' not in p.parts]]
            actual = bundle(source, files, stage / filename, repository, version)
            if actual != expected:
                raise ValueError('locked_bundle_mismatch:' + name)
            entries[name] = actual
        # 先检查所有输出冲突，避免前几个包成功后才发现后续包不能发布。
        for entry in entries.values():
            target = output / entry['filename']
            if target.is_symlink() or (target.exists() and digest(target.read_bytes()) != entry['sha256']):
                raise ValueError('existing_release_conflict:' + entry['filename'])
        if lock_path.is_symlink() or (lock_path.exists() and json.loads(lock_path.read_text()) != lock):
            raise ValueError('existing_lock_conflict')
        output.mkdir(parents=True, exist_ok=True)
        for entry in entries.values():
            target = output / entry['filename']
            if not target.exists():
                with target.open('xb') as stream:
                    stream.write((stage / entry['filename']).read_bytes())
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        if not lock_path.exists():
            with lock_path.open('x') as stream:
                stream.write(json.dumps(lock, ensure_ascii=False, indent=2)+'\n')
    return lock


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skills-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--lock-output', type=Path, required=True)
    parser.add_argument('--input-lock', type=Path, help='固定发行锁；默认使用插件内置 distribution.lock.json')
    args = parser.parse_args()
    result = build(Path(__file__).resolve().parents[1], args.skills_root.resolve(), args.output.resolve(), args.lock_output.resolve(), args.input_lock)
    print(json.dumps({'version': result['version'], 'bundleCount': len(result['bundles']), 'output': str(args.output)}))

if __name__ == '__main__':
    main()
