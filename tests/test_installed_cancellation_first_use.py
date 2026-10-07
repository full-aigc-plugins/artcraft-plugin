"""当前安装恢复技能经公开工作流取消真实渲染；无开发运行时导入。"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import sqlite3
import subprocess
import sys
import tempfile
import time
import unittest
from contextlib import closing


def tree_hashes(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob('*') if p.is_file()}


@unittest.skipUnless(os.environ.get('CRAFT_INSTALLED_CANCEL_FIRST_USE') == '1',
                     'explicit installed public native cancellation opt-in')
class InstalledCancellationFirstUse(unittest.TestCase):
    def test_actual_render_cancel_preserves_attempt_stage_and_never_replays(self):
        source = Path(os.environ['CRAFT_INSTALLED_CANCEL_SKILL']).resolve(strict=True)
        self.assertEqual(source.name, 'artcraft-cli-recover')
        before = tree_hashes(source)
        with tempfile.TemporaryDirectory(prefix='craft-installed-cancel-') as temporary:
            root = Path(temporary).resolve()
            skill = root/'.agents/skills/artcraft-cli-recover'
            shutil.copytree(source, skill)
            copied = tree_hashes(skill)
            runtime = root/'empty-public-runtime'
            project = root/'project'
            plan = {'workflowId': 'installed-native-cancel', 'revision': 'v1',
                    'budget': {'currency': 'USD', 'maxMinorUnits': 0, 'maxRevisions': 0, 'maxExternalCalls': 0},
                    'nodes': [{'id': 'intro', 'pluginId': 'effectcraft', 'dependsOn': [],
                               'projectKey': 'intro-project', 'expectedRevision': None,
                               'payload': {'schemaVersion': 'craft-skill-workflow/v1',
                                           'plan': {'document': {'name': 'Cancellation checkpoint', 'width': 1280,
                                                                 'height': 720, 'frameRate': 24, 'duration': 30},
                                                    'operations': [{'command': 'layer.newText', 'params': {
                                                        'name': 'Title', 'text': 'NOVA', 'font': 'Source Sans 3',
                                                        'size': 64, 'position': [600, 360]}}],
                                                    'frames': [0], 'exports': [{'format': 'mp4'}]},
                                           'assetBindings': [], 'outputs': [{'assetId': 'intro', 'location': 'intro.mp4',
                                                                             'mediaType': 'video/mp4'}]}}]}
            plan_path = root/'plan.json'; plan_path.write_text(json.dumps(plan))
            env = dict(os.environ, PATH='/usr/bin:/bin')
            for key in ('CRAFT_RUNTIME_HOME', 'CRAFT_NODE_ARCHIVE', 'CRAFT_BUNDLE_DIRECTORY',
                        'CRAFT_NATIVE_ARCHIVE_DIRECTORY'):
                env.pop(key, None)
            args = [sys.executable, '-I', '-B', str(skill/'scripts/workflow.py'), str(plan_path),
                    '--output', str(project), '--runtime-home', str(runtime),
                    '--owner', 'local-user', '--authorization', 'installed-cancel-local']
            database = project/'tasks.sqlite'
            def cli(*argv):
                result = subprocess.run([sys.executable, '-I', '-B', str(skill/'scripts/cli.py'),
                                         '--runtime-home', str(runtime), '--', *map(str, argv)],
                                        env=env, capture_output=True, text=True, timeout=60)
                self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
                return json.loads(result.stdout)
            def rows(sql, values=()):
                with closing(sqlite3.connect('file:'+str(database)+'?mode=ro', uri=True)) as connection:
                    return connection.execute(sql, values).fetchall()
            process = subprocess.Popen(args, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            task_id = None
            try:
                observed = None
                deadline = time.monotonic()+360
                while time.monotonic() < deadline:
                    if database.exists():
                        try:
                            found = rows("SELECT t.task_id,t.attempt_id,e.pid,e.token,t.epoch FROM tasks t JOIN executions e ON e.task_id=t.task_id WHERE e.status='running'")
                        except sqlite3.Error:
                            found = []
                        if found:
                            ps = subprocess.check_output(['/bin/ps', '-axo', 'command='], text=True)
                            if any(str(root) in line and 'effectcraft-cli' in line and ' render ' in line
                                   for line in ps.splitlines()):
                                observed = found[0]; break
                    if process.poll() is not None:
                        break
                    time.sleep(.05)
                if observed is None:
                    stdout, stderr = process.communicate(timeout=30)
                    self.fail('no actual native render observed: '+stdout+stderr)
                task_id, attempt, _, token, epoch = observed
                target = os.environ.get('CRAFT_INSTALLED_CANCEL_TARGET', 'workflow')
                self.assertIn(target, ('task', 'workflow'))
                run_key = rows('SELECT run_key FROM workflow_runs')[0][0]
                requested = cli('cancel', '--database', database, '--'+target, task_id if target == 'task' else run_key)
                self.assertIn(requested['state'], ('cancel_requested', 'cancelled'))
                stdout, stderr = process.communicate(timeout=90)
                self.assertEqual(process.returncode, 1 if target == 'task' else 0, stdout+stderr)
                first_json = json.loads(stdout)
                first = first_json['workflowReceipt'] if target == 'task' else first_json
                self.assertEqual(first['state'], 'blocked' if target == 'task' else 'cancelled')
                node = first['nodes']['intro']
                self.assertEqual(node['taskReceipt']['state'], 'cancelled')
                self.assertEqual(node['taskReceipt']['attemptId'], attempt)
                stopped = rows('SELECT status,group_stopped,token,epoch FROM executions WHERE task_id=?', (task_id,))[0]
                self.assertEqual(stopped, ('stopped', 1, token, epoch))
                self.assertEqual(rows('SELECT COUNT(*) FROM leases')[0][0], 0)
                self.assertEqual(node['taskReceipt']['outputRefs'], [])
                stages = list(project.rglob('project.ecproj'))
                self.assertEqual(len(stages), 1)
                native = stages[0]; native_before = hashlib.sha256(native.read_bytes()).hexdigest()
                self.assertGreater(native.stat().st_size, 0)
                installation = json.loads((project/'installation-receipt.json').read_text())
                self.assertEqual(set(installation['skills']), {'effectcraft'})
                domain = Path(installation['skills']['effectcraft']['skillRoot'])
                inspection = root/'inspect-plan.json'
                inspection.write_text(json.dumps({'schema': 'craft-command-plan/v1', 'operations': [
                    {'tool': 'open_project', 'params': {'path': {'$ref': 'source.path'}}},
                    {'tool': 'get_project', 'params': {}}]}))
                inspected = subprocess.run([sys.executable, '-I', '-B', str(domain/'scripts/commands.py'),
                                            'run', str(inspection), '--input', 'source='+str(native),
                                            '--output', str(root/'inspection'), '--runtime-home', str(runtime)],
                                           env=env, capture_output=True, text=True, timeout=90)
                self.assertEqual(inspected.returncode, 0, inspected.stdout+inspected.stderr)
                self.assertEqual(json.loads(inspected.stdout)['result'], 'PASS')
                event_count = rows("SELECT COUNT(*) FROM events WHERE task_id=? AND json_extract(detail_json,'$.execution')='spawned'", (task_id,))[0][0]
                self.assertEqual(event_count, 1)
                repeated = subprocess.run(args, env=env, capture_output=True, text=True, timeout=90)
                self.assertEqual(repeated.returncode, 1 if target == 'task' else 0, repeated.stdout+repeated.stderr)
                second_json = json.loads(repeated.stdout)
                second = second_json['workflowReceipt'] if target == 'task' else second_json
                self.assertEqual(second['nodes']['intro']['taskReceipt']['attemptId'], attempt)
                self.assertEqual(second['nodes']['intro']['taskReceipt']['state'], 'cancelled')
                self.assertEqual(first['budget'], second['budget'])
                self.assertEqual(rows("SELECT COUNT(*) FROM events WHERE task_id=? AND json_extract(detail_json,'$.execution')='spawned'", (task_id,))[0][0], 1)
                self.assertEqual(cli('cancel', '--database', database, '--task', task_id)['state'], 'cancelled')
                self.assertEqual(hashlib.sha256(native.read_bytes()).hexdigest(), native_before)
                self.assertEqual(tree_hashes(skill), copied)
                self.assertEqual(tree_hashes(source), before)
                if os.environ.get('CRAFT_INSTALLED_CANCEL_REPORT'):
                    Path(os.environ['CRAFT_INSTALLED_CANCEL_REPORT']).write_text(json.dumps({
                        'schema': 'craft-installed-native-cancel-first-use/v1', 'result': 'PASS',
                        'actualNativeRenderObserved': True, 'groupStopped': True, 'savedStageReopened': True,
                        'projectSha256': native_before, 'taskId': task_id, 'attemptId': attempt,
                        'cancelTarget': target, 'workflowState': first['state'], 'spawnCount': 1, 'repeatBudgetPreserved': True, 'skillUnchanged': True,
                        'installedSkill': source.name, 'runtimeVersion': installation['version'],
                        'effectSourceVersion': installation['skills']['effectcraft']['runtimeIdentity']['pluginVersion'],
                        'scope': 'actual installed single recovery skill, empty public runtime, real render cancellation, stopped receipt, editable stage preservation and repeated no-replay'}, indent=2)+'\n')
            finally:
                if process.poll() is None:
                    if task_id:
                        try: cli('cancel', '--database', database, '--task', task_id)
                        except Exception: pass
                    try: process.communicate(timeout=30)
                    except subprocess.TimeoutExpired:
                        # 只清理本测试私有目录内的进程组，不把测试清理当取消验收。
                        output = subprocess.check_output(['/bin/ps', '-axo', 'pid=,command='], text=True)
                        for line in output.splitlines():
                            if str(root) in line:
                                pid = int(line.strip().split(None, 1)[0])
                                try:
                                    group = os.getpgid(pid)
                                    if group != os.getpgrp(): os.killpg(group, signal.SIGTERM)
                                except ProcessLookupError: pass
                        process.terminate(); process.communicate(timeout=30)
                if process.stdout: process.stdout.close()
                if process.stderr: process.stderr.close()
