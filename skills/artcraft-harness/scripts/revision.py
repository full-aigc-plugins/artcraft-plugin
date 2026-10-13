#!/usr/bin/env python3
"""当前审阅驱动的持久化修订步骤；公开工作流执行，未知结果不自动重放。"""
import argparse
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid
sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location('craft_local_review', Path(__file__).with_name('review.py'))
R = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(R)
SPEC_PUBLIC = importlib.util.spec_from_file_location('craft_public_call', Path(__file__).with_name('public_call.py'))
P = importlib.util.module_from_spec(SPEC_PUBLIC)
SPEC_PUBLIC.loader.exec_module(P)
DOMAINS = {'filmcraft', 'effectcraft', 'photocraft', 'vectorcraft'}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def validate_policy(policy):
    required = {'schema', 'workflowId', 'ownerId', 'authorizationRef', 'targetSha256', 'maxRounds', 'maxStagnantRounds', 'allowedCommands'}
    if not isinstance(policy, dict) or set(policy) != required or policy['schema'] != 'craft-revision-policy/v1':
        raise ValueError('revision_policy_invalid')
    for field in ('workflowId', 'ownerId', 'authorizationRef'):
        R.text(policy[field], 'revision_policy_invalid', 512)
    R.hash_value(policy['targetSha256'])
    for field in ('maxRounds', 'maxStagnantRounds'):
        if type(policy[field]) is not int or not 1 <= policy[field] <= 100:
            raise ValueError('revision_policy_invalid')
    commands = policy['allowedCommands']
    if not isinstance(commands, dict) or not commands or len(commands) > 1000:
        raise ValueError('revision_policy_invalid')
    for node, rows in commands.items():
        R.text(node, 'revision_policy_invalid', 128)
        if not isinstance(rows, list) or not rows or len(rows) > 1000 or any(not isinstance(s, str) or not s for s in rows) or len(set(rows)) != len(rows):
            raise ValueError('revision_policy_invalid')
    return policy


def identity(policy, package):
    validate_policy(policy)
    if any(policy[k] != package['workflow'][k] for k in ('workflowId', 'ownerId', 'authorizationRef')):
        raise ValueError('revision_authorization_mismatch')


def observed_score(package, review):
    """声明的失败检查数量仅用于停滞政策，不冒充自动审美分数。"""
    targets = {(child['nodeId'], output['assetId']) for child in package['children'] for output in child['outputs']}
    for target in targets:
        for dim in ('technical', 'creative'):
            rows = [c for c in review['checks'] if (c['target']['nodeId'], c['target']['assetId']) == target and c['dimension'] == dim]
            if not rows or any(c['status'] == 'NOT_RUN' for c in rows):
                return None
    return sum(c['status'] == 'FAIL' for c in review['checks'])


def observe(policy, state, package, review):
    """保存可核验参考；停止条件先于下一次原生修改。"""
    identity(policy, package)
    if state.get('stopped'):
        return state['stopped']
    # 保存最近已核验观察的失败项；最佳包与这些问题可来自不同版本。
    state['unresolvedIssues'] = R.load_json(canonical([
        {'checkId': row.get('id'), 'dimension': row['dimension'], 'target': row['target'],
         'responsiblePlugin': row.get('responsiblePlugin'), 'runtimeIdentity': row.get('runtimeIdentity'),
         'note': row.get('note'), 'evidence': row.get('evidence', [])}
        for row in review['checks'] if row['status'] == 'FAIL'
    ]))
    state['issueSource'] = {'packageSha256': package['sha256'], 'runKey': package['workflow']['runKey']}
    score = observed_score(package, review)
    if score is None or review['decision'] not in ('changes_requested', 'accepted'):
        return 'review_required'
    anchor = {k: package['workflow'][k] for k in ('runKey', 'revision')}
    anchor.update(sha256=package['sha256'], score=score)
    if package.get('root'):
        anchor['root'] = package['root']
    if state.get('bestPackage') is None:
        state['bestPackage'] = anchor
    # 最佳指标需要技术 PASS 和完整技术/创作观察；接受状态仍独立。
    if review['dimensions']['technical'] == 'PASS' and (state.get('bestScore') is None or score < state['bestScore']):
        state['bestScore'] = score
        state['bestPackage'] = anchor
    if review['decision'] == 'accepted':
        return 'accepted_record'
    if state['rounds'] >= policy['maxRounds']:
        return 'max_rounds'
    if state.get('lastScore') is not None:
        state['stagnantRounds'] = state['stagnantRounds'] + 1 if score >= state['lastScore'] else 0
    state['lastScore'] = score
    if state['stagnantRounds'] >= policy['maxStagnantRounds']:
        return 'stagnation'
    return None


