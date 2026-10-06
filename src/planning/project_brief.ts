/** 版本化需求的只读校验；元数据不作为领域媒体输入或创作通过证据。 */
import { isDeepStrictEqual } from 'node:util';
import { orderGraph } from '../protocol/dependency_graph.ts';
const formats:Record<string,string>={'.fcproj':'filmcraft','.ecproj':'effectcraft','.pcraft':'photocraft','.vectorcraft':'vectorcraft'};
const fail=(code:string):never=>{throw new Error(code);};
const object=(v:any)=>v!==null && typeof v==='object' && !Array.isArray(v);
const exact=(v:any,keys:string[],code:string)=>{if(!object(v) || !isDeepStrictEqual(Object.keys(v).sort(),[...keys].sort()))fail(code);};
const text=(v:any)=>{if(typeof v!=='string' || !v.trim() || v.length>4096)fail('brief_text_invalid');};
function identifiers(values:any,allowed:Set<string>){
 if(!Array.isArray(values) || values.some(v=>typeof v!=='string' || !allowed.has(v)) || new Set(values).size!==values.length)fail('brief_dependency_invalid');
}
function references(values:any){
 if(!Array.isArray(values) || values.length>1000)fail('brief_reference_invalid');const ids=new Set();
 for(const ref of values){exact(ref,['assetId','version','sha256'],'brief_reference_invalid');text(ref.assetId);text(ref.version);if(typeof ref.sha256!=='string' || !/^[a-f0-9]{64}$/.test(ref.sha256) || ids.has(ref.assetId))fail('brief_reference_invalid');ids.add(ref.assetId);}
}
/** 接受闭合 craft-brief/v1 数据；保留不受支持的格式需求以报告能力缺失。 */
export function validateBrief(value:any):Record<string,any>{
 exact(value,['schema','workflowId','revision','ownerId','authorizationRef','budget','brand','subjects','deliverables','dataPolicy','ambiguities'],'brief_schema_invalid');
 if(value.schema!=='craft-brief/v1')fail('brief_schema_invalid');for(const key of ['workflowId','revision','ownerId','authorizationRef'])text(value[key]);
 exact(value.budget,['currency','maxMinorUnits','maxRevisions','maxExternalCalls'],'brief_budget_invalid');
 if(typeof value.budget.currency!=='string' || !/^[A-Z]{3}$/.test(value.budget.currency) || ['maxMinorUnits','maxRevisions','maxExternalCalls'].some(k=>!Number.isSafeInteger(value.budget[k]) || value.budget[k]<0))fail('brief_budget_invalid');
 if(!Array.isArray(value.deliverables) || !value.deliverables.length || value.deliverables.length>1000)fail('brief_deliverables_invalid');
 const ids=new Set<string>();
 for(const item of value.deliverables){
  const required=['id','nativeFormat','width','height','dependsOn','execution'];
  if(!object(item) || required.some(k=>!Object.hasOwn(item,k)) || Object.keys(item).some(k=>![...required,'frameRate','durationSeconds'].includes(k)))fail('brief_deliverable_invalid');
  text(item.id);text(item.nativeFormat);if(ids.has(item.id))fail('brief_duplicate_deliverable');ids.add(item.id);
  if(!['local','cloud'].includes(item.execution) || ['width','height'].some(k=>!Number.isInteger(item[k]) || item[k]<1 || item[k]>16384))fail('brief_deliverable_invalid');
  if(Object.hasOwn(item,'frameRate')){exact(item.frameRate,['num','den'],'brief_frame_rate_invalid');const {num,den}=item.frameRate;if(![num,den].every(n=>Number.isSafeInteger(n)&&n>0) || num/den<1 || num/den>240)fail('brief_frame_rate_invalid');}
  if(Object.hasOwn(item,'durationSeconds') && (typeof item.durationSeconds!=='number' || !Number.isFinite(item.durationSeconds) || item.durationSeconds<=0 || item.durationSeconds>86400))fail('brief_duration_invalid');
 }
 for(const item of value.deliverables)identifiers(item.dependsOn,ids);
 try{orderGraph(value.deliverables);}catch{fail('brief_dependency_cycle');}
 exact(value.dataPolicy,['allowUpload'],'brief_data_policy_invalid');if(typeof value.dataPolicy.allowUpload!=='boolean')fail('brief_data_policy_invalid');
 const brand=value.brand;
 if(brand!==null){
  exact(brand,['name','colors','fonts','appliesTo','referenceAssets'],'brief_brand_invalid');text(brand.name);identifiers(brand.appliesTo,ids);references(brand.referenceAssets);
  if(!Array.isArray(brand.colors) || brand.colors.some(c=>typeof c!=='string'||!/^#[0-9a-fA-F]{6}$/.test(c)) || !Array.isArray(brand.fonts))fail('brief_brand_invalid');brand.fonts.forEach(text);
 }
 if(!Array.isArray(value.subjects) || value.subjects.length>1000)fail('brief_subject_invalid');const subjects=new Set();
 for(const subject of value.subjects){exact(subject,['id','role','description','appliesTo','referenceAssets'],'brief_subject_invalid');['id','role','description'].forEach(k=>text(subject[k]));if(subjects.has(subject.id))fail('brief_subject_invalid');subjects.add(subject.id);identifiers(subject.appliesTo,ids);references(subject.referenceAssets);}
 if(!Array.isArray(value.ambiguities) || value.ambiguities.length>1000)fail('brief_ambiguity_invalid');const ambiguities=new Set();
 for(const item of value.ambiguities){exact(item,['id','question','affects'],'brief_ambiguity_invalid');text(item.id);text(item.question);identifiers(item.affects,ids);if(!item.affects.length || ambiguities.has(item.id))fail('brief_ambiguity_invalid');ambiguities.add(item.id);}
 return value;
}
/** 只提取当前节点的需求，避免全局 Brief 修订导致无关产物重建。 */
export function nodeBriefConstraints(value:any,nodeId:string):Record<string,any>{
 validateBrief(value);const deliverable=value.deliverables.find(item=>item.id===nodeId);if(!deliverable)fail('brief_deliverable_missing');
 const select=(component:any)=>Object.fromEntries(Object.entries(component).filter(([key])=>key!=='appliesTo'));
 return {deliverable,brand:value.brand?.appliesTo.includes(nodeId)?select(value.brand):null,subjects:value.subjects.filter(item=>item.appliesTo.includes(nodeId)).map(select)};
}
/** 仅由可信原生适配器生成；不从任务 payload 或缓存元数据读取。 */
export interface SourceInspection {schema:'craft-source-inspection/v1';pluginId:'filmcraft'|'effectcraft'|'photocraft'|'vectorcraft';nativeInspectionSha256:string;document:Record<string,any>;durationTicks?:string;nativeProjectSha256:string;nativeRuntimeSha256:string;}
/** 只延后可定位源工程或受支持元数据修改的原生检查，其他冲突仍拒绝。 */
export function pendingNativeAssessment(assessment:any,plan:any):boolean {
 if(assessment.state==='ready')return true;
 return assessment.blocked.length>0 && assessment.blocked.every((item:any)=>{
  if(item.reasons.every((reason:string)=>reason==='dependency_blocked'))return true;
  const node=plan.nodes.find((value:any)=>value.id===item.nodeId);
  const binding=node?.payload?.sourceProject;
  const resolvable=object(binding) && typeof binding.assetId==='string' && binding.assetId.length>0 && Object.keys(binding).length===1 && ((node.externalInputs??[]).some((input:any)=>input?.artifact?.assetId===binding.assetId && input.artifact.nativeProjectRef?.sha256===node.expectedRevision) || (node.inputBindings??[]).some((input:any)=>input.assetId===binding.assetId && node.dependsOn.includes(input.from)));
  const plugin=node?.runtimeIdentity?.pluginId;
  const source=resolvable && !Object.hasOwn(node.payload.plan??{},'document') && /^[a-f0-9]{64}$/.test(node.expectedRevision??'');
  const fresh=!binding && node?.expectedRevision===null && object(node.payload?.plan?.document) && Object.keys(node.payload.plan.document).length>0;
  return ['filmcraft','effectcraft','photocraft','vectorcraft'].includes(plugin) && (source || fresh) && item.reasons.every((reason:string)=>['source_inspection_required','duration_inspection_required','native_output_inspection_required'].includes(reason)) && (source || item.reasons.every((reason:string)=>reason==='native_output_inspection_required'));
 });
}
/** 这些公开命令可能改变交付元数据；最终值必须由保存后记录决定。 */
function changesMetadata(node:any):boolean {
 const commands:Record<string,string[]>={photocraft:['image.imageSize','image.canvasSize'],effectcraft:['comp.settings'],vectorcraft:['artboard.new','artboard.setProps'],filmcraft:[]};
 return (node.payload?.plan?.operations??[]).some((operation:any)=>commands[node.runtimeIdentity?.pluginId]?.includes(operation.command));
}
/** 新建非插入 placement 的精确边界；编辑和源工程不得用声明冒充检查。 */
function filmDurationTicks(node:any,inspection?:SourceInspection):bigint|null {
 const plan=node.payload?.plan;
 if(!Array.isArray(plan?.operations))return null;
 const source=Object.hasOwn(node.payload??{},'sourceProject');
 if(source ? !inspection : !object(plan?.document) || !Object.keys(plan.document).length)return null;
 const neutral=new Set(['asset.import','timeline.setTrack','timeline.select','captions.newTrack','captions.setStyle','caption.add','captions.setText','captions.delete','captions.setTrack']);
 let end=source ? BigInt(inspection!.durationTicks!) : 0n;
 for(const operation of plan.operations){
  if(!object(operation))return null;if(neutral.has(operation.command))continue;
  const params=operation.params;
  if(source || operation.command!=='timeline.place' || !object(params) || params.insert!==false)return null;
  if([params.time,params.duration].some(v=>typeof v!=='string' || v.length>19 || !/^(0|[1-9][0-9]*)$/.test(v)))return null;
  const start=BigInt(params.time),duration=BigInt(params.duration);
  if(duration<=0n || start+duration>9223372036854775807n)return null;
  if(start+duration>end)end=start+duration;
 }
 return end;
}
/** 按十进制需求数的有理表示比较，允许不足一个 tick 的浮点表示误差。 */
export function durationMatches(ticks:bigint,seconds:number,tolerance=1n):boolean {
 const [mantissa,exponent]=String(seconds).split('e'),parts=mantissa.split('.');
 const digits=BigInt(parts.join('')),power=Number(exponent??0)-(parts[1]?.length??0);
 const numerator=digits*(power>=0?10n**BigInt(power):1n),denominator=power<0?10n**BigInt(-power):1n;
 const difference=ticks*denominator-numerator*254016000000n;
 return ticks>0n && (difference<0n?-difference:difference)<=denominator*tolerance;
}
/** 检查声明计划并列出局部阻塞；文件真实性与原生输出仍由各自验收负责。 */
export function assessBrief(value:any,plan:any,inspections=new Map<string,SourceInspection>()):{schema:string;state:string;ready:string[];blocked:{nodeId:string;reasons:string[]}[];scope:string}{
 validateBrief(value);
 if(plan.ownerId!==value.ownerId || plan.authorizationRef!==value.authorizationRef)fail('brief_authorization_mismatch');
 if(plan.workflowId!==value.workflowId)fail('brief_workflow_mismatch');if(!isDeepStrictEqual(plan.budget,value.budget))fail('brief_budget_mismatch');
 if(!Array.isArray(plan.nodes) || !plan.nodes.length || plan.nodes.some(n=>!object(n)||typeof n.id!=='string') || new Set(plan.nodes.map(n=>n.id)).size!==plan.nodes.length)fail('brief_plan_invalid');
 if(value.deliverables.some(item=>!plan.nodes.some(node=>node.id===item.id)))fail('brief_plan_deliverable_missing');
 const available=new Set<string>();
 for(const node of plan.nodes){if(node.externalInputs!==undefined && !Array.isArray(node.externalInputs))fail('brief_plan_invalid');for(const source of node.externalInputs??[]){const ref=source?.artifact;if(!object(ref))fail('brief_plan_invalid');available.add(JSON.stringify([ref.assetId,ref.version,ref.sha256]));}}
 const problems=new Map<string,string[]>(plan.nodes.map(n=>[n.id,[]]));
 const style=(params:any,brand:any,reasons:string[])=>{
  if(Array.isArray(params)){params.forEach(p=>style(p,brand,reasons));return;}
  if(object(params))for(const [key,item] of Object.entries(params)){
   if(key==='font' && brand.fonts.length && typeof item==='string' && !brand.fonts.some(f=>f.toLowerCase()===item.toLowerCase()))reasons.push('brand_font_mismatch');
   if(key==='color' && brand.colors.length && typeof item==='string' && !brand.colors.some(c=>c.toLowerCase()===item.toLowerCase()))reasons.push('brand_color_mismatch');style(item,brand,reasons);
  }
 };
 for(const node of plan.nodes){
  const reasons=problems.get(node.id)!,item=value.deliverables.find(d=>d.id===node.id);
  if(!item){reasons.push('brief_deliverable_missing');continue;}
  if(!Object.hasOwn(formats,item.nativeFormat))reasons.push('capability_missing');else if((node.pluginId??node.runtimeIdentity?.pluginId)!==formats[item.nativeFormat])reasons.push('native_format_mismatch');
  if(!Array.isArray(node.dependsOn) || !isDeepStrictEqual([...node.dependsOn].sort(),[...item.dependsOn].sort()))reasons.push('brief_dependency_mismatch');
  if(item.execution==='cloud')reasons.push(value.dataPolicy.allowUpload?'cloud_executor_missing':'upload_forbidden');
  const inspection=inspections.get(node.id);
  if(inspection && (!Object.hasOwn(node.payload??{},'sourceProject') || inspection.nativeProjectSha256!==node.expectedRevision))fail('brief_source_inspection_binding_mismatch');
  const document=inspection?.document??node.payload?.plan?.document??{},metadataChanges=changesMetadata(node);
  const plugin=formats[item.nativeFormat];
  if(!['filmcraft','effectcraft'].includes(plugin) && (item.frameRate || Object.hasOwn(item,'durationSeconds')))reasons.push('capability_missing');
  if(metadataChanges)reasons.push('native_output_inspection_required');
  if(!object(document) || !Object.keys(document).length)reasons.push('source_inspection_required');else if(!metadataChanges && ['width','height'].some(k=>document[k]!==item[k]))reasons.push('document_size_mismatch');
  if(item.frameRate && !metadataChanges && object(document) && Object.keys(document).length){const rate=document.frameRate;const actual=object(rate)&&Number.isSafeInteger(rate.num)&&Number.isSafeInteger(rate.den)&&rate.den>0?rate.num/rate.den:rate;if(typeof actual!=='number' || !Number.isFinite(actual) || Math.abs(actual-item.frameRate.num/item.frameRate.den)>1e-9)reasons.push('frame_rate_mismatch');}
  if(Object.hasOwn(item,'durationSeconds') && !metadataChanges){
   if(formats[item.nativeFormat]==='filmcraft'){
    const duration=filmDurationTicks(node,inspection);
    if(duration===null)reasons.push('duration_inspection_required');else if(!durationMatches(duration,item.durationSeconds))reasons.push('duration_mismatch');
   }else if(document.duration!==item.durationSeconds)reasons.push('duration_inspection_required');
  }
  const constraints=nodeBriefConstraints(value,node.id);
  for(const component of [constraints.brand,...constraints.subjects])if(component && component.referenceAssets.some(r=>!available.has(JSON.stringify([r.assetId,r.version,r.sha256]))))reasons.push('reference_asset_missing_or_stale');
  if(constraints.brand)style(node.payload?.plan?.operations??[],constraints.brand,reasons);
  for(const ambiguity of value.ambiguities)if(ambiguity.affects.includes(node.id))reasons.push('ambiguity:'+ambiguity.id);
 }
 let changed=true;while(changed){changed=false;for(const node of plan.nodes)if(!problems.get(node.id)!.length && (node.dependsOn??[]).some(id=>!problems.has(id)||problems.get(id)!.length)){problems.get(node.id)!.push('dependency_blocked');changed=true;}}
 const blocked=plan.nodes.filter(n=>problems.get(n.id)!.length).map(n=>({nodeId:n.id,reasons:[...new Set(problems.get(n.id)!)].sort()}));
 return {schema:'craft-brief-assessment/v1',state:blocked.length?'blocked':'ready',ready:plan.nodes.filter(n=>!problems.get(n.id)!.length).map(n=>n.id),blocked,scope:'declared plan constraints only; native output, reference bytes and creative observations require their own verification'};
}
