#!/usr/bin/env python3
"""绑定当前交付的具名审阅记录；不执行模型、不修改包或任务状态。"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
sys.dont_write_bytecode = True
DIMENSIONS = ('technical', 'creative', 'acceptance')
HEX = re.compile(r'^[a-f0-9]{64}$')
MAX_BYTES = 8 * 1024 * 1024


def fail(code):
    raise ValueError(code)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def text(value, code, limit=8000):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        fail(code)
    return value


def hash_value(value):
    if not isinstance(value, str) or not HEX.fullmatch(value):
        fail('review_digest_invalid')
    return value


def safe_location(value):
    text(value, 'review_location_invalid', 4096)
    if PurePosixPath(value).is_absolute() or any(c in value for c in ('\\', ':', '\0')) or any(p in ('', '.', '..') for p in value.split('/')):
        fail('review_location_invalid')
    return value


def read_local(root, location):
    """只读取目录内普通文件；每级禁止符号链接，读前后检查变化。"""
    current = root.resolve(strict=True)
    for part in safe_location(location).split('/'):
        current = current / part
        if current.is_symlink():
            fail('review_symlink_refused')
    before = current.stat()
    if not current.is_file() or before.st_size > MAX_BYTES:
        fail('review_evidence_file_invalid')
    data = current.read_bytes()
    after = current.stat()
    if (before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_ino, after.st_size, after.st_mtime_ns):
        fail('review_source_changed')
    return data


def load_json(data):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                fail('review_duplicate_json_key')
            result[key] = value
        return result
    return json.loads(data, object_pairs_hook=pairs, parse_constant=lambda _: fail('review_json_constant_invalid'))


def binding(target, assets):
    if not isinstance(target, dict) or not {'nodeId', 'assetId', 'version', 'sha256'}.issubset(target):
        fail('review_asset_binding_invalid')
    for field in ('nodeId', 'assetId', 'version'):
        text(target[field], 'review_asset_binding_invalid', 512)
    key = (target['nodeId'], target['assetId'])
    if key not in assets or any(target[k] != assets[key][k] for k in ('version', 'sha256')):
        fail('review_asset_stale')
    for key in ('nodeId', 'assetId', 'version'):
        text(target[key], 'review_asset_binding_invalid', 512)
    hash_value(target['sha256'])
    if set(target) - {'nodeId', 'assetId', 'version', 'sha256', 'objectId', 'frame', 'region'}:
        fail('review_target_field_invalid')
    if 'objectId' in target:
        text(target['objectId'], 'review_object_invalid', 512)
    if 'frame' in target and (type(target['frame']) is not int or target['frame'] < 0):
        fail('review_frame_invalid')
    if 'region' in target:
        region = target['region']
        if not isinstance(region, dict) or set(region) != {'x', 'y', 'width', 'height'}:
            fail('review_region_invalid')
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in region.values()):
            fail('review_region_invalid')
        if not (0 <= region['x'] < 1 and 0 <= region['y'] < 1 and 0 < region['width'] <= 1 - region['x'] and 0 < region['height'] <= 1 - region['y']):
            fail('review_region_invalid')
    return assets[(target['nodeId'], target['assetId'])]


def evaluate(value, package, evidence_root):
    """校验评价者的观察与当前包绑定，聚合状态；不声称观察内容已自动验证。"""
    if not isinstance(value, dict) or set(value) != {'schema', 'packageSha256', 'planSha256', 'ownerId', 'authorizationRef', 'brandReferences', 'checks'} or value['schema'] != 'craft-review-input/v1':
        fail('review_input_invalid')
    workflow = package['workflow']
    if value['packageSha256'] != package['sha256'] or value['planSha256'] != workflow['planSha256']:
        fail('review_package_stale')
    if value['ownerId'] != workflow['ownerId'] or value['authorizationRef'] != workflow['authorizationRef']:
        fail('review_authorization_mismatch')
    assets = {}
    for child in package['children']:
        for artifact in child['outputs']:
            key = (child['nodeId'], artifact['assetId'])
            if key in assets:
                fail('review_asset_ambiguous')
            assets[key] = {**artifact, 'nodeId': child['nodeId'], 'runtimeIdentity': child['runtimeIdentity']}
    if not assets:
        fail('review_asset_missing')
    if not isinstance(value['brandReferences'], list) or len(value['brandReferences']) > 1000:
        fail('review_brand_reference_invalid')
    for target in value['brandReferences']:
        binding(target, assets)
    if not isinstance(value['checks'], list) or len(value['checks']) > 10000:
        fail('review_checks_invalid')
    ids, checks, coverage = set(), [], {dim: {key: [] for key in assets} for dim in DIMENSIONS}
    for check in value['checks']:
        if not isinstance(check, dict) or set(check) != {'id', 'dimension', 'status', 'evaluator', 'target', 'evidence', 'note'}:
            fail('review_check_invalid')
        identifier = text(check['id'], 'review_check_id_invalid', 512)
        if identifier in ids:
            fail('review_check_duplicate')
        ids.add(identifier)
        dimension, status = check['dimension'], check['status']
        if dimension not in DIMENSIONS or status not in ('PASS', 'FAIL', 'NOT_RUN'):
            fail('review_status_invalid')
        actor = check['evaluator']
        if not isinstance(actor, dict) or set(actor) != {'kind', 'id', 'version'} or actor['kind'] not in ('human', 'tool', 'model'):
            fail('review_evaluator_invalid')
        text(actor['id'], 'review_evaluator_invalid', 512)
        text(actor['version'], 'review_evaluator_invalid', 512)
        if dimension == 'acceptance' and status != 'NOT_RUN' and actor['kind'] != 'human':
            fail('review_human_acceptance_required')
        text(check['note'], 'review_note_required')
        artifact = binding(check['target'], assets)
        if status == 'FAIL' and dimension == 'creative' and not any(k in check['target'] for k in ('objectId', 'frame', 'region')):
            fail('review_issue_locator_required')
        evidence = check['evidence']
        if not isinstance(evidence, list) or len(evidence) > 100 or (status != 'NOT_RUN' and not evidence):
            fail('review_observation_evidence_required')
        for ref in evidence:
            if not isinstance(ref, dict) or set(ref) != {'location', 'sha256'}:
                fail('review_evidence_ref_invalid')
            if digest(read_local(evidence_root, ref['location'])) != hash_value(ref['sha256']):
                fail('review_evidence_digest_mismatch')
        coverage[dimension][(artifact['nodeId'], artifact['assetId'])].append(status)
        checks.append({**check, 'responsiblePlugin': artifact['runtimeIdentity']['pluginId'], 'runtimeIdentity': artifact['runtimeIdentity']})
    dimensions = {'engineering': 'PASS'}
    for dim in DIMENSIONS:
        rows = list(coverage[dim].values())
        dimensions[dim] = 'FAIL' if any('FAIL' in states for states in rows) else 'NOT_RUN' if any(not states or 'NOT_RUN' in states for states in rows) else 'PASS'
    decision = 'changes_requested' if 'FAIL' in dimensions.values() else 'pending' if 'NOT_RUN' in dimensions.values() else 'accepted'
    return {'dimensions': dimensions, 'decision': decision, 'taskState': 'review_ready', 'checks': checks,
            'scope': 'package integrity verified; named evaluator observations recorded, not automatic creative validation; ledger state unchanged'}


def verify_package(args):
    command = [sys.executable, '-I', '-B', str(Path(__file__).with_name('package.py')), 'verify', '--package', str(args.package.resolve(strict=True)), '--sha', args.package_sha, '--runtime-home', str(args.runtime_home)]
    for flag, value in (('--node-archive', args.node_archive), ('--bundle-dir', args.bundle_dir), ('--native-archive-dir', args.native_archive_dir)):
        if value is not None:
            command += [flag, str(value)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=600)
    if result.returncode:
        raise RuntimeError('review_package_verification_failed: ' + result.stdout.strip())
    return load_json(result.stdout)


def portable_input(value):
    result = load_json(json.dumps(value, ensure_ascii=False))
    for check in result['checks']:
        for ref in check['evidence']:
            safe_location(ref['location'])
            hash_value(ref['sha256'])
            ref['location'] = 'evidence/' + ref['sha256']
    return result


def verify_record(args, package):
    root = args.review.resolve(strict=True)
    data = read_local(root, 'review.json')
    if digest(data) != hash_value(args.review_sha):
        fail('review_record_digest_mismatch')
    report = load_json(data)
    if any(p.is_symlink() for p in root.rglob('*')):
        fail('review_symlink_refused')
    if not isinstance(report, dict) or set(report) != {'schema', 'inputSha256', 'input', 'files', 'dimensions', 'decision', 'taskState', 'checks', 'scope'} or report.get('schema') != 'craft-review-record/v1' or not isinstance(report.get('files'), dict):
        fail('review_record_invalid')
    if {str(p.relative_to(root)) for p in root.rglob('*') if not p.is_dir()} != set(report['files']) | {'review.json'}:
        fail('review_record_inventory_mismatch')
    for location, entry in report['files'].items():
        contents = read_local(root, location)
        if set(entry) != {'sha256', 'bytes'} or digest(contents) != hash_value(entry['sha256']) or len(contents) != entry['bytes']:
            fail('review_record_file_mismatch')
    original = load_json(read_local(root, 'input.json'))
    normalized = portable_input(original)
    expected_files = {'input.json', *(ref['location'] for check in normalized['checks'] for ref in check['evidence'])}
    if set(report['files']) != expected_files or report.get('input') != normalized or report.get('inputSha256') != digest(read_local(root, 'input.json')):
        fail('review_record_input_mismatch')
    computed = evaluate(normalized, package, root)
    if any(report.get(key) != val for key, val in computed.items()):
        fail('review_record_result_mismatch')
    return {'schema': 'craft-review-receipt/v1', 'sha256': args.review_sha, 'packageSha256': package['sha256'], **computed}


def record(args, package):
    if args.input.is_symlink():
        fail('review_symlink_refused')
    source = args.input.resolve(strict=True)
    data = read_local(source.parent, source.name)
    value = load_json(data)
    evaluate(value, package, source.parent)
    output = args.output.resolve()
    if output == args.package.resolve() or args.package.resolve() in output.parents:
        fail('review_output_inside_package')
    if output.exists():
        fail('review_output_exists')
    output.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.craft-review-', dir=output.parent))
    reserved = None
    try:
        files = {}
        def write(location, contents):
            if location in files:
                return
            if sum(v['bytes'] for v in files.values()) + len(contents) > 8 * MAX_BYTES:
                fail('review_evidence_limit_exceeded')
            target = stage / location
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as stream:
                stream.write(contents)
            files[location] = {'sha256': digest(contents), 'bytes': len(contents)}
        write('input.json', data)
        for check in value['checks']:
            for ref in check['evidence']:
                contents = read_local(source.parent, ref['location'])
                if digest(contents) != ref['sha256']:
                    fail('review_source_changed')
                write('evidence/' + ref['sha256'], contents)
        normalized = portable_input(value)
        report = {'schema': 'craft-review-record/v1', 'inputSha256': digest(data), 'input': normalized, 'files': files, **evaluate(normalized, package, stage)}
        contents = (json.dumps(report, ensure_ascii=False, indent=2) + '\n').encode()
        (stage / 'review.json').write_bytes(contents)
        # 发布前再次确认交付未改变；失败不生成可用审阅回执。
        verify_package(args)
        output.mkdir(mode=0o700)
        reserved = output.stat().st_ino
        stage.rename(output)
        reserved = None
        return {'schema': 'craft-review-receipt/v1', 'root': str(output), 'sha256': digest(contents), 'packageSha256': package['sha256'], **evaluate(normalized, package, output)}
    finally:
        shutil.rmtree(stage, ignore_errors=True)
        if reserved is not None and output.exists() and output.stat().st_ino == reserved:
            try:
                output.rmdir()
            except OSError:
                pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('record', 'verify'))
    parser.add_argument('--package', required=True, type=Path)
    parser.add_argument('--package-sha', required=True)
    parser.add_argument('--input', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--review', type=Path)
    parser.add_argument('--review-sha')
    parser.add_argument('--runtime-home', type=Path, default=Path(os.environ.get('CRAFT_RUNTIME_HOME', str(Path.home()/'.local/share/craft-runtimes'))))
    for flag in ('node-archive', 'bundle-dir', 'native-archive-dir'):
        parser.add_argument('--' + flag, type=Path)
    args = parser.parse_args()
    try:
        hash_value(args.package_sha)
        if args.action == 'record' and (not args.input or not args.output) or args.action == 'verify' and (not args.review or not args.review_sha):
            fail('review_arguments_required')
        package = verify_package(args)
        result = record(args, package) if args.action == 'record' else verify_record(args, package)
        print(json.dumps(result, ensure_ascii=False))
    except (ValueError, RuntimeError, OSError, KeyError, TypeError, subprocess.SubprocessError) as error:
        print(json.dumps({'error': str(error), 'result': 'unknown' if isinstance(error, subprocess.TimeoutExpired) else 'failed'}, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
