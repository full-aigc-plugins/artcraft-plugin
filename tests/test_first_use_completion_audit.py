"""完成审计必须拒绝过期、重复、漏项和仅有成功计数的记录。"""
import copy
import sys
from contextlib import redirect_stdout
import importlib.util
from pathlib import Path
import unittest
import io
import tarfile
import tempfile
from types import SimpleNamespace
from unittest.mock import patch
import hashlib

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/audit_first_use_completion.py'

class FirstUseCompletionAuditTests(unittest.TestCase):
    def module(self):
        spec = importlib.util.spec_from_file_location('completion_audit', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def fixture(self):
        lock = {'plugins': {'filmcraft': {'skills': {'filmcraft-use': 'a'*64, 'filmcraft-cli': 'b'*64}}}}
        records = [{'pluginId': 'filmcraft', 'skill': name, 'sha256': digest,
                    'independentColdRuntime': True, 'run': 'fixed native run'}
                   for name, digest in lock['plugins']['filmcraft']['skills'].items()]
        return lock, {'result': 'PASS', 'count': 2, 'records': records}

    def test_default_audit_binds_current_lock_and_matching_evidence(self):
        module=self.module()
        with tempfile.TemporaryDirectory() as temporary:
            output=Path(temporary)/'audit.json'
            report={'goalStatus':'not_complete','currentInstallationIdentity':{},'domains':[]}
            argv=['audit','--plugins-root','fixture-plugins','--skills-root','fixture-skills',
                  '--host-receipt','fixture-host.json','--output',str(output)]
            with patch.object(sys,'argv',argv),patch.object(module,'audit',return_value=report) as audit,redirect_stdout(io.StringIO()):
                module.main()
            self.assertEqual(audit.call_args.args[2],module.ROOT/'host-acceptance-asr-caption.lock.json')
            self.assertEqual(audit.call_args.args[3],module.ROOT/'docs/evidence/craft-asr-caption-fixed-first-use-20261008.json')

    def test_explicit_historical_lock_and_evidence_remain_supported(self):
        module = self.module()
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'audit.json'
            report = {'goalStatus': 'not_complete', 'currentInstallationIdentity': {}, 'domains': []}
            argv = ['audit', '--plugins-root', 'fixture-plugins', '--skills-root', 'fixture-skills',
                    '--lock', 'historical.lock.json', '--evidence', 'historical-proof.json',
                    '--host-receipt', 'historical-host.json', '--output', str(output)]
            with patch.object(sys, 'argv', argv), patch.object(module, 'audit', return_value=report) as audit, redirect_stdout(io.StringIO()):
                module.main()
            self.assertEqual(audit.call_args.args[2:4], (Path('historical.lock.json'), Path('historical-proof.json')))

    def test_current_exact_inventory_is_accepted(self):
        lock, proof = self.fixture()
        self.assertEqual(self.module().validate_cold_inventory(lock, proof), 2)

    def test_stale_digest_duplicate_missing_or_warm_run_is_rejected(self):
        lock, original = self.fixture()
        mutations = [lambda p: p['records'][0].update(sha256='c'*64),
                     lambda p: p['records'].append(copy.deepcopy(p['records'][0])),
                     lambda p: p['records'].pop(),
                     lambda p: p['records'][0].update(independentColdRuntime=False),
                     lambda p: p['records'][0].pop('run')]
        for mutate in mutations:
            proof = copy.deepcopy(original); mutate(proof)
            with self.subTest(proof=proof), self.assertRaises(ValueError):
                self.module().validate_cold_inventory(lock, proof)

    def test_success_count_without_records_is_rejected(self):
        lock, proof = self.fixture(); proof['records'] = []
        with self.assertRaises(ValueError):
            self.module().validate_cold_inventory(lock, proof)

    def test_checked_tasks_do_not_prove_formal_scenarios(self):
        module = self.module()
        text = ('# Spec\n### Requirement: FC-SK-003 Install\nSHALL install.\n'
                '#### Scenario: Cold start\n- **WHEN** first use\n- **THEN** install\n')
        rows = module.specification_inventory(text, 'spec.md')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['status'], 'requires_scenario_evidence_review')
        self.assertEqual(rows[0]['requirement'], 'FC-SK-003 Install')
        self.assertEqual(rows[0]['scenarios'][0]['status'], 'not_proven_by_installation_inventory')
        self.assertEqual(len(rows[0]['scenarios'][0]['contractSha256']), 64)

    def test_duplicate_json_keys_cannot_replace_evidence(self):
        with self.assertRaisesRegex(ValueError, 'audit_duplicate_json_key'):
            self.module().parse_json('{"result":"FAIL","result":"PASS"}')

class SourceExportAuditTests(unittest.TestCase):
    def test_fixed_export_ignores_cache_but_rejects_tracked_edits(self):
        module = FirstUseCompletionAuditTests().module()
        with tempfile.TemporaryDirectory() as temporary:
            repo = Path(temporary)
            skill = repo/'skills/filmcraft-use'; skill.mkdir(parents=True)
            (skill/'SKILL.md').write_bytes(b'fixed skill')
            (skill/'local.pyc').write_bytes(b'ignored cache')
            hashed = hashlib.sha256(b'SKILL.md\0'+hashlib.sha256(b'fixed skill').hexdigest().encode()+b'\n').hexdigest()
            data = io.BytesIO()
            with tarfile.open(fileobj=data, mode='w') as tar:
                member = tarfile.TarInfo('skills/filmcraft-use/SKILL.md'); member.size=11
                tar.addfile(member, io.BytesIO(b'fixed skill'))
            def output(argv, **kwargs):
                if 'archive' in argv: return data.getvalue()
                return 'skills/filmcraft-use/local.pyc\n' if '--ignored' in argv else ''
            entry = {'skillSourceRef':'v0.1.0-dev.29','skills':{'filmcraft-use':hashed}}
            with patch.object(module.subprocess,'run',return_value=SimpleNamespace(returncode=0)), patch.object(module.subprocess,'check_output',side_effect=output):
                result=module.verify_source_export(repo,entry)
                self.assertEqual(result['ignoredSkillFiles'],1)
                self.assertEqual((skill/'local.pyc').read_bytes(),b'ignored cache')
                (skill/'SKILL.md').write_bytes(b'changed skill')
                with self.assertRaisesRegex(ValueError,'audit_tracked_source_drift'):
                    module.verify_source_export(repo,entry)

    def test_nonzero_git_diff_does_not_accept_source(self):
        module = FirstUseCompletionAuditTests().module()
        with patch.object(module.subprocess,'run',return_value=SimpleNamespace(returncode=1)), patch.object(module.subprocess,'check_output') as archive:
            with self.assertRaisesRegex(ValueError,'audit_tracked_source_drift'):
                module.verify_source_export(Path('fixture'),{'skillSourceRef':'v0.1.0-dev.29'})
            archive.assert_not_called()

if __name__ == '__main__':
    unittest.main()
