"""实际固定Art空缓存安装四领域CLI；只读故障注入与公开下载分别留证。"""
import concurrent.futures
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.environ.get('CRAFT_FIXED_NATIVE_DOWNLOAD') == '1', 'requires explicit public download QA')
class FixedNativeDownloadTests(unittest.TestCase):
    def test_single_fixed_art_skill_recovers_two_partial_native_downloads_for_each_domain(self):
        source = Path(os.environ['CRAFT_FIXED_DOWNLOAD_SKILL'])
        output = Path(os.environ['CRAFT_FIXED_DOWNLOAD_OUTPUT'])
        self.assertFalse(output.exists()); output.mkdir(parents=True)
        fixture = ROOT/'test/fixtures/install_download_injection.py'
        spec = importlib.util.spec_from_file_location('host_identity', ROOT/'scripts/verify_codex_host.py')
        identity = importlib.util.module_from_spec(spec); spec.loader.exec_module(identity)
        before = identity.skill_hash(source)

        def exercise(domain):
            root = output/domain; skill = root/'.agents/skills/artcraft-use'; home = root/'runtime'
            skill.parent.mkdir(parents=True); shutil.copytree(source, skill)
            self.assertEqual(identity.skill_hash(skill), before); self.assertFalse(home.exists())
            log = root/'events.jsonl'
            args = [sys.executable, '-I', '-B', str(fixture), 'art', str(skill/'scripts/bootstrap.py'), str(log), domain, '--runtime-home', str(home), '--plugin', domain]
            started = time.monotonic()
            result = subprocess.run(args, capture_output=True, text=True, timeout=600)
            (root/'call.json').write_text(json.dumps({'args': args, 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}, indent=2)+'\n')
            self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
            receipt = json.loads(result.stdout); self.assertEqual(set(receipt['skills']), {domain})
            self.assertEqual(receipt['version'], '0.1.0-dev.129-runtime.1')
            entry = receipt['skills'][domain]; cli = Path(entry['executable'])
            sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
            self.assertEqual(sha(cli), entry['runtimeIdentity']['sha256'])
            version = subprocess.run([str(cli), '--version'], capture_output=True, text=True, timeout=30, check=True).stdout.strip()
            native_lock = json.loads((Path(entry['skillRoot'])/'scripts/runtime.lock.json').read_text())
            self.assertEqual(version, native_lock['artifacts']['darwin-arm64'].get('versionOutput', native_lock['artifact']+' '+native_lock['resolvedVersion']))
            events = [json.loads(line) for line in log.read_text().splitlines()]
            downloads = [event for event in events if event['event'] == 'native-download']
            self.assertEqual([event['fault'] for event in downloads], ['partial-ssl-eof', 'incomplete-content-length', 'real-public-https'])
            self.assertTrue(all(event['priorPartialAbsent'] for event in downloads))
            commands = [event['args'] for event in events if event['event'] == 'native-command']
            self.assertEqual(commands, [['--version'], ['commands', '--json']])
            self.assertFalse(list((home/domain).glob('.install-*')))
            self.assertEqual(identity.skill_hash(skill), before); self.assertEqual(identity.skill_hash(source), before)
            self.assertFalse(list(skill.rglob('*.pyc')))
            record = {'domain': domain, 'result': 'PASS', 'seconds': round(time.monotonic()-started, 3), 'nativeVersion': version, 'nativeSha256': sha(cli), 'bootstrapSha256': sha(Path(entry['skillRoot'])/'scripts/bootstrap.py'), 'artSkillSha256': before, 'emptyRuntime': True, 'downloadAttempts': 3, 'partialArchivesDiscarded': True, 'realPublicFinalDownload': True, 'nativeCommands': commands, 'selectedDomainOnly': True, 'skillPreserved': True, 'eventsSha256': sha(log), 'callSha256': sha(root/'call.json')}
            (root/'proof.json').write_text(json.dumps(record, indent=2)+'\n'); return record

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            records = list(pool.map(exercise, ('filmcraft', 'effectcraft', 'photocraft', 'vectorcraft')))
        (output/'proof.json').write_text(json.dumps({'schema': 'artcraft-fixed-native-download-recovery/v1', 'result': 'PASS', 'pluginVersion': '0.1.0-dev.130', 'sourceVersion': '0.1.0-dev.102', 'runtimeVersion': '0.1.0-dev.129-runtime.1', 'python': sys.version, 'records': records, 'scope': 'Four separately copied fixed Art skills, empty runtime homes, actual public Node/core/selected child downloads. Test-only two partial native transport faults; actual third public native download, digest and version validation. No native editing/rendering.'}, indent=2)+'\n')


if __name__ == '__main__':
    unittest.main()
