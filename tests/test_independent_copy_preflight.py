"""独立安装副本必须是完整普通文件树，不能忽略目录或悬空链接。"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


def module():
    spec = importlib.util.spec_from_file_location('independent_copy', ROOT / 'scripts/verify_independent_skill_install.py')
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


class IndependentCopyPreflightTests(unittest.TestCase):
    def test_regular_digest_remains_compatible(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'scripts').mkdir()
            (root / 'SKILL.md').write_text('skill')
            (root / 'scripts/cli.py').write_text('launcher')
            expected = hashlib.sha256()
            for relative in ('SKILL.md', 'scripts/cli.py'):
                expected.update(relative.encode() + b'\0')
                expected.update(hashlib.sha256((root / relative).read_bytes()).hexdigest().encode() + b'\n')
            self.assertEqual(module().skill_hash(root), expected.hexdigest())

    def test_all_link_entries_are_rejected(self):
        for kind in ('directory', 'dangling', 'root', 'parent'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                skill = root / 'skills/filmcraft-cli'
                skill.mkdir(parents=True)
                (skill / 'SKILL.md').write_text('skill')
                external = root / 'external'
                external.mkdir()
                (external / 'payload').write_text('outside')
                if kind == 'directory':
                    (skill / 'linked').symlink_to(external, target_is_directory=True)
                elif kind == 'dangling':
                    (skill / 'linked').symlink_to(root / 'absent')
                elif kind == 'root':
                    linked = root / 'linked'
                    linked.symlink_to(skill, target_is_directory=True)
                    skill = linked
                else:
                    linked = root / 'linked'
                    linked.symlink_to(skill.parent, target_is_directory=True)
                    skill = linked / skill.name
                with self.assertRaisesRegex(ValueError, 'independent_skill_symlink'):
                    module().skill_hash(skill)
                self.assertEqual((external / 'payload').read_text(), 'outside')

    def test_special_entry_and_missing_tree_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            os.mkfifo(root / 'pipe')
            with self.assertRaisesRegex(ValueError, 'independent_skill_entry_invalid'):
                module().skill_hash(root)

    def test_missing_skill_tree_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(ValueError, 'independent_skill_directory_missing'):
                module().skill_hash(Path(temporary) / 'absent')

    def test_installed_link_cannot_reach_native_probe_or_receipt(self):
        for kind in ('directory', 'dangling', 'root', 'parent'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                source = root / 'source'
                (source / 'scripts').mkdir(parents=True)
                (source / 'SKILL.md').write_text('fixture')
                (source / 'scripts/cli.py').write_text('fixture launcher')
                (source / 'scripts/runtime.lock.json').write_text(json.dumps({'resolvedVersion': '0.2.0-craft.4'}))
                m = module()
                m.NAMES = ('filmcraft',)
                expected = m.skill_hash(source)
                lock = {'plugins': {'filmcraft': {'skillSourceRef': 'v0.1.0-dev.34', 'skillSourceSha': 'a' * 40, 'skills': {'filmcraft-cli': expected}}}}
                for name in ('node', 'cli', 'python'):
                    (root / name).write_text('tool')
                output = root / 'output'
                native_calls = []
                def run(argv, **kwargs):
                    if 'add' in argv:
                        target = Path(kwargs['cwd']) / '.agents/skills/filmcraft-cli'
                        shutil.copytree(source, target)
                        if kind == 'directory':
                            (target / 'linked').symlink_to(source, target_is_directory=True)
                        elif kind == 'dangling':
                            (target / 'linked').symlink_to(root / 'absent')
                        elif kind == 'root':
                            shutil.rmtree(target)
                            target.symlink_to(source, target_is_directory=True)
                        else:
                            parent = target.parent
                            external = root / 'installed-external'
                            parent.rename(external)
                            parent.symlink_to(external, target_is_directory=True)
                        value = 'installed'
                    elif '-I' in argv:
                        native_calls.append(argv)
                        value = 'filmcraft-cli 0.2.0-craft.4'
                    else:
                        value = '1.7.0'
                    return SimpleNamespace(returncode=0, stdout=value, stderr='')
                with patch.object(m.subprocess, 'run', side_effect=run):
                    with self.assertRaisesRegex(ValueError, 'independent_skill_symlink'):
                        m.verify(root / 'node', root / 'cli', root / 'python', lock, output)
                self.assertEqual(native_calls, [])
                self.assertFalse((output / 'receipt.json').exists())
                self.assertEqual(m.skill_hash(source), expected)


if __name__ == '__main__':
    unittest.main()
