"""开发版技能快照也必须绑定不可变版本，不允许分支或逃逸目的地。"""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('vendor',ROOT/'scripts/vendor/skill_vendor.py')
vendor=importlib.util.module_from_spec(spec);spec.loader.exec_module(vendor)

class VendorTests(unittest.TestCase):
    def source(self, ref='v0.1.0-dev.0', dest='skills/'):
        return {'package':'artcraft-skills','repo':'https://github.com/full-aigc-skills/artcraft-skills.git','ref':ref,'skills':['artcraft-use'],'dest':dest,'sha':'a'*40,'sha256':{'artcraft-use':'b'*64}}

    def test_development_tag_is_immutable_version(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary).resolve()
            self.assertEqual(vendor.validate_source(self.source(),root),root/'skills')

    def test_remote_ref_race_cannot_label_new_checkout_with_old_sha(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            with patch.object(vendor,'resolve_ref',return_value='a'*40), patch.object(vendor,'fetch_checkout',return_value=root), patch.object(vendor.subprocess,'run',return_value=SimpleNamespace(stdout='b'*40+'\n')):
                with self.assertRaisesRegex(RuntimeError,'fetched commit differs'):
                    vendor.source_checkout(self.source(),{},root)

    def test_branch_and_escaping_destination_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary).resolve()
            with self.assertRaisesRegex(RuntimeError,'immutable semantic version'):
                vendor.validate_source(self.source('main'),root)
            with self.assertRaisesRegex(RuntimeError,'escapes repository root'):
                vendor.validate_source(self.source('v0.1.0','../outside'),root)


    def test_local_override_uses_tag_not_dirty_worktree_or_cache(self):
        import subprocess
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            local = root / 'source'; local.mkdir()
            subprocess.run(['git', 'init', '-q', str(local)], check=True)
            skill = local / 'skills' / 'sample'; skill.mkdir(parents=True)
            (skill / 'SKILL.md').write_text('fixed tag content')
            (local / '.gitignore').write_text('__pycache__/\n')
            subprocess.run(['git', '-C', str(local), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(local), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], check=True)
            subprocess.run(['git', '-C', str(local), 'tag', 'v1.0.0'], check=True)
            expected = subprocess.check_output(['git', '-C', str(local), 'rev-parse', 'v1.0.0'], text=True).strip()
            (skill / 'SKILL.md').write_text('uncommitted worktree')
            cache = skill / '__pycache__'; cache.mkdir(); (cache / 'module.pyc').write_bytes(b'ignored local cache')
            work = root / 'fetch'; work.mkdir()
            source = {'package':'sample-skills', 'repo':str(local), 'ref':'v1.0.0'}
            checkout, sha = vendor.source_checkout(source, {'sample-skills':str(local)}, work)
            self.assertEqual(sha, expected)
            self.assertEqual((checkout / 'skills/sample/SKILL.md').read_text(), 'fixed tag content')
            self.assertFalse((checkout / 'skills/sample/__pycache__').exists())
            self.assertEqual((skill / 'SKILL.md').read_text(), 'uncommitted worktree')

if __name__=='__main__':unittest.main()
