"""固定 Art 安装副本的公开 LUT／运动首次使用与保全验收。"""
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

def hashes(root):
 return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}

@unittest.skipUnless(os.environ.get('CRAFT_LUT_INSTALLED_FIRST_USE')=='1','requires immutable installed Art dev69 and public downloads')
class InstalledLutFirstUse(unittest.TestCase):
 def test_public_cold_install_lut_motion_revision_and_repeat(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary);skill=root/'.agents/skills/artcraft-cli-execute'
   shutil.copytree(Path(os.environ['CRAFT_INSTALLED_LUT_ART_SKILL']),skill)
   baseline=hashes(skill);runtime=root/'empty-runtime';project=root/'project'
   self.assertFalse(runtime.exists())
   film=Path(os.environ['CRAFT_INSTALLED_LUT_FILM_SKILL'])
   voice=root/'voice.wav';cube=root/'grade.cube'
   ffmpeg=os.environ['CRAFT_TEST_FFMPEG']
   subprocess.run([ffmpeg,'-v','error','-f','lavfi','-i','sine=frequency=440:duration=2:sample_rate=48000','-c:a','pcm_s16le',str(voice)],check=True)
   cube.write_text('LUT_3D_SIZE 2\n'+''.join(f'{g} {r} {b}\n' for b in (0,1) for g in (0,1) for r in (0,1)))
   fp=json.loads((film/'examples/short-film.json').read_text());common={'clip':{'$ref':'shotClip.clips.0'},'effect':'motion','param':'position'}
   fp['operations'] += [{'command':'effects.toggleAnimation','params':common},{'command':'effects.setParam','params':dict(common,value=[100,90],time='0')},{'command':'effects.setParam','params':dict(common,value=[200,90],time='254016000000')},{'command':'lumetri.setInputLut','params':{'clip':common['clip'],'asset':'grade'}}]
   fp['frames']=['0','381024000000']
   plan={'workflowId':'installed-lut-motion','revision':'v1','budget':{'currency':'USD','maxMinorUnits':0,'maxRevisions':4,'maxExternalCalls':0},'nodes':[
    {'id':'intro','pluginId':'effectcraft','dependsOn':[],'projectKey':'intro','expectedRevision':None,'payload':{'schemaVersion':'craft-skill-workflow/v1','plan':{'document':{'name':'Red intro','width':320,'height':180,'frameRate':12,'duration':2},'operations':[{'command':'layer.newSolid','params':{'name':'Red','color':'#ff0000'}}],'frames':[0],'exports':[{'format':'mp4'}]},'assetBindings':[],'outputs':[{'assetId':'intro-video','location':'intro.mp4','mediaType':'video/mp4'}]}},
    {'id':'film','pluginId':'filmcraft','dependsOn':['intro'],'inputBindings':[{'from':'intro','assetId':'intro-video'}],'providedAssets':['voice','grade'],'projectKey':'film','expectedRevision':None,'payload':{'schemaVersion':'craft-skill-workflow/v1','plan':fp,'assetBindings':[{'name':'shot','assetId':'intro-video'},{'name':'voice','assetId':'voice'},{'name':'grade','assetId':'grade','kind':'lut'}],'outputs':[{'assetId':'film','location':'film.mp4','mediaType':'video/mp4'}]}}]}
   environment={k:v for k,v in os.environ.items() if k not in ('CRAFT_NODE_ARCHIVE','CRAFT_BUNDLE_DIRECTORY','CRAFT_NATIVE_ARCHIVE_DIRECTORY')};environment['PATH']='/usr/bin:/bin'
   def run(value,lut_path,expected=0):
    path=root/(value['revision']+'.json');path.write_text(json.dumps(value))
    result=subprocess.run([sys.executable,'-I','-B',str(skill/'scripts/workflow.py'),str(path),'--output',str(project),'--runtime-home',str(runtime),'--authorization','installed-lut-motion','--asset','voice='+str(voice),'--asset','grade='+str(lut_path)],capture_output=True,text=True,env=environment,timeout=600)
    self.assertEqual(result.returncode,expected,result.stdout+result.stderr);receipt=json.loads(result.stdout);return json.loads(receipt['error']) if expected else receipt
   first=run(plan,cube);self.assertEqual(first['state'],'review_ready')
   setup=json.loads((project/'installation-receipt.json').read_text());self.assertEqual(setup['version'],'0.1.0-dev.68');self.assertEqual(setup['skills']['filmcraft']['runtimeIdentity']['pluginVersion'],'0.1.0-dev.10')
   old=Path(first['nodes']['film']['root']);original=hashes(old);artifact=first['nodes']['film']['outputs'][0];manifest=json.loads((old/'manifest.json').read_text())
   self.assertEqual(next(d for d in artifact['dependencies'] if d['assetRef']['assetId']=='grade')['kind'],'lut')
   before=json.loads((old/'native.json').read_text())['sequence']
   revised=copy.deepcopy(plan);revised['revision']='v2';node=revised['nodes'][1];node['expectedRevision']=artifact['nativeProjectRef']['sha256'];node['externalInputs']=[{'root':str(old),'artifact':artifact}];node['payload']['sourceProject']={'assetId':'film'}
   for binding in node['payload']['assetBindings']:binding['retained']=True
   node['payload']['plan']={'operations':[{'command':'effects.setParam','params':dict(common,value=[260,90],time='254016000000')}],'frames':['0','381024000000'],'export':{'audioRequired':True}}
   cube.unlink();retained=old/manifest['assets']['grade']['path'];second=run(revised,retained)
   self.assertEqual(second['nodes']['intro']['taskId'],first['nodes']['intro']['taskId']);self.assertNotEqual(second['nodes']['film']['taskId'],first['nodes']['film']['taskId'])
   changed=Path(second['nodes']['film']['root']);after=json.loads((changed/'native.json').read_text())['sequence'];self.assertEqual(before['audio'],after['audio']);self.assertEqual(original['captions.json'],hashes(changed)['captions.json'])
   fx=lambda sequence,name:next(e for e in sequence['video'][0]['items'][0]['effects'] if e['effect']==name)
   self.assertEqual(fx(before,'lumetri'),fx(after,'lumetri'));self.assertEqual(fx(after,'motion')['params']['position']['keyframes'],2)
   def decode(folder,kind):
    args=['-frames:v','24','-f','rawvideo','-pix_fmt','rgb24'] if kind=='video' else ['-vn','-f','s16le','-ac','1','-ar','48000']
    return subprocess.check_output([ffmpeg,'-v','error','-i',str(folder/'film.mp4'),*args,'-'])
   initial=decode(old,'video');final=decode(changed,'video');self.assertEqual(len(final),24*320*180*3);self.assertNotEqual(initial,final);offset=18*320*180*3+(20*320+160)*3;pixel=list(final[offset:offset+3]);self.assertGreater(pixel[1],180);self.assertLess(pixel[0],35)
   self.assertEqual(decode(old,'audio'),decode(changed,'audio'))
   repeated=run(revised,retained);self.assertEqual({name:(item['taskId'],item.get('outputs')) for name,item in repeated['nodes'].items()},{name:(item['taskId'],item.get('outputs')) for name,item in second['nodes'].items()});self.assertEqual(repeated['budget'],second['budget']);self.assertEqual(original,hashes(old));self.assertEqual(baseline,hashes(skill))
   broken=copy.deepcopy(revised);broken['revision']='v3';broken['nodes'][1]['payload']['plan']['operations'][0]['params']['time']='-1'
   failed=run(broken,retained,1);self.assertEqual(failed['state'],'failed');self.assertEqual(failed['nodes']['film']['status'],'failed');self.assertEqual(failed['nodes']['film']['outputs'],[])
   recovery=copy.deepcopy(revised);recovery['revision']='v4';recovered=run(recovery,retained);self.assertEqual(recovered['state'],'review_ready');self.assertEqual(recovered['nodes']['intro']['taskId'],second['nodes']['intro']['taskId']);self.assertEqual(original,hashes(old));self.assertEqual(baseline,hashes(skill))
   if os.environ.get('CRAFT_LUT_INSTALLED_EVIDENCE'):
    evidence={'schema':'artcraft69-installed-lut-motion-first-use/v1','result':'PASS','scope':'copied-alone actual installed Art dev69 execute skill; empty runtime; default public downloads; two-domain native LUT/motion revision','runtimeVersion':setup['version'],'filmSourceVersion':setup['skills']['filmcraft']['runtimeIdentity']['pluginVersion'],'decodedFrames':24,'lutPixel':pixel,'upstreamReused':True,'originalLutRemoved':True,'sourcePreserved':True,'audioPreserved':True,'captionsPreserved':True,'lutPreserved':True,'repeatPreserved':True,'failureAndCorrectionPassed':True,'skillPreserved':True,'driverSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    with Path(os.environ['CRAFT_LUT_INSTALLED_EVIDENCE']).open('x') as stream:json.dump(evidence,stream,indent=2)
if __name__=='__main__':unittest.main()
