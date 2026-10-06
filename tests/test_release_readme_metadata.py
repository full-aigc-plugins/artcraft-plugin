"""当前元数据漂移必须拒绝，历史验收版本不应被误报。"""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('readme_audit', ROOT / 'scripts/validate_release_readmes.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReadmeMetadataTests(unittest.TestCase):
    def fixture(self, root):
        for domain in module.DOMAINS:
            repo = root / (domain + '-plugin'); repo.mkdir()
            (repo / 'plugin.json').write_text(json.dumps({'version': '0.2.0'}))
            (repo / 'skills.lock.json').write_text(json.dumps({'sources': [{'package': domain + '-skills', 'ref': 'v0.3.0'}]}))
            text = '| Metadata version | 0.2.0 |\n| Skills source | ' + domain + '-skills / v0.3.0 |\n\nHistorical verification: 0.1.0-dev.1.\n'
            for filename in ['README.md', 'README.zh-CN.md']:
                (repo / filename).write_text(text)

    def test_current_versions_and_historical_evidence_are_distinct(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.fixture(root)
            result = module.audit(root)
            self.assertEqual(result['result'], 'passed')
            self.assertEqual(len(result['records']), 10)

    def test_stale_skill_source_and_current_paragraph_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.fixture(root)
            p = root / 'artcraft-plugin/README.md'
            p.write_text(p.read_text().replace('v0.3.0', 'v0.1.0-dev.3') + 'Current plugin: `0.1.0-dev.1`; skill source: `0.1.0-dev.3`;\n')
            result = module.audit(root)
            self.assertEqual(result['result'], 'failed')
            self.assertEqual({e['field'] for e in result['errors']}, {'skills', 'currentReleaseParagraph'})

    def test_duplicate_or_missing_current_table_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.fixture(root)
            p = root / 'filmcraft-plugin/README.md'
            p.write_text('| Metadata version | 0.2.0 |\n| Metadata version | 0.2.0 |\n')
            result = module.audit(root)
            self.assertEqual(result['result'], 'failed')
            self.assertEqual({e['field'] for e in result['errors']}, {'plugin', 'skills'})
