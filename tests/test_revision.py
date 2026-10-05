"""受控修订步骤的策略、传递依赖和停止边界。"""
import importlib.util
import sys
sys.dont_write_bytecode=True
from pathlib import Path
import unittest
import json
import tempfile
import subprocess
from argparse import Namespace
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1]

class RevisionTests(unittest.TestCase):
 def module(self):
  s=importlib.util.spec_from_file_location('revision',ROOT/'skills/artcraft-use/scripts/revision.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
 def fixture(self):
  policy={'schema':'craft-revision-policy/v1','workflowId':'brand','ownerId':'local-user','authorizationRef':'scope','targetSha256':'a'*64,'maxRounds':2,'maxStagnantRounds':1,'allowedCommands':{'logo':['paint.setFill'],'poster':['asset.replace']}}
  def node(id,deps,plugin):return {'id':id,'dependsOn':deps,'projectKey':id,'pluginId':plugin,'expectedRevision':None,'payload':{'schemaVersion':'craft-skill-workflow/v1','plan':{'document':{'name':id},'operations':[],'exports':[]},'assetBindings':[],'outputs':[{'assetId':id,'location':id+'.png','mediaType':'image/png'}]}}
  plan={'workflowId':'brand','revision':'v1','ownerId':'local-user','authorizationRef':'scope','budget':{'currency':'USD','maxMinorUnits':0,'maxExternalCalls':0,'maxRevisions':2},'deadline':'2030-01-01T00:00:00Z','nodes':[node('logo',[],'vectorcraft'),node('poster',['logo'],'photocraft'),node('unrelated',[],'vectorcraft')]}
  def child(n):return {'nodeId':n['id'],'runtimeIdentity':{'pluginId':n['pluginId']},'root':'children/'+n['id'],'outputs':[{'assetId':n['id'],'version':'1','sha256':'b'*64,'nativeProjectRef':{'sha256':'c'*64}}]}
  package={'sha256':'d'*64,'workflow':{'workflowId':'brand','revision':'v1','ownerId':'local-user','authorizationRef':'scope','runKey':'old'},'children':[child(n) for n in plan['nodes']]}
  review={'decision':'changes_requested','dimensions':{'engineering':'PASS','technical':'PASS','creative':'FAIL','acceptance':'NOT_RUN'},'checks':[{'dimension':dim,'status':'FAIL' if n['id']=='logo' and dim=='creative' else 'PASS','target':{'nodeId':n['id'],'assetId':n['id']},'responsiblePlugin':n['pluginId']} for n in plan['nodes'] for dim in ('technical','creative')]}
  request={'schema':'craft-revision-request/v1','revision':'v2','patches':[{'nodeId':'logo','operations':[{'command':'paint.setFill','params':{'color':'#123456'}}]},{'nodeId':'poster','operations':[{'command':'asset.replace','params':{'asset':'logo','replacement':'replacement'}}],'assetBindings':[{'name':'replacement','assetId':'logo'}]}]}
  return policy,plan,package,review,request
 def test_plan_uses_current_sources_and_preserves_unrelated_node_and_budget(self):
  m=self.module();policy,plan,package,review,request=self.fixture();made=m.build_plan(policy,plan,package,review,request,Path('/current/package'))
  self.assertEqual(made['nodes'][2],plan['nodes'][2]);self.assertEqual(made['budget'],plan['budget']);self.assertEqual(made['deadline'],plan['deadline'])
  self.assertEqual(made['nodes'][0]['expectedRevision'],'c'*64);self.assertNotIn('document',made['nodes'][0]['payload']['plan']);self.assertEqual(made['nodes'][0]['payload']['sourceProject'],{'assetId':'logo'})
 def test_scope_missing_dependency_unknown_command_or_new_target_refused(self):
  m=self.module()
  mutations=[lambda p,r:r['patches'].pop(),lambda p,r:r['patches'].append({'nodeId':'unrelated','operations':[{'command':'paint.setFill','params':{}}]}),lambda p,r:r['patches'][0]['operations'][0].update(command='project.resize'),lambda p,r:r.update(revision='v1'),lambda p,r:p.update(workflowId='other')]
  for mutate in mutations:
   with self.subTest(index=mutations.index(mutate)):
    policy,plan,package,review,request=self.fixture();mutate(policy,request)
    with self.assertRaises(ValueError):m.build_plan(policy,plan,package,review,request,Path('/current/package'))
 def test_rounds_stagnation_and_missing_review_stop_without_execution(self):
  m=self.module();policy,plan,package,review,request=self.fixture()
  state={'rounds':0,'stagnantRounds':0,'bestScore':None,'bestPackage':None,'lastScore':None,'stopped':None}
  self.assertIsNone(m.observe(policy,state,package,review));self.assertEqual(state['bestPackage']['sha256'],'d'*64)
  state['rounds']=1
  self.assertEqual(m.observe(policy,state,package,review),'stagnation')
  state={'rounds':2,'stagnantRounds':0,'bestScore':None,'bestPackage':None,'lastScore':None,'stopped':None}
  self.assertEqual(m.observe(policy,state,package,review),'max_rounds')
  review['checks'].pop()
  self.assertEqual(m.observe(policy,{**state,'rounds':0},package,review),'review_required')
 def test_invalid_or_expanded_policy_is_rejected(self):
  m=self.module();policy,*_=self.fixture()
  for field,value in [('maxRounds',0),('maxRounds',True),('maxStagnantRounds',0),('targetSha256','bad'),('allowedCommands',{}),('extra','not declared')]:
   with self.subTest(field=field):
    bad={**policy,field:value}
    with self.assertRaises(ValueError):m.validate_policy(bad)

 def harness(self,m,root):
  policy,plan,package,review,request=self.fixture()
  project=root/'project';project.mkdir();(project/'.artcraft-project.json').write_text(json.dumps({'schema':'artcraft-project/v1','ownerId':'local-user','workflowId':'brand'}))
  folder=root/'package';folder.mkdir()
  package['files']={}
  for name in ('workflow-plan.json','workflow-plan-portable.json'):
   data=m.canonical(plan);(folder/name).write_bytes(data);package['files'][name]={'sha256':m.sha(data),'bytes':len(data)}
  package['root']=str(folder)
  policyfile=root/'policy.json';policyfile.write_bytes(m.canonical(policy))
  requestfile=root/'request.json';requestfile.write_bytes(m.canonical(request))
  args=Namespace(project=project,policy=policyfile,policy_sha=m.sha(policyfile.read_bytes()),request=requestfile,package=folder,package_sha=package['sha256'],review=root/'review',review_sha='f'*64,runtime_home=root/'runtime',node_archive=None,bundle_dir=None,native_archive_dir=None,resume=False,video_factory_root=None,ffmpeg=None,ffprobe=None)
  return args,package,review,request

 def test_unknown_requires_same_step_resume_then_reuses_current_verified_package(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as d:
   args,package,review,request=self.harness(m,Path(d));launches=[];fail=[True]
   def invoke(args,script,values):
    if script=='review.py':return review
    if script=='workflow.py':
     launches.append(script)
     if fail[0]:raise subprocess.TimeoutExpired('fixture workflow',1)
     return {'state':'review_ready','runKey':'new-run','nodes':{}}
    if values[0]=='create':return {'root':str(Path(d)/'new package'),'sha256':'e'*64,'runKey':'new-run'}
    if values[-1]=='e'*64:return {'workflow':{'runKey':'new-run'}}
    return package
   with patch.object(m,'invoke',side_effect=invoke):
    unknown=m.step(args);self.assertEqual(unknown['state'],'outcome_unknown');self.assertEqual(m.read_state(args.project)['rounds'],1)
    self.assertEqual(m.step(args)['state'],'outcome_unknown');self.assertEqual(len(launches),1)
    request['revision']='v3';args.request.write_bytes(m.canonical(request));self.assertEqual(m.step(args)['state'],'outcome_unknown');self.assertEqual(len(launches),1)
    request['revision']='v2';args.request.write_bytes(m.canonical(request));args.resume=True;fail[0]=False
    made=m.step(args);self.assertEqual(made['state'],'review_required');self.assertEqual(m.read_state(args.project)['rounds'],1)
    self.assertEqual(m.step(args),made);self.assertEqual(len(launches),2)
   def stale(args,script,values):
    if script=='review.py':return review
    if values[-1]=='e'*64:return {'workflow':{'runKey':'different'}}
    return package
   with patch.object(m,'invoke',side_effect=stale),self.assertRaisesRegex(ValueError,'revision_saved_package_mismatch'):m.step(args)

 def test_pending_plan_tamper_and_counter_drift_block_resume_before_native_dispatch(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as d:
   args,package,review,request=self.harness(m,Path(d));launches=[]
   def invoke(args,script,values):
    if script=='review.py':return review
    if script=='workflow.py':launches.append(script);raise subprocess.TimeoutExpired('fixture',1)
    return package
   with patch.object(m,'invoke',side_effect=invoke):
    m.step(args);state=m.read_state(args.project);state['pending']['plan']['nodes'][0]['payload']['plan']['operations'][0]['params']['color']='#ffffff';m.save_state(args.project,state);args.resume=True
    with self.assertRaisesRegex(ValueError,'revision_pending_plan_modified'):m.step(args)
    self.assertEqual(len(launches),1)
   state['rounds']=0;m.save_state(args.project,state)
   with self.assertRaisesRegex(ValueError,'revision_state_counter_mismatch'):m.read_state(args.project)

 def test_human_rejection_can_route_a_patch_and_accepted_record_updates_best_anchor(self):
  m=self.module();policy,plan,package,review,request=self.fixture()
  for row in review['checks']:row['status']='PASS'
  review['checks'].append({'dimension':'acceptance','status':'FAIL','target':{'nodeId':'logo','assetId':'logo'},'responsiblePlugin':'vectorcraft'})
  self.assertEqual(m.observed_score(package,review),1)
  self.assertEqual(m.build_plan(policy,plan,package,review,request,Path('/package'))['revision'],'v2')
  state={'rounds':0,'stagnantRounds':0,'bestScore':None,'bestPackage':None,'lastScore':None,'stopped':None}
  review['checks'][-1]['status']='PASS';review['decision']='accepted'
  self.assertEqual(m.observe(policy,state,package,review),'accepted_record');self.assertEqual(state['bestScore'],0)

 def test_best_package_is_reverified_and_failed_verification_cannot_be_pass(self):
  m=self.module();best={'root':'/best','sha256':'a'*64,'runKey':'best-run','revision':'v1'};state={'bestPackage':best,'rounds':1}
  with patch.object(m,'invoke',return_value={'workflow':{'runKey':'best-run'}}):
   self.assertEqual(m.stopped_receipt(None,state,'stagnation')['bestVerification'],'PASS')
  with patch.object(m,'invoke',side_effect=RuntimeError('package_file_digest_mismatch')):
   self.assertEqual(m.stopped_receipt(None,state,'stagnation')['bestVerification'],'FAIL')

if __name__=='__main__':unittest.main()
