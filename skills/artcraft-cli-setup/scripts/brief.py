#!/usr/bin/env python3
"""版本化需求记录与只读计划检查；不生成原生操作、不提升创作验收。"""
import argparse
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path
import re
import shutil
import tempfile

FORMATS={'.fcproj':'filmcraft','.ecproj':'effectcraft','.pcraft':'photocraft','.vectorcraft':'vectorcraft'}
FIELDS={'schema','workflowId','revision','ownerId','authorizationRef','budget','brand','subjects','deliverables','dataPolicy','ambiguities'}
HEX=re.compile(r'^[a-f0-9]{64}$')

def fail(code):
    raise ValueError(code)

def canonical(value):
    return (json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n').encode()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def text(value):
    if not isinstance(value,str) or not value.strip() or len(value)>4096:fail('brief_text_invalid')

def refs(values):
    if not isinstance(values,list) or len(values)>1000:fail('brief_reference_invalid')
    ids=set()
    for value in values:
        if not isinstance(value,dict) or set(value)!={'assetId','version','sha256'}:fail('brief_reference_invalid')
        text(value['assetId']);text(value['version'])
        if not isinstance(value['sha256'],str) or not HEX.fullmatch(value['sha256']) or value['assetId'] in ids:fail('brief_reference_invalid')
        ids.add(value['assetId'])

def identifiers(values,allowed):
    if not isinstance(values,list) or any(not isinstance(v,str) or v not in allowed for v in values) or len(values)!=len(set(values)):fail('brief_dependency_invalid')

def validate(value):
    if not isinstance(value,dict) or set(value)!=FIELDS or value['schema']!='craft-brief/v1':fail('brief_schema_invalid')
    for key in ('workflowId','revision','ownerId','authorizationRef'):text(value[key])
    budget=value['budget']
    if not isinstance(budget,dict) or set(budget)!={'currency','maxMinorUnits','maxRevisions','maxExternalCalls'} or not isinstance(budget['currency'],str) or not re.fullmatch('[A-Z]{3}',budget['currency']):fail('brief_budget_invalid')
    if any(type(budget[key]) is not int or not 0<=budget[key]<=2**53-1 for key in budget if key!='currency'):fail('brief_budget_invalid')
    items=value['deliverables']
    if not isinstance(items,list) or not 1<=len(items)<=1000:fail('brief_deliverables_invalid')
    ids=set()
    for item in items:
        if not isinstance(item,dict) or not {'id','nativeFormat','width','height','dependsOn','execution'}<=set(item) or set(item)-{'id','nativeFormat','width','height','dependsOn','execution','frameRate','durationSeconds'}:fail('brief_deliverable_invalid')
        text(item['id']);text(item['nativeFormat'])
        if item['id'] in ids:fail('brief_duplicate_deliverable')
        ids.add(item['id'])
        if item['execution'] not in ('local','cloud') or any(type(item[k]) is not int or not 1<=item[k]<=16384 for k in ('width','height')):fail('brief_deliverable_invalid')
        if 'frameRate' in item:
            rate=item['frameRate']
            if not isinstance(rate,dict) or set(rate)!={'num','den'} or any(type(v) is not int or not 1<=v<=2**53-1 for v in rate.values()) or not 1<=Fraction(rate['num'],rate['den'])<=240:fail('brief_frame_rate_invalid')
        if 'durationSeconds' in item and (type(item['durationSeconds']) not in (int,float) or not math.isfinite(item['durationSeconds']) or not 0<item['durationSeconds']<=86400):fail('brief_duration_invalid')
    for item in items:identifiers(item['dependsOn'],ids)
    seen,active=set(),set();by_id={x['id']:x for x in items}
    def visit(key):
        if key in active:fail('brief_dependency_cycle')
        if key in seen:return
        active.add(key)
        for parent in by_id[key]['dependsOn']:visit(parent)
        active.remove(key);seen.add(key)
    for key in ids:visit(key)
    if not isinstance(value['dataPolicy'],dict) or set(value['dataPolicy'])!={'allowUpload'} or type(value['dataPolicy']['allowUpload']) is not bool:fail('brief_data_policy_invalid')
    brand=value['brand']
    if brand is not None:
        if not isinstance(brand,dict) or set(brand)!={'name','colors','fonts','appliesTo','referenceAssets'}:fail('brief_brand_invalid')
        text(brand['name']);identifiers(brand['appliesTo'],ids);refs(brand['referenceAssets'])
        if not isinstance(brand['colors'],list) or any(not isinstance(c,str) or not re.fullmatch('#[0-9a-fA-F]{6}',c) for c in brand['colors']):fail('brief_brand_invalid')
        if not isinstance(brand['fonts'],list):fail('brief_brand_invalid')
        for font in brand['fonts']:text(font)
    if not isinstance(value['subjects'],list) or len(value['subjects'])>1000:fail('brief_subject_invalid')
    subject_ids=set()
    for subject in value['subjects']:
        if not isinstance(subject,dict) or set(subject)!={'id','role','description','appliesTo','referenceAssets'}:fail('brief_subject_invalid')
        for key in ('id','role','description'):text(subject[key])
        if subject['id'] in subject_ids:fail('brief_subject_invalid')
        subject_ids.add(subject['id']);identifiers(subject['appliesTo'],ids);refs(subject['referenceAssets'])
    if not isinstance(value['ambiguities'],list) or len(value['ambiguities'])>1000:fail('brief_ambiguity_invalid')
    ambiguity_ids=set()
    for item in value['ambiguities']:
        if not isinstance(item,dict) or set(item)!={'id','question','affects'}:fail('brief_ambiguity_invalid')
        text(item['id']);text(item['question']);identifiers(item['affects'],ids)
        if not item['affects'] or item['id'] in ambiguity_ids:fail('brief_ambiguity_invalid')
        ambiguity_ids.add(item['id'])
    return value

def node_constraints(value,node_id):
    validate(value)
    item=next((v for v in value['deliverables'] if v['id']==node_id),None)
    if item is None:fail('brief_deliverable_missing')
    brand=value['brand']
    return {'deliverable':item,'brand':{k:v for k,v in brand.items() if k!='appliesTo'} if brand and node_id in brand['appliesTo'] else None,
            'subjects':[{k:v for k,v in s.items() if k!='appliesTo'} for s in value['subjects'] if node_id in s['appliesTo']]}

def assess(value,plan,owner,authorization):
    validate(value)
    if owner!=value['ownerId'] or authorization!=value['authorizationRef']:fail('brief_authorization_mismatch')
    if not isinstance(plan,dict) or plan.get('workflowId')!=value['workflowId']:fail('brief_workflow_mismatch')
    if plan.get('budget')!=value['budget']:fail('brief_budget_mismatch')
    nodes=plan.get('nodes')
    if not isinstance(nodes,list) or not nodes or any(not isinstance(n,dict) or not isinstance(n.get('id'),str) for n in nodes) or len({n['id'] for n in nodes})!=len(nodes):fail('brief_plan_invalid')
    if any(not any(node['id']==item['id'] for node in nodes) for item in value['deliverables']):fail('brief_plan_deliverable_missing')
    references=[]
    for node in nodes:
        for source in node.get('externalInputs',[]):references.append(source.get('artifact',{}))
    available={(r.get('assetId'),r.get('version'),r.get('sha256')) for r in references}
    requirements={d['id']:d for d in value['deliverables']};problems={n['id']:[] for n in nodes}
    def declared_style(params,brand,reasons):
        if isinstance(params,dict):
            for key,item in params.items():
                if key=='font' and brand['fonts'] and isinstance(item,str) and item.casefold() not in {f.casefold() for f in brand['fonts']}:reasons.append('brand_font_mismatch')
                if key=='color' and brand['colors'] and isinstance(item,str) and item.lower() not in {c.lower() for c in brand['colors']}:reasons.append('brand_color_mismatch')
                declared_style(item,brand,reasons)
        elif isinstance(params,list):
            for item in params:declared_style(item,brand,reasons)
    for node in nodes:
        reasons=problems[node['id']];item=requirements.get(node['id'])
        if item is None:reasons.append('brief_deliverable_missing');continue
        plugin=FORMATS.get(item['nativeFormat'])
        if plugin is None:reasons.append('capability_missing')
        elif node.get('pluginId',node.get('runtimeIdentity',{}).get('pluginId'))!=plugin:reasons.append('native_format_mismatch')
        if set(node.get('dependsOn',[]))!=set(item['dependsOn']):reasons.append('brief_dependency_mismatch')
        if item['execution']=='cloud':reasons.append('cloud_executor_missing' if value['dataPolicy']['allowUpload'] else 'upload_forbidden')
        document=node.get('payload',{}).get('plan',{}).get('document',{})
        if not document:reasons.append('source_inspection_required')
        elif any(document.get(k)!=item[k] for k in ('width','height')):reasons.append('document_size_mismatch')
        if 'frameRate' in item:
            rate=document.get('frameRate');expected=Fraction(item['frameRate']['num'],item['frameRate']['den'])
            if isinstance(rate,dict) and set(rate)=={'num','den'} and type(rate['num']) is int and type(rate['den']) is int and rate['den']>0:actual=float(Fraction(rate['num'],rate['den']))
            elif type(rate) in (int,float):actual=rate
            else:actual=None
            if actual is None or not math.isfinite(actual) or abs(actual-float(expected))>1e-9:reasons.append('frame_rate_mismatch')
        if 'durationSeconds' in item and document.get('duration')!=item['durationSeconds']:reasons.append('duration_inspection_required')
        constraints=node_constraints(value,node['id'])
        for component in [constraints['brand'],*constraints['subjects']]:
            if component and any((r['assetId'],r['version'],r['sha256']) not in available for r in component['referenceAssets']):reasons.append('reference_asset_missing_or_stale')
        if constraints['brand']:declared_style(node.get('payload',{}).get('plan',{}).get('operations',[]),constraints['brand'],reasons)
        for ambiguity in value['ambiguities']:
            if node['id'] in ambiguity['affects']:reasons.append('ambiguity:'+ambiguity['id'])
    changed=True
    while changed:
        changed=False
        for node in nodes:
            if not problems[node['id']] and any(parent not in problems or problems[parent] for parent in node.get('dependsOn',[])):
                problems[node['id']].append('dependency_blocked');changed=True
    blocked=[{'nodeId':n['id'],'reasons':sorted(set(problems[n['id']]))} for n in nodes if problems[n['id']]]
    return {'schema':'craft-brief-assessment/v1','state':'blocked' if blocked else 'ready','ready':[n['id'] for n in nodes if not problems[n['id']]],'blocked':blocked,
            'scope':'declared plan constraints only; native output, reference bytes and creative observations require their own verification'}

def read(path):
    path=Path(path)
    if path.is_symlink():fail('brief_symlink_refused')
    before=path.stat()
    if not path.is_file() or before.st_size>8*1024*1024:fail('brief_file_invalid')
    data=path.read_bytes();after=path.stat()
    if (before.st_ino,before.st_size,before.st_mtime_ns)!=(after.st_ino,after.st_size,after.st_mtime_ns):fail('brief_source_changed')
    return data

def load(data):
    def pairs(items):
        result={}
        for key,value in items:
            if key in result:fail('brief_duplicate_json_key')
            result[key]=value
        return result
    return json.loads(data,object_pairs_hook=pairs,parse_constant=lambda _:fail('brief_json_constant_invalid'))

def create(source,output):
    original=read(source);value=validate(load(original));output=Path(output).absolute()
    if output.exists() or output.is_symlink():fail('brief_output_exists')
    output.parent.mkdir(parents=True,exist_ok=True);stage=Path(tempfile.mkdtemp(prefix='.craft-brief-',dir=output.parent));reserved=None
    try:
        files={'input.json':original,'brief.json':canonical(value)}
        for name,data in files.items():(stage/name).write_bytes(data)
        manifest={'schema':'craft-brief-record/v1','files':{n:{'sha256':digest(data),'bytes':len(data)} for n,data in files.items()}}
        content=canonical(manifest);(stage/'manifest.json').write_bytes(content)
        output.mkdir();reserved=output.stat().st_ino;stage.rename(output);reserved=None
        return {'schema':'craft-brief-receipt/v1','root':str(output),'sha256':digest(content),'workflowId':value['workflowId'],'revision':value['revision']}
    finally:
        shutil.rmtree(stage,ignore_errors=True)
        if reserved is not None:
            try:
                if output.stat().st_ino==reserved:output.rmdir()
            except OSError:pass

def verify(root,expected):
    root=Path(root)
    if root.is_symlink():fail('brief_symlink_refused')
    if not isinstance(expected,str) or not HEX.fullmatch(expected) or digest(read(root/'manifest.json'))!=expected:fail('brief_manifest_mismatch')
    manifest=load(read(root/'manifest.json'))
    if not isinstance(manifest,dict) or set(manifest)!={'schema','files'} or manifest['schema']!='craft-brief-record/v1' or set(manifest['files'])!={'input.json','brief.json'}:fail('brief_manifest_invalid')
    if any(p.is_symlink() for p in root.rglob('*')):fail('brief_symlink_refused')
    if {str(p.relative_to(root)) for p in root.rglob('*') if not p.is_dir()}!={'input.json','brief.json','manifest.json'}:fail('brief_inventory_mismatch')
    for name,entry in manifest['files'].items():
        data=read(root/name)
        if not isinstance(entry,dict) or set(entry)!={'sha256','bytes'} or digest(data)!=entry['sha256'] or len(data)!=entry['bytes']:fail('brief_file_mismatch')
    value=validate(load(read(root/'brief.json')))
    if value!=validate(load(read(root/'input.json'))):fail('brief_input_mismatch')
    return value

def main():
    parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='command',required=True)
    create_parser=sub.add_parser('create');create_parser.add_argument('--input',type=Path,required=True);create_parser.add_argument('--output',type=Path,required=True)
    for name in ('verify','assess'):
        child=sub.add_parser(name);child.add_argument('--brief',type=Path,required=True);child.add_argument('--sha',required=True)
        if name=='assess':child.add_argument('--plan',type=Path,required=True);child.add_argument('--owner',required=True);child.add_argument('--authorization',required=True)
    args=parser.parse_args()
    try:
        if args.command=='create':result=create(args.input,args.output)
        else:
            value=verify(args.brief,args.sha);result={'schema':'craft-brief-verification/v1','brief':value} if args.command=='verify' else assess(value,load(read(args.plan)),args.owner,args.authorization)
        print(json.dumps(result,ensure_ascii=False));return 0
    except (ValueError,OSError,TypeError,KeyError) as error:
        print(json.dumps({'error':str(error),'state':'blocked'},ensure_ascii=False));return 1
if __name__=='__main__':raise SystemExit(main())
