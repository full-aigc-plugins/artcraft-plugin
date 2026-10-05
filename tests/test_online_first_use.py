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
            self.assertEqual(first['budget']['allocated'],{'minorUnits':0,'externalCalls':0,'revisions':0})
            distribution=json.loads((skill/'scripts/distribution.lock.json').read_text())
            self.assertEqual(setup['version'],distribution['version'])
            for name,value in setup['skills'].items():self.assertEqual(value['runtimeIdentity']['pluginVersion'],distribution['bundles'][name+'-skills'].get('version',distribution['version']))
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
            old_projects={id:hashlib.sha256((Path(node['root'])/node['outputs'][0]['nativeProjectRef']['location']).read_bytes()).hexdigest() for id,node in first['nodes'].items()}
            revised=json.loads((skill/'examples/brand-campaign.json').read_text());revised['revision']='v2'
            # 发布制品通过技能入口真正修订旧原生 Logo，保持原对象与绑定。
            prior_logo=first['nodes']['logo'];prior_output=prior_logo['outputs'][0]
            logo_node=revised['nodes'][0]
            logo_node['expectedRevision']=prior_output['nativeProjectRef']['sha256']
            logo_node['externalInputs']=[{'root':prior_logo['root'],'artifact':prior_output}]
            logo_node['payload']['sourceProject']={'assetId':prior_output['assetId']}
            logo_node['payload']['plan']={'operations':[{'command':'paint.setFill','params':{'ids':[{'$ref':'logo.ids.0'},{'$ref':'wordmark.id'}],'color':'#e84032'}}],'exports':logo_node['payload']['plan']['exports']}
            revised_file=root/'revised.json';revised_file.write_text(json.dumps(revised));revision_args=list(args);revision_args[4]=str(revised_file)
            modified_run=subprocess.run(revision_args,capture_output=True,text=True,env=environment,timeout=120)
            self.assertEqual(modified_run.returncode,0,modified_run.stdout+modified_run.stderr);modified=json.loads(modified_run.stdout)
            changed_logo_manifest=json.loads((Path(modified['nodes']['logo']['root'])/'manifest.json').read_text())
            self.assertEqual(changed_logo_manifest['sourceProjectSha256'],prior_output['nativeProjectRef']['sha256'])
            self.assertEqual(modified['budget']['allocated'],{'minorUnits':0,'externalCalls':0,'revisions':1})
            for id,node in first['nodes'].items():
                self.assertNotEqual(node['taskId'],modified['nodes'][id]['taskId'])
                self.assertNotEqual(node['outputs'][0]['sha256'],modified['nodes'][id]['outputs'][0]['sha256'])
                self.assertEqual(old_projects[id],hashlib.sha256((Path(node['root'])/node['outputs'][0]['nativeProjectRef']['location']).read_bytes()).hexdigest())
            self.assertEqual(hashlib.sha256(voice.read_bytes()).hexdigest(),modified['nodes']['film']['outputs'][0]['sourceRefs'][1]['sha256'])
            repeated_revision=subprocess.run(revision_args,capture_output=True,text=True,env=environment,timeout=120)
            self.assertEqual(repeated_revision.returncode,0,repeated_revision.stdout+repeated_revision.stderr)
            self.assertEqual(json.loads(repeated_revision.stdout)['budget'],modified['budget'])
            revised['revision']='v3';revised_file.write_text(json.dumps(revised))
            exhausted=subprocess.run(revision_args,capture_output=True,text=True,env=environment,timeout=120)
            self.assertEqual(exhausted.returncode,1);self.assertIn('budget_exceeded: revisions',exhausted.stdout)
            final_status=json.loads(subprocess.run(cli,check=True,capture_output=True,text=True,env=environment,timeout=30).stdout)
            self.assertEqual(len(final_status['tasks']),8);self.assertFalse(final_status['leases'])
            self.assertEqual(final_status['budgets'][0]['allocated']['revisions'],1)
            # 默认公开下载的单技能入口完整交付打包，不读取开发仓库模块。
            package=root/'delivery-package'
            package_args=[sys.executable,'-I','-B',str(skill/'scripts/package.py'),'create','--project',str(project),'--workflow',modified['runKey'],'--output',str(package),'--authorization','isolated-first-use','--runtime-home',str(runtime)]
            packed_run=subprocess.run(package_args,capture_output=True,text=True,env=environment,timeout=120)
            self.assertEqual(packed_run.returncode,0,packed_run.stdout+packed_run.stderr)
            packed=json.loads(packed_run.stdout);self.assertEqual(len(packed['children']),4)
            moved=root/'moved-package';package.rename(moved)
            shutil.rmtree(project);voice.unlink()
            verify_args=[sys.executable,'-I','-B',str(skill/'scripts/package.py'),'verify','--package',str(moved),'--sha',packed['sha256'],'--runtime-home',str(runtime)]
            verified_run=subprocess.run(verify_args,capture_output=True,text=True,env=environment,timeout=120)
            self.assertEqual(verified_run.returncode,0,verified_run.stdout+verified_run.stderr)
            verified=json.loads(verified_run.stdout);self.assertEqual(len(verified['children']),4)
            self.assertEqual(verified['state'],'review_ready')



if __name__ == '__main__':unittest.main()
