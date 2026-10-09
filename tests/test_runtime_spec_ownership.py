"""运行时场景必须归属于其正式需求，不能混入桌面交接需求。"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class RuntimeSpecOwnershipTests(unittest.TestCase):
    def groups(self):
        text = (ROOT / 'openspec/changes/establish-v1-plugin/specs/runtime-distribution/spec.md').read_text()
        groups = {}
        current = None
        for line in text.splitlines():
            requirement = re.match(r'### Requirement: (\S+)', line)
            if requirement:
                current = requirement.group(1)
                groups[current] = []
            elif line.startswith('#### Scenario: '):
                groups[current].append(line.removeprefix('#### Scenario: '))
        return groups

    def test_runtime_upgrade_owns_all_seventeen_named_scenarios(self):
        groups = self.groups()
        named = [name for names in groups.values() for name in names
                 if 'AC-RT-002' in name or name == '领域 CLI 并行安装与复用']
        self.assertEqual(len(named), 17)
        self.assertEqual(set(groups['AC-RT-002']), set(named))

    def test_desktop_handoff_keeps_its_four_separate_scenarios(self):
        self.assertEqual(set(self.groups()['AC-DS-001']), {
            'Desktop command first use',
            'Conflicting connection or untrusted receipt',
            'Desktop handoff receipt or metadata conflict',
            'Mode-aware bridge-only tools',
        })
