"""Art固定领域包的实际并行复用、生产锁超时及工程保全专项。"""
import concurrent.futures
import contextlib
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
DOMAINS = ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft')


@unittest.skipUnless(os.environ.get('CRAFT_INSTALLED_DOMAIN_MUTEX') == '1', 'requires fixed Art installation and native projects')
class InstalledDomainMutexTests(unittest.TestCase):
    def test_pinned_child_installers_wait_timeout_and_parallel_reuse_without_native_replay(self):
        host = json.loads(Path(os.environ['CRAFT_DOMAIN_MUTEX_HOST']).read_text())
        home = Path(os.environ['CRAFT_DOMAIN_MUTEX_HOME'])
        projects = Path(os.environ['CRAFT_DOMAIN_MUTEX_PROJECTS'])
        output = Path(os.environ['CRAFT_DOMAIN_MUTEX_OUTPUT'])
        self.assertFalse(output.exists()); output.mkdir(parents=True)
        art = Path(host['skillDirectories']['artcraft'])
        distribution = json.loads((art/'scripts/distribution.lock.json').read_text())
        native_projects = [p for p in projects.rglob('*') if p.suffix in ('.fcproj', '.ecproj', '.pcraft', '.vectorcraft')]
        self.assertTrue(all(any(p.suffix == suffix for p in native_projects) for suffix in ('.fcproj', '.ecproj', '.pcraft', '.vectorcraft')))
        spec = importlib.util.spec_from_file_location('setup_verify', art/'scripts/setup.py')
        setup = importlib.util.module_from_spec(spec); spec.loader.exec_module(setup)
        child_roots = {}; native_locks = {}
        for name in DOMAINS:
            entry = distribution['bundles'][name+'-skills']
            bundle = home/'artcraft/bundles'/(name+'-skills')/entry['version']/entry['sha256']
            setup.verify_bundle(bundle, entry)
            child_roots[name] = bundle/'skills'/(name+'-use')
            native_locks[name] = json.loads((child_roots[name]/'scripts/runtime.lock.json').read_text())

        def digest(path):
            return hashlib.sha256(path.read_bytes()).hexdigest()

        def snapshot():
            result = {}
            for label, directory in [('runtime', home), ('projects', projects)]:
                for path in sorted(directory.rglob('*')):
                    if path.is_file() and path.name != '.install.lock':
                        result[label+'/'+str(path.relative_to(directory))] = digest(path)
            return result

        def invoke(item):
            domain, worker = item
            args = [sys.executable, '-I', '-B', str(child_roots[domain]/'scripts/bootstrap.py'), '--runtime-home', str(home)]
            start = time.monotonic(); reply = subprocess.run(args, capture_output=True, text=True, timeout=180)
            return {'domain': domain, 'worker': worker, 'args': args, 'exitCode': reply.returncode, 'stdout': reply.stdout, 'stderr': reply.stderr, 'seconds': round(time.monotonic()-start, 3)}

        @contextlib.contextmanager
        def holders():
            owners = []
            try:
                for domain in DOMAINS:
                    path = home/domain/'.install.lock'
                    self.assertTrue(path.parent.is_dir())
                    code = "import fcntl,sys; f=open(sys.argv[1],'a+b'); fcntl.flock(f,fcntl.LOCK_EX); print('ready',flush=True); sys.stdin.read()"
                    owner = subprocess.Popen([sys.executable, '-I', '-B', '-c', code, str(path)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    owners.append(owner); self.assertEqual(owner.stdout.readline().strip(), 'ready')
                yield owners
            finally:
                for owner in owners:
                    if owner.poll() is None: owner.kill()
                    owner.communicate(timeout=5)

        # 每领域三个独立等待者同时竞争同一原生安装；不改变安装器的120秒生产常量。
        inputs = [(domain, worker) for domain in DOMAINS for worker in range(3)]
        before = snapshot(); self.assertTrue(before); records = []
        with holders() as owners, concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            calls = list(pool.map(invoke, inputs))
            for call in calls:
                self.assertEqual(call['exitCode'], 1, call)
                self.assertIn('runtime_install_busy', json.loads(call['stdout'])['error'])
                self.assertGreaterEqual(call['seconds'], 119); self.assertLess(call['seconds'], 155)
            self.assertTrue(all(owner.poll() is None for owner in owners)); self.assertEqual(snapshot(), before)
            records.append({'kind': 'production-timeout', 'calls': calls, 'runtimeAndProjectsPreserved': True})
            (output/'timeout.json').write_text(json.dumps(records[-1], indent=2)+'\n')
        with holders() as owners, concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
            futures = [pool.submit(invoke, item) for item in inputs]
            time.sleep(2); self.assertTrue(all(not future.done() for future in futures)); self.assertEqual(snapshot(), before)
            for owner in owners: owner.kill()
            for owner in owners: owner.communicate(timeout=5)
            calls = [future.result() for future in futures]
            for call in calls:
                self.assertEqual(call['exitCode'], 0, call)
                reply = json.loads(call['stdout']); locked = native_locks[call['domain']]
                self.assertTrue(reply['reused']); self.assertEqual(reply['binarySha256'], locked['artifacts']['darwin-arm64']['binarySha256'])
                binary = Path(reply['executable']); self.assertEqual(digest(binary), reply['binarySha256'])
                version = subprocess.run([str(binary), '--version'], capture_output=True, text=True, timeout=30, check=True).stdout.strip()
                self.assertEqual(version, locked['artifacts']['darwin-arm64'].get('versionOutput', locked['artifact']+' '+locked['resolvedVersion']))
                call['nativeVersionOutput'] = version
            self.assertEqual(snapshot(), before)
            records.append({'kind': 'os-owner-exit-parallel-reuse', 'calls': calls, 'runtimeAndProjectsPreserved': True})
        for domain in DOMAINS:
            entry = distribution['bundles'][domain+'-skills']; setup.verify_bundle(child_roots[domain].parents[1], entry)
        proof = {'schema': 'artcraft-fixed-domain-mutex/v1', 'result': 'PASS', 'pluginVersion': '0.1.0-dev.130', 'sourceVersion': '0.1.0-dev.102', 'runtimeVersion': distribution['version'], 'python': sys.version, 'publicCalls': 24, 'productionWaitSeconds': 120, 'workersPerDomain': 3, 'protectedFileCount': len(before), 'protectedNativeProjectCount': len(native_projects), 'protectedFileMapSha256': hashlib.sha256(json.dumps(before, sort_keys=True).encode()).hexdigest(), 'childBootstrapSha256': {domain: digest(child_roots[domain]/'scripts/bootstrap.py') for domain in DOMAINS}, 'nativeVersions': {domain: entry['resolvedVersion'] for domain, entry in native_locks.items()}, 'records': records, 'scope': 'Current Art-owned immutable child installation entry points, genuine published native CLI verified reuse, real OS holder/timeouts and parallel waiters. Warm installation only; no editing/rendering or fresh archive download claimed.'}
        (output/'proof.json').write_text(json.dumps(proof, indent=2)+'\n')


if __name__ == '__main__':
    unittest.main()
