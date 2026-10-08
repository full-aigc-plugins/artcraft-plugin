"""验收工具必须先拒绝无效宿主与已存在输出，不能触碰运行时。"""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT/'scripts/verify_fixed_runtime_integrity.py'


class FixedRuntimeIntegrityTests(unittest.TestCase):
    def test_existing_output_is_preserved_before_host_read(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root/'proof.json'
            output.write_text('user evidence')
            result = subprocess.run([sys.executable, '-I', '-B', str(SCRIPT), '--host-receipt', str(root/'missing-host'), '--lock', str(root/'missing-lock'), '--runtime-home', str(root/'runtime'), '--output', str(output)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('runtime_evidence_output_exists', result.stderr)
            self.assertEqual(output.read_text(), 'user evidence')
            self.assertFalse((root/'runtime').exists())

    def test_failed_or_incomplete_host_refused_before_runtime_access(self):
        spec = importlib.util.spec_from_file_location('runtime_integrity_test', SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            lock = root/'lock.json'
            lock.write_text('{}')
            host = root/'host.json'
            for value in ({}, {'result': 'failed', 'loadingErrors': 0}, {'result': 'passed', 'loadingErrors': 1}):
                host.write_text(json.dumps(value))
                with self.subTest(host=value), self.assertRaisesRegex(ValueError, 'runtime_host_receipt_invalid'):
                    module.verify(host, lock, root/'runtime')
                self.assertFalse((root/'runtime').exists())