def plugin(node):
    return node.get('pluginId') or node.get('runtimeIdentity', {}).get('pluginId')


def build_plan(policy, base, package, review, request, package_root):
    """从已核验包生成原生源工程修订，禁止补丁更改图、预算或工具身份。"""
    identity(policy, package)
    if not isinstance(request, dict) or set(request) != {'schema', 'revision', 'patches'} or request['schema'] != 'craft-revision-request/v1':
        raise ValueError('revision_request_invalid')
    R.text(request['revision'], 'revision_request_invalid', 128)
    if request['revision'] == package['workflow']['revision']:
        raise ValueError('revision_new_version_required')
    if base['workflowId'] != policy['workflowId']:
        raise ValueError('revision_workflow_mismatch')
    nodes = {n['id']: n for n in base['nodes']}
    if len(nodes) != len(base['nodes']) or any(n not in nodes for n in policy['allowedCommands']):
        raise ValueError('revision_node_scope_invalid')
    failures = {c['target']['nodeId'] for c in review['checks'] if c['status'] == 'FAIL'}
    if not failures or not failures.issubset(nodes):
        raise ValueError('revision_failed_node_missing')
    affected = set(failures)
    while True:
        expanded = affected | {n['id'] for n in base['nodes'] if any(p in affected for p in n['dependsOn'])}
        if expanded == affected:
            break
        affected = expanded
    required = {id for id in affected if plugin(nodes[id]) in DOMAINS}
    if not isinstance(request['patches'], list) or len(request['patches']) > 1000:
        raise ValueError('revision_patch_invalid')
    patches = {}
    for patch in request['patches']:
        if not isinstance(patch, dict) or not {'nodeId', 'operations'}.issubset(patch) or set(patch) - {'nodeId', 'operations', 'assetBindings'}:
            raise ValueError('revision_patch_invalid')
        node_id = patch['nodeId']
        if not isinstance(node_id, str) or node_id in patches or node_id not in required or node_id not in policy['allowedCommands']:
            raise ValueError('revision_node_scope_invalid')
        operations = patch['operations']
        if not isinstance(operations, list) or not operations:
            raise ValueError('revision_patch_invalid')
        for operation in operations:
            if not isinstance(operation, dict) or not {'command', 'params'}.issubset(operation) or set(operation) - {'command', 'params', 'as'} or operation['command'] not in policy['allowedCommands'][node_id] or not isinstance(operation['params'], dict):
                raise ValueError('revision_command_scope_invalid')
        patches[node_id] = patch
    if set(patches) != required:
        raise ValueError('revision_dependent_patch_required')
    children = {c['nodeId']: c for c in package['children']}
    upstream_assets = {id: {a['assetId'] for parent in node['dependsOn'] for a in children[parent]['outputs']} for id, node in nodes.items()}
    result = R.load_json(canonical(base))
    result['revision'] = request['revision']
    for node in result['nodes']:
        if node['id'] not in patches:
            continue
        child = children[node['id']]
        source = next((a for a in child['outputs'] if a.get('nativeProjectRef')), None)
        if source is None or child['runtimeIdentity']['pluginId'] != plugin(node):
            raise ValueError('revision_native_source_missing')
        source_root = Path(child['root'])
        if not source_root.is_absolute():
            source_root = package_root / source_root
        node['expectedRevision'] = source['nativeProjectRef']['sha256']
        node['externalInputs'] = [{'root': str(source_root), 'artifact': source}]
        node.pop('providedAssets', None)
        payload = node['payload']
        payload['sourceProject'] = {'assetId': source['assetId']}
        payload['plan'].pop('document', None)
        payload['plan'].pop('assets', None)
        payload['plan']['operations'] = patches[node['id']]['operations']
        payload['assetBindings'] = patches[node['id']].get('assetBindings', [{**b, 'retained': True} for b in payload.get('assetBindings', []) if b['assetId'] in upstream_assets[node['id']]])
    return result


