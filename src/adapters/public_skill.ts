/** 通过独立技能的公开 CLI 交接，禁止导入技能内部 Python 模块。 */
import { readFile, writeFile, mkdir, stat, realpath } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { strictMcpRunner } from './strict_mcp_runner.ts';
import { domainFontDependencies } from './font_dependencies.ts';
import { collectedDependencies } from './collected_dependencies.ts';
import { parseEffectExportProbe } from './effect_export_probe.ts';
import { parseDesignSourceInspection } from './design_source_inspection.ts';
import { filmExportMetadata } from './film_export_metadata.ts';
import { parseFilmSourceInspection } from './film_source_inspection.ts';
import { imageSequenceMime, inspectImageSequence, sequenceMetadata } from '../protocol/image_sequence.ts';
import { verifyArtifact, verifySourceRevision, validateExchangeLossReport } from '../protocol/contracts.ts';
import { inspectPng } from '../protocol/png_inspection.ts';
import { inspectJpeg } from '../protocol/jpeg_inspection.ts';
import type { AdapterFactory, ArtifactInput } from '../planning/workflow_engine.ts';

export interface PublicSkillConfig {
 pluginId:'filmcraft'|'effectcraft'|'photocraft'|'vectorcraft';
 skillRoot:string;python:string;pythonSha256:string;nativeExecutable:string;runtimeHome:string;
 files:{path:string;sha256:string}[];outputRoot:string;
}
const executeNative=promisify(execFile);
const projects={filmcraft:'project.fcproj',effectcraft:'project.ecproj',photocraft:'project.pcraft',vectorcraft:'project.vectorcraft'};
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const safeLocation=(value:string)=>typeof value==='string' && value.length>0 && !isAbsolute(value) && !/[\\:\x00]/.test(value) && !value.split('/').some(part=>['','..','.'].includes(part));

