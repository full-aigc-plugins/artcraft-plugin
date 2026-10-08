#!/usr/bin/env python3
"""只读核对五套当前来源、安装副本与首次使用证据；完整规范逐场景保留待审状态。"""
import argparse
import hashlib
import importlib.util
import json
import io
import tarfile
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('craft_completion_host', ROOT/'scripts/verify_codex_host.py')
_host = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_host)


def parse_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('audit_duplicate_json_key: ' + key)
            result[key] = value
        return result
    return json.loads(text, object_pairs_hook=pairs)


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def validate_cold_inventory(lock, proof):
    expected = {(domain, name): sha for domain, item in lock['plugins'].items()
                for name, sha in item['skills'].items()}
    seen = set()
    if proof.get('result') != 'PASS' or proof.get('count') != len(expected):
        raise ValueError('audit_cold_summary_invalid')
    for record in proof.get('records', []):
        key = (record.get('pluginId'), record.get('skill'))
        if key in seen or key not in expected or record.get('sha256') != expected[key]:
            raise ValueError('audit_cold_identity_invalid')
        if record.get('independentColdRuntime') is not True or not record.get('run'):
            raise ValueError('audit_cold_scope_invalid')
        seen.add(key)
    if seen != set(expected):
        raise ValueError('audit_cold_inventory_incomplete')
    return len(seen)


def specification_inventory(text, relative_path):
    """逐条保留完整合同摘要，不由安装计数或 tasks 勾选推断规范完成。"""
    rows = []
    matches = list(re.finditer(r'^### Requirement: (.+)$', text, re.MULTILINE))
    for index, match in enumerate(matches):
        section = text[match.start():matches[index+1].start() if index+1<len(matches) else len(text)]
        scenarios = list(re.finditer(r'^#### Scenario: (.+)$', section, re.MULTILINE))
        row = {'requirement': match[1], 'path': relative_path,
               'line': text.count('\n', 0, match.start())+1,
               'contractSha256': hashlib.sha256(section.encode()).hexdigest(),
               'status': 'requires_scenario_evidence_review', 'scenarios': []}
        for number, scenario in enumerate(scenarios):
            block = section[scenario.start():scenarios[number+1].start() if number+1<len(scenarios) else len(section)]
            row['scenarios'].append({'name': scenario[1],
                'contractSha256': hashlib.sha256(block.encode()).hexdigest(),
                'status': 'not_proven_by_installation_inventory'})
        rows.append(row)
    return rows


def git_tag(repo, ref):
    return subprocess.check_output(['git', '-C', str(repo), 'rev-parse', '--verify', ref+'^{commit}'], text=True).strip()


def verify_source_export(repo, entry):
    """标签归档与当前受控技能文件逐字节比较；不修改或混入本地忽略缓存。"""
    changed = subprocess.run(['git', '-C', str(repo), 'diff', '--quiet', entry['skillSourceRef'], '--', 'skills'])
    if changed.returncode:
        raise ValueError('audit_tracked_source_drift')
    archive = subprocess.check_output(['git', '-C', str(repo), 'archive', '--format=tar', entry['skillSourceRef'], 'skills'])
    files = {name: [] for name in entry['skills']}
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        for member in tar:
            if member.isdir():
                continue
            path = Path(member.name)
            if not member.isfile() or path.is_absolute() or '..' in path.parts or len(path.parts)<3 or path.parts[0]!='skills' or path.parts[1] not in files:
                raise ValueError('audit_source_archive_invalid')
            content = tar.extractfile(member).read()
            current = repo/path
            if current.is_symlink() or not current.is_file() or current.read_bytes()!=content:
                raise ValueError('audit_tracked_source_drift')
            files[path.parts[1]].append((Path(*path.parts[2:]).as_posix(), content))
    for name, rows in files.items():
        hashed = hashlib.sha256()
        for relative, content in sorted(rows):
            hashed.update(relative.encode()+b'\0')
            hashed.update(hashlib.sha256(content).hexdigest().encode()+b'\n')
        if hashed.hexdigest()!=entry['skills'][name]:
            raise ValueError('audit_source_tag_hash_mismatch')
    # 仅报告，不删除本地未跟踪或被忽略材料，也不将它们当作发行内容。
    extra = subprocess.check_output(['git','-C',str(repo),'ls-files','--others','--exclude-standard','--','skills'],text=True).splitlines()
    ignored = subprocess.check_output(['git','-C',str(repo),'ls-files','--others','--ignored','--exclude-standard','--','skills'],text=True).splitlines()
    return {'tagAndTrackedFiles':'match', 'untrackedSkillFiles':len(extra),
            'ignoredSkillFiles':len(ignored), 'wholeWorkingTreeClaim':'not asserted'}


