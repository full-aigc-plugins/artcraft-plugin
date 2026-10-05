"""独立安装验收计划不浮动版本、不覆盖已有目录、不静默安装工具。"""
import importlib.util
import json
from pathlib import Path
import tempfile
import shutil
import os
from unittest.mock import patch
from types import SimpleNamespace
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
class NativeVersionGateTests(unittest.TestCase):
 def fixture(self,callback):
  m=IndependentInstallTests().module();m.NAMES=('filmcraft',)
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);source=root/'source';scripts=source/'scripts';scripts.mkdir(parents=True)
   (source/'SKILL.md').write_text('fixture skill')
   (scripts/'cli.py').write_text('fixture launcher')
   (scripts/'runtime.lock.json').write_text(json.dumps({'resolvedVersion':'0.2.0-craft.1'}))
   for name in ('node','cli','python'):(root/name).write_text('fixture tool')
   lock={'plugins':{'filmcraft':{'skillSourceRef':'v0.1.0-dev.5','skillSourceSha':'a'*40,'skills':{'filmcraft-cli':m.skill_hash(source)}}}}
   output=root/'output';native_environments=[]
   def run(argv,**kwargs):
    if 'add' in argv:shutil.copytree(source,Path(kwargs['cwd'])/'.agents/skills/filmcraft-cli');value='installed'
    elif '-I' in argv:native_environments.append(kwargs['env']);value=callback
    else:value='1.7.0'
    return SimpleNamespace(returncode=0,stdout=value,stderr='')
   with patch.object(m.subprocess,'run',side_effect=run),patch.dict(os.environ,{'CRAFT_NODE_ARCHIVE':'fixture-offline','CRAFT_BUNDLE_DIRECTORY':'fixture-offline','CRAFT_NATIVE_ARCHIVE_DIRECTORY':'fixture-offline','CRAFT_RUNTIME_HOME':'fixture-cache'}):
    yield m,root,lock,output,native_environments
 def test_zero_exit_with_wrong_native_version_cannot_publish_receipt(self):
  for m,root,lock,output,environments in self.fixture('filmcraft-cli 0.2.0-craft.10'):
   with self.assertRaisesRegex(ValueError,'independent_runtime_version_mismatch'):m.verify(root/'node',root/'cli',root/'python',lock,output)
   self.assertFalse((output/'receipt.json').exists())
 def test_locked_native_version_is_recorded_and_offline_overrides_are_excluded(self):
  for m,root,lock,output,environments in self.fixture('filmcraft-cli 0.2.0-craft.1'):
   receipt=m.verify(root/'node',root/'cli',root/'python',lock,output)
   self.assertEqual(receipt['plugins'][0]['nativeVersions']['filmcraft-cli'],{'expected':'0.2.0-craft.1','actual':'filmcraft-cli 0.2.0-craft.1'})
   self.assertEqual(environments[0]['PATH'],'/usr/bin:/bin')
   for key in ('CRAFT_NODE_ARCHIVE','CRAFT_BUNDLE_DIRECTORY','CRAFT_NATIVE_ARCHIVE_DIRECTORY','CRAFT_RUNTIME_HOME'):self.assertNotIn(key,environments[0])

if __name__=='__main__':unittest.main()
