"""独立安装验收计划不浮动版本、不覆盖已有目录、不静默安装工具。"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
class IndependentInstallTests(unittest.TestCase):
 def module(self):
  spec=importlib.util.spec_from_file_location('independent',ROOT/'scripts/verify_independent_skill_install.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
 def test_plan_uses_current_fixed_skill_refs_and_project_only_copy(self):
  m=self.module();lock=json.loads((ROOT/'host-acceptance.lock.json').read_text());plan=m.installation_plan(lock)
  self.assertEqual(len(plan),5);self.assertEqual(sum(len(p['skills']) for p in plan),58)
  for row in plan:
   self.assertTrue(row['source'].endswith(lock['plugins'][row['plugin']]['skillSourceRef']))
   self.assertNotIn('--global',row['argv']);self.assertIn('--copy',row['argv']);self.assertIn('codex',row['argv'])
 def test_missing_tool_does_not_create_output_or_attempt_installation(self):
  m=self.module();lock=json.loads((ROOT/'host-acceptance.lock.json').read_text())
  with tempfile.TemporaryDirectory() as d:
   output=Path(d)/'output'
   with self.assertRaisesRegex(ValueError,'existing_tool_required'):m.verify(Path(d)/'absent',Path(d)/'cli',Path(d)/'python',lock,output)
   self.assertFalse(output.exists())
 def test_hash_rejects_symlink_payload(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as d:
   folder=Path(d);(folder/'target').write_text('file');(folder/'link').symlink_to('target')
   with self.assertRaisesRegex(ValueError,'independent_skill_symlink'):m.skill_hash(folder)
if __name__=='__main__':unittest.main()