def audit(plugins_root, skills_root, lock_path, proof_path, host_path):
    lock = parse_json(Path(lock_path).read_text())
    proof = parse_json(Path(proof_path).read_text())
    host = parse_json(Path(host_path).read_text())
    _host.validate_lock(lock)
    if proof.get('result') != 'PASS' or proof.get('hostLock') != lock:
        raise ValueError('audit_evidence_not_current_lock')
    recorded_host = proof.get('host', {})
    if recorded_host.get('result') != 'passed' or recorded_host.get('loadingErrors') != 0:
        raise ValueError('audit_host_evidence_invalid')
    if host.get('result') != 'passed' or host.get('loadingErrors') != 0:
        raise ValueError('audit_installed_host_invalid')
    cold_count = validate_cold_inventory(lock, proof.get('current64ColdIdentityProof', {}))
    domains = []
    for name, entry in lock['plugins'].items():
        plugin_repo = Path(plugins_root)/(name+'-plugin')
        skill_repo = Path(skills_root)/(name+'-skills')
        if git_tag(plugin_repo, entry['ref']) != entry['sha'] or git_tag(skill_repo, entry['skillSourceRef']) != entry['skillSourceSha']:
            raise ValueError('audit_tag_identity_mismatch: '+name)
        for observed in (recorded_host, host):
            matches = [r for r in observed.get('plugins', []) if r.get('pluginId') == name]
            if len(matches) != 1:
                raise ValueError('audit_host_inventory_invalid')
            row = matches[0]
            identities = {'version': entry['version'], 'sourceSha': entry['sha'],
                          'skillSourceSha': entry['skillSourceSha'],
                          'pluginManifestSha256': entry['pluginManifestSha256'],
                          'skillSha256': entry['skillSha256'], 'enabled': True}
            if any(row.get(k) != v for k, v in identities.items()):
                raise ValueError('audit_host_identity_mismatch')
            discovered = row.get('skills', [])
            expected = {name+':'+n: sha for n, sha in entry['skills'].items()}
            if len(discovered) != len(expected) or {r.get('name'):r.get('sha256') for r in discovered} != expected or any(r.get('enabled') is not True for r in discovered):
                raise ValueError('audit_host_skill_identity_mismatch')
        installed_use = Path(host['skillDirectories'][name])
        expected_names = set(entry['skills'])
        source_identity = verify_source_export(skill_repo, entry)
        for tree in (plugin_repo/'skills', installed_use.parent):
            if tree.is_symlink() or {p.name for p in tree.iterdir() if p.is_dir()} != expected_names:
                raise ValueError('audit_current_tree_inventory_mismatch: '+name)
            for skill, expected in entry['skills'].items():
                if (tree/skill).is_symlink() or _host.skill_hash(tree/skill) != expected:
                    raise ValueError('audit_current_skill_drift: '+name+':'+skill)
        for skill in entry['skills']:
            _host.verify_installed_skill(installed_use.parent/skill, entry)
        specs_root = plugin_repo/'openspec/changes/establish-v1-plugin'
        specifications = []
        specification_files = []
        for path in sorted((specs_root/'specs').glob('*/spec.md')):
            relative = path.relative_to(plugin_repo).as_posix()
            specification_files.append({'path': relative, 'sha256': digest(path)})
            specifications.extend(specification_inventory(path.read_text(), relative))
        if not specifications:
            raise ValueError('audit_formal_specifications_missing')
        tasks_path = specs_root/'tasks.md'
        open_tasks = [{'line': n, 'text': line} for n,line in enumerate(tasks_path.read_text().splitlines(),1)
                      if re.match(r'^- \[ \]', line)]
        domains.append({'plugin': name, 'version': entry['version'],
            'skillSourceRef': entry['skillSourceRef'], 'skillSourceSha': entry['skillSourceSha'],
            'skills': len(entry['skills']), 'sourceIdentity': source_identity,
            'currentPluginInstalledHashes': 'match',
            'specificationFiles': specification_files, 'requirements': specifications,
            'openTasks': open_tasks, 'tasksSha256': digest(tasks_path)})
    return {'schema': 'craft-first-use-completion-audit/v1',
        'goalStatus': 'not_complete',
        'currentInstallationIdentity': {'result': 'passed', 'skills': cold_count,
            'scope': 'Current tracked skill-source files match the fixed-tag archive; plugin/installed full trees rehashed; local immutable tags and recorded host discovery match the exact lock. Ignored source files are separately reported.'},
        'recordedColdInstallation': {'result': 'identity_current', 'skills': cold_count,
            'scope': proof['current64ColdIdentityProof'].get('scope'),
            'newNativeExecution': False},
        'evidenceFingerprint': digest(proof_path), 'hostLockFingerprint': digest(lock_path),
        'installedHostFingerprint': digest(host_path), 'domains': domains,
        'remainingEvidence': proof.get('unverified', []),
        'formalCompletion': 'Each requirement and scenario needs its complete matching implementation/runtime evidence; this inventory does not accept or close them.',
        'excluded': ['New native execution', 'Actual generic Skills CLI installation',
                     'Model dispatch', 'Human creative acceptance', 'Other platforms', 'Production'],
        'writes': 'Only the explicitly requested new audit output; no task, source, runtime, installed skill or index changes.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--plugins-root', type=Path, required=True)
    parser.add_argument('--skills-root', type=Path, required=True)
    parser.add_argument('--lock', type=Path, default=ROOT/'host-acceptance-art124.lock.json')
    parser.add_argument('--evidence', type=Path, default=ROOT/'docs/evidence/craft-art124-film-time-fixed-first-use-20261008.json')
    parser.add_argument('--host-receipt', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        raise ValueError('audit_output_exists')
    report = audit(args.plugins_root, args.skills_root, args.lock, args.evidence, args.host_receipt)
    with args.output.open('x') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
        stream.write('\n')
    print(json.dumps({'goalStatus': report['goalStatus'],
                      'identity': report['currentInstallationIdentity'],
                      'requirements': sum(len(d['requirements']) for d in report['domains']),
                      'openTasks': sum(len(d['openTasks']) for d in report['domains'])}))

if __name__ == '__main__':
    main()
