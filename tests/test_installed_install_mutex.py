"""固定宿主十技能的真实120秒互斥验收；显式启用，禁止缩短生产超时。"""
import concurrent.futures
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.environ.get('CRAFT_INSTALLED_MUTEX') == '1', 'requires explicit installed host and runtime')
class InstalledMutexTests(unittest.TestCase):
    def test_all_installed_entries_timeout_and_reuse_after_os_owner_exit(self):
        host = json.loads(Path(os.environ['CRAFT_MUTEX_HOST']).read_text())
        lock = json.loads((ROOT/'host-acceptance-art130.lock.json').read_text())
        home = Path(os.environ['CRAFT_MUTEX_HOME'])
        output = Path(os.environ['CRAFT_MUTEX_OUTPUT'])
        self.assertFalse(output.exists()); output.mkdir(parents=True)
        spec = importlib.util.spec_from_file_location('host_identity', ROOT/'scripts/verify_codex_host.py')
        identity = importlib.util.module_from_spec(spec); spec.loader.exec_module(identity)
        entries = {name: Path(host['skillDirectories']['artcraft']).parent/name for name in lock['plugins']['artcraft']['skills']}
        self.assertEqual(len(entries), 10)

        def verify_host():
            count = 0
            for domain, directory in host['skillDirectories'].items():
                for name, digest in lock['plugins'][domain]['skills'].items():
                    self.assertEqual(identity.skill_hash(Path(directory).parent/name), digest); count += 1
            self.assertEqual(count, 64)

        def files():
            return {str(p.relative_to(home)): hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in sorted(home.rglob('*')) if p.is_file() and p.name not in ('.artcraft-node-install.lock', '.artcraft-setup.lock')}

        def holder(path):
            code = "import fcntl,sys; f=open(sys.argv[1],'a+b'); fcntl.flock(f,fcntl.LOCK_EX); print('ready',flush=True); sys.stdin.read()"
            process = subprocess.Popen([sys.executable, '-I', '-B', '-c', code, str(path)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            self.assertEqual(process.stdout.readline().strip(), 'ready'); return process

        def invoke(item):
            name, directory = item
            args = [sys.executable, '-I', '-B', str(directory/'scripts/cli.py'), '--runtime-home', str(home), '--', '--version']
            start = time.monotonic()
            result = subprocess.run(args, capture_output=True, text=True, timeout=180)
            return {'skill': name, 'args': args, 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr, 'seconds': round(time.monotonic()-start, 3)}

        # 不修改安装文件或LOCK_WAIT_SECONDS；必须观察公开进程的真实生产超时。
        verify_host(); before = files(); records = []
        self.assertTrue(before)
        for phase, filename in [('node', '.artcraft-node-install.lock'), ('setup', '.artcraft-setup.lock')]:
            owner = holder(home/filename)
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
                    results = list(pool.map(invoke, entries.items()))
                for result in results:
                    reply = json.loads(result['stdout'])
                    self.assertEqual(result['exitCode'], 1, result)
                    self.assertIn('runtime_install_busy', reply['error'])
                    self.assertGreaterEqual(result['seconds'], 119)
                    self.assertLess(result['seconds'], 155)
                    self.assertFalse(reply['installed'])
                self.assertIsNone(owner.poll())
                self.assertEqual(files(), before)
                records.append({'phase': phase, 'kind': 'production-timeout', 'ownerAliveThroughRefusal': True, 'calls': results, 'runtimeFilesPreserved': True})
                (output/(phase+'-timeout.json')).write_text(json.dumps(records[-1], indent=2)+'\n')
            finally:
                if owner.poll() is None: owner.kill()
                owner.communicate(timeout=5)

            # 同一个锁文件保留；新持锁进程被杀死后由OS释放锁，等待者明确重试并复用。
            owner = holder(home/filename)
            try:
                with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
                    futures = [pool.submit(invoke, item) for item in entries.items()]
                    time.sleep(2)
                    self.assertTrue(all(not future.done() for future in futures))
                    self.assertEqual(files(), before)
                    owner.kill(); owner.communicate(timeout=5)
                    results = [future.result() for future in futures]
                for result in results:
                    self.assertEqual(result['exitCode'], 0, result)
                    self.assertEqual(json.loads(result['stdout']), {'name': 'artcraft', 'version': '0.1.0-dev.129-runtime.1'})
                self.assertTrue((home/filename).exists())
                self.assertEqual(files(), before)
                records.append({'phase': phase, 'kind': 'os-owner-exit-reuse', 'residualLockFilePreserved': True, 'calls': results, 'runtimeFilesPreserved': True})
                (output/(phase+'-reuse.json')).write_text(json.dumps(records[-1], indent=2)+'\n')
            finally:
                if owner.poll() is None: owner.kill(); owner.communicate(timeout=5)
        verify_host()
        proof = {'schema': 'artcraft-fixed-installed-mutex/v1', 'result': 'PASS', 'pluginVersion': '0.1.0-dev.130', 'sourceVersion': '0.1.0-dev.102', 'runtimeVersion': '0.1.0-dev.129-runtime.1', 'productionWaitSeconds': 120, 'publicCalls': 40, 'installedHostTrees': 64, 'runtimeFileCount': len(before), 'runtimeFilesSha256': hashlib.sha256(json.dumps(before, sort_keys=True).encode()).hexdigest(), 'records': records, 'scope': 'Actual fixed public entries and OS holder processes, verified warm runtime; no network/native editing during waits. Fresh empty-cache first use is separate evidence.'}
        (output/'proof.json').write_text(json.dumps(proof, indent=2)+'\n')


if __name__ == '__main__':
    unittest.main()