def invoke(args, script, values):
    command = [sys.executable, '-I', '-B', str(Path(__file__).with_name(script)), *map(str, values), '--runtime-home', str(args.runtime_home)]
    for flag, name in (('node-archive', 'node_archive'), ('bundle-dir', 'bundle_dir'), ('native-archive-dir', 'native_archive_dir')):
        value = getattr(args, name)
        if value is not None:
            command += ['--' + flag, str(value)]
    return P.run(command, 'revision_public_call_failed: ', args.runtime_home, parser=R.load_json, invalid='revision_public_result_unknown')


def read_state(root):
    path = root / '.artcraft-revision-cycle.json'
    if not path.exists() and not path.is_symlink():
        return None
    value = R.load_json(R.read_local(root, path.name))
    if not isinstance(value, dict) or value.get('schema') != 'craft-revision-cycle/v1' or not isinstance(value.get('steps'), dict) or not isinstance(value.get('policy'), dict):
        raise ValueError('revision_state_invalid')
    validate_policy(value['policy'])
    if sha(canonical(value['policy'])) != value.get('policyCanonicalSha256') or type(value.get('rounds')) is not int or value['rounds'] < 0 or type(value.get('stagnantRounds')) is not int or value['stagnantRounds'] < 0:
        raise ValueError('revision_state_invalid')
    if value['rounds'] != len(value['steps']) + (1 if value.get('pending') else 0):
        raise ValueError('revision_state_counter_mismatch')
    return value


def package_base(args, package):
    original_bytes = R.read_local(args.package.resolve(strict=True), 'workflow-plan.json')
    portable_bytes = R.read_local(args.package.resolve(strict=True), 'workflow-plan-portable.json')
    if sha(original_bytes) != package['files']['workflow-plan.json']['sha256'] or sha(portable_bytes) != package['files']['workflow-plan-portable.json']['sha256']:
        raise ValueError('revision_package_changed')
    base, portable = R.load_json(original_bytes), R.load_json(portable_bytes)
    for node, moved_node in zip(base['nodes'], portable['nodes']):
        if node['id'] != moved_node['id']:
            raise ValueError('revision_package_plan_mismatch')
        for original, moved in zip(node.get('externalInputs', []), moved_node.get('externalInputs', [])):
            original['root'] = str(args.package.resolve(strict=True) / moved['root'])
    return base


def save_state(root, state):
    with tempfile.NamedTemporaryFile(dir=root, prefix='.revision-state-', delete=False) as file:
        temporary = Path(file.name)
        file.write(canonical(state))
        file.flush()
        os.fsync(file.fileno())
    try:
        os.replace(temporary, root / '.artcraft-revision-cycle.json')
    finally:
        temporary.unlink(missing_ok=True)


def stopped_receipt(args, state, reason):
    result = {'state': 'stopped', 'reason': reason, 'bestPackage': state['bestPackage'], 'rounds': state['rounds'], 'bestVerification': 'NOT_RUN'}
    result['unresolvedIssues'] = state.get('unresolvedIssues', [])
    result['issueSource'] = state.get('issueSource')
    result['issueEvidence'] = 'recorded_observation' if result['issueSource'] else 'NOT_RUN'
    best = state['bestPackage']
    if best and best.get('root'):
        try:
            checked = invoke(args, 'package.py', ['verify', '--package', best['root'], '--sha', best['sha256']])
            if checked['workflow']['runKey'] != best['runKey']:
                raise ValueError('revision_best_package_mismatch')
            result['bestVerification'] = 'PASS'
        except (ValueError, RuntimeError, OSError, KeyError, subprocess.SubprocessError) as error:
            result['bestVerification'] = 'FAIL'
            result['bestVerificationError'] = str(error)
    return result


