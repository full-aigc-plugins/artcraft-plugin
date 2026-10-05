"""宿主矩阵只能取固定标签，不能把本地修改标记成发行制品。"""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class HostReleaseBuilderTests(unittest.TestCase):
    def load(self):
        spec=importlib.util.spec_from_file_location('host_builder',ROOT/'scripts/build_host_release_lock.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
    def fixture(self,root):
        repo=root/'filmcraft-plugin';repo.mkdir();subprocess.run(['git','init','-q',str(repo)],check=True)
        skill=repo/'skills/filmcraft-use';skill.mkdir(parents=True);(skill/'SKILL.md').write_text('fixed')
        module=self.load();tree_hash=module.skill_hash(skill)
        (repo/'plugin.json').write_text(json.dumps({'name':'filmcraft','version':'0.1.0-dev.5'}))
        (repo/'skills.lock.json').write_text(json.dumps({'sources':[{'package':'filmcraft-skills','repo':'https://github.com/full-aigc-skills/filmcraft-skills.git','ref':'v0.1.0-dev.4','sha':'a'*40,'skills':['filmcraft-use'],'sha256':{'filmcraft-use':tree_hash}}]}))
        subprocess.run(['git','-C',str(repo),'add','.'],check=True)
        subprocess.run(['git','-C',str(repo),'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixed'],check=True)
        subprocess.run(['git','-C',str(repo),'tag','v0.1.0-dev.5'],check=True)
        return repo,tree_hash
    def test_dirty_worktree_does_not_change_release_identity(self):
        module=self.load()
        with tempfile.TemporaryDirectory() as temporary:
            repo,sha=self.fixture(Path(temporary));(repo/'skills/filmcraft-use/SKILL.md').write_text('dirty')
            entry=module.release_entry(repo,'filmcraft','0.1.0-dev.5')
            self.assertEqual(entry['skillSha256'],sha);self.assertEqual((repo/'skills/filmcraft-use/SKILL.md').read_text(),'dirty')
            self.assertEqual(entry['sha'],subprocess.check_output(['git','-C',str(repo),'rev-parse','v0.1.0-dev.5'],text=True).strip())
    def test_wrong_version_and_tagged_skill_drift_are_rejected(self):
        module=self.load()
        with tempfile.TemporaryDirectory() as temporary:
            repo,_=self.fixture(Path(temporary))
            for version in ['main','0.1.0-dev.999']:
                with self.assertRaises(ValueError):module.release_entry(repo,'filmcraft',version)
            (repo/'skills/filmcraft-use/SKILL.md').write_text('wrong')
            subprocess.run(['git','-C',str(repo),'add','.'],check=True);subprocess.run(['git','-C',str(repo),'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','drift'],check=True)
            subprocess.run(['git','-C',str(repo),'tag','v0.1.0-dev.6'],check=True)
            # 把元数据版本与命令参数不匹配的标签先拒绝。
            with self.assertRaisesRegex(ValueError,'host_release_version_mismatch'):module.release_entry(repo,'filmcraft','0.1.0-dev.6')
    def test_tagged_skill_tampering_is_rejected_even_with_matching_version(self):
        module=self.load()
        with tempfile.TemporaryDirectory() as temporary:
            repo,_=self.fixture(Path(temporary))
            (repo/'plugin.json').write_text(json.dumps({'name':'filmcraft','version':'0.1.0-dev.6'}))
            (repo/'skills/filmcraft-use/SKILL.md').write_text('tampered')
            subprocess.run(['git','-C',str(repo),'add','.'],check=True)
            subprocess.run(['git','-C',str(repo),'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','tamper'],check=True)
            subprocess.run(['git','-C',str(repo),'tag','v0.1.0-dev.6'],check=True)
            with self.assertRaisesRegex(ValueError,'host_tagged_skill_drift'):module.release_entry(repo,'filmcraft','0.1.0-dev.6')

    def test_existing_output_conflict_is_preserved(self):
        module=self.load()
        with tempfile.TemporaryDirectory() as temporary:
            path=Path(temporary)/'lock.json';module.write_lock({'value':'old'},path)
            with self.assertRaisesRegex(ValueError,'existing_host_lock_conflict'):module.write_lock({'value':'new'},path)
            self.assertEqual(json.loads(path.read_text()),{'value':'old'})
            module.write_lock({'value':'old'},path)
