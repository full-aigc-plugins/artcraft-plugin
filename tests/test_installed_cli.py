"""已安装技能的公开 CLI 验收须拒绝漂移、缺失工具与覆盖。"""
import importlib.util
import json
import io
import sys
from unittest.mock import patch
from types import SimpleNamespace
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class InstalledCliTests(unittest.TestCase):
 def module(self):
  spec=importlib.util.spec_from_file_location('installed',ROOT/'scripts/verify_installed_cli.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
 def test_default_installed_verification_uses_current_lock(self):
  m=self.module()
  with patch.object(sys,'argv',['verify','--receipt','fixture-receipt.json','--output','fixture-output']),patch.object(m,'verify',return_value={'result':'passed','versionProbes':64,'pythonVersion':'fixture','seconds':0}) as verify,redirect_stdout(io.StringIO()):m.main()
  self.assertEqual(verify.call_args.args[1],ROOT/'host-acceptance-art116.lock.json')
 def test_native_version_comparison_is_exact(self):
  m=self.module();self.assertTrue(m.matches_version('filmcraft-cli 0.2.0-craft.1','0.2.0-craft.1'))
  for text in ('filmcraft-cli 0.2.0-craft.10','filmcraft-cli 10.2.0-craft.1','0.2.0-craft.1-extra'):
   self.assertFalse(m.matches_version(text,'0.2.0-craft.1'))
 def test_matching_version_from_another_cli_is_rejected(self):
  m=self.module()
  for text in ('unrelated-cli 0.2.0-craft.3','error: expected filmcraft-cli 0.2.0-craft.3'):
   self.assertFalse(m.matches_version(text,'0.2.0-craft.3'))
 def test_art_runtime_requires_named_json_identity(self):
  m=self.module()
  self.assertTrue(m.matches_version('{"name":"artcraft","version":"0.1.0-dev.83"}','0.1.0-dev.83','artcraft'))
  for text in ('artcraft 0.1.0-dev.83','{"name":"unrelated","version":"0.1.0-dev.83"}'):
   self.assertFalse(m.matches_version(text,'0.1.0-dev.83','artcraft'))
 def test_wrong_cli_zero_exit_cannot_create_success_receipt(self):
  m=self.module();host=m.host_module();host.NAMES=('filmcraft',)
  host.validate_lock=lambda lock:None
  host.verify_installed_skill=lambda directory,entry:None
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);skill=root/'plugin/skills/filmcraft-cli';scripts=skill/'scripts';scripts.mkdir(parents=True)
   (scripts/'cli.py').write_text('fixture launcher')
   (scripts/'runtime.lock.json').write_text(json.dumps({'resolvedVersion':'0.2.0-craft.3'}))
   expected=host.skill_hash(skill)
   lock=root/'lock.json';lock.write_text(json.dumps({'plugins':{'filmcraft':{'skills':{'filmcraft-cli':expected}}}}))
   receipt=root/'host.json';receipt.write_text(json.dumps({'schema':'craft-codex-host-evidence/v2','result':'passed','skillDirectories':{'filmcraft':str(skill)}}))
   output=root/'output'
   def run(argv,**kwargs):
    text='Python 3.13.5' if len(argv)==2 else ('unrelated-cli 0.2.0-craft.3' if argv[-1]=='--version' else '[{"id":"project.inspect"}]')
    return SimpleNamespace(returncode=0,stdout=text,stderr='')
   with patch.object(m,'host_module',return_value=host),patch.object(m.subprocess,'run',side_effect=run):
    with self.assertRaisesRegex(ValueError,'installed_cli_runtime_version_mismatch'):
     m.verify(Path(sys.executable),lock,receipt,output)
   self.assertFalse((output/'receipt.json').exists())
   self.assertEqual(host.skill_hash(skill),expected)
 def test_evidence_scope_tracks_verified_inventory(self):
  m=self.module()
  for skills,domains in ((58,5),(64,5),(80,8)):
   scope=m.evidence_scope([{} for _ in range(skills)],list(range(domains)))
   self.assertTrue(scope.startswith(f'{skills} separately copied single skills;'))
   self.assertIn(f'{domains} fresh public domain caches',scope)
   self.assertIn('later probes reuse each domain cache',scope)
 def test_missing_python_refused_before_output(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as d:
   output=Path(d)/'result'
   with self.assertRaisesRegex(ValueError,'existing_python_required'):m.verify(Path(d)/'missing',ROOT/'host-acceptance.lock.json',Path(d)/'receipt.json',output)
   self.assertFalse(output.exists())
 def test_receipt_plugin_inventory_refused_before_output(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as d:
   receipt=Path(d)/'receipt.json';receipt.write_text(json.dumps({'schema':'craft-codex-host-evidence/v2','result':'passed','skillDirectories':{}}));output=Path(d)/'result'
   with self.assertRaisesRegex(ValueError,'installed_cli_receipt_invalid'):m.verify(Path(__import__('sys').executable),ROOT/'host-acceptance.lock.json',receipt,output)
   self.assertFalse(output.exists())
 def test_metadata_drift_refused_before_output(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);plugin=root/'plugin';skill=plugin/'skills/filmcraft-use';skill.mkdir(parents=True)
   (plugin/'plugin.json').write_text('{}');(plugin/'skills.lock.json').write_text('{"sources": []}')
   receipt=root/'receipt.json';receipt.write_text(json.dumps({'schema':'craft-codex-host-evidence/v2','result':'passed','skillDirectories':{n:str(skill) for n in ('filmcraft','effectcraft','photocraft','vectorcraft','artcraft')}}));output=root/'result'
   with self.assertRaisesRegex(ValueError,'host_installed_skill_identity_mismatch'):m.verify(Path(__import__('sys').executable),ROOT/'host-acceptance.lock.json',receipt,output)
   self.assertFalse(output.exists())
if __name__=='__main__':unittest.main()
