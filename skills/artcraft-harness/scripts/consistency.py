#!/usr/bin/env python3
"""校验固定品牌及主体引用的跨产物观察，不替代具名评价者或人工接受。"""


def reject(code):
    raise ValueError(code)


def evaluate(value, brand_references, checks, assets, evidence, binding, load_json, text):
    """接收已校验的检查与证据字节，返回覆盖状态及绑定到资产定位的问题。"""
    if not isinstance(value, dict) or set(value) != {'schema', 'references', 'assessments'} or value['schema'] != 'craft-consistency/v1':
        reject('consistency_input_invalid')
    references = value['references']
    if not isinstance(references, list) or not 2 <= len(references) <= 1000:
        reject('consistency_references_invalid')
    ids, roles, asset_ids = set(), set(), set()
    for ref in references:
        if not isinstance(ref, dict) or set(ref) != {'id', 'role', 'asset'}:
            reject('consistency_reference_invalid')
        identifier = text(ref['id'], 'consistency_reference_invalid', 512)
        if identifier in ids or ref['role'] not in ('brand', 'subject'):
            reject('consistency_reference_invalid')
        binding(ref['asset'], assets)
        # 参考指向完整资产；目标帧与区域只在观察目标中指定。
        if set(ref['asset']) != {'nodeId', 'assetId', 'version', 'sha256'}:
            reject('consistency_reference_invalid')
        identity = (ref['asset']['nodeId'], ref['asset']['assetId'])
        if identity in asset_ids:
            reject('consistency_reference_duplicate_asset')
        asset_ids.add(identity)
        if ref['role'] == 'brand' and ref['asset'] not in brand_references:
            reject('consistency_brand_reference_mismatch')
        ids.add(identifier)
        roles.add(ref['role'])
    if roles != {'brand', 'subject'}:
        reject('consistency_reference_roles_required')
    assessments = value['assessments']
    if not isinstance(assessments, list) or len(assessments) > 10000:
        reject('consistency_assessments_invalid')
    by_id = {check['id']: check for check in checks}
    seen, domains, covered, rows, issues = set(), set(), set(), [], []
    required = {'photocraft', 'effectcraft', 'filmcraft'}
    for entry in assessments:
        if not isinstance(entry, dict) or set(entry) != {'checkId', 'referenceIds'}:
            reject('consistency_assessment_invalid')
        identifier = text(entry['checkId'], 'consistency_check_invalid', 512)
        selected = entry['referenceIds']
        if identifier in seen or identifier not in by_id:
            reject('consistency_check_invalid')
        if not isinstance(selected, list) or any(not isinstance(item, str) for item in selected) or len(selected) != len(ids) or set(selected) != ids:
            reject('consistency_reference_set_mismatch')
        seen.add(identifier)
        check = by_id[identifier]
        domain, target = check['responsiblePlugin'], check['target']
        if check['dimension'] != 'creative' or domain not in required:
            reject('consistency_creative_target_required')
        if domain == 'photocraft' and 'region' not in target or domain in ('effectcraft', 'filmcraft') and 'frame' not in target:
            reject('consistency_target_locator_required')
        if check['status'] != 'NOT_RUN':
            for ref in check['evidence']:
                observation = load_json(evidence[(ref['location'], ref['sha256'])])
                fields = {'schema', 'checkId', 'target', 'references', 'evaluator', 'status', 'method', 'observations'}
                if not isinstance(observation, dict) or set(observation) != fields or observation['schema'] != 'craft-consistency-observation/v1':
                    reject('consistency_observation_invalid')
                expected = {'checkId': identifier, 'target': target, 'references': references,
                            'evaluator': check['evaluator'], 'status': check['status']}
                if any(observation[key] != val for key, val in expected.items()):
                    reject('consistency_observation_binding_mismatch')
                text(observation['method'], 'consistency_method_required')
                observations = observation['observations']
                if not isinstance(observations, list) or not 1 <= len(observations) <= 1000:
                    reject('consistency_observations_required')
                for item in observations:
                    if not isinstance(item, dict) or set(item) != {'description'}:
                        reject('consistency_observation_description_invalid')
                    text(item['description'], 'consistency_observation_description_invalid')
            domains.add(domain)
            covered.add((target['nodeId'], target['assetId']))
        row = {**entry, 'target': target, 'responsiblePlugin': domain,
               'status': check['status'], 'evaluator': check['evaluator'], 'evidence': check['evidence']}
        rows.append(row)
        if check['status'] == 'FAIL':
            issues.append(row)
    missing = sorted(required - domains)
    missing_targets = [dict((field, asset[field]) for field in ('nodeId', 'assetId', 'version', 'sha256'))
                       for key, asset in sorted(assets.items())
                       if asset['runtimeIdentity']['pluginId'] in required and key not in covered]
    result = 'FAIL' if issues else 'NOT_RUN' if missing or missing_targets or any(row['status'] == 'NOT_RUN' for row in rows) else 'PASS'
    return {'schema': 'craft-consistency-result/v1', 'result': result,
            'references': references, 'assessments': rows, 'domains': sorted(domains),
            'missingDomains': missing, 'missingTargets': missing_targets, 'issues': issues,
            'scope': 'fixed-reference named evaluator observations; not automatic semantic validation or human acceptance'}
