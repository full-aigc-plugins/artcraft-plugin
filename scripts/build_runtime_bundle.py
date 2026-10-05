#!/usr/bin/env python3
"""从插件运行时与独立技能源生成确定性发布包及锁；不修改上游源。"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

VERSION = '0.1.0-dev.0'
NAMES = ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def bundle(source, files, destination, repository):
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
    return {'filename': destination.name, 'url': f'https://github.com/{repository}/releases/download/v{VERSION}/{destination.name}', 'sha256': digest(destination.read_bytes()), 'bytes': destination.stat().st_size, 'files': hashes, 'sourceRepository': f'https://github.com/{repository}'}


def build(plugin_root, skills_root, output, lock_path):
    output.mkdir(parents=True, exist_ok=True)
    files = [plugin_root/'LICENSE', plugin_root/'package.json', *plugin_root.glob('src/**/*.ts'), *plugin_root.glob('schemas/*.json')]
    entries = {'artcraft-runtime': bundle(plugin_root, files, output/f'artcraft-runtime-{VERSION}.zip', 'full-aigc-plugins/artcraft-plugin')}
    for name in NAMES:
        source = skills_root/(name+'-skills')
        files = [source/'LICENSE', *[p for p in (source/'skills'/(name+'-use')).rglob('*') if p.is_file() and '__pycache__' not in p.parts]]
        entries[name+'-skills'] = bundle(source, files, output/f'{name}-skills-{VERSION}.zip', 'full-aigc-skills/'+name+'-skills')
    lock = {'schema': 'artcraft-distribution/v1', 'version': VERSION, 'bundles': entries}
    lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2)+'\n')
    return lock


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skills-root', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--lock-output', type=Path, required=True)
    args = parser.parse_args()
    result = build(Path(__file__).resolve().parents[1], args.skills_root.resolve(), args.output.resolve(), args.lock_output.resolve())
    print(json.dumps({'version': VERSION, 'bundleCount': len(result['bundles']), 'output': str(args.output)}))

if __name__ == '__main__':
    main()
