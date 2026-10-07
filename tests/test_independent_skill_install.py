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
import sys
import subprocess
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
ROOT=Path(__file__).resolve().parents[1]
class IndependentInstallTests(unittest.TestCase):
 def test_plan_runs_with_isolated_python(self):
  result=subprocess.run([sys.executable,'-I','-B',str(ROOT/'scripts/verify_independent_skill_install.py'),'--plan'],capture_output=True,text=True)
  self.assertEqual(result.returncode,0,result.stderr)
  plan=json.loads(result.stdout)
  self.assertEqual(sum(len(row['skills']) for row in plan),64)
 def module(self):
  spec=importlib.util.spec_from_file_location('independent',ROOT/'scripts/verify_independent_skill_install.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
 def test_plan_uses_current_fixed_skill_refs_and_project_only_copy(self):
  m=self.module();lock=json.loads((ROOT/'host-acceptance-art97.lock.json').read_text());plan=m.installation_plan(lock)
  self.assertEqual(len(plan),5);self.assertEqual(sum(len(p['skills']) for p in plan),64)
  self.assertEqual({row['plugin']:len(row['skills']) for row in plan},
                   {'filmcraft':13,'effectcraft':15,'photocraft':13,'vectorcraft':13,'artcraft':10})
  for row in plan:
   self.assertTrue(row['source'].endswith(lock['plugins'][row['plugin']]['skillSourceRef']))
   self.assertNotIn('--global',row['argv']);self.assertIn('--copy',row['argv']);self.assertIn('codex',row['argv'])
 def test_missing_tool_does_not_create_output_or_attempt_installation(self):
  m=self.module();lock=json.loads((ROOT/'host-acceptance-art97.lock.json').read_text())
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
 def fixture(self,callback,domain="filmcraft",expected="0.2.0-craft.1"):
  m=IndependentInstallTests().module();m.NAMES=(domain,)
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);source=root/'source';scripts=source/'scripts';scripts.mkdir(parents=True)
   (source/'SKILL.md').write_text('fixture skill')
   (scripts/'cli.py').write_text('fixture launcher')
   (scripts/('distribution.lock.json' if domain=='artcraft' else 'runtime.lock.json')).write_text(json.dumps({'bundles':{'artcraft-runtime':{'version':expected}}} if domain=='artcraft' else {'resolvedVersion':expected}))
   for name in ('node','cli','python'):(root/name).write_text('fixture tool')
   lock={'plugins':{domain:{'skillSourceRef':'v0.1.0-dev.5','skillSourceSha':'a'*40,'skills':{domain+'-cli':m.skill_hash(source)}}}}
   output=root/'output';native_environments=[]
   def run(argv,**kwargs):
    if 'add' in argv:shutil.copytree(source,Path(kwargs['cwd'])/'.agents/skills'/ (domain+'-cli'));value='installed'
    elif '-I' in argv:native_environments.append(kwargs['env']);value=callback
    else:value='1.7.0'
    return SimpleNamespace(returncode=0,stdout=value,stderr='')
   with patch.object(m.subprocess,'run',side_effect=run),patch.dict(os.environ,{'CRAFT_NODE_ARCHIVE':'fixture-offline','CRAFT_BUNDLE_DIRECTORY':'fixture-offline','CRAFT_NATIVE_ARCHIVE_DIRECTORY':'fixture-offline','CRAFT_RUNTIME_HOME':'fixture-cache'}):
    yield m,root,lock,output,native_environments
 def test_zero_exit_with_wrong_native_version_cannot_publish_receipt(self):
  for m,root,lock,output,environments in self.fixture('filmcraft-cli 0.2.0-craft.10'):
   with self.assertRaisesRegex(ValueError,'independent_runtime_version_mismatch'):m.verify(root/'node',root/'cli',root/'python',lock,output)
   self.assertFalse((output/'receipt.json').exists())
 def test_same_version_from_wrong_cli_cannot_publish_receipt(self):
  for actual in ('unrelated-cli 0.2.0-craft.1', 'error: expected filmcraft-cli 0.2.0-craft.1'):
   with self.subTest(actual=actual):
    for m,root,lock,output,environments in self.fixture(actual):
     with self.assertRaisesRegex(ValueError,'independent_runtime_version_mismatch'):m.verify(root/'node',root/'cli',root/'python',lock,output)
     self.assertFalse((output/'receipt.json').exists())
 def test_artcraft_requires_its_json_identity(self):
  for actual in ('{"name":"unrelated","version":"0.1.0-dev.41"}', 'artcraft 0.1.0-dev.41', '{"name":"artcraft","version":"0.1.0-dev.41"}'):
   with self.subTest(actual=actual):
    for m,root,lock,output,environments in self.fixture(actual,domain='artcraft',expected='0.1.0-dev.41'):
     if actual == '{"name":"artcraft","version":"0.1.0-dev.41"}':
      receipt=m.verify(root/'node',root/'cli',root/'python',lock,output)
      self.assertEqual(receipt['plugins'][0]['nativeVersions']['artcraft-cli']['actual'],actual)
     else:
      with self.assertRaisesRegex(ValueError,'independent_runtime_version_mismatch'):m.verify(root/'node',root/'cli',root/'python',lock,output)
      self.assertFalse((output/'receipt.json').exists())
 def test_locked_native_version_is_recorded_and_offline_overrides_are_excluded(self):
  for m,root,lock,output,environments in self.fixture('filmcraft-cli 0.2.0-craft.1'):
   receipt=m.verify(root/'node',root/'cli',root/'python',lock,output)
   self.assertEqual(receipt['versionProbes'],1)
   self.assertEqual(receipt['scope'],'actual public Skills CLI installation and 1 public native version probes')
   self.assertEqual(receipt['plugins'][0]['nativeVersions']['filmcraft-cli'],{'expected':'0.2.0-craft.1','actual':'filmcraft-cli 0.2.0-craft.1'})
   self.assertEqual(environments[0]['PATH'],'/usr/bin:/bin')
   for key in ('CRAFT_NODE_ARCHIVE','CRAFT_BUNDLE_DIRECTORY','CRAFT_NATIVE_ARCHIVE_DIRECTORY','CRAFT_RUNTIME_HOME'):self.assertNotIn(key,environments[0])

if __name__=='__main__':unittest.main()
