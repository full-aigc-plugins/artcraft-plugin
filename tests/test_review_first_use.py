"""单独审阅技能的真实首次安装、可移动记录与失败边界。评价为测试观察，不证明创作质量。"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]

@unittest.skipUnless(os.environ.get('CRAFT_REVIEW_FIRST_USE')=='1','requires public native first-use downloads')
class ReviewFirstUseTests(unittest.TestCase):
 def test_single_review_skill_records_native_package_without_unrelated_installs(self):
  with tempfile.TemporaryDirectory(prefix='artcraft-review-first-use-') as d:
   root=Path(d);skill=root/'only review skill'
   installed=os.environ.get('CRAFT_INSTALLED_REVIEW_SKILL_ROOT')
   shutil.copytree(Path(installed) if installed else ROOT/'skills/artcraft-cli-review',skill,ignore=shutil.ignore_patterns('__pycache__'))
   runtime=root/'runtime';project=root/'project';authorization='review-fixture-scope'
   def run(script,*args,ok=True,home=runtime):
    command=[sys.executable,'-I','-B',str(skill/'scripts'/script),*map(str,args),'--runtime-home',str(home)]
    result=subprocess.run(command,env=dict(os.environ,PATH='/usr/bin:/bin'),capture_output=True,text=True,timeout=600)
    if ok:self.assertEqual(result.returncode,0,result.stdout+result.stderr)
    else:self.assertNotEqual(result.returncode,0,result.stdout+result.stderr)
    return json.loads(result.stdout)
   plan=json.loads((skill/'examples/brand-campaign.json').read_text());plan['nodes']=[n for n in plan['nodes'] if n['id']=='logo']
   plan_path=root/'plan.json';plan_path.write_text(json.dumps(plan))
   made=run('workflow.py',plan_path,'--output',project,'--authorization',authorization)
   packed=run('package.py','create','--project',project,'--workflow',made['runKey'],'--output',root/'package','--authorization',authorization)
   package=run('package.py','verify','--package',root/'package','--sha',packed['sha256'])
   snapshots={p:p.read_bytes() for p in (root/'package').rglob('*') if p.is_file()};ledger=(project/'tasks.sqlite').read_bytes()
   observation=root/'inspection.json';contents=b'{"scope":"fixture record validation only; no aesthetic acceptance"}\n';observation.write_bytes(contents)
   target=package['children'][0]['outputs'][0];ref={key:target[key] for key in ('assetId','version','sha256')};ref['nodeId']='logo'
   input={'schema':'craft-review-input/v1','packageSha256':packed['sha256'],'planSha256':package['workflow']['planSha256'],'ownerId':package['workflow']['ownerId'],'authorizationRef':authorization,'brandReferences':[ref.copy()],'checks':[{'id':'technical-fixture','dimension':'technical','status':'PASS','evaluator':{'kind':'tool','id':'fixture-observer','version':'1'},'target':ref,'evidence':[{'location':'inspection.json','sha256':hashlib.sha256(contents).hexdigest()}],'note':'Tests evidence binding only, not actual media quality'}]}
   source=root/'review-input.json';source.write_text(json.dumps(input))
   receipt=run('review.py','record','--package',root/'package','--package-sha',packed['sha256'],'--input',source,'--output',root/'review')
   self.assertEqual(receipt['decision'],'pending');self.assertEqual(receipt['dimensions']['creative'],'NOT_RUN');self.assertEqual(receipt['taskState'],'review_ready')
   moved=root/'moved review';(root/'review').rename(moved);movedpackage=root/'moved package';(root/'package').rename(movedpackage)
   clean=root/'verify runtime'
   checked=run('review.py','verify','--package',movedpackage,'--package-sha',packed['sha256'],'--review',moved,'--review-sha',receipt['sha256'],home=clean)
   self.assertEqual(checked['decision'],'pending')
   self.assertTrue(all(not (clean/n).exists() for n in ('filmcraft','effectcraft','photocraft','vectorcraft')))
   self.assertTrue(all(not (runtime/n).exists() for n in ('filmcraft','effectcraft','photocraft')))
   self.assertEqual((project/'tasks.sqlite').read_bytes(),ledger)
   for path,contents in snapshots.items():self.assertEqual((movedpackage/path.relative_to(root/'package')).read_bytes(),contents)
   input['checks'][0]['target']['version']='stale';source.write_text(json.dumps(input))
   bad=run('review.py','record','--package',movedpackage,'--package-sha',packed['sha256'],'--input',source,'--output',root/'stale-review',ok=False)
   self.assertIn('review_asset_stale',bad['error']);self.assertFalse((root/'stale-review').exists())
   next((moved/'evidence').iterdir()).write_text('tampered')
   bad=run('review.py','verify','--package',movedpackage,'--package-sha',packed['sha256'],'--review',moved,'--review-sha',receipt['sha256'],ok=False,home=clean)
   self.assertIn('review_record_file_mismatch',bad['error'])
   self.assertFalse(any(skill.rglob('*.pyc')))
if __name__=='__main__':unittest.main()
