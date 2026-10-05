"""审阅记录：资产与品牌引用绑定，缺失证据不提升状态。"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from argparse import Namespace
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'skills/artcraft-use/scripts/review.py'

class ReviewTests(unittest.TestCase):
 def load(self):
  spec=importlib.util.spec_from_file_location('review',SCRIPT)
  module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
 def fixture(self,root):
  import hashlib
  data=b'{"observation":"test fixture only, not actual creative acceptance"}\n'
  (root/'observation.json').write_bytes(data)
  target={'nodeId':'logo','assetId':'logo-png','version':'1','sha256':'a'*64}
  package={'sha256':'b'*64,'workflow':{'ownerId':'local-user','authorizationRef':'scope','planSha256':'c'*64},'children':[{'nodeId':'logo','runtimeIdentity':{'pluginId':'vectorcraft','cliVersion':'0.2.0'},'outputs':[{'assetId':'logo-png','version':'1','sha256':'a'*64}]}]}
  value={'schema':'craft-review-input/v1','packageSha256':'b'*64,'planSha256':'c'*64,'ownerId':'local-user','authorizationRef':'scope','brandReferences':[target.copy()],'checks':[{'id':dim,'dimension':dim,'status':'PASS','evaluator':{'kind':'human','id':'fixture-reviewer','version':'fixture-1'},'target':target.copy(),'evidence':[{'location':'observation.json','sha256':hashlib.sha256(data).hexdigest()}],'note':'Test fixture observation'} for dim in ('technical','creative','acceptance')]}
  return package,value
 def test_all_bound_observations_record_acceptance_without_completing_task(self):
  m=self.load()
  with tempfile.TemporaryDirectory() as d:
   package,value=self.fixture(Path(d));report=m.evaluate(value,package,Path(d))
   self.assertEqual(report['decision'],'accepted')
   self.assertEqual(report['taskState'],'review_ready')
   self.assertEqual(report['dimensions'],dict.fromkeys(('engineering','technical','creative','acceptance'),'PASS'))
   self.assertEqual(report['checks'][0]['responsiblePlugin'],'vectorcraft')
 def test_missing_or_not_run_keeps_pending_and_fail_blocks_acceptance(self):
  m=self.load()
  with tempfile.TemporaryDirectory() as d:
   package,value=self.fixture(Path(d));value['checks']=[]
   self.assertEqual(m.evaluate(value,package,Path(d))['decision'],'pending')
   package,value=self.fixture(Path(d));value['checks'][0]['status']='NOT_RUN';value['checks'][0]['evidence']=[]
   self.assertEqual(m.evaluate(value,package,Path(d))['decision'],'pending')
   value['checks'][0]['status']='FAIL';value['checks'][0]['evidence']=value['checks'][1]['evidence']
   self.assertEqual(m.evaluate(value,package,Path(d))['decision'],'changes_requested')
 def test_stale_identity_missing_proof_nonhuman_acceptance_and_bad_locator_rejected(self):
  m=self.load()
  mutations=[lambda v:v.update(packageSha256='d'*64),lambda v:v.update(planSha256='d'*64),lambda v:v.update(ownerId='other'),lambda v:v['checks'][0]['target'].update(version='old'),lambda v:v['brandReferences'][0].update(sha256='d'*64),lambda v:v['checks'][0].update(evidence=[]),lambda v:v['checks'][-1]['evaluator'].update(kind='model'),lambda v:v['checks'][0]['target'].update(frame=-1),lambda v:v['checks'][0]['target'].update(region={'x':0,'y':0,'width':2,'height':1}),lambda v:v['checks'][0]['evidence'][0].update(location='../outside'),lambda v:v['checks'][0]['evidence'][0].update(sha256='d'*64)]
  for mutate in mutations:
   with self.subTest(mutation=mutations.index(mutate)),tempfile.TemporaryDirectory() as d:
    package,value=self.fixture(Path(d));mutate(value)
    with self.assertRaises((ValueError,OSError)):m.evaluate(value,package,Path(d))
 def test_symlink_proof_is_refused_and_changed_input_not_read_as_same_evidence(self):
  m=self.load()
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);package,value=self.fixture(root);(root/'alias.json').symlink_to(root/'observation.json')
   value['checks'][0]['evidence'][0]['location']='alias.json'
   with self.assertRaises(ValueError):m.evaluate(value,package,root)
   value['checks'][0]['evidence'][0]['location']='observation.json';(root/'observation.json').write_text('changed')
   with self.assertRaises(ValueError):m.evaluate(value,package,root)

 def test_record_moves_verifies_and_refuses_changed_observation_or_overwrite(self):
  m=self.load()
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);package,value=self.fixture(root);source=root/'input.json';source.write_text(json.dumps(value))
   delivery=root/'package';delivery.mkdir();args=Namespace(input=source,output=root/'review',package=delivery)
   with patch.object(m,'verify_package',return_value=package):first=m.record(args,package)
   before=(args.output/'review.json').read_bytes()
   with patch.object(m,'verify_package',return_value=package),self.assertRaisesRegex(ValueError,'review_output_exists'):m.record(args,package)
   self.assertEqual((args.output/'review.json').read_bytes(),before)
   moved=root/'moved review';args.output.rename(moved);args.review=moved;args.review_sha=first['sha256']
   self.assertEqual(m.verify_record(args,package)['decision'],'accepted')
   with self.assertRaisesRegex(ValueError,'review_package_stale'):m.verify_record(args,{**package,'sha256':'d'*64})
   proof=next((moved/'evidence').iterdir());proof.write_text('changed')
   with self.assertRaisesRegex(ValueError,'review_record_file_mismatch'):m.verify_record(args,package)

 def test_creative_failure_requires_specific_locator_and_any_asset_missing_stays_pending(self):
  m=self.load()
  with tempfile.TemporaryDirectory() as d:
   package,value=self.fixture(Path(d));value['checks'][1]['status']='FAIL'
   with self.assertRaisesRegex(ValueError,'review_issue_locator_required'):m.evaluate(value,package,Path(d))
   value['checks'][1]['target']['region']={'x':0,'y':0,'width':1,'height':1}
   self.assertEqual(m.evaluate(value,package,Path(d))['decision'],'changes_requested')
   value['checks'][1]['status']='PASS';package['children'][0]['outputs'].append({'assetId':'logo-svg','version':'1','sha256':'d'*64})
   self.assertEqual(m.evaluate(value,package,Path(d))['decision'],'pending')

if __name__=='__main__':unittest.main()
