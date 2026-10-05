/** 只通过 Video Factory 公开 CLI 验证登记成片，不导入其私有模块。 */
import {readFile,writeFile,mkdir,readdir,lstat,realpath,stat} from 'node:fs/promises';
import {join,isAbsolute,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyArtifact,planHash} from '../protocol/contracts.ts';
import type {AdapterFactory} from '../planning/workflow_engine.ts';

const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const required=['file','hash','decode','videoStream','duration','dimensions','fps','audio','timeline','provenance','container','videoCodec','pixelFormat','audioFormat'];
export interface VideoFactoryConfig {pluginId:'video-factory';pluginRoot:string;nodeExecutable:string;nodeSha256:string;ffmpeg:string;ffprobe:string;files:{path:string;sha256:string}[];outputRoot:string;}

/** 报告必须完整且诚实；CLI 退出零或 accepted 字段不是验收证据。 */
export function validateVideoFactoryReport(report:any):any {
 if(report?.schemaVersion!=='1.0.0' || !['review','pass','fail'].includes(report.decision) || !Array.isArray(report.gates) || !Array.isArray(report.failedRequired) || !['unlabeled','approved','rejected'].includes(report.humanLabel))throw new Error('video_factory_report_invalid');
 const gates=new Map<string,string>();
 for(const gate of report.gates){if(!gate || typeof gate.id!=='string' || gates.has(gate.id) || !['PASS','FAIL','NOT_RUN','SKIPPED'].includes(gate.status))throw new Error('video_factory_report_invalid');gates.set(gate.id,gate.status);}
 if(required.some(id=>!gates.has(id) || gates.get(id)==='SKIPPED'))throw new Error('video_factory_report_invalid');
 const failed=required.filter(id=>gates.get(id)==='FAIL');
 if(planHash(failed)!==planHash(report.failedRequired) || (failed.length && report.decision!=='fail') || (report.decision==='pass' && (required.some(id=>gates.get(id)!=='PASS') || report.humanLabel!=='approved')))throw new Error('video_factory_report_invalid');
 return report;
}

/** 从宿主已安装的公开插件和显式媒体工具生成摘要锁；不猜测重复安装目录。 */
export async function videoFactoryConfiguration(pluginRoot:string,nodeExecutable:string,ffmpeg:string,ffprobe:string,outputRoot:string):Promise<Record<string,any>> {
 for(const path of [pluginRoot,nodeExecutable,ffmpeg,ffprobe,outputRoot])if(!isAbsolute(path))throw new Error('video_factory_config_invalid');
 pluginRoot=await realpath(pluginRoot);
 const manifest=JSON.parse(await readFile(join(pluginRoot,'plugin.json'),'utf8'));
 const pkg=JSON.parse(await readFile(join(pluginRoot,'package.json'),'utf8'));
 if(manifest.name!=='video-factory' || manifest.version!=='0.4.0' || pkg.version!==manifest.version)throw new Error('video_factory_version_unsupported');
 const files:{path:string;sha256:string}[]=[];
 const add=async(path:string)=>{if(!(await lstat(path)).isFile())throw new Error('video_factory_source_invalid');files.push({path,sha256:hash(await readFile(path))});};
 const walk=async(path:string)=>{for(const entry of await readdir(path,{withFileTypes:true})){const child=join(path,entry.name);if(entry.isSymbolicLink())throw new Error('video_factory_source_invalid');if(entry.isDirectory())await walk(child);else if(/\.(mjs|js|json)$/.test(entry.name))await add(child);}};
 for(const name of ['plugin.json','package.json','bin/video-factory'])await add(join(pluginRoot,name));
 for(const name of ['src','schemas','skills'])await walk(join(pluginRoot,name));
 for(const path of [ffmpeg,ffprobe])files.push({path,sha256:hash(await readFile(path))});
 files.sort((a,b)=>a.path.localeCompare(b.path));
 const config={pluginId:'video-factory',pluginRoot,nodeExecutable,nodeSha256:hash(await readFile(nodeExecutable)),ffmpeg,ffprobe,files,outputRoot};
 return {config,runtimeIdentity:{pluginId:'video-factory',pluginVersion:manifest.version,cliVersion:pkg.version,sha256:hash(await readFile(join(pluginRoot,'bin/video-factory'))),mode:'headless',capabilitySnapshotSha256:planHash(files)}};
}

