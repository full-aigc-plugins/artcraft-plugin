"""原生版本输出的真实格式与错误身份拒绝。"""
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('cold_verifier', ROOT / 'scripts/verify_single_skill_cold_start.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NativeVersionTests(unittest.TestCase):
    def test_photo_version_with_build_identity(self):
        self.assertTrue(module.native_version_matches('photocraft-cli 0.2.0 (ad8632173, 2026-10-05)\n', 'photocraft', '0.2.0'))
        self.assertFalse(module.native_version_matches('photocraft-cli 0.2.0-craft.1 (abc, today)', 'photocraft', '0.2.0'))
        self.assertFalse(module.native_version_matches('effectcraft-cli 0.2.0', 'photocraft', '0.2.0'))

    def test_artcraft_json_identity(self):
        self.assertTrue(module.native_version_matches('{"name":"artcraft","version":"0.1.0-dev.41"}', 'artcraft', '0.1.0-dev.41'))
        for invalid in ['[]', '{}', 'artcraft 0.1.0-dev.41', '{"name":"other","version":"0.1.0-dev.41"}']:
            self.assertFalse(module.native_version_matches(invalid, 'artcraft', '0.1.0-dev.41'))
