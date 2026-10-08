"""发行包必须来自固定标签，不能把工作树内容误标为旧版本。"""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('builder', ROOT / 'scripts/build_runtime_bundle.py')
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)


class RuntimeBundleTests(unittest.TestCase):
    def fixture(self, root):
        plugin = root / 'plugin'; skills = root / 'sources'; output = root / 'published'
        output.mkdir()
        entries = {}
        for name in ('artcraft-runtime', *[n + '-skills' for n in builder.NAMES]):
            source = plugin if name == 'artcraft-runtime' else skills / name
            source.mkdir(parents=True)
            (source / 'LICENSE').write_text('fixture license\n')
            if name == 'artcraft-runtime':
                (source / 'package.json').write_text('{"version":"1.0.0"}\n')
                (source / 'src').mkdir(); (source / 'src/cli.ts').write_text('console.log("fixed");\n')
                (source / 'schemas').mkdir(); (source / 'schemas/test.json').write_text('{}\n')
            else:
                (source / 'skills/sample').mkdir(parents=True)
                (source / 'skills/sample/SKILL.md').write_text('fixed skill\n')
            subprocess.run(['git', 'init', '-q', str(source)], check=True)
            subprocess.run(['git', '-C', str(source), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(source), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], check=True)
            subprocess.run(['git', '-C', str(source), 'tag', 'v1.0.0'], check=True)
            files = [p for p in source.rglob('*') if p.is_file() and '.git' not in p.parts]
            repo = 'full-aigc-plugins/artcraft-plugin' if name == 'artcraft-runtime' else 'full-aigc-skills/' + name
            entries[name] = builder.bundle(source, files, output / (name + '-1.0.0.zip'), repo, '1.0.0')
        lock = {'schema': 'artcraft-distribution/v1', 'version': '1.0.0', 'bundles': entries}
        lock_file = plugin / 'skills/artcraft-use/scripts/distribution.lock.json'
        lock_file.parent.mkdir(parents=True); lock_file.write_text(json.dumps(lock))
        return plugin, skills, lock, lock_file

    def test_fixed_tags_ignore_new_head_dirty_files_and_untracked_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); plugin, skills, lock, _ = self.fixture(root)
            source = skills / 'filmcraft-skills'; target = source / 'skills/sample/SKILL.md'
            target.write_text('new committed content\n')
            subprocess.run(['git', '-C', str(source), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(source), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'new head'], check=True)
            target.write_text('user uncommitted work\n')
            (source / 'skills/sample/__pycache__').mkdir()
            (source / 'skills/sample/__pycache__/cache.pyc').write_bytes(b'cache')
            result = builder.build(plugin, skills, root / 'rebuilt', root / 'rebuilt.lock.json')
            self.assertEqual(result, lock)
            self.assertEqual(target.read_text(), 'user uncommitted work\n')
            self.assertEqual((root / 'rebuilt/filmcraft-skills-1.0.0.zip').read_bytes(), (root / 'published/filmcraft-skills-1.0.0.zip').read_bytes())
            self.assertEqual(builder.build(plugin, skills, root / 'rebuilt', root / 'rebuilt.lock.json'), lock)

    def test_fixed_git_archive_release_is_preserved_without_repacking(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);plugin,skills,lock,lock_file=self.fixture(root)
            source=skills/'filmcraft-skills'
            (source/'README.md').write_text('published documentation')
            subprocess.run(['git','-C',str(source),'add','.'],check=True)
            subprocess.run(['git','-C',str(source),'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','new published archive'],check=True)
            subprocess.run(['git','-C',str(source),'tag','v1.0.1'],check=True)
            archive=root/'filmcraft-skills-1.0.1.zip'
            entry=builder.git_archive_bundle(source,'1.0.1',archive,'full-aigc-skills/filmcraft-skills')
            self.assertEqual(entry['archiveFormat'],'git-archive-zip')
            self.assertIn('README.md',entry['files'])
            lock['bundles']['filmcraft-skills']=entry;lock_file.write_text(json.dumps(lock))
            (source/'README.md').write_text('dirty newer documentation')
            actual=builder.build(plugin,skills,root/'rebuilt',root/'rebuilt.lock.json')
            self.assertEqual(actual,lock)
            self.assertEqual((root/'rebuilt'/archive.name).read_bytes(),archive.read_bytes())
            self.assertEqual((source/'README.md').read_text(),'dirty newer documentation')

    def test_bad_digest_and_missing_tag_publish_nothing(self):
        for failure in ('digest', 'tag'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as tmp:
                root = Path(tmp); plugin, skills, lock, lock_file = self.fixture(root)
                if failure == 'digest':
                    lock['bundles']['filmcraft-skills']['sha256'] = '0' * 64
                    lock_file.write_text(json.dumps(lock))
                else:
                    subprocess.run(['git', '-C', str(skills / 'filmcraft-skills'), 'tag', '-d', 'v1.0.0'], check=True, stdout=subprocess.DEVNULL)
                with self.assertRaises((ValueError, subprocess.CalledProcessError)):
                    builder.build(plugin, skills, root / 'rebuilt', root / 'rebuilt.lock.json')
                self.assertFalse((root / 'rebuilt.lock.json').exists())
                self.assertFalse((root / 'rebuilt').exists())

    def test_conflicting_existing_release_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); plugin, skills, _, _ = self.fixture(root)
            output = root / 'rebuilt'; output.mkdir()
            existing = output / 'filmcraft-skills-1.0.0.zip'; existing.write_bytes(b'existing release')
            with self.assertRaises(ValueError):
                builder.build(plugin, skills, output, root / 'rebuilt.lock.json')
            self.assertEqual(existing.read_bytes(), b'existing release')
            self.assertEqual(list(output.iterdir()), [existing])
            self.assertFalse((root / 'rebuilt.lock.json').exists())

    def test_tagged_symlink_cannot_enter_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); source = root / 'source'; source.mkdir()
            (source / 'LICENSE').symlink_to('/outside/user-data')
            subprocess.run(['git', 'init', '-q', str(source)], check=True)
            subprocess.run(['git', '-C', str(source), 'add', '.'], check=True)
            subprocess.run(['git', '-C', str(source), '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'link fixture'], check=True)
            subprocess.run(['git', '-C', str(source), 'tag', 'v1.0.0'], check=True)
            with self.assertRaisesRegex(ValueError, 'unsafe_source_archive'):
                builder.tagged_source(source, '1.0.0', root / 'extract', ['LICENSE'])
            with self.assertRaisesRegex(ValueError, 'immutable_version_required'):
                builder.tagged_source(source, 'main', root / 'extract', ['LICENSE'])


class GitPrefixBundleTests(unittest.TestCase):
 def test_declared_prefix_reconstructs_exact_git_zip_and_keeps_root_manifest(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);plugin,skills,lock,path=RuntimeBundleTests().fixture(root)
   repo=skills/'photocraft-skills';prefix='photocraft-skills-1.0.0/';expected=root/'expected.zip'
   subprocess.run(['git','-C',str(repo),'archive','--format=zip','--prefix='+prefix,'--output='+str(expected),'refs/tags/v1.0.0'],check=True)
   actual=root/'actual.zip';entry=builder.git_archive_bundle(repo,'1.0.0',actual,'full-aigc-skills/photocraft-skills',archive_prefix=prefix)
   self.assertEqual(actual.read_bytes(),expected.read_bytes());self.assertEqual(entry['archivePrefix'],prefix)
   self.assertIn('LICENSE',entry['files']);self.assertFalse(any(p.startswith(prefix) for p in entry['files']))
 def test_v_tag_prefix_reconstructs_exact_git_zip(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);plugin,skills,lock,path=RuntimeBundleTests().fixture(root)
   repo=skills/'vectorcraft-skills';prefix='vectorcraft-skills-v1.0.0/';expected=root/'expected.zip'
   subprocess.run(['git','-C',str(repo),'archive','--format=zip','--prefix='+prefix,'--output='+str(expected),'refs/tags/v1.0.0'],check=True)
   actual=root/'actual.zip';entry=builder.git_archive_bundle(repo,'1.0.0',actual,'full-aigc-skills/vectorcraft-skills',archive_prefix=prefix)
   self.assertEqual(actual.read_bytes(),expected.read_bytes());self.assertEqual(entry['archivePrefix'],prefix)
 def test_legacy_prefix_reconstructs_exact_git_zip(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);plugin,skills,lock,path=RuntimeBundleTests().fixture(root)
   repo=skills/'photocraft-skills';prefix='photocraft-skills/';expected=root/'expected.zip'
   subprocess.run(['git','-C',str(repo),'archive','--format=zip','--prefix='+prefix,'--output='+str(expected),'refs/tags/v1.0.0'],check=True)
   actual=root/'actual.zip';entry=builder.git_archive_bundle(repo,'1.0.0',actual,'full-aigc-skills/photocraft-skills',archive_prefix=prefix)
   self.assertEqual(actual.read_bytes(),expected.read_bytes());self.assertEqual(entry['archivePrefix'],prefix)
   self.assertIn('LICENSE',entry['files']);self.assertFalse(any(p.startswith(prefix) for p in entry['files']))
 def test_prefix_requires_exact_known_domain_repository(self):
  for prefix in ('../','other/','photocraft-skills','photocraft-skills//','','photocraft-skills-1.0.1/','photocraft-skills-v1.0.1/'):
   with self.subTest(prefix=prefix),tempfile.TemporaryDirectory() as t:
    out=Path(t)/'out.zip'
    with self.assertRaisesRegex(ValueError,'archive_prefix_invalid'):
     builder.git_archive_bundle(Path(t),'1.0.0',out,'full-aigc-skills/photocraft-skills',archive_prefix=prefix)
    self.assertFalse(out.exists())


if __name__ == '__main__':
    unittest.main()
