"""只复制已发布 ArtCraft 技能，从默认在线地址安装依赖并交付四个原生工程。"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave
import struct
import math

SOURCE = Path(os.environ['CRAFT_INSTALLED_SKILL_ROOT']).resolve() if os.environ.get('CRAFT_INSTALLED_SKILL_ROOT') else Path(__file__).resolve().parents[1]/'skills/artcraft-use'

@unittest.skipUnless(os.environ.get('CRAFT_ONLINE_FIRST_USE') == '1', 'requires macOS arm64 and online official/project downloads')
class OnlineFirstWorkflowTests(unittest.TestCase):
    def test_isolated_single_skill_installs_runs_and_reuses_four_native_deliveries(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary).resolve()
            if os.environ.get('CRAFT_INSTALLED_SKILL_ROOT'):skill=SOURCE
            else:
                skill=root/'only-artcraft-use';shutil.copytree(SOURCE, skill, ignore=shutil.ignore_patterns('__pycache__'))
            voice=root/'voice.wav'
            with wave.open(str(voice), 'wb') as output:
                output.setparams((1,2,48000,48000,'NONE','not compressed'))
                output.writeframes(b''.join(struct.pack('<h',round(4000*math.sin(i*2*math.pi*440/48000))) for i in range(48000)))
            runtime=root/'runtime';project=root/'project'
            args=[sys.executable,'-I','-B',str(skill/'scripts/workflow.py'),str(skill/'examples/brand-campaign.json'),'--output',str(project),'--runtime-home',str(runtime),'--authorization','isolated-first-use','--asset','voice='+str(voice)]
            environment=dict(os.environ,PATH='/usr/bin:/bin')
            first_run=subprocess.run(args,capture_output=True,text=True,env=environment,timeout=600)
            self.assertEqual(first_run.returncode,0,first_run.stdout+first_run.stderr)
            first=json.loads(first_run.stdout);self.assertEqual(first['state'],'review_ready')
            for id, suffix in [('logo','vectorcraft'),('poster','pcraft'),('intro','ecproj'),('film','fcproj')]:
                node=first['nodes'][id];self.assertEqual(node['status'],'review_ready')
                self.assertTrue((Path(node['root'])/('project.'+suffix)).is_file())
            setup=json.loads((project/'installation-receipt.json').read_text())
            self.assertTrue(Path(setup['nodeExecutable']).is_relative_to(runtime))
            self.assertTrue(Path(setup['entryPoint']).is_relative_to(runtime))
            self.assertEqual(set(setup['skills']),{'filmcraft','effectcraft','photocraft','vectorcraft'})
            for value in setup['skills'].values():
                self.assertTrue(Path(value['executable']).is_relative_to(runtime))
                self.assertTrue(Path(value['skillRoot']).is_relative_to(runtime))
            second_run=subprocess.run(args,capture_output=True,text=True,env=environment,timeout=120)
            self.assertEqual(second_run.returncode,0,second_run.stdout+second_run.stderr)
            second=json.loads(second_run.stdout)
            for id in first['nodes']:self.assertEqual(first['nodes'][id]['taskId'],second['nodes'][id]['taskId'])
            cli=[setup['nodeExecutable'],setup['entryPoint'],'status','--database',str(project/'tasks.sqlite')]
            status=json.loads(subprocess.run(cli,check=True,capture_output=True,text=True,env=environment,timeout=30).stdout)
            self.assertEqual(len(status['tasks']),4);self.assertFalse(status['leases'])
            changed=json.loads((skill/'examples/brand-campaign.json').read_text());changed['nodes'][0]['payload']['plan']['document']['name']='Changed without new revision'
            changed_file=root/'changed.json';changed_file.write_text(json.dumps(changed))
            bad_args=list(args);bad_args[4]=str(changed_file)
            bad=subprocess.run(bad_args,capture_output=True,text=True,env=environment,timeout=120)
            self.assertEqual(bad.returncode,1);self.assertIn('workflow_revision_conflict',bad.stdout)
            self.assertEqual(hashlib.sha256(voice.read_bytes()).hexdigest(),first['nodes']['film']['outputs'][0]['sourceRefs'][1]['sha256'])

if __name__ == '__main__':unittest.main()
