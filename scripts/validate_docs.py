#!/usr/bin/env python3
"""Validate documentation integrity and OpenSpec traceability; not product behavior."""
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import sys
import subprocess

ROOT = Path(__file__).resolve().parents[1]
errors = []
markdown = sorted(ROOT.rglob('*.md'))
markdown = [p for p in markdown if '.git' not in p.parts]
for path in markdown:
    text = path.read_text(encoding='utf-8')
    relative = str(path.relative_to(ROOT))
    if re.search(r'\{\{[A-Z][A-Z_]*\}\}', text):
        errors.append(f'{relative}: unresolved machine placeholder')
    if re.search(r'/(?:Users|home)/[A-Za-z0-9_.-]+/', text):
        errors.append(f'{relative}: private absolute path')
    if re.search(r'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{24,})', text):
        errors.append(f'{relative}: possible credential')
    fenced = False
    h1 = 0
    for line in text.splitlines():
        if line.startswith('```'):
            if not fenced and not line[3:].strip():
                errors.append(f'{relative}: unlabeled code fence')
            fenced = not fenced
        elif not fenced and line.startswith('# '):
            h1 += 1
    if fenced:
        errors.append(f'{relative}: unbalanced code fence')
    if h1 > 1:
        errors.append(f'{relative}: multiple H1 headings')
    for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
        target = target.strip('<>')
        parsed = urlsplit(target)
        if parsed.scheme or target.startswith('#'):
            continue
        destination = (path.parent / unquote(parsed.path)).resolve()
        if not destination.is_relative_to(ROOT):
            errors.append(f'{relative}: escaping link {target}')
        elif not destination.exists():
            errors.append(f'{relative}: missing link {target}')

manifest = json.loads((ROOT / 'plugin.json').read_text())
status = json.loads((ROOT / 'project-status.json').read_text())
lock = json.loads((ROOT / 'skills.lock.json').read_text())
if not re.fullmatch(r'0\.1\.0-dev\.\d+', manifest['version']) or status['stage'] not in ('documentation-baseline', 'implementation-in-progress'):
    errors.append('documentation status and metadata mismatch')
if status['marketplaceEligible'] or status['supportedPluginHosts']:
    errors.append('unaccepted implementation claims marketplace or host support')
if lock['sources']:
    if status['stage'] != 'implementation-in-progress':
        errors.append('published skill snapshots require implementation stage')
    else:
        verified = subprocess.run([sys.executable, str(ROOT/'scripts/vendor/skill_vendor.py'), 'check', '--offline'], cwd=ROOT, capture_output=True, text=True)
        if verified.returncode:
            errors.append('skill snapshot verification failed: '+verified.stdout.strip())

change = ROOT / status['specAuthority']
spec_files = sorted((change / 'specs').glob('*/spec.md'))
requirements = []
scenario_count = 0
for spec in spec_files:
    text = spec.read_text()
    for block in re.split(r'^### Requirement: ', text, flags=re.M)[1:]:
        identifier = block.split()[0]
        requirements.append(identifier)
        scenarios = re.findall(r'^#### Scenario: ', block, flags=re.M)
        scenario_count += len(scenarios)
        if len(scenarios) < 2 or 'SHALL' not in block:
            errors.append(f'{identifier}: needs normative behavior and positive/negative scenarios')
        if '**WHEN**' not in block or '**THEN**' not in block:
            errors.append(f'{identifier}: missing observable scenario')
if len(requirements) != len(set(requirements)):
    errors.append('duplicate requirement IDs')
tasks = (change / 'tasks.md').read_text()
# 与 CI 固定 OpenSpec 的任务分组约束一致，旧 CLI 也能提前发现错放。
current_group = None
for line in tasks.splitlines():
    heading = re.match(r'^## ([0-9]+)\.', line)
    if heading:
        current_group = heading[1]
    task = re.match(r'^- \[[ xX]\] ([0-9]+)\.([0-9]+) ', line)
    if task and task[1] != current_group:
        errors.append(f'task {task[1]}.{task[2]} is under group {current_group}, expected group {task[1]}')
task_ids = re.findall(r'^- \[[ xX]\] ([0-9.]+) ', tasks, flags=re.M)
duplicate_task_ids = sorted(task for task, count in Counter(task_ids).items() if count > 1)
if duplicate_task_ids:
    errors.append('duplicate task IDs: '+', '.join(duplicate_task_ids))