/** 配置来自发布锁和安装器，不允许从模型 payload 选择脚本、解释器或输出根。 */
export function publicSkillFactory(config:PublicSkillConfig):AdapterFactory {
 const locked=structuredClone(config);
 if(!Object.hasOwn(projects,locked.pluginId) || ![locked.skillRoot,locked.python,locked.nativeExecutable,locked.runtimeHome,locked.outputRoot].every(isAbsolute))throw new Error('skill_config_invalid');
 const script=join(locked.skillRoot,'scripts','workflow.py');
 for(const name of ['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py']){
  if(!locked.files.some(file=>file.path===join(locked.skillRoot,'scripts',name)))throw new Error('skill_lock_incomplete');
 }
 const factory:AdapterFactory=async(nodeValue,inputValues,taskId)=>{
  const node=structuredClone(nodeValue),inputs=structuredClone(inputValues);
  if(node.runtimeIdentity.pluginId!==locked.pluginId)throw new Error('skill_plugin_mismatch');
  // DAG 领域工作流仅提供 headless 启动；bridge 必须使用显式会话入口，不能降级执行。
  if(node.runtimeIdentity.mode==='bridge')throw new Error('capability_missing: '+locked.pluginId+' bridge workflow');
  const payload=node.payload;
  if(payload.schemaVersion!=='craft-skill-workflow/v1' || Object.keys(payload).some(key=>!['schemaVersion','plan','assetBindings','outputs','sourceProject'].includes(key)) || !payload.plan || typeof payload.plan!=='object' || Array.isArray(payload.plan) || 'assets' in payload.plan)throw new Error('skill_payload_invalid');
  if(!Array.isArray(payload.assetBindings) || !Array.isArray(payload.outputs) || !payload.outputs.length)throw new Error('skill_payload_invalid');
  // 源工程只从登记输入解析，不能由 payload 提供本机路径。
  let source:ArtifactInput|undefined;
  const plan=structuredClone(payload.plan);
  if(payload.sourceProject!==undefined){
   const binding=payload.sourceProject;
   if(!binding || typeof binding!=='object' || Array.isArray(binding) || Object.keys(binding).some(key=>key!=='assetId') || typeof binding.assetId!=='string')throw new Error('skill_source_binding_invalid');
   const matches=inputs.filter(input=>input.artifact.assetId===binding.assetId);
   if(matches.length!==1)throw new Error('skill_source_missing');
   source=matches[0];
   if(node.expectedRevision===null || !/^[a-f0-9]{64}$/.test(node.expectedRevision))throw new Error('skill_source_revision_mismatch');
   if('document' in plan || ('expectedProjectSha256' in plan && plan.expectedProjectSha256!==node.expectedRevision))throw new Error('skill_source_plan_invalid');
   plan.expectedProjectSha256=node.expectedRevision;
  }else if(node.expectedRevision!==null || 'expectedProjectSha256' in plan)throw new Error('skill_source_missing');
  if(Array.isArray(plan.operations) && plan.operations.some((step:any)=>step.command==='native.command')){
   for(const name of ['scripts/native_workflow.py','scripts/commands.py','references/command-coverage.json']){
    if(!locked.files.some(file=>file.path===join(locked.skillRoot,name)))throw new Error('native_workflow_lock_incomplete');
   }
  }
  const sourceFiles:{path:string;sha256:string}[]=[];
  let sourceManifest:any;
  const checkSource=async()=>{
   if(!source)return;
   const native=source.artifact.nativeProjectRef;
   if(!native || native.location!==projects[locked.pluginId] || native.sha256!==node.expectedRevision)throw new Error('skill_source_revision_mismatch');
   await verifySourceRevision(source.artifact,source.root,node.expectedRevision!);
   await verifyArtifact(source.artifact,source.root);
   const evidence=source.artifact.evidenceRefs.filter((item:{location:string})=>item.location==='manifest.json');
   if(evidence.length!==1)throw new Error('skill_source_manifest_missing');
   const bytes=await readFile(join(source.root,'manifest.json'));
   if(hash(bytes)!==evidence[0].sha256)throw new Error('skill_source_manifest_mismatch');
   const manifest=JSON.parse(bytes.toString());
   if(manifest.schema!==locked.pluginId+'-delivery/v1' || manifest.runtimeSha256!==node.runtimeIdentity.sha256 || !manifest.files || typeof manifest.files!=='object' || Array.isArray(manifest.files) || manifest.files[projects[locked.pluginId]]!==node.expectedRevision)throw new Error('skill_source_manifest_invalid');
   sourceManifest=manifest;
   const checked=[{path:join(source.root,'manifest.json'),sha256:hash(bytes)}];
   for(const [location,digest] of Object.entries(manifest.files)){
    if(!safeLocation(location) || typeof digest!=='string' || !/^[a-f0-9]{64}$/.test(digest))throw new Error('skill_source_manifest_invalid');
    // 公共文件核验包含真实路径 containment，外逃符号链接同样拒绝。
    await verifyArtifact({...source.artifact,location,sha256:digest,version:digest,bytes:(await stat(join(source.root,location))).size,mediaType:'application/octet-stream',nativeProjectRef:null,dependencies:[],evidenceRefs:[],renditions:[],lossReportRef:null},source.root);
    checked.push({path:join(source.root,location),sha256:digest});
   }
   if(sourceFiles.length && JSON.stringify(sourceFiles)!==JSON.stringify(checked))throw new Error('skill_source_manifest_mismatch');
   sourceFiles.splice(0,sourceFiles.length,...checked);
  };
  await checkSource();
  const names=new Set<string>();
  const assets:{name:string;input:ArtifactInput;retained:boolean;kind?:'lut'}[]=[];
  for(const binding of payload.assetBindings){
   if(Object.keys(binding).some(key=>!['name','assetId','retained','kind'].includes(key)) || (binding.retained!==undefined && typeof binding.retained!=='boolean') || (binding.kind!==undefined && binding.kind!=='lut') || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(binding.name) || names.has(binding.name))throw new Error('skill_asset_binding_invalid');
   names.add(binding.name);
   const matches=inputs.filter(input=>input.artifact.assetId===binding.assetId);
   if(matches.length!==1)throw new Error('skill_asset_missing');
   if(matches[0]===source)throw new Error('skill_source_bound_as_media');
   if(binding.kind==='lut'){
    if(locked.pluginId!=='filmcraft')throw new Error('skill_lut_domain_unsupported');
    if(!/\.(cube|3dl)$/i.test(matches[0].artifact.location) || matches[0].artifact.mediaType===imageSequenceMime)throw new Error('skill_lut_format_unsupported');
   }
   if(matches[0].artifact.mediaType===imageSequenceMime && locked.pluginId!=='filmcraft')throw new Error('skill_sequence_domain_unsupported');
   await verifyArtifact(matches[0].artifact,matches[0].root);assets.push({name:binding.name,input:matches[0],retained:binding.retained===true,...(binding.kind==='lut'?{kind:'lut' as const}:{})});
  }
  // 保留绑定仍消费真实上游输入；必须与原工程已收集的同名素材一致。
  const checkRetained=async()=>{
   for(const asset of assets.filter(item=>item.retained)){
    const prior=sourceManifest?.assets?.[asset.name];
    if(!source || !prior || !safeLocation(prior.path) || prior.sha256!==asset.input.artifact.sha256 || sourceManifest.files[prior.path]!==prior.sha256 || (asset.kind==='lut' && prior.kind!=='lut'))throw new Error('skill_retained_asset_mismatch');
    await verifyArtifact(asset.input.artifact,asset.input.root);
   }
  };
  await checkRetained();
  // 每个声明输入须实际交接给领域端，不能制造未消费的血缘。
  if(assets.length+(source?1:0)!==inputs.length || new Set(assets.map(item=>item.input)).size!==assets.length)throw new Error('skill_input_unbound');
  for(const output of payload.outputs){
   if(Object.keys(output).some(key=>!['assetId','location','mediaType'].includes(key)) || !safeLocation(output.location) || typeof output.assetId!=='string' || !output.assetId || typeof output.mediaType!=='string')throw new Error('skill_output_invalid');
  }
  if(new Set(payload.outputs.map((item:{assetId:string})=>item.assetId)).size!==payload.outputs.length)throw new Error('skill_output_duplicate');
  if(!locked.files.some(file=>file.path===join(locked.skillRoot,'references/native-command-snapshot.json')))throw new Error('capability_missing: native_tool_schema snapshot unlocked');
  if(await readFile(locked.python).then(hash)!==locked.pythonSha256)throw new Error('launcher_identity_mismatch');
  for(const file of locked.files){
   if(!isAbsolute(file.path) || await readFile(file.path).then(hash)!==file.sha256)throw new Error('launcher_file_identity_mismatch');
  }
  const root=join(locked.outputRoot,hash(taskId)),delivery=join(root,'delivery'),planFile=join(root,'plan.json');
  await mkdir(root,{recursive:true});
  await writeFile(planFile,JSON.stringify(plan),'utf8');
  const strictRunner=join(root,'strict-mcp-runner.py');
  await writeFile(strictRunner,strictMcpRunner,'utf8');
  const args=['-I','-B',strictRunner,join(locked.skillRoot,'scripts/mcp_session.py'),script,planFile,'--output',delivery,'--runtime-home',locked.runtimeHome];
  for(const asset of assets.filter(item=>!item.retained)){
   const segmented=asset.input.artifact.mediaType===imageSequenceMime && /(^|\/)segments\.json$/.test(asset.input.artifact.location);
   // 已登记输入仍由 prepare 再核验；规范化系统临时目录别名，保留段内反符号链接检查。
   const sourcePath=join(asset.input.root,asset.input.artifact.location);
   args.push(asset.kind==='lut'?'--lut-asset':asset.input.artifact.mediaType===imageSequenceMime?(segmented?'--segmented-sequence-asset':'--sequence-asset'):'--asset',asset.name+'='+(segmented?await realpath(sourcePath):sourcePath));
  }
  if(source)args.push('--source',source.root);
  const ref=(location:string,sha256:string)=>({assetId:taskId+'-'+hash(location).slice(0,16),version:sha256,sha256,location});
  const artifact=async(location:string,sha256:string,mediaType:string,assetId:string)=>({
   protocolVersion:'craft-artifact/v1',assetId,version:sha256,sha256,bytes:(await stat(join(delivery,location))).size,mediaType,producerTaskId:taskId,sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location
  });
  return {root:delivery,adapter:{
   ...(source ? {inspectSource:async()=>{
    await checkSource();
    if(hash(await readFile(locked.nativeExecutable))!==node.runtimeIdentity.sha256)throw new Error('brief_source_runtime_identity_mismatch');
    const project=join(source!.root,projects[locked.pluginId]);
    const args=locked.pluginId==='filmcraft' ? ['--project',project,'inspect'] : locked.pluginId==='effectcraft' ? ['--project',project,'run','comp.info',JSON.stringify({comp:sourceManifest?.bindings?.composition?.comp}),'--json'] : ['info',project];
    const inspected=await executeNative(locked.nativeExecutable,args,{timeout:30000,maxBuffer:8*1024*1024,encoding:'utf8'}).catch(()=>{throw new Error('brief_source_inspection_failed');});
    const primary=locked.pluginId==='vectorcraft' && plan.operations?.some((operation:any)=>operation.command==='artboard.new') ? source!.artifact.location : payload.outputs[0].location;
    const board=/^artboard-([1-9][0-9]*)\.(png|svg|pdf)$/.exec(primary);
    const inspection=locked.pluginId==='filmcraft' ? parseFilmSourceInspection(inspected.stdout,node.expectedRevision!,node.runtimeIdentity.sha256) : parseDesignSourceInspection(locked.pluginId,inspected.stdout,node.expectedRevision!,node.runtimeIdentity.sha256,{artboard:board ? Number(board[1])-1 : undefined,composition:sourceManifest?.bindings?.composition?.comp});
    await checkSource();
    if(hash(await readFile(locked.nativeExecutable))!==node.runtimeIdentity.sha256)throw new Error('brief_source_runtime_identity_mismatch');
    return inspection;
   }} : {}),
   prepare:async(request)=>{
    if(request.runtimeIdentity.pluginId!==locked.pluginId)throw new Error('skill_plugin_mismatch');
    if(request.expectedRevision!==node.expectedRevision)throw new Error('skill_source_revision_mismatch');
    await checkSource();
    await checkRetained();
    for(const asset of assets)await verifyArtifact(asset.input.artifact,asset.input.root);
    const launchArgs=[...args];
    // 长导出只能使用本次已验证任务的截止时间，不由领域计划或环境扩大。
    if(locked.pluginId==='filmcraft' && typeof request.deadline==='string')launchArgs.push('--art-native-budget='+JSON.stringify({executable:locked.nativeExecutable,sha256:request.runtimeIdentity.sha256,deadline:request.deadline}));
    return {executable:locked.python,args:launchArgs,cwd:root,actualRevision:source?node.expectedRevision:null,budgetUsage:{minorUnits:0,externalCalls:0},launcherIdentity:{runtimeExecutable:locked.nativeExecutable,sha256:locked.pythonSha256,files:[...locked.files,...sourceFiles,{path:strictRunner,sha256:hash(strictMcpRunner)},{path:planFile,sha256:hash(JSON.stringify(plan))}]}};
   },
   verify:async(request)=>{
    await checkSource();
    await checkRetained();
    const manifestBytes=await readFile(join(delivery,'manifest.json'));
    const manifest=JSON.parse(manifestBytes.toString());
    if(manifest.schema!==locked.pluginId+'-delivery/v1' || manifest.runtimeSha256!==request.runtimeIdentity.sha256 || !manifest.files || typeof manifest.files!=='object')throw new Error('skill_manifest_invalid');
    for(const [location,digest] of Object.entries(manifest.files)){
     if(!safeLocation(location) || typeof digest!=='string')throw new Error('skill_manifest_invalid');
     await verifyArtifact(await artifact(location,digest,'application/octet-stream',taskId),delivery);
    }
    if(source && manifest.sourceProjectSha256!==node.expectedRevision)throw new Error('skill_source_revision_mismatch');
    const dependencyRefs:ReturnType<typeof ref>[]=[];
    const sequenceRefs=async(location:string,digest:string)=>{
     const descriptor=await inspectImageSequence(delivery,location,digest);
     const prefix=location.replace(/[^/]+$/,'');
     for(const child of descriptor.segmentManifestRefs??[]){
      const path=prefix+child.location;
      if(manifest.files[path]!==child.sha256)throw new Error('skill_sequence_manifest_mismatch');
      dependencyRefs.push(ref(path,child.sha256));
     }
     for(const frame of descriptor.frames){
      const path=prefix+frame.location;
      if(manifest.files[path]!==frame.sha256)throw new Error('skill_sequence_manifest_mismatch');
      dependencyRefs.push(ref(path,frame.sha256));
     }
     return descriptor;
    };
    const boundDependencies:any[]=[];
    for(const asset of assets){
     // 原生素材替换归入原别名；只接受计划显式声明的替换映射。
     const replacements=['effectcraft','vectorcraft'].includes(locked.pluginId)?(plan.operations??[]).filter((operation:any)=>operation.command==='asset.replace' && operation.params?.replacement===asset.name):[];
     if(replacements.length>1)throw new Error('skill_dependency_uncollected');
     const alias=replacements.length?replacements[0].params.asset:asset.name;
     const collected=manifest.assets?.[alias];
     const segmented=asset.input.artifact.mediaType===imageSequenceMime && /(^|\/)segments\.json$/.test(asset.input.artifact.location);
     if(!collected || (segmented?collected.sourceSequenceSha256:collected.sha256)!==asset.input.artifact.sha256 || !safeLocation(collected.path))throw new Error('skill_dependency_uncollected');
     if(segmented){
      const normalized=await inspectImageSequence(delivery,collected.path,collected.sha256);
      if(normalized.schema!=='filmcraft-collected-sequence/v1'||normalized.sourceSequenceSha256!==asset.input.artifact.sha256)throw new Error('skill_sequence_manifest_mismatch');
     }
     await verifyArtifact(await artifact(collected.path,collected.sha256,'application/octet-stream',taskId),delivery);
     if(asset.kind==='lut' && collected.kind!=='lut')throw new Error('skill_dependency_uncollected');
     if(asset.input.artifact.mediaType===imageSequenceMime && collected.kind!=='image-sequence')throw new Error('skill_sequence_manifest_mismatch');
     boundDependencies.push({alias,artifact:asset.input.artifact,kind:asset.kind});
    }
    // 继承的媒体也须收集并核验，局部修改不能丢失旧工程依赖。
    for(const collected of Object.values(manifest.assets??{}) as {path:string;sha256:string;kind?:string}[]){
     if(!collected || !safeLocation(collected.path) || manifest.files[collected.path]!==collected.sha256)throw new Error('skill_dependency_uncollected');
     dependencyRefs.push(ref(collected.path,collected.sha256));
     if(collected.kind==='image-sequence')await sequenceRefs(collected.path,collected.sha256);
    }
    const assetDependencies=collectedDependencies(manifest,boundDependencies,source?.artifact,sourceManifest,JSON.stringify([locked.pluginId,node.projectKey]));
    // 公共依赖身份与同身份 evidenceRef 关联，沿用现有协议字段并核验包内实际字节。
    dependencyRefs.push(...assetDependencies.map(dependency=>dependency.assetRef));
    const nativeLocation=projects[locked.pluginId];
    if(!manifest.files[nativeLocation])throw new Error('skill_native_missing');
    const nativeRef=ref(nativeLocation,manifest.files[nativeLocation]),manifestRef=ref('manifest.json',hash(manifestBytes));
    if(manifest.lossReport?.path!=='exchange-loss.json' || manifest.lossReport.sha256!==manifest.files['exchange-loss.json'])throw new Error('skill_loss_report_missing');
    const lossRef=ref('exchange-loss.json',manifest.lossReport.sha256);
    const report=validateExchangeLossReport(JSON.parse(await readFile(join(delivery,lossRef.location),'utf8')));
    if(report.pluginId!==locked.pluginId || report.native.sha256!==nativeRef.sha256 || report.outputs.some((item:any)=>manifest.files[item.location]!==item.sha256))throw new Error('skill_loss_report_binding_mismatch');
    const fontDependencies:any[]=[];
    {
     // Film／Effect 的简化检查会丢失字体样式；直接检查已核验的原生 JSON 全工程。
     const location=['filmcraft','effectcraft'].includes(locked.pluginId)?nativeLocation:'native.json';
     if(!manifest.files[location])throw new Error('font_inspection_missing');
     if((await stat(join(delivery,location))).size>16*1024*1024)throw new Error('font_inspection_invalid');
     const bytes=await readFile(join(delivery,location));
     if(bytes.length>16*1024*1024 || hash(bytes)!==manifest.files[location])throw new Error('font_inspection_invalid');
     const inspectionRef=ref(location,manifest.files[location]);
     let inspection:any;try{inspection=JSON.parse(bytes.toString('utf8'));}catch{throw new Error('font_inspection_invalid');}
     fontDependencies.push(...domainFontDependencies(locked.pluginId,inspection,nativeRef.sha256,inspectionRef));
     if(fontDependencies.length)dependencyRefs.push(inspectionRef);
    }
    const sourceRefs=inputs.map(input=>({assetId:input.artifact.assetId,version:input.artifact.version,sha256:input.artifact.sha256}));
    const outputs=[];
    for(const item of payload.outputs){
     if(!manifest.files[item.location])throw new Error('skill_output_missing');
     if(manifest.imageSequence?.path===item.location && item.mediaType!==imageSequenceMime)throw new Error('skill_sequence_output_mismatch');
     const output=await artifact(item.location,manifest.files[item.location],item.mediaType,item.assetId);
     let technicalMetadata={};
     const technicalEvidence:ReturnType<typeof ref>[]=[];
     // 图片属性来自摘要绑定的编码内容；不从扩展名、工程尺寸或未知 ICC 推断。
     if(item.mediaType==='image/png')technicalMetadata=await inspectPng(join(delivery,item.location),output.bytes,false,output.sha256);
     if(item.mediaType==='image/jpeg')technicalMetadata=await inspectJpeg(join(delivery,item.location),output.bytes,output.sha256);
     if(locked.pluginId==='filmcraft' && item.mediaType==='video/mp4'){
      if(!manifest.files['native.json'] || !manifest.files['export-probe.json'])throw new Error('film_export_metadata_missing');
      technicalMetadata=filmExportMetadata(await readFile(join(delivery,'native.json'),'utf8'),await readFile(join(delivery,'export-probe.json'),'utf8'),item.location,output.bytes);
      for(const location of ['native.json','export-probe.json'])technicalEvidence.push(ref(location,manifest.files[location]));
     }
     if(item.mediaType===imageSequenceMime){
      if(locked.pluginId!=='effectcraft' || manifest.imageSequence?.path!==item.location || manifest.imageSequence?.sha256!==output.sha256)throw new Error('skill_sequence_output_mismatch');
      technicalMetadata=sequenceMetadata(await sequenceRefs(item.location,output.sha256));
     }
     const publicOutput={...output,technicalMetadata,sourceRefs,nativeProjectRef:nativeRef,lossReportRef:lossRef,evidenceRefs:[manifestRef,...dependencyRefs,...technicalEvidence],dependencies:[...fontDependencies,...assetDependencies.map(dependency=>{const {location,...assetRef}=dependency.assetRef;return {...dependency,assetRef};})]};
     await verifyArtifact(publicOutput,delivery);outputs.push(publicOutput);
    }
    return {root:delivery,outputs,evidenceRefs:[manifestRef]};
   }
  }};
 };

 factory.verifyBriefExport=async(node,root,outputs,brief)=>{
  if(locked.pluginId!=='effectcraft')return;
  if(node.runtimeIdentity.pluginId!==locked.pluginId)throw new Error('skill_plugin_mismatch');
  for(const output of outputs.filter(item=>item.mediaType===imageSequenceMime)){
   await verifyArtifact(output,root);const facts=output.technicalMetadata;
   if(facts.width!==brief.width || facts.height!==brief.height)throw new Error('brief_export_size_mismatch');
   if(brief.frameRate && BigInt(facts.frameRate.num)*BigInt(brief.frameRate.den)!==BigInt(brief.frameRate.num)*BigInt(facts.frameRate.den))throw new Error('brief_export_frame_rate_mismatch');
   if(Object.hasOwn(brief,'durationSeconds') && Math.abs(Number(facts.durationTicks)*facts.timeBase.num/facts.timeBase.den-brief.durationSeconds)>facts.frameRate.den/facts.frameRate.num+1e-9)throw new Error('brief_export_duration_mismatch');
  }
  for(const output of outputs.filter(item=>item.mediaType==='video/mp4')){
   await verifyArtifact(output,root);
   if(hash(await readFile(locked.nativeExecutable))!==node.runtimeIdentity.sha256)throw new Error('brief_source_runtime_identity_mismatch');
   // 空内存工程仅导入已核验视频、查询元数据；不打开或保存任何创作工程。
   const result=await executeNative(locked.nativeExecutable,['--empty','run','file.import',JSON.stringify({paths:[join(root,output.location)]}),'project.summary','{}','file.interpretFootage','{"items":[1]}','--json'],{timeout:30000,maxBuffer:8*1024*1024,encoding:'utf8'}).catch(()=>{throw new Error('brief_export_probe_failed');});
   const probe=parseEffectExportProbe(result.stdout);
   if(probe.width!==brief.width || probe.height!==brief.height)throw new Error('brief_export_size_mismatch');
   if(brief.frameRate && Math.abs(probe.frameRate-brief.frameRate.num/brief.frameRate.den)>1e-9)throw new Error('brief_export_frame_rate_mismatch');
   if(Object.hasOwn(brief,'durationSeconds') && Math.abs(probe.duration-brief.durationSeconds)>1/probe.frameRate+1e-9)throw new Error('brief_export_duration_mismatch');
   await verifyArtifact(output,root);
   if(hash(await readFile(locked.nativeExecutable))!==node.runtimeIdentity.sha256)throw new Error('brief_source_runtime_identity_mismatch');
  }
 };
 return factory;
}
