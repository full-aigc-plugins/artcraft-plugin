"""当前宿主安装的十个独立技能必须在任何安装或输出前拒绝重复计划键。"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]


def files(root):
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file()}


@unittest.skipUnless(os.environ.get('CRAFT_INSTALLED_PLAN_JSON') == '1',
                     'requires current pinned host installation and retained isolated output')
class InstalledPlanJsonTests(unittest.TestCase):
    def test_all_installed_entries_refuse_before_side_effects(self):
        source = Path(os.environ['CRAFT_INSTALLED_PLAN_SKILLS']).resolve()
        root = Path(os.environ['CRAFT_INSTALLED_PLAN_ROOT']).resolve()
        root.mkdir(parents=True, exist_ok=False)
        lock = json.loads((ROOT / 'host-acceptance-art130.lock.json').read_text())
        expected = lock['plugins']['artcraft']['skills']
        plans = [
            '{"schema":"craft-command-plan/v1","schema":"craft-command-plan/v1","operations":[]}',
            '{"schema":"craft-command-plan/v1","operations":[{"command":"x","command":"y","params":{}}]}',
            '{"schema":"craft-command-plan/v1","operations":[{"command":"x","params":{"opacity":1,"opacity":0}}]}'
        ]
        # 使用宿主验收自身的目录摘要算法，避免文件清单替代发行身份。
        sys.path.insert(0, str(ROOT / 'scripts'))
        from verify_codex_host import skill_hash
        before = {name: files(source / name) for name in expected}
        calls = []
        started = time.monotonic()
        for name, digest in expected.items():
            original = source / name
            self.assertEqual(skill_hash(original), digest)
            entry_root = root / name
            skill = entry_root / '.agents/skills' / name
            shutil.copytree(original, skill)
            self.assertEqual(skill_hash(skill), digest)
            runtime, output = entry_root / 'runtime', entry_root / 'output'
            plan_file = entry_root / 'plan.json'
            for domain in ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft'):
                for index, plan in enumerate(plans):
                    plan_file.write_text(plan)
                    for action in ('check', 'run'):
                        argv = [sys.executable, '-I', '-B', str(skill / 'scripts/domain_commands.py'),
                                action, domain, str(plan_file), '--runtime-home', str(runtime)]
                        if action == 'run':
                            argv.extend(['--output', str(output)])
                        result = subprocess.run(argv, capture_output=True, text=True, timeout=20)
                        identifier = f'{domain}-{index}-{action}'
                        (entry_root / f'{identifier}.stdout').write_text(result.stdout)
                        (entry_root / f'{identifier}.stderr').write_text(result.stderr)
                        calls.append({'skill': name, 'domain': domain, 'case': index,
                                      'action': action, 'exitCode': result.returncode})
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn('duplicate_json_key', result.stdout + result.stderr)
                        self.assertFalse(runtime.exists())
                        self.assertFalse(output.exists())
            self.assertEqual(files(original), before[name])
            self.assertEqual(skill_hash(skill), digest)
        self.assertEqual(len(calls), 240)
        proof = {'schema': 'artcraft-installed-plan-json/v1', 'result': 'PASS',
                 'hostLockSha256': hashlib.sha256((ROOT / 'host-acceptance-art130.lock.json').read_bytes()).hexdigest(),
                 'skillDigests': expected, 'calls': calls, 'seconds': round(time.monotonic()-started, 3),
                 'runtimeAndOutputCreated': False, 'installedAndCopiedSkillBytesPreserved': True,
                 'scope': 'current installed public Python gateways; rejection only, not native mixed acceptance'}
        (root / 'proof.json').write_text(json.dumps(proof, indent=2)+'\n')
