"""当前固定Art外层归档真实冷下载恢复专项；普通CI不会发起网络安装。"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.environ.get('CRAFT_FIXED_OUTER_DOWNLOAD') == '1', 'requires explicit public outer-download QA')
class FixedOuterDownloadTests(unittest.TestCase):
    def test_fixed_node_core_and_selected_domain_archives_recover_without_relaxing_locks(self):
        source = Path(os.environ['CRAFT_FIXED_DOWNLOAD_SKILL']); output = Path(os.environ['CRAFT_FIXED_DOWNLOAD_OUTPUT'])
        self.assertFalse(output.exists()); output.mkdir(parents=True)
        skill = output/'.agents/skills/artcraft-use'; skill.parent.mkdir(parents=True); shutil.copytree(source, skill)
        home = output/'runtime'; self.assertFalse(home.exists())
        spec = importlib.util.spec_from_file_location('host_identity', ROOT/'scripts/verify_codex_host.py')
        identity = importlib.util.module_from_spec(spec); spec.loader.exec_module(identity)
        before = identity.skill_hash(source); self.assertEqual(identity.skill_hash(skill), before)
        log = output/'events.jsonl'; fixture = ROOT/'test/fixtures/outer_download_injection.py'
        args = [sys.executable, '-I', '-B', str(fixture), str(skill/'scripts/bootstrap.py'), str(log), str(home), '--plugin', 'vectorcraft']
        result = subprocess.run(args, capture_output=True, text=True, timeout=600)
        (output/'call.json').write_text(json.dumps({'args': args, 'exitCode': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}, indent=2)+'\n')
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
        receipt = json.loads(result.stdout); self.assertEqual(set(receipt['skills']), {'vectorcraft'})
        self.assertEqual(receipt['version'], '0.1.0-dev.129-runtime.1')
        node = json.loads((skill/'scripts/node.lock.json').read_text()); distribution = json.loads((skill/'scripts/distribution.lock.json').read_text())
        sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
        self.assertEqual(sha(Path(receipt['nodeExecutable'])), node['binarySha256'])
        entry = receipt['skills']['vectorcraft']; self.assertEqual(sha(Path(entry['executable'])), entry['runtimeIdentity']['sha256'])
        setup_spec = importlib.util.spec_from_file_location('setup_verify', skill/'scripts/setup.py')
        setup = importlib.util.module_from_spec(setup_spec); setup_spec.loader.exec_module(setup)
        setup.verify_bundle(Path(receipt['runtimeRoot']), distribution['bundles']['artcraft-runtime'])
        setup.verify_bundle(Path(entry['skillRoot']).parents[1], distribution['bundles']['vectorcraft-skills'])
        expected = [node['url'], distribution['bundles']['artcraft-runtime']['url'], distribution['bundles']['vectorcraft-skills']['url']]
        events = [json.loads(line) for line in log.read_text().splitlines()]; downloads = [e for e in events if e['event'] == 'outer-download']
        self.assertEqual(len(downloads), 9); self.assertEqual(set(e['url'] for e in downloads), set(expected))
        for url in expected:
            self.assertEqual([e['fault'] for e in downloads if e['url'] == url], ['partial-ssl-eof', 'http503', 'real-public-https'])
        self.assertTrue(all(e['priorPartialAbsent'] for e in downloads))
        self.assertEqual([e['args'] for e in events if e['event'] == 'native-command'], [['commands', '--json']])
        self.assertEqual(identity.skill_hash(skill), before); self.assertEqual(identity.skill_hash(source), before)
        self.assertFalse(list(home.rglob('*.zip'))); self.assertFalse(list(home.rglob('*.tar.gz')))
        self.assertFalse(list(skill.rglob('*.pyc')))
        (output/'proof.json').write_text(json.dumps({'schema': 'artcraft-fixed-outer-download-recovery/v1', 'result': 'PASS', 'pluginVersion': '0.1.0-dev.130', 'sourceVersion': '0.1.0-dev.102', 'runtimeVersion': receipt['version'], 'artSkillSha256': before, 'publicArchiveCount': 3, 'attemptsPerArchive': 3, 'partialArchivesDiscarded': True, 'actualFinalPublicDownload': True, 'nodeBinarySha256': node['binarySha256'], 'coreBundleSha256': distribution['bundles']['artcraft-runtime']['sha256'], 'selectedBundleSha256': distribution['bundles']['vectorcraft-skills']['sha256'], 'downloadHelperSha256': sha(skill/'scripts/download.py'), 'skillPreserved': True, 'scope': 'Actual current copied Art public bootstrap, empty runtime: Node/core/Vector skill archive partial SSL EOF then503 then actual HTTPS; fixed binary and complete bundle verification. Native edits/renders excluded.'}, indent=2)+'\n')


if __name__ == '__main__':
    unittest.main()
