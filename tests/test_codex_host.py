"""宿主验收器的保留用户数据、来源和摘要边界；真实宿主另由显式命令验收。"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('host_verifier',ROOT/'scripts/verify_codex_host.py')
verifier=importlib.util.module_from_spec(spec);spec.loader.exec_module(verifier)
class HostVerifierTests(unittest.TestCase):
 def test_existing_output_is_never_reused_or_overwritten(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);target=root/'user-directory';target.mkdir();sentinel=target/'original';sentinel.write_text('preserve')
   with self.assertRaises(FileExistsError):verifier.verify('/usr/bin/false',ROOT/'host-acceptance.lock.json',target)
   self.assertEqual(sentinel.read_text(),'preserve');self.assertEqual(list(target.iterdir()),[sentinel])
 def test_invalid_release_set_cannot_create_host_configuration(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);lock=root/'bad.json';lock.write_text(json.dumps({'schema':'craft-host-release-lock/v1','plugins':{}}));target=root/'host'
   with self.assertRaisesRegex(ValueError,'host_release_lock_invalid'):verifier.verify('/usr/bin/false',lock,target)
   self.assertFalse(target.exists())
 def test_installed_skill_hash_detects_content_changes_and_external_symlinks(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);skill=root/'skill';skill.mkdir();file=skill/'SKILL.md';file.write_text('original');first=verifier.skill_hash(skill)
   file.write_text('changed');self.assertNotEqual(verifier.skill_hash(skill),first)
   outside=root/'outside';outside.write_text('external');(skill/'escaping').symlink_to(outside)
   with self.assertRaisesRegex(ValueError,'host_skill_symlink'):verifier.skill_hash(skill)
 def test_mutable_ref_wrong_repository_and_bad_hash_fail_before_creating_host(self):
  original=json.loads((ROOT/'host-acceptance.lock.json').read_text())
  for key,value in [('ref','main'),('repository','https://github.com/full-aigc-plugins/not-the-plugin.git'),('sha','g'*40),('skillSourceRef','main'),('pluginManifestSha256','bad')]:
   with self.subTest(key=key),tempfile.TemporaryDirectory() as temporary:
    root=Path(temporary);lock=root/'bad.json';candidate=json.loads(json.dumps(original));candidate['plugins']['filmcraft'][key]=value;lock.write_text(json.dumps(candidate));target=root/'host'
    with self.assertRaisesRegex(ValueError,'host_release_identity_invalid'):verifier.verify('/usr/bin/false',lock,target)
    self.assertFalse(target.exists())

 def test_correct_name_does_not_allow_modified_skill_source_or_manifest(self):
  import hashlib
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);skill=root/'skills/filmcraft-use';skill.mkdir(parents=True);(skill/'SKILL.md').write_text('pinned skill')
   manifest={'name':'filmcraft','version':'0.1.0-dev.2'};text=json.dumps(manifest);(root/'plugin.json').write_text(text)
   source={'ref':'v0.1.0-dev.2','sha':'a'*40,'sha256':{'filmcraft-use':verifier.skill_hash(skill)}}
   (root/'skills.lock.json').write_text(json.dumps({'sources':[source]}))
   expected={'version':manifest['version'],'pluginManifestSha256':hashlib.sha256(text.encode()).hexdigest(),'skillSourceRef':source['ref'],'skillSourceSha':source['sha'],'skillSha256':source['sha256']['filmcraft-use']}
   verifier.verify_installed_skill(skill,expected)
   (skill/'SKILL.md').write_text('changed');
   with self.assertRaisesRegex(ValueError,'host_installed_skill_identity_mismatch'):verifier.verify_installed_skill(skill,expected)
   (skill/'SKILL.md').write_text('pinned skill');source['sha']='b'*40;(root/'skills.lock.json').write_text(json.dumps({'sources':[source]}))
   with self.assertRaisesRegex(ValueError,'host_installed_skill_identity_mismatch'):verifier.verify_installed_skill(skill,expected)
   source['sha']='a'*40;(root/'skills.lock.json').write_text(json.dumps({'sources':[source]}));manifest['name']='counterfeit';(root/'plugin.json').write_text(json.dumps(manifest))
   with self.assertRaisesRegex(ValueError,'host_installed_skill_identity_mismatch'):verifier.verify_installed_skill(skill,expected)

 def test_skill_suite_lock_rejects_foreign_names_missing_router_and_bad_digest(self):
  import copy
  lock=json.loads((ROOT/'host-acceptance.lock.json').read_text())
  for skills in [{'filmcraft-use':'bad'},{'another-use':'a'*64},{'filmcraft-cli':'a'*64}]:
   candidate=copy.deepcopy(lock);candidate['plugins']['filmcraft']['skills']=skills
   with self.assertRaisesRegex(ValueError,'host_skill_suite_identity_invalid'):verifier.validate_lock(candidate)

# 与离线边界测试分开；CI 不具备 Codex 时明确跳过，不伪称宿主通过。
import os
import shutil
@unittest.skipUnless(os.environ.get('CRAFT_HOST_TEST')=='1','requires explicit current Codex host install acceptance')
class LiveHostTests(unittest.TestCase):
 def test_fixed_public_releases_install_and_are_discovered_by_app_server(self):
  codex=os.environ.get('CRAFT_CODEX_CLI') or shutil.which('codex')
  self.assertIsNotNone(codex)
  with tempfile.TemporaryDirectory(prefix='craft-codex-host-test-') as temporary:
   result=verifier.verify(codex,ROOT/'host-acceptance.lock.json',Path(temporary)/'host')
   self.assertEqual(result['result'],'passed');self.assertEqual(result['loadingErrors'],0)
   self.assertEqual({entry['pluginId'] for entry in result['plugins']},set(verifier.NAMES))
   for entry in result['plugins']:
    self.assertTrue(entry['enabled']);self.assertEqual(entry['discoveredName'],entry['pluginId']+':'+entry['pluginId']+'-use')
    expected=json.loads((ROOT/'host-acceptance.lock.json').read_text())['plugins'][entry['pluginId']]
    self.assertEqual({skill['name'] for skill in entry['skills']},{entry['pluginId']+':'+name for name in expected.get('skills',{entry['pluginId']+'-use':expected['skillSha256']})})

if __name__=='__main__':unittest.main()
