/** 外部公开 CLI 验证：不把 NOT_RUN、accepted 或退出零当作创作通过。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {videoFactoryFactory,validateVideoFactoryReport} from '../src/adapters/video_factory.ts';
import {TaskLedger} from '../src/harness/task_ledger.ts';
import {LocalRunner} from '../src/harness/local_runner.ts';
import {WorkflowEngine} from '../src/planning/workflow_engine.ts';
import {packageProject,verifyProjectPackage} from '../src/artifacts/project_package.ts';
const sha=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');

test('external report requires all gates and preserves required NOT_RUN',()=>{
 assert.throws(()=>validateVideoFactoryReport({accepted:true}),/video_factory_report_invalid/);
 const gates=['file','hash','decode','videoStream','duration','dimensions','fps','audio','timeline','provenance','container','videoCodec','pixelFormat','audioFormat'].map(id=>({id,status:id==='provenance'?'NOT_RUN':'PASS'}));
 const report={schemaVersion:'1.0.0',decision:'review',failedRequired:[],humanLabel:'unlabeled',gates};
 assert.equal(validateVideoFactoryReport(report).decision,'review');
 assert.throws(()=>validateVideoFactoryReport({...report,decision:'pass'}),/video_factory_report_invalid/);
 assert.throws(()=>validateVideoFactoryReport({...report,gates:gates.slice(1)}),/video_factory_report_invalid/);
});

test('external adapter rejects incomplete tool locks before creating outputs',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-vf-boundary-'));
 try{
  assert.throws(()=>videoFactoryFactory({pluginId:'video-factory',pluginRoot:root,nodeExecutable:process.execPath,nodeSha256:sha('node'),ffmpeg:'/bin/ffmpeg',ffprobe:'/bin/ffprobe',files:[],outputRoot:join(root,'out')}),/video_factory_lock_incomplete/);
 }finally{await rm(root,{recursive:true});}
});

test('real Video Factory public CLI evaluates a registered video and its report survives packaging',
 {skip:!process.env.CRAFT_VIDEO_FACTORY_ROOT || !process.env.CRAFT_FFMPEG || !process.env.CRAFT_FFPROBE},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-vf-live-'));const ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const pluginRoot=process.env.CRAFT_VIDEO_FACTORY_ROOT!,ffmpeg=process.env.CRAFT_FFMPEG!,ffprobe=process.env.CRAFT_FFPROBE!;
  const {videoFactoryConfiguration}=await import('../src/adapters/video_factory.ts');
  const config=await videoFactoryConfiguration(pluginRoot,process.execPath,ffmpeg,ffprobe,join(root,'outputs'));
  const file=join(root,'film.mp4');
  execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=12:duration=1','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',file]);
  const bytes=await readFile(file),digest=sha(bytes);
  const artifact={protocolVersion:'craft-artifact/v1',assetId:'film',version:digest,sha256:digest,bytes:bytes.length,mediaType:'video/mp4',producerTaskId:'provided-film',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'film.mp4'};
  const factory=videoFactoryFactory(config.config);
  const plan={workflowId:'external-review',ownerId:'test',revision:'v1',authorizationRef:'external-review',budget:{currency:'USD',maxMinorUnits:0,maxExternalCalls:0,maxRevisions:0},deadline:new Date(Date.now()+60000).toISOString(),nodes:[{id:'review',projectKey:'video-review',dependsOn:[],runtimeIdentity:config.runtimeIdentity,expectedRevision:null,externalInputs:[{root,artifact}],payload:{schemaVersion:'craft-video-evaluation/v1',assetId:'film',expected:{width:320,height:180,fps:12,durationSeconds:1,requireAudio:true}}}]};
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async()=>{}),{'video-factory':factory});
  await assert.rejects(factory({...plan.nodes[0],payload:{...plan.nodes[0].payload,command:'run arbitrary'}},[{root,artifact}],'invalid-command'),/video_factory_payload_invalid/);
  const result=await engine.run(plan);
  assert.equal(result.state,'review_ready',JSON.stringify({result,task:ledger.status(result.nodes.review.taskId!)}));
  const output=result.nodes.review.outputs![0];const report=JSON.parse(await readFile(join(result.nodes.review.root!,output.location),'utf8'));
  assert.equal(report.input.sha256,digest);assert.equal(report.result.decision,'review');
  assert.equal(report.result.gates.find((g:any)=>g.id==='provenance').status,'NOT_RUN');
  assert.equal(sha(await readFile(file)),digest);
  assert.equal((await engine.run(plan)).nodes.review.taskId,result.nodes.review.taskId);
  const packed=await packageProject(ledger,result.runKey,'test','external-review',join(root,'package'));
  const checked=await verifyProjectPackage(packed.root,packed.sha256);
  assert.equal(checked.children.length,1);
  assert.equal(checked.children[0].outputs[0].sourceRefs[0].sha256,digest);
  const rejected=structuredClone(plan);rejected.workflowId='external-wrong-dimensions';rejected.nodes[0].payload.expected.width=640;
  assert.equal((await engine.run(rejected)).state,'failed','a required gate failure cannot publish verified outputs');
  assert.equal(sha(await readFile(file)),digest);
  const toolChanged={...config.config,files:config.config.files.map((item:any,index:number)=>index===0?{...item,sha256:'0'.repeat(64)}:item)};
  const changedNode={...plan.nodes[0],runtimeIdentity:{...config.runtimeIdentity,capabilitySnapshotSha256:sha(JSON.stringify('changed'))}};
  await assert.rejects(videoFactoryFactory(toolChanged)(changedNode,[{root,artifact}],'changed-tool'),/video_factory_identity_mismatch/);
  await writeFile(file,Buffer.concat([bytes,Buffer.from('drift')]));
  await assert.rejects(factory(plan.nodes[0],[{root,artifact}],'drift'),/artifact_digest_mismatch/);
 }finally{ledger.close();await rm(root,{recursive:true});}
});
