"""固定首用失败证据须验证退出码、原始错误及本技能恢复位置。"""
from pathlib import Path
import importlib.util
import json
import tempfile
from types import SimpleNamespace
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/verify_setup_boundary.py'

class SetupBoundaryTests(unittest.TestCase):
    def module(self):
        spec = importlib.util.spec_from_file_location('setup_boundary', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def fixture(self, root):
        skill = root / '.agents/skills/photocraft-cli-selection'
        (skill / 'scripts').mkdir(parents=True)
        (skill / 'scripts/bootstrap.py').write_text('# fixture')
        runtime = root / 'empty runtime'
        reply = {'error': 'archive unavailable', 'result': 'failed',
                 'dependencySetup': {'skill': 'photocraft-cli-setup',
                    'bootstrapScript': str((skill/'scripts/bootstrap.py').resolve()),
                    'runtimeHome': str(runtime.resolve()), 'automaticRetry': False}}
        return skill, runtime, reply

    def test_exact_own_setup_diagnostic_is_accepted(self):
        with tempfile.TemporaryDirectory() as temporary:
            skill, runtime, reply = self.fixture(Path(temporary))
            result = SimpleNamespace(returncode=1, stdout=json.dumps(reply), stderr='')
            self.assertEqual(self.module().validate_failure(result, skill, runtime, 'photocraft')['error'], reply['error'])

    def test_success_unknown_retry_sibling_and_wrong_runtime_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            skill, runtime, original = self.fixture(Path(temporary))
            for change in ('exit', 'unknown', 'retry', 'sibling', 'runtime', 'empty', 'installed'):
                reply = json.loads(json.dumps(original)); code = 1
                if change == 'exit': code = 0
                elif change == 'unknown': reply['result'] = 'unknown'
                elif change == 'retry': reply['dependencySetup']['automaticRetry'] = True
                elif change == 'sibling': reply['dependencySetup']['bootstrapScript'] = str(skill.parent/'sibling/scripts/bootstrap.py')
                elif change == 'runtime': reply['dependencySetup']['runtimeHome'] = str(runtime.parent/'other')
                elif change == 'empty': reply['error'] = ''
                elif change == 'installed': reply['installed'] = True
                with self.subTest(change=change), self.assertRaises(ValueError):
                    self.module().validate_failure(SimpleNamespace(returncode=code,stdout=json.dumps(reply),stderr=''), skill, runtime, 'photocraft')

    def test_non_object_duplicate_and_non_finite_replies_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            skill, runtime, reply = self.fixture(Path(temporary))
            for text in ('[]', 'null', '{"error":"a","error":"b"}', '{"error":NaN}'):
                with self.subTest(text=text), self.assertRaises(ValueError):
                    self.module().validate_failure(SimpleNamespace(returncode=1,stdout=text,stderr=''), skill, runtime, 'photocraft')

if __name__ == '__main__':
    unittest.main()
