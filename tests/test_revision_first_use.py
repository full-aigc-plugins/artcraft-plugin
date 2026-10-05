"""真实单技能修订：冻结策略、原生返工、无关复用、停滞/轮数/预算及移动回执。"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import signal
import time
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]

@unittest.skipUnless(os.environ.get('CRAFT_REVISION_FIRST_USE')=='1','requires public native cold first-use downloads')
class RevisionFirstUseTests(unittest.TestCase):
 def test_native_revision_and_all_stop_policies_preserve_original_deliveries(self):
  with tempfile.TemporaryDirectory(prefix='artcraft-revision-first-use-') as d:
   root=Path(d);skill=root/'single revise skill'
   installed=os.environ.get('CRAFT_INSTALLED_REVISE_SKILL_ROOT')
   shutil.copytree(Path(installed) if installed else ROOT/'skills/artcraft-cli-revise',skill,ignore=shutil.ignore_patterns('__pycache__'))
   runtime=root/'runtime';env=dict(os.environ,PATH='/usr/bin:/bin')
   def run(script,*args,success=True):
    argv=[sys.executable,'-I','-B',str(skill/'scripts'/script)]
    argv += ['--runtime-home',str(runtime),*map(str,args)] if script=='cli.py' else [*map(str,args),'--runtime-home',str(runtime)]
    result=subprocess.run(argv,capture_output=True,text=True,env=env,timeout=600)
    if success:self.assertEqual(result.returncode,0,result.stdout+result.stderr)
    else:self.assertNotEqual(result.returncode,0,result.stdout+result.stderr)
    return json.loads(result.stdout)
   template=json.loads((skill/'examples/brand-campaign.json').read_text());template['nodes']=[n for n in template['nodes'] if n['id'] in ('logo','poster')]
   extra=json.loads(json.dumps(template['nodes'][0]));extra['id']='unrelated';extra['projectKey']='unrelated-project';extra['payload']['outputs'][0]['assetId']='unrelated-png';template['nodes'].append(extra)
   observation=root/'observation.json';observed=b'{"scope":"declared fixture feedback for revision contract, not aesthetic acceptance"}\n';observation.write_bytes(observed)
   def review(package,packed,tag):
    value=run('package.py','verify','--package',package,'--sha',packed['sha256'])
    checks=[];brand=None
    for child in value['children']:
     for artifact in child['outputs']:
      target={key:artifact[key] for key in ('assetId','version','sha256')};target['nodeId']=child['nodeId']
      if child['nodeId']=='logo':brand=target.copy()
      for dim in ('technical','creative'):
       target_one=target.copy()
       failed=dim=='creative' and child['nodeId']=='logo'
       if failed:target_one['objectId']='logo.ids.0'
       checks.append({'id':child['nodeId']+'-'+artifact['assetId']+'-'+dim,'dimension':dim,'status':'FAIL' if failed else 'PASS','evaluator':{'kind':'tool','id':'fixture-feedback','version':'1'},'target':target_one,'evidence':[{'location':'observation.json','sha256':hashlib.sha256(observed).hexdigest()}],'note':'Declared fixture observation; no real creative or human acceptance'})
    path=root/(tag+'-review-input.json');path.write_text(json.dumps({'schema':'craft-review-input/v1','packageSha256':packed['sha256'],'planSha256':value['workflow']['planSha256'],'ownerId':value['workflow']['ownerId'],'authorizationRef':value['workflow']['authorizationRef'],'brandReferences':[brand],'checks':checks}))
    destination=root/(tag+'-review')
    receipt=run('review.py','record','--package',package,'--package-sha',packed['sha256'],'--input',path,'--output',destination)
    self.assertEqual(receipt['decision'],'changes_requested');return destination,receipt
   for reason in ('stagnation','max_rounds','budget_exceeded'):
    with self.subTest(stop=reason):
     project=root/(reason+'-project');auth='revision-'+reason
     plan=json.loads(json.dumps(template));plan['workflowId']='revision-'+reason
     plan['budget']['maxRevisions']=0 if reason=='budget_exceeded' else 2
     planfile=root/(reason+'-plan.json');planfile.write_text(json.dumps(plan))
     first=run('workflow.py',planfile,'--output',project,'--authorization',auth)
     original_files={p:p.read_bytes() for n in first['nodes'].values() for p in Path(n['root']).rglob('*') if p.is_file()}
     package=root/(reason+'-package');packed=run('package.py','create','--project',project,'--workflow',first['runKey'],'--authorization',auth,'--output',package)
     original_package={p:p.read_bytes() for p in package.rglob('*') if p.is_file()}
     feedback,feedback_receipt=review(package,packed,reason+'-initial')
     policy={'schema':'craft-revision-policy/v1','workflowId':plan['workflowId'],'ownerId':'local-user','authorizationRef':auth,'targetSha256':'a'*64,'maxRounds':1 if reason=='max_rounds' else 3,'maxStagnantRounds':1,'allowedCommands':{'logo':['paint.setFill'],'poster':['layer.select','layer.layerMask.hideAll','asset.place']}}
     policyfile=root/(reason+'-policy.json');policyfile.write_text(json.dumps(policy));policy_sha=hashlib.sha256(policyfile.read_bytes()).hexdigest()
     request={'schema':'craft-revision-request/v1','revision':'v2','patches':[{'nodeId':'logo','operations':[{'command':'paint.setFill','params':{'ids':[{'$ref':'logo.ids.0'},{'$ref':'wordmark.id'}],'color':'#d63b42'}}]},{'nodeId':'poster','operations':[{'command':'layer.select','params':{'layer':{'$ref':'logo.layer'}}},{'command':'layer.layerMask.hideAll','params':{}},{'command':'asset.place','params':{'asset':'replacement','center':[160,210],'name':'Revised Logo'}}],'assetBindings':[{'name':'replacement','assetId':'logo-png'}]}]}
     requestfile=root/(reason+'-request.json');requestfile.write_text(json.dumps(request))
     def step_args(package,packed,feedback,feedback_receipt):return ['step','--project',project,'--package',package,'--package-sha',packed['sha256'],'--review',feedback,'--review-sha',feedback_receipt['sha256'],'--request',requestfile,'--policy',policyfile,'--policy-sha',policy_sha]
     def step(package,packed,feedback,feedback_receipt,success=True):return run('revision.py',*step_args(package,packed,feedback,feedback_receipt),success=success)
     if reason=='stagnation':
      # 只终止本测试创建的独立进程组；在原生工作流 review_ready 后模拟丢失最终回执。
      child=subprocess.Popen([sys.executable,'-I','-B',str(skill/'scripts/revision.py'),*map(str,step_args(package,packed,feedback,feedback_receipt)),'--runtime-home',str(runtime)],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
      interrupted=False;deadline=time.monotonic()+180
      while child.poll() is None and time.monotonic()<deadline:
       journal=project/'.artcraft-revision-cycle.json'
       if journal.exists():
        snapshot=json.loads(journal.read_text())
        if (snapshot.get('pending') or {}).get('phase')=='package':
         self.assertEqual(snapshot['pending']['workflowResult']['state'],'review_ready')
         self.assertEqual(os.getpgid(child.pid),child.pid)
         os.killpg(child.pid,signal.SIGKILL);interrupted=True;break
       time.sleep(.005)
      if not interrupted and child.poll() is None:os.killpg(child.pid,signal.SIGKILL)
      stdout,stderr=child.communicate(timeout=30)
      self.assertTrue(interrupted,stdout+stderr)
      pending_status=run('cli.py','--','status','--database',project/'tasks.sqlite')
      self.assertFalse(pending_status['leases'])
      uncertain=run('revision.py',*step_args(package,packed,feedback,feedback_receipt),success=False)
      self.assertEqual(uncertain['state'],'outcome_unknown')
      self.assertEqual(run('cli.py','--','status','--database',project/'tasks.sqlite'),pending_status)
      made=run('revision.py',*step_args(package,packed,feedback,feedback_receipt),'--resume')
      self.assertEqual(run('cli.py','--','status','--database',project/'tasks.sqlite'),pending_status)
     else:
      made=step(package,packed,feedback,feedback_receipt)
     if reason=='budget_exceeded':
      self.assertEqual(made['state'],'stopped',made);self.assertEqual(made['reason'],'budget_exceeded');self.assertEqual(made['bestVerification'],'PASS');self.assertTrue(made['unresolvedIssues']);self.assertEqual(made['issueSource']['reviewSha256'],feedback_receipt['sha256'])
     else:
      self.assertEqual(made['state'],'review_required',made)
      second=made['workflow'];self.assertEqual(second['nodes']['unrelated']['taskId'],first['nodes']['unrelated']['taskId'])
      for id in ('logo','poster'):
       self.assertNotEqual(second['nodes'][id]['taskId'],first['nodes'][id]['taskId'])
       self.assertNotEqual(second['nodes'][id]['outputs'][0]['sha256'],first['nodes'][id]['outputs'][0]['sha256'])
       manifest=json.loads((Path(second['nodes'][id]['root'])/'manifest.json').read_text());self.assertEqual(manifest['sourceProjectSha256'],first['nodes'][id]['outputs'][0]['nativeProjectRef']['sha256'])
      before=run('cli.py','--','status','--database',project/'tasks.sqlite')
      self.assertEqual(step(package,packed,feedback,feedback_receipt),made)
      self.assertEqual(run('cli.py','--','status','--database',project/'tasks.sqlite'),before)
      newpackage=Path(made['package']['root']);newfeedback,newreceipt=review(newpackage,made['package'],reason+'-new')
      request['revision']='v3';requestfile.write_text(json.dumps(request))
      stopped=step(newpackage,made['package'],newfeedback,newreceipt)
      self.assertEqual(stopped['state'],'stopped');self.assertEqual(stopped['reason'],reason);self.assertTrue(stopped['unresolvedIssues']);self.assertEqual(stopped['issueEvidence'],'recorded_observation');self.assertEqual(stopped['bestVerification'],'PASS')
      self.assertEqual(stopped['bestPackage']['sha256'],packed['sha256'])
      self.assertEqual(run('cli.py','--','status','--database',project/'tasks.sqlite'),before)
     for path,contents in original_files.items():self.assertEqual(path.read_bytes(),contents)
     for path,contents in original_package.items():self.assertEqual(path.read_bytes(),contents)
     status=run('revision.py','status','--project',project);self.assertEqual(status['rounds'],1)
     policy['targetSha256']='e'*64;policyfile.write_text(json.dumps(policy));policy_sha=hashlib.sha256(policyfile.read_bytes()).hexdigest()
     denied=step(package,packed,feedback,feedback_receipt,success=False);self.assertIn('revision_policy_changed_requires_new_authorization',denied['error'])
   self.assertFalse(any(skill.rglob('*.pyc')))
if __name__=='__main__':unittest.main()
