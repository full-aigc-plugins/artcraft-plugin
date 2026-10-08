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
  m=self.module();lock=json.loads((ROOT/'host-acceptance-art101.lock.json').read_text());plan=m.installation_plan(lock)
  self.assertEqual(len(plan),5);self.assertEqual(sum(len(p['skills']) for p in plan),64)
  self.assertEqual({row['plugin']:len(row['skills']) for row in plan},
                   {'filmcraft':13,'effectcraft':15,'photocraft':13,'vectorcraft':13,'artcraft':10})
  for row in plan:
   self.assertTrue(row['source'].endswith(lock['plugins'][row['plugin']]['skillSourceRef']))
   self.assertNotIn('--global',row['argv']);self.assertIn('--copy',row['argv']);self.assertIn('codex',row['argv'])
 def test_missing_tool_does_not_create_output_or_attempt_installation(self):
  m=self.module();lock=json.loads((ROOT/'host-acceptance-art101.lock.json').read_text())
  with tempfile.TemporaryDirectory() as d:
   output=Path(d)/'output'
   with self.assertRaisesRegex(ValueError,'existing_tool_required'):m.verify(Path(d)/'absent',Path(d)/'cli',Path(d)/'python',lock,output)
   self.assertFalse(output.exists())
 def test_hash_rejects_symlink_payload(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as d:
   folder=Path(d);(folder/'target').write_text('file');(folder/'link').symlink_to('target')
   with self.assertRaisesRegex(ValueError,'independent_skill_symlink'):m.skill_hash(folder)
class InstallLockPreflightTests(unittest.TestCase):
 def module(self):return IndependentInstallTests().module()
 def lock(self):return json.loads((ROOT/'host-acceptance-art-photo34.lock.json').read_text())
 def test_default_plan_matches_current_published_source_refs(self):
  result=subprocess.run([sys.executable,'-I','-B',str(ROOT/'scripts/verify_independent_skill_install.py'),'--plan'],capture_output=True,text=True)
  self.assertEqual(result.returncode,0,result.stderr)
  rows=json.loads(result.stdout);current=self.lock()
  for row in rows:
   entry=current['plugins'][row['plugin']]
   self.assertTrue(row['source'].endswith('/'+entry['skillSourceRef']))
   self.assertEqual(row['sourceSha'],entry['skillSourceSha'])
   self.assertEqual(row['skills'],entry['skills'])
 def test_invalid_lock_is_rejected_before_output_and_external_tool(self):
  mutations=[lambda x:x.update(skillSourceRef='main'),
             lambda x:x.update(skillSourceRef='v0.1.0-dev.32/../../main'),
             lambda x:x.update(skillSourceSha='a'*39),
             lambda x:x['skills'].update({'filmcraft-cli':'not-a-digest'}),
             lambda x:x['skills'].update({'--global':'b'*64}),
             lambda x:x['skills'].update({'../filmcraft-cli':'b'*64}),
             lambda x:x['skills'].update({'artcraft-cli':'b'*64}),
             lambda x:x.update(skills=['filmcraft-cli'])]
  for case,mutate in enumerate(mutations):
   lock=self.lock();mutate(lock['plugins']['filmcraft'])
   with self.subTest(case=case),tempfile.TemporaryDirectory() as temporary:
    output=Path(temporary)/'output';m=self.module()
    with patch.object(m.subprocess,'run') as call:
     with self.assertRaisesRegex(ValueError,'independent_install_lock_invalid'):
      m.verify('/missing/node','/missing/cli','/missing/python',lock,output)
     call.assert_not_called()
    self.assertFalse(output.exists())
 def test_explicit_historical_fixed_lock_still_produces_plan(self):
  m=self.module();lock=json.loads((ROOT/'host-acceptance-art102.lock.json').read_text())
  self.assertEqual(sum(len(x['skills']) for x in m.installation_plan(lock)),64)

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

class InstallCallEvidenceTests(unittest.TestCase):
 def failure(self, kind):
  fixture=NativeVersionGateTests()
  for m,root,lock,output,environments in fixture.fixture('filmcraft-cli 0.2.0-craft.1'):
   original=m.subprocess.run
   def run(argv,**kwargs):
    if 'add' not in argv:return original(argv,**kwargs)
    if kind=='timeout':raise subprocess.TimeoutExpired(argv,600,output=b'partial download',stderr=b'network stalled')
    if kind=='launch':raise OSError('tool could not start')
    return SimpleNamespace(returncode=7,stdout='download started',stderr='public archive unavailable')
   with patch.object(m.subprocess,'run',side_effect=run):
    with self.assertRaises((RuntimeError,subprocess.TimeoutExpired,OSError)):
     m.verify(root/'node',root/'cli',root/'python',lock,output)
   self.assertFalse((output/'receipt.json').exists())
   calls=sorted((output/'calls').glob('*.json'))
   self.assertEqual(len(calls),2)
   record=json.loads(calls[-1].read_text())
   self.assertEqual(record['status'],kind)
   self.assertEqual(record['argv'][2],'add')
   self.assertEqual(record['timeoutSeconds'],600)
   stdout=(output/'calls'/record['stdout']).read_text()
   stderr=(output/'calls'/record['stderr']).read_text()
   if kind=='timeout':self.assertEqual((stdout,stderr),('partial download','network stalled'))
   elif kind=='launch':self.assertIn('tool could not start',stderr)
   else:self.assertEqual((stdout,stderr),('download started','public archive unavailable'))
 def test_nonzero_keeps_complete_call_evidence(self):self.failure('exit')
 def test_timeout_keeps_partial_bytes_and_does_not_publish_success(self):self.failure('timeout')
 def test_launch_failure_keeps_diagnostic_and_does_not_publish_success(self):self.failure('launch')
 def test_real_external_failure_keeps_output(self):
  m=IndependentInstallTests().module()
  lock=json.loads((ROOT/'host-acceptance-art-photo34.lock.json').read_text())
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);cli=root/'fixture.py';output=root/'output'
   cli.write_text("import sys\nif '--version' in sys.argv: print('fixture 1')\nelse:\n print('actual stdout')\n print('actual stderr',file=sys.stderr)\n sys.exit(7)\n")
   with self.assertRaisesRegex(RuntimeError,'independent_install_call_failed'):
    m.verify(sys.executable,cli,sys.executable,lock,output)
   record=json.loads((output/'calls/0002.json').read_text())
   self.assertEqual(record['returncode'],7)
   self.assertEqual((output/'calls'/record['stderr']).read_text(),'actual stderr\n')
   self.assertFalse((output/'receipt.json').exists())

if __name__=='__main__':unittest.main()
