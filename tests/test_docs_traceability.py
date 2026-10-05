"""规范任务编号必须唯一；静态校验不能漏过 CI 固定 OpenSpec 已拒绝的问题。"""
from pathlib import Path
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]

class DocumentationTraceabilityTests(unittest.TestCase):
    def test_duplicate_open_task_is_rejected_without_changing_the_repository(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)/'repo'
            shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('.git','node_modules','.codex','.claude','.local','.runtime','.codegraph','__pycache__'))
            path=root/'openspec/changes/establish-v1-plugin/tasks.md'
            # 正向基线排除现有重号，再只注入一个未勾选重复编号。
            seen=set();lines=[]
            for line in path.read_text().splitlines():
                match=re.match(r'- \[[ xX]\] ([0-9.]+) ',line)
                if match and match[1] in seen:continue
                if match:seen.add(match[1])
                lines.append(line)
            baseline='\n'.join(lines)+'\n';path.write_text(baseline)
            def validate():
                return subprocess.run([sys.executable,'-B',str(root/'scripts/validate_docs.py')],cwd=root,capture_output=True,text=True)
            positive=validate();self.assertEqual(positive.returncode,0,positive.stdout+positive.stderr)
            path.write_text(baseline+'\n- [ ] 6.16 duplicate fixture\n')
            negative=validate();self.assertEqual(negative.returncode,1,negative.stdout+negative.stderr)
            self.assertIn('duplicate task IDs: 6.16',json.loads(negative.stdout)['errors'])

    def test_task_under_wrong_numbered_group_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)/'repo'
            shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('.git','node_modules','.codex','.claude','.local','.runtime','.codegraph','__pycache__'))
            path=root/'openspec/changes/establish-v1-plugin/tasks.md'
            baseline=path.read_text()
            def validate():
                return subprocess.run([sys.executable,'-B',str(root/'scripts/validate_docs.py')],cwd=root,capture_output=True,text=True)
            positive=validate();self.assertEqual(positive.returncode,0,positive.stdout+positive.stderr)
            task=next(line for line in baseline.splitlines() if line.startswith('- [ ] 1.1 '))
            path.write_text(baseline.replace(task+'\n','')+'\n'+task+'\n')
            negative=validate();self.assertEqual(negative.returncode,1,negative.stdout+negative.stderr)
            self.assertIn('task 1.1 is under group 11, expected group 1',json.loads(negative.stdout)['errors'])
