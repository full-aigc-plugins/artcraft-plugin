"""当前 README 身份必须由仓内 CI 校验；历史验收记录保持原范围。"""
from pathlib import Path
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CurrentReadmeIdentityTests(unittest.TestCase):
    def test_local_docs_gate_rejects_stale_and_duplicate_current_identity(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / 'repo'
            shutil.copytree(ROOT, root, ignore=shutil.ignore_patterns(
                '.git', 'node_modules', '.codex', '.claude', '.local',
                '.runtime', '.codegraph', '__pycache__'))
            def validate():
                return subprocess.run([sys.executable, '-B', str(root / 'scripts/validate_docs.py')],
                                      cwd=root, capture_output=True, text=True)
            baseline = validate()
            self.assertEqual(baseline.returncode, 0, baseline.stdout + baseline.stderr)
            cases = [
                ('README.md', r'^(\| (?:Metadata version|Plugin ID / version|Plugin ID / 版本) \| )[^|]+( \|)$', 'plugin version'),
                ('README.zh-CN.md', r'^(\| (?:Skills source|Skill authority|技能事实源) \| )[^|]+( \|)$', 'skill source'),
            ]
            for filename, pattern, field in cases:
                with self.subTest(file=filename, field=field):
                    path = root / filename
                    original = path.read_text()
                    changed, count = re.subn(pattern, lambda m: m[1] + '0.0.0-stale' + m[2],
                                             original, flags=re.M)
                    self.assertEqual(count, 1)
                    path.write_text(changed)
                    negative = validate()
                    self.assertEqual(negative.returncode, 1, negative.stdout + negative.stderr)
                    self.assertTrue(any('current README identity' in e for e in json.loads(negative.stdout)['errors']))
                    path.write_text(original)
            path = root / 'README.md'
            original = path.read_text()
            row = next(line for line in original.splitlines()
                       if re.match(r'^\| (?:Metadata version|Plugin ID / version|Plugin ID / 版本) \|', line))
            path.write_text(original + '\n' + row + '\n')
            negative = validate()
            self.assertEqual(negative.returncode, 1, negative.stdout + negative.stderr)
            self.assertTrue(any('current README identity' in e for e in json.loads(negative.stdout)['errors']))

