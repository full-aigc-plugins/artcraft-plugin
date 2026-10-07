"""独立技能的快照不能依赖链接目标；同步拒绝必须保留原技能与锁。"""
import contextlib
import hashlib
import importlib.util
import io
import json
import subprocess
import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('self_contained_vendor', ROOT / 'scripts/vendor/skill_vendor.py')
vendor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vendor)


class SelfContainedVendorTests(unittest.TestCase):
    def test_regular_payload_retains_existing_digest(self):
        with tempfile.TemporaryDirectory() as temporary:
            skill = Path(temporary) / 'skill'
            skill.mkdir()
            (skill / 'SKILL.md').write_bytes(b'payload')
            expected = hashlib.sha256(b'SKILL.md\0' + hashlib.sha256(b'payload').hexdigest().encode() + b'\n').hexdigest()
            self.assertEqual(vendor.hash_skill_dir(skill), expected)

    def test_offline_check_rejects_missing_commit_or_digest_before_source_use(self):
        for field, value in (('sha', None), ('sha', 'a' * 39), ('sha256', {}), ('sha256', {'first': 'x' * 64, 'second': 'b' * 64})):
            with self.subTest(field=field, value=value), tempfile.TemporaryDirectory() as temporary:
                target, checkout, lock = self.fixture(Path(temporary))
                data = json.loads(lock.read_text())
                data['sources'][0][field] = value
                lock.write_text(json.dumps(data))
                with self.assertRaisesRegex(RuntimeError, 'locked commit|locked digest'):
                    vendor.cmd_check(lock, True, {})

    def test_version_named_branch_is_not_a_release_tag(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            local = root / 'source'
            local.mkdir()
            subprocess.run(['git', 'init', '-q', str(local)], check=True)
            (local / 'file').write_text('branch payload')
            subprocess.run(['git', '-C', str(local), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(local), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], check=True)
            subprocess.run(['git', '-C', str(local), 'branch', 'v1.0.0'], check=True)
            with self.assertRaises((RuntimeError, subprocess.CalledProcessError)):
                vendor.resolve_ref(str(local), 'v1.0.0')
            with self.assertRaises(subprocess.CalledProcessError):
                vendor.fetch_checkout(str(local), 'v1.0.0', root / 'fetch')

    def test_links_are_rejected_including_root_directory_and_dangling(self):
        for kind in ('file', 'directory', 'dangling', 'root', 'parent'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                skill = root / 'skill'
                skill.mkdir()
                (skill / 'SKILL.md').write_text('fixed skill')
                outside = root / 'outside'
                outside.mkdir()
                (outside / 'payload').write_text('external resource')
                if kind == 'parent':
                    link = root / 'parent-link'
                    link.symlink_to(root, target_is_directory=True)
                    checked = link / 'skill'
                elif kind == 'root':
                    link = root / 'skill-link'
                    link.symlink_to(skill, target_is_directory=True)
                    checked = link
                else:
                    target = outside / 'payload' if kind == 'file' else outside if kind == 'directory' else root / 'missing'
                    (skill / 'resource').symlink_to(target)
                    checked = skill
                with self.assertRaisesRegex(RuntimeError, 'symbolic link'):
                    vendor.hash_skill_dir(checked)
                self.assertEqual((outside / 'payload').read_text(), 'external resource')

    def fixture(self, root):
        root = root.resolve()
        target = root / 'plugin'
        target.mkdir()
        checkout = root / 'checkout'
        names = ['first', 'second']
        for name in names:
            for base, text in ((target, 'original '), (checkout, 'new ')):
                skill = base / 'skills' / name
                skill.mkdir(parents=True)
                (skill / 'SKILL.md').write_text(text + name)
        source = {'package': 'fixture-skills', 'repo': 'https://example.invalid/skills.git',
                  'ref': 'v1.0.0', 'sha': 'a' * 40, 'skills': names, 'dest': 'skills',
                  'sha256': {name: vendor.hash_skill_dir(target / 'skills' / name) for name in names}}
        lock = target / 'skills.lock.json'
        lock.write_text(json.dumps({'version': 1, 'sources': [source]}))
        (target / 'plugin-local-skills.json').write_text(json.dumps({'version': 1, 'dest': 'skills', 'skills': []}))
        return target, checkout, lock

    def test_invalid_second_source_does_not_replace_first_target_or_lock(self):
        for kind in ('external-link', 'missing-entry'):
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                target, checkout, lock = self.fixture(root)
                second = checkout / 'skills/second'
                outside = root / 'external'
                outside.write_text('external resource')
                if kind == 'external-link':
                    (second / 'resource').symlink_to(outside)
                else:
                    (second / 'SKILL.md').unlink()
                before = lock.read_bytes()
                with patch.object(vendor, 'source_checkout', return_value=(checkout, 'b' * 40)), contextlib.redirect_stdout(io.StringIO()):
                    try:
                        code = vendor.cmd_update(lock, {}, {}, {})
                    except RuntimeError:
                        code = 1
                self.assertEqual(code, 1)
                self.assertEqual(lock.read_bytes(), before)
                self.assertEqual((target / 'skills/first/SKILL.md').read_text(), 'original first')
                self.assertEqual((target / 'skills/second/SKILL.md').read_text(), 'original second')
                self.assertEqual(outside.read_text(), 'external resource')

    def test_offline_check_rejects_content_identical_external_link(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target, checkout, lock = self.fixture(root)
            entry = target / 'skills/first/SKILL.md'
            outside = root / 'external'
            outside.write_bytes(entry.read_bytes())
            entry.unlink()
            entry.symlink_to(outside)
            before = lock.read_bytes()
            with contextlib.redirect_stdout(io.StringIO()):
                try:
                    code = vendor.cmd_check(lock, True, {})
                except RuntimeError:
                    code = 1
            self.assertEqual(code, 1)
            self.assertEqual(lock.read_bytes(), before)
            self.assertTrue(entry.is_symlink())
            self.assertEqual(outside.read_text(), 'original first')

    def test_snapshot_drift_fails_without_refreshing_lock_or_other_skill(self):
        with tempfile.TemporaryDirectory() as temporary:
            target, checkout, lock = self.fixture(Path(temporary))
            entry = target / 'skills/first/SKILL.md'
            entry.write_text('unapproved snapshot edit')
            before = lock.read_bytes()
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(vendor.cmd_check(lock, True, {}), 1)
            self.assertEqual(entry.read_text(), 'unapproved snapshot edit')
            self.assertEqual(lock.read_bytes(), before)
            self.assertEqual((target / 'skills/second/SKILL.md').read_text(), 'original second')

    def test_linked_destination_is_rejected_even_when_it_stays_inside_repository(self):
        with tempfile.TemporaryDirectory() as temporary:
            target, checkout, lock = self.fixture(Path(temporary))
            original = target / 'skills'
            moved = target / 'actual-skills'
            original.rename(moved)
            original.symlink_to(moved, target_is_directory=True)
            before = lock.read_bytes()
            with self.assertRaisesRegex(RuntimeError, 'symbolic link destination'):
                vendor.cmd_check(lock, True, {})
            self.assertTrue(original.is_symlink())
            self.assertEqual(lock.read_bytes(), before)
            self.assertEqual((moved / 'first/SKILL.md').read_text(), 'original first')

    def test_existing_link_target_is_preserved_before_any_replacement(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target, checkout, lock = self.fixture(root)
            entry = target / 'skills/second/SKILL.md'
            outside = root / 'external'
            outside.write_bytes(entry.read_bytes())
            entry.unlink()
            entry.symlink_to(outside)
            before = lock.read_bytes()
            with patch.object(vendor, 'source_checkout', return_value=(checkout, 'b' * 40)), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(vendor.cmd_update(lock, {}, {}, {}), 1)
            self.assertEqual(lock.read_bytes(), before)
            self.assertEqual((target / 'skills/first/SKILL.md').read_text(), 'original first')
            self.assertTrue(entry.is_symlink())
            self.assertEqual(outside.read_text(), 'original second')

    def test_valid_update_preserves_plugin_local_skill_and_binds_new_digest(self):
        with tempfile.TemporaryDirectory() as temporary:
            target, checkout, lock = self.fixture(Path(temporary))
            local = target / 'skills/local'
            local.mkdir()
            (local / 'SKILL.md').write_text('plugin local')
            (target / 'plugin-local-skills.json').write_text(json.dumps({'version': 1, 'dest': 'skills', 'skills': ['local']}))
            with patch.object(vendor, 'source_checkout', return_value=(checkout, 'b' * 40)), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(vendor.cmd_update(lock, {}, {}, {}), 0)
                self.assertEqual(vendor.cmd_check(lock, True, {}), 0)
            source = json.loads(lock.read_text())['sources'][0]
            self.assertEqual(source['sha'], 'b' * 40)
            for name in ('first', 'second'):
                self.assertEqual((target / 'skills' / name / 'SKILL.md').read_text(), 'new ' + name)
                self.assertEqual(source['sha256'][name], vendor.hash_skill_dir(target / 'skills' / name))
            self.assertEqual((local / 'SKILL.md').read_text(), 'plugin local')

    def test_public_check_rejects_equal_content_link_without_touching_user_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            target, checkout, lock = self.fixture(root)
            entry = target / 'skills/first/SKILL.md'
            outside = root / 'external'
            outside.write_bytes(entry.read_bytes())
            entry.unlink()
            entry.symlink_to(outside)
            before = lock.read_bytes()
            result = subprocess.run([sys.executable, '-I', '-B', str(ROOT / 'scripts/vendor/skill_vendor.py'),
                                     'check', '--offline', '--lock', str(lock)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn('symbolic link', result.stdout)
            self.assertEqual(lock.read_bytes(), before)
            self.assertTrue(entry.is_symlink())
            self.assertEqual(outside.read_text(), 'original first')

    def test_public_update_rejects_tagged_link_before_replacing_any_skill(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            target, checkout, lock = self.fixture(root)
            outside = root / 'external'
            outside.write_text('external resource')
            (checkout / 'skills/second/resource').symlink_to(outside)
            subprocess.run(['git', 'init', '-q', str(checkout)], check=True)
            subprocess.run(['git', '-C', str(checkout), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(checkout), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], check=True)
            subprocess.run(['git', '-C', str(checkout), 'tag', 'v1.0.0'], check=True)
            before = lock.read_bytes()
            result = subprocess.run([sys.executable, '-I', '-B', str(ROOT / 'scripts/vendor/skill_vendor.py'),
                                     'update', '--lock', str(lock), '--source-path', 'fixture-skills=' + str(checkout)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
            self.assertIn('symbolic link', result.stdout)
            self.assertEqual(lock.read_bytes(), before)
            self.assertEqual((target / 'skills/first/SKILL.md').read_text(), 'original first')
            self.assertEqual((target / 'skills/second/SKILL.md').read_text(), 'original second')
            self.assertEqual(outside.read_text(), 'external resource')


if __name__ == '__main__':
    unittest.main()