for completed in re.findall(r'^- \[[xX]\] ([0-9.]+) ', tasks, flags=re.M):
    evidence = status.get('taskEvidence', {}).get(completed)
    if status['stage'] == 'documentation-baseline' or not evidence or not (ROOT / evidence).is_file():
        errors.append(f'completed task {completed} needs implementation-stage evidence')
trace = json.loads((ROOT / 'docs/traceability.json').read_text())['entries']
if {e['requirement'] for e in trace} != set(requirements):
    errors.append('traceability requirements differ from OpenSpec')
for entry in trace:
    for task in entry['tasks']:
        if task not in task_ids:
            errors.append(f'missing task {task} for {entry["requirement"]}')
        if not re.search(r'^- \[[ xX]\] '+re.escape(task)+r' \['+re.escape(entry['requirement'])+r'\]', tasks, re.M):
            errors.append(f'task {task} points at the wrong requirement')
proposal = (change / 'proposal.md').read_text()
new_caps = proposal.split('### New Capabilities',1)[1].split('### Modified Capabilities',1)[0]
declared = set(re.findall(r'^- `([^`]+)`:', new_caps, flags=re.M))
if declared != {f.parent.name for f in spec_files}:
    errors.append('proposal capabilities and spec directories differ')

product_dirs = list((ROOT / 'product-docs').iterdir())
if len(product_dirs) != 1:
    errors.append('expected one product documentation root')
else:
    product = product_dirs[0]
    for directory, expected in [(product,10),(product/'V1',7),(product/'en',10),(product/'en/V1',7)]:
        if len(list(directory.glob('*.md'))) != expected:
            errors.append(f'{directory.relative_to(ROOT)}: wrong document count')
# 当前身份由仓内事实源校验；不要求其他插件检出，不改写历史验收。
if len(lock.get('sources', [])) != 1:
    errors.append('current README identity: one skill authority required')
else:
    source = lock['sources'][0]
    version_pattern = r'(?:^|\s|/)v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?)'
    for language in ('README.md', 'README.zh-CN.md'):
        text = (ROOT / language).read_text()
        for field, labels, expected in [
            ('plugin', 'Metadata version|Plugin ID / version|Plugin ID / 版本', manifest['version']),
            ('skills', 'Skills source|Skill authority|技能事实源', source['ref'].removeprefix('v')),
        ]:
            rows = re.findall(r'^\| (?:' + labels + r') \| ([^|]+) \|$', text, re.M)
            observed = re.findall(version_pattern, rows[0]) if len(rows) == 1 else []
            if observed != [expected] or field == 'skills' and source['package'] not in rows[0]:
                errors.append(f'{language}: current README identity {field} differs from manifest/lock')
        current = re.search(r'^Current plugin: `([^`]+)`; skill source: `([^`]+)`;', text, re.M)
        if current and current.groups() != (manifest['version'], source['ref'].removeprefix('v')):
            errors.append(f'{language}: current README identity paragraph differs from manifest/lock')

for language in ['README.md','README.zh-CN.md']:
    text=(ROOT/language).read_text()
    if any(req not in (ROOT/'docs/traceability.json').read_text() for req in requirements):
        errors.append('missing requirement mapping')
en_sections=len(re.findall(r'^## ',(ROOT/'README.md').read_text(),re.M))
zh_sections=len(re.findall(r'^## ',(ROOT/'README.zh-CN.md').read_text(),re.M))
if en_sections!=zh_sections:
    errors.append('README languages differ in section coverage')

for path in ROOT.rglob('*.json'):
    if '.git' not in path.parts:
        try:
            json.loads(path.read_text())
        except (json.JSONDecodeError,UnicodeDecodeError) as exc:
            errors.append(f'{path.relative_to(ROOT)}: invalid JSON: {exc}')
result={'status':'failed' if errors else 'passed','scope':'documentation structure, local links, status honesty and spec/task traceability only','markdownFiles':len(markdown),'capabilities':len(spec_files),'requirements':len(requirements),'scenarios':scenario_count,'openImplementationTasks':len(re.findall(r'^- \[ \] ',tasks,re.M)),'errors':errors}
print(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(bool(errors))
