"""已安装技能的公开 CLI 验收须拒绝漂移、缺失工具与覆盖。"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class InstalledCliTests(unittest.TestCase):
 def module(self):
  spec=importlib.util.spec_from_file_location('installed',ROOT/'scripts/verify_installed_cli.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
 def test_native_version_comparison_is_exact(self):
  m=self.module();self.assertTrue(m.matches_version('filmcraft-cli 0.2.0-craft.1','0.2.0-craft.1'))
  for text in ('filmcraft-cli 0.2.0-craft.10','filmcraft-cli 10.2.0-craft.1','0.2.0-craft.1-extra'):
   self.assertFalse(m.matches_version(text,'0.2.0-craft.1'))
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
