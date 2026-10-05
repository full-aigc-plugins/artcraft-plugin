/** 通过独立技能的公开 CLI 交接，禁止导入技能内部 Python 模块。 */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyArtifact } from '../protocol/contracts.ts';
import type { AdapterFactory, ArtifactInput } from '../planning/workflow_engine.ts';

export interface PublicSkillConfig {
 pluginId:'filmcraft'|'effectcraft'|'photocraft'|'vectorcraft';
 skillRoot:string;python:string;pythonSha256:string;nativeExecutable:string;runtimeHome:string;
 files:{path:string;sha256:string}[];outputRoot:string;
}
const projects={filmcraft:'project.fcproj',effectcraft:'project.ecproj',photocraft:'project.pcraft',vectorcraft:'project.vectorcraft'};
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const safeLocation=(value:string)=>typeof value==='string' && value.length>0 && !isAbsolute(value) && !/[\\:\x00]/.test(value) && !value.split('/').some(part=>['','..','.'].includes(part));

/** 配置来自发布锁和安装器，不允许从模型 payload 选择脚本、解释器或输出根。 */
export function publicSkillFactory(config:PublicSkillConfig):AdapterFactory {
 const locked=structuredClone(config);
 if(!Object.hasOwn(projects,locked.pluginId) || ![locked.skillRoot,locked.python,locked.nativeExecutable,locked.runtimeHome,locked.outputRoot].every(isAbsolute))throw new Error('skill_config_invalid');
 const script=join(locked.skillRoot,'scripts','workflow.py');
 for(const name of ['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json']){
  if(!locked.files.some(file=>file.path===join(locked.skillRoot,'scripts',name)))throw new Error('skill_lock_incomplete');
 }
 return async(nodeValue,inputValues,taskId)=>{
  const node=structuredClone(nodeValue),inputs=structuredClone(inputValues);
  if(node.runtimeIdentity.pluginId!==locked.pluginId)throw new Error('skill_plugin_mismatch');
  const payload=node.payload;
  if(payload.schemaVersion!=='craft-skill-workflow/v1' || Object.keys(payload).some(key=>!['schemaVersion','plan','assetBindings','outputs','sourceProject'].includes(key)) || !payload.plan || typeof payload.plan!=='object' || Array.isArray(payload.plan) || 'assets' in payload.plan)throw new Error('skill_payload_invalid');
  if(!Array.isArray(payload.assetBindings) || !Array.isArray(payload.outputs) || !payload.outputs.length)throw new Error('skill_payload_invalid');
  if(locked.pluginId==='vectorcraft' && payload.assetBindings.length)throw new Error('skill_assets_unsupported');
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
  const sourceFiles:{path:string;sha256:string}[]=[];
  const checkSource=async()=>{
   if(!source)return;
   await verifyArtifact(source.artifact,source.root);
   const native=source.artifact.nativeProjectRef;
   if(!native || native.location!==projects[locked.pluginId] || native.sha256!==node.expectedRevision)throw new Error('skill_source_revision_mismatch');
   const evidence=source.artifact.evidenceRefs.filter((item:{location:string})=>item.location==='manifest.json');
   if(evidence.length!==1)throw new Error('skill_source_manifest_missing');
   const bytes=await readFile(join(source.root,'manifest.json'));
   if(hash(bytes)!==evidence[0].sha256)throw new Error('skill_source_manifest_mismatch');
   const manifest=JSON.parse(bytes.toString());
   if(manifest.schema!==locked.pluginId+'-delivery/v1' || manifest.runtimeSha256!==node.runtimeIdentity.sha256 || !manifest.files || typeof manifest.files!=='object' || Array.isArray(manifest.files) || manifest.files[projects[locked.pluginId]]!==node.expectedRevision)throw new Error('skill_source_manifest_invalid');
   const checked=[{path:join(source.root,'manifest.json'),sha256:hash(bytes)}];
   for(const [location,digest] of Object.entries(manifest.files)){
    if(!safeLocation(location) || typeof digest!=='string' || !/^[a-f0-9]{64}$/.test(digest))throw new Error('skill_source_manifest_invalid');
    // 公共文件核验包含真实路径 containment，外逃符号链接同样拒绝。
    await verifyArtifact({...source.artifact,location,sha256:digest,version:digest,bytes:(await stat(join(source.root,location))).size,mediaType:'application/octet-stream',nativeProjectRef:null,evidenceRefs:[],renditions:[],lossReportRef:null},source.root);
    checked.push({path:join(source.root,location),sha256:digest});
   }
   if(sourceFiles.length && JSON.stringify(sourceFiles)!==JSON.stringify(checked))throw new Error('skill_source_manifest_mismatch');
   sourceFiles.splice(0,sourceFiles.length,...checked);
  };
  await checkSource();
  const names=new Set<string>();
  const assets:{name:string;input:ArtifactInput}[]=[];
  for(const binding of payload.assetBindings){
   if(Object.keys(binding).some(key=>!['name','assetId'].includes(key)) || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(binding.name) || names.has(binding.name))throw new Error('skill_asset_binding_invalid');
   names.add(binding.name);
   const matches=inputs.filter(input=>input.artifact.assetId===binding.assetId);
   if(matches.length!==1)throw new Error('skill_asset_missing');
   if(matches[0]===source)throw new Error('skill_source_bound_as_media');
   await verifyArtifact(matches[0].artifact,matches[0].root);assets.push({name:binding.name,input:matches[0]});
  }
  // 每个声明输入须实际交接给领域端，不能制造未消费的血缘。
  if(assets.length+(source?1:0)!==inputs.length || new Set(assets.map(item=>item.input)).size!==assets.length)throw new Error('skill_input_unbound');
  for(const output of payload.outputs){
   if(Object.keys(output).some(key=>!['assetId','location','mediaType'].includes(key)) || !safeLocation(output.location) || typeof output.assetId!=='string' || !output.assetId || typeof output.mediaType!=='string')throw new Error('skill_output_invalid');
  }
  if(new Set(payload.outputs.map((item:{assetId:string})=>item.assetId)).size!==payload.outputs.length)throw new Error('skill_output_duplicate');
  if(await readFile(locked.python).then(hash)!==locked.pythonSha256)throw new Error('launcher_identity_mismatch');
  for(const file of locked.files){
   if(!isAbsolute(file.path) || await readFile(file.path).then(hash)!==file.sha256)throw new Error('launcher_file_identity_mismatch');
  }
  const root=join(locked.outputRoot,hash(taskId)),delivery=join(root,'delivery'),planFile=join(root,'plan.json');
  await mkdir(root,{recursive:true});
  await writeFile(planFile,JSON.stringify(plan),'utf8');
  const args=['-I','-B',script,planFile,'--output',delivery,'--runtime-home',locked.runtimeHome];
  for(const asset of assets)args.push('--asset',asset.name+'='+join(asset.input.root,asset.input.artifact.location));
  if(source)args.push('--source',source.root);
  const ref=(location:string,sha256:string)=>({assetId:taskId+'-'+hash(location).slice(0,16),version:sha256,sha256,location});
  const artifact=async(location:string,sha256:string,mediaType:string,assetId:string)=>({
   protocolVersion:'craft-artifact/v1',assetId,version:sha256,sha256,bytes:(await stat(join(delivery,location))).size,mediaType,producerTaskId:taskId,sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location
  });
  return {root:delivery,adapter:{
   prepare:async(request)=>{
    if(request.runtimeIdentity.pluginId!==locked.pluginId)throw new Error('skill_plugin_mismatch');
    if(request.expectedRevision!==node.expectedRevision)throw new Error('skill_source_revision_mismatch');
    await checkSource();
    return {executable:locked.python,args,cwd:root,actualRevision:source?node.expectedRevision:null,budgetUsage:{minorUnits:0,externalCalls:0},launcherIdentity:{runtimeExecutable:locked.nativeExecutable,sha256:locked.pythonSha256,files:[...locked.files,...sourceFiles,{path:planFile,sha256:hash(JSON.stringify(plan))}]}};
   },
   verify:async(request)=>{
    await checkSource();
    const manifestBytes=await readFile(join(delivery,'manifest.json'));
    const manifest=JSON.parse(manifestBytes.toString());
    if(manifest.schema!==locked.pluginId+'-delivery/v1' || manifest.runtimeSha256!==request.runtimeIdentity.sha256 || !manifest.files || typeof manifest.files!=='object')throw new Error('skill_manifest_invalid');
    for(const [location,digest] of Object.entries(manifest.files)){
     if(!safeLocation(location) || typeof digest!=='string')throw new Error('skill_manifest_invalid');
     await verifyArtifact(await artifact(location,digest,'application/octet-stream',taskId),delivery);
    }
    if(source && manifest.sourceProjectSha256!==node.expectedRevision)throw new Error('skill_source_revision_mismatch');
    const dependencyRefs=[];
    for(const asset of assets){
     // EffectCraft 替换会把新素材归入原别名；只接受计划显式声明的替换映射。
     const replacements=locked.pluginId==='effectcraft'?(plan.operations??[]).filter((operation:any)=>operation.command==='asset.replace' && operation.params?.replacement===asset.name):[];
     if(replacements.length>1)throw new Error('skill_dependency_uncollected');
     const alias=replacements.length?replacements[0].params.asset:asset.name;
     const collected=manifest.assets?.[alias];
     if(!collected || collected.sha256!==asset.input.artifact.sha256 || !safeLocation(collected.path))throw new Error('skill_dependency_uncollected');
     await verifyArtifact(await artifact(collected.path,collected.sha256,'application/octet-stream',taskId),delivery);

    }
    // 继承的媒体也须收集并核验，局部修改不能丢失旧工程依赖。
    for(const collected of Object.values(manifest.assets??{}) as {path:string;sha256:string}[]){
     if(!collected || !safeLocation(collected.path) || manifest.files[collected.path]!==collected.sha256)throw new Error('skill_dependency_uncollected');
     dependencyRefs.push(ref(collected.path,collected.sha256));
    }
    const nativeLocation=projects[locked.pluginId];
    if(!manifest.files[nativeLocation])throw new Error('skill_native_missing');
    const nativeRef=ref(nativeLocation,manifest.files[nativeLocation]),manifestRef=ref('manifest.json',hash(manifestBytes));
    const sourceRefs=inputs.map(input=>({assetId:input.artifact.assetId,version:input.artifact.version,sha256:input.artifact.sha256}));
    const outputs=[];
    for(const item of payload.outputs){
     if(!manifest.files[item.location])throw new Error('skill_output_missing');
     const output=await artifact(item.location,manifest.files[item.location],item.mediaType,item.assetId);
     const publicOutput={...output,sourceRefs,nativeProjectRef:nativeRef,evidenceRefs:[manifestRef,...dependencyRefs],dependencies:sourceRefs.filter(assetRef=>!source || assetRef.assetId!==source.artifact.assetId).map(assetRef=>({assetRef,kind:'media',packaged:true,missingReason:null}))};
     await verifyArtifact(publicOutput,delivery);outputs.push(publicOutput);
    }
    return {root:delivery,outputs,evidenceRefs:[manifestRef]};
   }
  }};
 };
}
