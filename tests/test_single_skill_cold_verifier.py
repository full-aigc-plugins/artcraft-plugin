"""原生版本输出的真实格式与错误身份拒绝。"""
import importlib.util
from pathlib import Path
import sys
import unittest
import json
import tempfile

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


class LockedVersionTests(unittest.TestCase):
    def test_new_artcraft_release_is_read_from_its_immutable_lock(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); (root / 'scripts').mkdir()
            (root / 'scripts/distribution.lock.json').write_text(json.dumps({'bundles': {'artcraft-runtime': {'version': '0.1.0-dev.45'}}}))
            expected = module.locked_native_version(root, 'artcraft')
            self.assertEqual(expected, '0.1.0-dev.45')
            self.assertTrue(module.native_version_matches('{"name":"artcraft","version":"0.1.0-dev.45"}', 'artcraft', expected))
            self.assertFalse(module.native_version_matches('{"name":"artcraft","version":"0.1.0-dev.41"}', 'artcraft', expected))

    def test_native_maintenance_version_is_exact_and_invalid_lock_is_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); (root / 'scripts').mkdir()
            lock = root / 'scripts/runtime.lock.json'
            lock.write_text(json.dumps({'resolvedVersion':'0.2.0-craft.1'}))
            self.assertEqual(module.locked_native_version(root, 'filmcraft'), '0.2.0-craft.1')
            for value in (None, 'latest', '0.2.0 craft.1'):
                lock.write_text(json.dumps({'resolvedVersion':value}))
                with self.assertRaisesRegex(ValueError, 'cold_runtime_lock_invalid'):
                    module.locked_native_version(root, 'filmcraft')
