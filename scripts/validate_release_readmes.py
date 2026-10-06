#!/usr/bin/env python3
"""只读核对五插件中英文 README 当前版本与 manifest／技能源锁。"""
import argparse
import hashlib
import json
from pathlib import Path
import re

DOMAINS = ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft', 'artcraft')


def audit(repositories):
    errors, records = [], []
    for domain in DOMAINS:
        root = repositories / (domain + '-plugin')
        manifest = json.loads((root / 'plugin.json').read_text())
        sources = json.loads((root / 'skills.lock.json').read_text())['sources']
        if len(sources) != 1:
            raise ValueError('one_skill_authority_required:' + domain)
        source = sources[0]
        for filename in ('README.md', 'README.zh-CN.md'):
            path = root / filename
            text = path.read_text()
            plugin_rows = re.findall(r'^\| (?:Metadata version|Plugin ID / version|Plugin ID / 版本) \| ([^|]+) \|$', text, re.M)
            source_rows = re.findall(r'^\| (?:Skills source|Skill authority|技能事实源) \| ([^|]+) \|$', text, re.M)
            for label, rows, expected in [('plugin', plugin_rows, manifest['version']), ('skills', source_rows, source['ref'].removeprefix('v'))]:
                observed = re.findall(r'(?:^|\s|/)v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?)', rows[0]) if len(rows) == 1 else []
                if observed != [expected]:
                    errors.append({'pluginId': domain, 'file': filename, 'field': label, 'expected': expected, 'observed': observed})
            if source_rows and source['package'] not in source_rows[0]:
                errors.append({'pluginId': domain, 'file': filename, 'field': 'sourcePackage', 'expected': source['package']})
            # 英文“当前插件”段不能继续给出旧插件或旧技能源版本。
            current = re.search(r'^Current plugin: `([^`]+)`; skill source: `([^`]+)`;', text, re.M)
            if current and current.groups() != (manifest['version'], source['ref'].removeprefix('v')):
                errors.append({'pluginId': domain, 'file': filename, 'field': 'currentReleaseParagraph', 'observed': list(current.groups())})
            records.append({'pluginId': domain, 'file': filename, 'pluginVersion': manifest['version'], 'skillPackage': source['package'], 'skillRef': source['ref'], 'readmeSha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    return {'schema': 'craft-release-readme-audit/v1', 'result': 'passed' if not errors else 'failed', 'records': records, 'errors': errors, 'scope': 'current release metadata only; historical evidence kept at original scope; no runtime acceptance'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repositories', required=True, type=Path)
    args = parser.parse_args()
    result = audit(args.repositories)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result['result'] == 'passed' else 1)