def step(args):
    root = args.project.resolve(strict=True)
    policy_bytes = R.read_local(args.policy.resolve(strict=True).parent, args.policy.resolve(strict=True).name)
    if sha(policy_bytes) != R.hash_value(args.policy_sha):
        raise ValueError('revision_policy_digest_mismatch')
    policy = validate_policy(R.load_json(policy_bytes))
    marker = R.load_json(R.read_local(root, '.artcraft-project.json'))
    if marker != {'schema': 'artcraft-project/v1', 'ownerId': policy['ownerId'], 'workflowId': policy['workflowId']}:
        raise ValueError('revision_project_owner_mismatch')
    fd = os.open(root / '.artcraft-revision.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('revision_cycle_busy') from None
        state = read_state(root)
        if state is None:
            state = {'schema': 'craft-revision-cycle/v1', 'policy': policy, 'policySha256': args.policy_sha, 'policyCanonicalSha256': sha(canonical(policy)), 'rounds': 0, 'stagnantRounds': 0, 'lastScore': None, 'bestScore': None, 'bestPackage': None, 'stopped': None, 'latestRunKey': None, 'pending': None, 'steps': {}}
        elif state['policySha256'] != args.policy_sha or state['policy'] != policy:
            raise ValueError('revision_policy_changed_requires_new_authorization')
        request_bytes = R.read_local(args.request.resolve(strict=True).parent, args.request.resolve(strict=True).name)
        request = R.load_json(request_bytes)
        key = sha(canonical({'packageSha256': args.package_sha, 'reviewSha256': args.review_sha, 'request': request, 'policySha256': args.policy_sha}))
        if state['stopped']:
            return stopped_receipt(args, state, state['stopped'])
        if key in state['steps']:
            # 技术复用仍需当前包与证据有效，不能从陈旧摘要直接返回接受。
            invoke(args, 'review.py', ['verify', '--package', args.package, '--package-sha', args.package_sha, '--review', args.review, '--review-sha', args.review_sha])
            stored = state['steps'][key]
            current = invoke(args, 'package.py', ['verify', '--package', stored['package']['root'], '--sha', stored['package']['sha256']])
            if current['workflow']['runKey'] != stored['workflow']['runKey']:
                raise ValueError('revision_saved_package_mismatch')
            return stored
        pending = state['pending']
        if pending and (pending['key'] != key or not args.resume):
            return {'state': 'outcome_unknown', 'reason': 'resume_same_step_required', 'pendingStep': pending['key'], 'bestPackage': state['bestPackage']}
        try:
            package = invoke(args, 'package.py', ['verify', '--package', args.package, '--sha', args.package_sha])
            review = invoke(args, 'review.py', ['verify', '--package', args.package, '--package-sha', args.package_sha, '--review', args.review, '--review-sha', args.review_sha])
        except P.PublicCallFailure as error:
            if not pending:raise
            # 恢复前置安装失败不证明原编辑失败，也不能清除未知步骤或归还额度。
            state['pending']['error'] = str(error)
            state['pending'].update(error.diagnostic)
            save_state(root, state)
            return {'state': 'outcome_unknown', 'reason': 'resume_preflight_failed',
                    'error': str(error), 'pendingStep': pending['key'],
                    'rounds': state['rounds'], 'bestPackage': state['bestPackage'],
                    **error.diagnostic}
        identity(policy, package)
        if not pending and state['latestRunKey'] is not None and package['workflow']['runKey'] != state['latestRunKey']:
            raise ValueError('revision_current_package_required')
        if pending:
            plan = build_plan(policy, package_base(args, package), package, review, request, args.package.resolve(strict=True))
            if canonical(plan) != canonical(pending['plan']):
                raise ValueError('revision_pending_plan_modified')
        else:
            if any(item.get('revision') == request.get('revision') for item in state['steps'].values()):
                raise ValueError('revision_version_already_used')
            reason = observe(policy, state, package, review)
            state['issueSource']['reviewSha256'] = args.review_sha
            if reason:
                state['stopped'] = reason if reason != 'review_required' else None
                save_state(root, state)
                if reason != 'review_required':
                    return stopped_receipt(args, state, reason)
                return {'state': 'review_required', 'reason': reason, 'bestPackage': state['bestPackage'], 'rounds': state['rounds']}
            plan = build_plan(policy, package_base(args, package), package, review, request, args.package.resolve(strict=True))
            state['rounds'] += 1
            state['pending'] = {'key': key, 'plan': plan, 'phase': 'workflow', 'sourcePackageSha256': args.package_sha, 'sourceReviewSha256': args.review_sha}
            save_state(root, state)
        plan_root = root / 'revision-plans'
        plan_root.mkdir(exist_ok=True)
        if plan_root.is_symlink():
            raise ValueError('revision_plan_directory_invalid')
        plan_path = plan_root / (key + '.json')
        if plan_path.exists():
            if R.read_local(plan_root, plan_path.name) != canonical(plan):
                raise ValueError('revision_plan_modified')
        else:
            with plan_path.open('xb') as stream:
                stream.write(canonical(plan))
        try:
            flags = [plan_path, '--output', root, '--owner', policy['ownerId'], '--authorization', policy['authorizationRef']]
            for flag, name in (('video-factory-root', 'video_factory_root'), ('ffmpeg', 'ffmpeg'), ('ffprobe', 'ffprobe')):
                if getattr(args, name) is not None:
                    flags += ['--' + flag, getattr(args, name)]
            result = invoke(args, 'workflow.py', flags)
            if result.get('state') != 'review_ready':
                raise RuntimeError('revision_workflow_outcome_unknown')
            state['pending']['phase'] = 'package'
            state['pending']['workflowResult'] = result
            save_state(root, state)
            packages = root / 'revision-packages'
            packages.mkdir(exist_ok=True)
            if packages.is_symlink():
                raise ValueError('revision_package_directory_invalid')
            # 恢复时选择新目录；未知打包回执不从包内反推可信 SHA。
            destination = packages / (key + '-' + uuid.uuid4().hex)
            packed = invoke(args, 'package.py', ['create', '--project', root, '--workflow', result['runKey'], '--owner', policy['ownerId'], '--authorization', policy['authorizationRef'], '--output', destination])
            receipt = {'state': 'review_required', 'revision': plan['revision'], 'rounds': state['rounds'], 'workflow': result, 'package': packed, 'bestPackage': state['bestPackage'], 'taskState': 'review_ready', 'scope': 'native patch execution and declared failure-count policy; no model evaluation or human acceptance'}
            state['steps'][key] = receipt
            state['pending'] = None
            state['latestRunKey'] = result['runKey']
            save_state(root, state)
            return receipt
        except (ValueError, RuntimeError, OSError, subprocess.SubprocessError) as error:
            state['pending']['error'] = str(error)
            if isinstance(error, P.PublicCallFailure):state['pending'].update(error.diagnostic)
            if 'budget_exceeded:' in str(error):
                state['stopped'] = 'budget_exceeded'
            save_state(root, state)
            if state['stopped']:
                return {**stopped_receipt(args, state, state['stopped']), 'error': str(error), 'pendingStep': key}
            reply = {'state': 'outcome_unknown', 'reason': state['stopped'], 'error': str(error), 'pendingStep': key, 'rounds': state['rounds'], 'bestPackage': state['bestPackage']}
            if isinstance(error, P.PublicCallFailure):reply.update(error.diagnostic)
            return reply


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('step', 'status'))
    parser.add_argument('--project', type=Path, required=True)
    for flag in ('package', 'review', 'request', 'policy', 'node-archive', 'bundle-dir', 'native-archive-dir', 'video-factory-root', 'ffmpeg', 'ffprobe'):
        parser.add_argument('--' + flag, type=Path)
    for flag in ('package-sha', 'review-sha', 'policy-sha'):
        parser.add_argument('--' + flag)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--runtime-home', type=Path, default=Path(os.environ.get('CRAFT_RUNTIME_HOME', str(Path.home()/'.local/share/craft-runtimes'))))
    args = parser.parse_args()
    try:
        if args.action == 'status':
            result = read_state(args.project.resolve(strict=True))
            if result is None:
                raise ValueError('revision_cycle_missing')
        else:
            if any(getattr(args, key) is None for key in ('package', 'package_sha', 'review', 'review_sha', 'request', 'policy', 'policy_sha')):
                raise ValueError('revision_arguments_required')
            R.hash_value(args.package_sha)
            R.hash_value(args.review_sha)
            result = step(args)
        print(json.dumps(result, ensure_ascii=False))
        if result.get('state') == 'outcome_unknown':
            raise SystemExit(2)
    except (ValueError, RuntimeError, OSError, KeyError, TypeError, subprocess.SubprocessError) as error:
        reply = {'error': str(error), 'state': 'outcome_unknown' if isinstance(error, subprocess.TimeoutExpired) else 'failed'}
        if isinstance(error, P.PublicCallFailure):
            reply.update(error.diagnostic)
            if reply.get('result') == 'unknown':reply['state'] = 'outcome_unknown'
        print(json.dumps(reply, ensure_ascii=False))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
