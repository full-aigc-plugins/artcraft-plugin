"""规划文档不能引用与实际不可变技能锁不同的来源身份。"""
import json,subprocess,sys,tempfile,unittest,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class SourcePlanIdentityTests(unittest.TestCase):
 def test_current_source_plan_identity_and_stale_fields(self):
  with tempfile.TemporaryDirectory() as temporary:
   root=Path(temporary)/'repo';shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('.git','__pycache__','.codegraph','node_modules'))
   def validate():return subprocess.run([sys.executable,'-I','-B',str(root/'scripts/validate_docs.py')],cwd=root,capture_output=True,text=True)
   baseline=validate();self.assertEqual(baseline.returncode,0,baseline.stdout+baseline.stderr);path=root/'docs/skills-source-plan.json';original=path.read_text()
   for key,bad in [('sourceSha','0'*40),('sourceRef','v0.0.0-stale'),('package','foreign-skills')]:
    value=json.loads(original);value[key]=bad;path.write_text(json.dumps(value));failed=validate();self.assertEqual(failed.returncode,1,failed.stdout);self.assertIn('source plan identity differs from immutable skill lock',json.loads(failed.stdout)['errors']);path.write_text(original)
