import {lockNativeSchema} from './fixtures/native_schema_lock.ts';
/** 真实原生保存后的协议故障：运行实际发布的编排引擎，测试钩子不进入产品。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const installationFile=process.env.CRAFT_PROTOCOL_INSTALLATION;
const candidateSkill=process.env.CRAFT_PROTOCOL_VECTOR_SKILL;
const output=process.env.CRAFT_PROTOCOL_WORKFLOW_EVIDENCE;
const domains=(process.env.CRAFT_PROTOCOL_DOMAINS||'vectorcraft').split(',');
assert.ok(domains.every(domain=>['filmcraft','effectcraft','photocraft','vectorcraft'].includes(domain)));
assert.equal(new Set(domains).size,domains.length);
const faults=(process.env.CRAFT_PROTOCOL_FAULTS||'malformed,scalar,missing,ambiguous,nonfinite,tool-content').split(',');
assert.ok(faults.every(fault=>['malformed','scalar','missing','ambiguous','nonfinite','tool-content','inner-nonfinite','inner-overflow','inner-duplicate'].includes(fault)));
assert.equal(new Set(faults).size,faults.length);
const sha=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const exec=promisify(execFile),records:any[]=[];
for(const domainId of domains)for(const fault of faults){
 test(`published Art engine preserves failed ${domainId} ${fault} attempt and blocks consumers`,{skip:!installationFile},async()=>{
  const installation=JSON.parse(await readFile(installationFile!,'utf8'));
  const load=async(path:string)=>import(pathToFileURL(join(process.env.CRAFT_PROTOCOL_RUNTIME_SOURCE_ROOT||installation.runtimeRoot,'src',path)).href);
  const {TaskLedger}=await load('harness/task_ledger.ts');
  const {LocalRunner}=await load('harness/local_runner.ts');
  const {WorkflowEngine}=await load('planning/workflow_engine.ts');
  const {publicSkillFactory}=await load('adapters/public_skill.ts');
  const retained=process.env.CRAFT_PROTOCOL_RETAIN_ROOT;
  const root=retained?resolve(retained,domainId+'-'+fault):await mkdtemp(join(tmpdir(),'art-native-protocol-'));
  if(retained)await mkdir(root,{recursive:false});
  const ledger=new TaskLedger(join(root,'tasks.sqlite'));
  try{
   const domain=installation.skills[domainId];
   const skillRoot=domainId==='vectorcraft'&&candidateSkill?candidateSkill:domain.skillRoot;
   const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>({path:join(skillRoot,'scripts',name),sha256:sha(await readFile(join(skillRoot,'scripts',name)))})));
   await lockNativeSchema(files);
   const nativeHash=sha(await readFile(domain.executable));
   const pluginVersion=process.env.CRAFT_PROTOCOL_PLUGIN_VERSION||(candidateSkill&&domainId==='vectorcraft'?'0.1.0-candidate':domain.runtimeIdentity.pluginVersion);
   const identity={...domain.runtimeIdentity,pluginVersion,sha256:nativeHash};
   const factory=publicSkillFactory({pluginId:domainId,skillRoot,python:installation.pythonExecutable,pythonSha256:installation.pythonSha256,nativeExecutable:domain.executable,runtimeHome:installation.runtimeHome,files,outputRoot:join(root,'deliveries')});
   const proxy=fileURLToPath(new URL('./fixtures/protocol_proxy.py',import.meta.url));
   const wrapper=fileURLToPath(new URL('./fixtures/workflow_protocol_injection.py',import.meta.url));
   const suffix=({filmcraft:'fcproj',effectcraft:'ecproj',photocraft:'pcraft',vectorcraft:'vectorcraft'} as Record<string,string>)[domainId];
   const log=join(root,'native-saves.jsonl'),capture=join(root,'saved.'+suffix),replyFile=join(root,'public-workflow-reply.json');
   let preparations=0,delivery='';
   const injected=async(node:any,inputs:any[],taskId:string)=>{
    const compiled=await factory(node,inputs,taskId);
    return {...compiled,adapter:{...compiled.adapter,prepare:async(request:any)=>{
     preparations++;
     const plan=await compiled.adapter.prepare(request);
     delivery=plan.args[plan.args.indexOf('--output')+1];
     return {...plan,args:['-I','-B',wrapper,proxy,fault,log,capture,replyFile,...plan.args.slice(2)],launcherIdentity:{...plan.launcherIdentity,files:[...plan.launcherIdentity.files,{path:wrapper,sha256:sha(await readFile(wrapper))},{path:proxy,sha256:sha(await readFile(proxy))}]}};
    }}};
   };
   const domainPlans:Record<string,any>={
    vectorcraft:{document:{name:'Protocol fixture',width:32,height:32,units:'Pixels'},operations:[{command:'shape.rectangle',params:{x:4,y:4,width:8,height:8},as:'shape'}],exports:[{format:'png',artboard:0}]},
    effectcraft:{document:{name:'Protocol fixture',width:32,height:32,frameRate:12,duration:1},operations:[{command:'layer.newShape',params:{kind:'rounded',name:'Badge',size:[8,8],position:[16,16],fill:'#ef5b36'},as:'badge'}],frames:[],exports:[]},
    photocraft:{document:{name:'Protocol fixture',width:32,height:32,background:'#faf4e8'},operations:[],exports:[]},
    filmcraft:{document:{name:'Protocol fixture',width:32,height:32,frameRate:{num:12,den:1}},operations:[],frames:[],exports:[]},
   };
   const payload:any={schemaVersion:'craft-skill-workflow/v1',plan:domainPlans[domainId],assetBindings:[],outputs:[{assetId:'native-project',location:'project.'+suffix,mediaType:'application/octet-stream'}]};
   const externalInputs:any[]=[];
   if(domainId==='filmcraft'){
    // Film 的公开合同要求非空时间线；提供真实登记图片，而非绕过该前置条件。
    const image=join(root,'still.png');
    await exec(installation.pythonExecutable,['-I','-B','-c',"import struct,zlib,sys\ndef chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)\nraw=(b'\\x00'+bytes([239,91,54,255])*32)*32\nopen(sys.argv[1],'wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',32,32,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))",image]);
    const bytes=await readFile(image),digest=sha(bytes);
    externalInputs.push({root,artifact:{protocolVersion:'craft-artifact/v1',assetId:'still',version:digest,sha256:digest,bytes:bytes.length,mediaType:'image/png',producerTaskId:'provided',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{width:32,height:32},lossReportRef:null,evidenceRefs:[],location:'still.png'}});
    payload.assetBindings=[{name:'still',assetId:'still'}];
    payload.plan.operations=[{command:'asset.import',params:{asset:'still'},as:'still'},{command:'timeline.place',params:{item:{$ref:'still.item'},track:'V1',time:'0',sourceIn:'0',duration:'254016000000',insert:false},as:'clip'}];
   }
   const node=(id:string,dependsOn:string[])=>({id,dependsOn,projectKey:id,runtimeIdentity:identity,expectedRevision:null,payload,...(externalInputs.length?{externalInputs}:{})});
   const plan={workflowId:'native-protocol-'+domainId+'-'+fault,ownerId:'fixture',revision:'v1',authorizationRef:'native-protocol-test',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:1,maxExternalCalls:0},deadline:new Date(Date.now()+120000).toISOString(),nodes:[node('logo',[]),node('consumer',['logo'])]};
   const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async request=>assert.equal(request.authorizationRef,'native-protocol-test')),{[domainId]:injected});
   const first=await engine.run(plan);
   assert.equal(first.state,'failed',JSON.stringify(first));
   assert.equal(first.nodes.consumer.status,'blocked');
   assert.equal(first.nodes.consumer.taskId,undefined);
   assert.deepEqual(first.nodes.logo.outputs,[]);
   const taskId=first.nodes.logo.taskId,receipt=ledger.status(taskId),execution=ledger.execution(taskId);
   assert.equal(receipt.state,'failed');assert.equal(execution.status,'stopped');assert.equal(execution.groupStopped,true);
   assert.equal(preparations,1);
   const publicReply=JSON.parse(await readFile(replyFile,'utf8'));
   assert.deepEqual(Object.keys(publicReply),['error']);
   assert.ok(publicReply.error.startsWith('outcome_unknown:'),publicReply.error);
   assert.equal(execution.diagnostics.stdout.sha256,sha(await readFile(replyFile)));
   const saveLog=await readFile(log,'utf8');
   const saves=saveLog.trim().split('\n').map(line=>JSON.parse(line));
   assert.equal(saves.length,1);assert.equal(saves[0].saveSucceeded,true);
   const capturedHash=sha(await readFile(capture));assert.equal(capturedHash,saves[0].sha256);
   const failure=JSON.parse(await readFile(join(delivery,'failure.json'),'utf8'));
   assert.equal(failure.schema,'craft-failed-stage/v1');
   assert.equal(failure.outcome,'outcome_unknown');assert.equal(failure.replayAllowed,false);
   assert.equal(failure.acceptance,'not-a-successful-delivery');
   assert.equal(failure.lastAttempt.phase,'submitted');
   const saveCommand=({filmcraft:'file.saveAs',effectcraft:'save_project',photocraft:'doc_save',vectorcraft:'document.save'} as Record<string,string>)[domainId];
   assert.ok(JSON.stringify(failure.lastAttempt).includes(saveCommand));
   const stage=resolve(delivery,failure.stage);
   assert.deepEqual(JSON.parse(await readFile(join(stage,'failure.json'),'utf8')),failure);
   const originals=(await readdir(stage)).filter(name=>name.endsWith('.'+suffix));assert.equal(originals.length,1);
   const original=join(stage,originals[0]);assert.equal(sha(await readFile(original)),capturedHash);
   for(const [name,entry] of Object.entries(failure.files) as [string,{sha256:string;bytes:number}][]){
    const bytes=await readFile(join(stage,name));assert.equal(sha(bytes),entry.sha256);assert.equal(bytes.length,entry.bytes);
   }
   await assert.rejects(readFile(join(delivery,'manifest.json')),/ENOENT/);
   const reference={path:{$ref:'project.path'}};
   const inspectPlans:Record<string,any[]>={filmcraft:[{command:'file.open',params:reference},{command:'sequence.inspect',params:{}}],effectcraft:[{tool:'open_project',params:reference},{tool:'get_comp',params:{}}],photocraft:[{tool:'doc_open',params:reference},{tool:'doc_inspect',params:{}}],vectorcraft:[{command:'document.open',params:reference},{command:'document.json',params:{}}]};
   const inspectionPlan=join(root,'inspection-plan.json');
   await writeFile(inspectionPlan,JSON.stringify({schema:'craft-command-plan/v1',operations:inspectPlans[domainId]}));
   const reopened=JSON.parse((await exec(installation.pythonExecutable,['-I','-B',join(skillRoot,'scripts/commands.py'),'run',inspectionPlan,'--input','project='+original,'--output',join(root,'reopened'),'--runtime-home',installation.runtimeHome])).stdout);
   assert.equal(reopened.result,'PASS');
   const second=await engine.run(plan);
   assert.equal(preparations,1);assert.equal(second.nodes.logo.taskId,taskId);
   assert.equal(ledger.status(taskId).attemptId,receipt.attemptId);assert.deepEqual(second.budget,first.budget);
   assert.equal(await readFile(log,'utf8'),saveLog);
   assert.equal(sha(await readFile(capture)),capturedHash);assert.equal(sha(await readFile(domain.executable)),nativeHash);
   assert.equal(sha(await readFile(original)),capturedHash);
   for(const input of externalInputs)assert.equal(sha(await readFile(join(input.root,input.artifact.location))),input.artifact.sha256);
   for(const file of files)assert.equal(sha(await readFile(file.path)),file.sha256);
   records.push({domainId,fault,result:'PASS',pluginVersion,runtimeVersion:installation.version,nativeSha256:nativeHash,clientSha256:files.find(file=>file.path.endsWith('mcp_session.py'))!.sha256,recoveryModuleSha256:files.find(file=>file.path.endsWith('preserved_stage.py'))!.sha256,originalStagePreserved:true,retainedFileCount:Object.keys(failure.files).length,lastAttemptPreserved:true,saveCount:1,nativeReopen:true,consumerBlocked:true,publicUnknownReply:true,attemptPreserved:true,budgetPreserved:true,registeredInputCount:externalInputs.length,registeredInputsPreserved:true,noReplay:true});
   if(output)await writeFile(output,JSON.stringify({schema:'art-native-protocol-workflow-candidate/v1',result:records.length===domains.length*faults.length?'PASS':'RUNNING',cases:records,runtimeSourceMode:process.env.CRAFT_PROTOCOL_RUNTIME_SOURCE_ROOT?'working-tree-candidate':'fixed-installed',scope:'runtime modules selected explicitly by receipt or candidate override; pinned public domain adapters; original product-retained stage inspected and reopened; controlled post-save hook; proxy copy only a hash witness',excluded:['complete per-command or GUI acceptance','force-kill or filesystem-crash durability']},null,2)+'\n');
  }finally{ledger.close();if(!retained)await rm(root,{recursive:true,force:true});}
 });
}