/** 适配器配置来自可信安装登记；模型只能声明登记输入和检查目标。 */
export function videoFactoryFactory(config:VideoFactoryConfig):AdapterFactory {
 const locked=structuredClone(config),entry=join(locked.pluginRoot,'bin/video-factory');
 if(![locked.pluginRoot,locked.nodeExecutable,locked.ffmpeg,locked.ffprobe,locked.outputRoot].every(isAbsolute) || basename(locked.ffmpeg)!=='ffmpeg' || basename(locked.ffprobe)!=='ffprobe')throw new Error('video_factory_config_invalid');
 if(![entry,join(locked.pluginRoot,'src/cli.mjs'),join(locked.pluginRoot,'schemas/video_plan.schema.json'),locked.ffmpeg,locked.ffprobe].every(path=>locked.files.some(file=>file.path===path)))throw new Error('video_factory_lock_incomplete');
 const checkTools=async()=>{for(const file of locked.files)if(hash(await readFile(file.path))!==file.sha256)throw new Error('video_factory_tool_changed');if(hash(await readFile(locked.nodeExecutable))!==locked.nodeSha256)throw new Error('launcher_identity_mismatch');};
 return async(node,inputs,taskId)=>{
  const payload=node.payload;
  if(node.runtimeIdentity.pluginId!=='video-factory' || node.runtimeIdentity.sha256!==locked.files.find(file=>file.path===entry)!.sha256 || node.runtimeIdentity.capabilitySnapshotSha256!==planHash(locked.files))throw new Error('video_factory_identity_mismatch');
  if(node.expectedRevision!==null || payload.schemaVersion!=='craft-video-evaluation/v1' || Object.keys(payload).some(key=>!['schemaVersion','assetId','expected'].includes(key)) || inputs.length!==1 || inputs[0].artifact.assetId!==payload.assetId || inputs[0].artifact.mediaType!=='video/mp4')throw new Error('video_factory_payload_invalid');
  const expected=payload.expected;
  if(!expected || Object.keys(expected).sort().join(',')!=='durationSeconds,fps,height,requireAudio,width' || ![expected.width,expected.height].every(n=>Number.isSafeInteger(n) && n>0 && n%2===0) || !Number.isFinite(expected.fps) || expected.fps<1 || expected.fps>120 || !Number.isFinite(expected.durationSeconds) || expected.durationSeconds<=0 || expected.durationSeconds>86400 || typeof expected.requireAudio!=='boolean')throw new Error('video_factory_payload_invalid');
  const input=structuredClone(inputs[0]);
  await verifyArtifact(input.artifact,input.root);await checkTools();
  const root=join(locked.outputRoot,hash(taskId));await mkdir(root,{recursive:true});
  const location='evaluation.json',job=join(root,'evaluation-job.json'),planFile=join(root,'video-plan.json');
  const ticks=Math.round(expected.durationSeconds*1000000);
  const plan={schemaVersion:'1.0.0',id:taskId,mode:'local_composition',round:1,assets:[{id:'A1',path:join(input.root,input.artifact.location),sha256:input.artifact.sha256,kind:'video',durationTicks:ticks}],editDecision:{schemaVersion:'1.0.0',id:'E1',revision:1,timebase:{numerator:1,denominator:1000000},clips:[{id:'C01',assetId:'A1',sourceInTicks:0,sourceOutTicks:ticks,timelineInTicks:0,track:0,transition:'cut',gainDb:0}]},output:{aspect:expected.width===expected.height?'1:1':expected.width>expected.height?'16:9':'9:16',width:expected.width,height:expected.height,fps:expected.fps,requireAudio:expected.requireAudio}};
  await writeFile(planFile,JSON.stringify(plan));
  const value={entry,nodeExecutable:locked.nodeExecutable,ffmpeg:locked.ffmpeg,ffprobe:locked.ffprobe,input:{path:join(input.root,input.artifact.location),sha256:input.artifact.sha256},planFile,output:join(root,location)};
  await writeFile(job,JSON.stringify(value));
  const driver=fileURLToPath(new URL('./video_factory_driver.ts',import.meta.url));
  const evidence=[{path:job,sha256:hash(JSON.stringify(value))},{path:planFile,sha256:hash(JSON.stringify(plan))},{path:driver,sha256:hash(await readFile(driver))}];
  return {root,adapter:{
   prepare:async()=>{await verifyArtifact(input.artifact,input.root);await checkTools();return {executable:locked.nodeExecutable,args:[driver,job],cwd:root,actualRevision:null,budgetUsage:{minorUnits:0,externalCalls:0},launcherIdentity:{runtimeExecutable:entry,sha256:locked.nodeSha256,files:[...locked.files,...evidence]}};},
   verify:async()=>{
    await verifyArtifact(input.artifact,input.root);await checkTools();
    const bytes=await readFile(join(root,location)),report=JSON.parse(bytes.toString());
    if(report.schema!=='craft-video-evaluation/v1' || report.input.sha256!==input.artifact.sha256 || report.planSha256!==evidence[1].sha256)throw new Error('video_factory_report_binding_mismatch');
    validateVideoFactoryReport(report.result);
    if(report.result.decision==='fail')throw new Error('video_factory_evaluation_failed:'+report.result.failedRequired.join(','));
    const digest=hash(bytes),planBytes=await readFile(planFile),planDigest=hash(planBytes);
    const output={protocolVersion:'craft-artifact/v1',assetId:taskId+'-evaluation',version:digest,sha256:digest,bytes:bytes.length,mediaType:'application/json',producerTaskId:taskId,sourceRefs:[{assetId:input.artifact.assetId,version:input.artifact.version,sha256:input.artifact.sha256}],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[{assetId:taskId+'-plan',version:planDigest,sha256:planDigest,location:'video-plan.json'}],location};
    return {root,outputs:[output],evidenceRefs:output.evidenceRefs};
   }
  }};
 };
}
