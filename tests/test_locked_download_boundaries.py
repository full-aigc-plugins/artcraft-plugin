"""当前固定Art下载模块的明确错误分类及重试上限。"""
import http.client
import importlib.util
from pathlib import Path
import ssl
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]


class Response:
    headers = {'Content-Length': '4'}
    def __init__(self): self.reads = 0
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self, size):
        self.reads += 1
        return b'good' if self.reads == 1 else b''


class LockedDownloadBoundariesTests(unittest.TestCase):
    def module(self):
        spec = importlib.util.spec_from_file_location('fixed_download', ROOT/'skills/artcraft-use/scripts/download.py')
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module

    def test_all_declared_transient_classes_recover_on_third_read_only_attempt(self):
        module = self.module(); url = 'https://example.invalid/locked-test-archive'
        faults = [ssl.SSLEOFError('EOF'), ConnectionResetError('reset'), TimeoutError('timeout'), http.client.IncompleteRead(b'half', 8), *[HTTPError(url, code, 'temporary', {}, None) for code in (408, 429, 500, 503)]]
        for fault in faults:
            with self.subTest(fault=repr(fault)), tempfile.TemporaryDirectory() as root, patch.object(module.time, 'sleep'), patch.object(module.urllib.request, 'urlopen', side_effect=[fault, fault, Response()]) as fetch:
                target = Path(root)/'archive'; module.download(url, target, 100, 'size_limit')
                self.assertEqual(fetch.call_count, 3); self.assertEqual(target.read_bytes(), b'good')

    def test_certificate_permission_and_http403_stop_after_one_attempt(self):
        module = self.module(); url = 'https://example.invalid/locked-test-archive'
        for fault in [URLError(ssl.SSLCertVerificationError('certificate')), PermissionError('denied'), HTTPError(url, 403, 'denied', {}, None)]:
            with self.subTest(fault=repr(fault)), tempfile.TemporaryDirectory() as root, patch.object(module.urllib.request, 'urlopen', side_effect=fault) as fetch:
                with self.assertRaises(type(fault)): module.download(url, Path(root)/'archive', 100, 'size_limit')
                self.assertEqual(fetch.call_count, 1)

    def test_third_failure_leaves_no_archive_and_size_overflow_is_final(self):
        module = self.module(); url = 'https://example.invalid/locked-test-archive'
        with tempfile.TemporaryDirectory() as root, patch.object(module.time, 'sleep'), patch.object(module.urllib.request, 'urlopen', side_effect=TimeoutError('timeout')) as fetch:
            target = Path(root)/'archive'
            with self.assertRaisesRegex(ValueError, 'artifact_download_failed'): module.download(url, target, 100, 'size_limit')
            self.assertEqual(fetch.call_count, 3); self.assertFalse(target.exists())
        with tempfile.TemporaryDirectory() as root, patch.object(module.urllib.request, 'urlopen', return_value=Response()) as fetch:
            with self.assertRaisesRegex(ValueError, 'size_limit'): module.download(url, Path(root)/'archive', 2, 'size_limit')
            self.assertEqual(fetch.call_count, 1)


if __name__ == '__main__':
    unittest.main()
