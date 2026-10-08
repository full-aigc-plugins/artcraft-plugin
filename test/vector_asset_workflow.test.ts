import {lockNativeSchema} from './fixtures/native_schema_lock.ts';
/** 真实公开 VectorCraft 素材交给 PhotoCraft；替换源素材只更新消费者。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { publicSkillFactory } from '../src/adapters/public_skill.ts';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { WorkflowEngine } from '../src/planning/workflow_engine.ts';
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const exec=promisify(execFile);
const skills=process.env.CRAFT_NATIVE_SKILLS_ROOT;
const runtime=process.env.CRAFT_NATIVE_RUNTIME_HOME;
test('registered VectorCraft asset flows to PhotoCraft and replacement preserves independent node and old packages',{skip:process.env.CRAFT_NATIVE_VECTOR_ASSETS!=='1'||!skills||!runtime},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-vector-assets-')),ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const python='/opt/anaconda3/bin/python3';
  await exec(python,['-I','-B','-c','from PIL import Image; import sys; Image.new("RGB",(32,24),"#ed3412").save(sys.argv[1]); Image.new("RGB",(64,48),"#175cce").save(sys.argv[2],quality=100)',join(root,'product.png'),join(root,'new.jpg')]);
  const factories:Record<string,any>={},identities:Record<string,any>={};
  for(const pluginId of ['vectorcraft','photocraft'] as const){
   const skillRoot=join(skills!,pluginId+'-skills','skills',pluginId+'-use');
   const nativeLock=JSON.parse(await readFile(join(skillRoot,'scripts/runtime.lock.json'),'utf8'));
   const nativeExecutable=join(runtime!,pluginId,nativeLock.resolvedVersion,pluginId+'-cli');
   const files=await Promise.all((await readdir(join(skillRoot,'scripts'))).filter(name=>name.endsWith('.py')||name==='runtime.lock.json').map(async name=>({path:join(skillRoot,'scripts',name),sha256:hash(await readFile(join(skillRoot,'scripts',name)))})));
   await lockNativeSchema(files);
   factories[pluginId]=publicSkillFactory({pluginId,skillRoot,python,pythonSha256:hash(await readFile(python)),nativeExecutable,runtimeHome:runtime!,files,outputRoot:join(root,'deliveries')});
   identities[pluginId]={pluginId,pluginVersion:'candidate-assets',cliVersion:nativeLock.resolvedVersion,sha256:hash(await readFile(nativeExecutable)),mode:'headless',capabilitySnapshotSha256:hash(JSON.stringify(files))};
  }
  const input=async(file:string,assetId:string,mediaType:string)=>{const data=await readFile(join(root,file)),digest=hash(data);return {root,artifact:{protocolVersion:'craft-artifact/v1',assetId,version:digest,sha256:digest,bytes:data.length,mediaType,producerTaskId:'provided-'+assetId,sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:file}};};
  const provided=await input('product.png','product','image/png');
  const originalInputHash=provided.artifact.sha256;
  const payload=(plan:any,bindings:any[],assetId:string,location:string)=>({schemaVersion:'craft-skill-workflow/v1',plan,assetBindings:bindings,outputs:[{assetId,location,mediaType:'image/png'}]});
  const node=(id:string,pluginId:string,dependsOn:string[],value:any)=>({id,dependsOn,projectKey:id,runtimeIdentity:identities[pluginId],expectedRevision:null,payload:value});
  const vectorPlan={document:{name:'Provided brand',width:120,height:80},operations:[{command:'asset.place',params:{asset:'product',rect:[8,8,32,24]},as:'productObject'},{command:'shape.rectangle',params:{x:90,y:50,width:15,height:15,fill:'#21c563'},as:'unrelated'}],exports:[{format:'png'}]};
  const plan:any={workflowId:'provided-vector-brand',ownerId:'test',revision:'v1',authorizationRef:'native-vector-assets',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:1,maxExternalCalls:0},deadline:new Date(Date.now()+180000).toISOString(),nodes:[
   {...node('brand','vectorcraft',[],payload(vectorPlan,[{name:'product',assetId:'product'}],'brand-png','artboard-1.png')),externalInputs:[provided]},
   {...node('poster','photocraft',['brand'],payload({document:{name:'Brand poster',width:160,height:120,background:'#faf4e8'},operations:[{command:'asset.place',params:{asset:'brand',center:[80,60],name:'Brand'}},{command:'type.create',params:{x:10,y:18,text:'NOVA',name:'Headline',font:'Arial',size:14,color:'#192a3b'}}],exports:[{format:'png'},{format:'psd'}]},[{name:'brand',assetId:'brand-png'}],'poster-png','design.png')),inputBindings:[{from:'brand',assetId:'brand-png'}]},
   node('independent','vectorcraft',[],payload({document:{name:'Independent icon',width:40,height:40},operations:[{command:'shape.rectangle',params:{x:8,y:8,width:24,height:24,fill:'#21c563'}}],exports:[{format:'png'}]},[],'icon-png','artboard-1.png'))
  ]};
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async request=>assert.equal(request.authorizationRef,'native-vector-assets')),factories);
  const first=await engine.run(plan,2);assert.equal(first.state,'review_ready',JSON.stringify(first));
  const oldFiles:Record<string,Record<string,string>>={};
  for(const id of ['brand','poster','independent'])oldFiles[id]=JSON.parse(await readFile(join(first.nodes[id].root!,'manifest.json'),'utf8')).files;
  const changed=structuredClone(plan);changed.revision='v2';
  const prior=first.nodes.brand.outputs![0],replacement=await input('new.jpg','new-product','image/jpeg');
  changed.nodes[0].expectedRevision=prior.nativeProjectRef.sha256;
  changed.nodes[0].externalInputs=[{root:first.nodes.brand.root,artifact:prior},replacement];
  changed.nodes[0].payload={...payload({operations:[{command:'asset.replace',params:{asset:'product',replacement:'updated'}}],exports:[{format:'png'}]},[{name:'updated',assetId:'new-product'}],'brand-png','artboard-1.png'),sourceProject:{assetId:'brand-png'}};
  const second=await engine.run(changed,2);assert.equal(second.state,'review_ready',JSON.stringify(second));
  for(const id of ['brand','poster']){assert.notEqual(second.nodes[id].taskId,first.nodes[id].taskId);assert.notEqual(second.nodes[id].outputs![0].sha256,first.nodes[id].outputs![0].sha256);}
  assert.equal(second.nodes.independent.taskId,first.nodes.independent.taskId);
  for(const id of ['brand','poster','independent'])for(const [file,digest] of Object.entries(oldFiles[id]))assert.equal(hash(await readFile(join(first.nodes[id].root!,file))),digest);
  const previousManifest=JSON.parse(await readFile(join(first.nodes.brand.root!,'manifest.json'),'utf8'));
  const manifest=JSON.parse(await readFile(join(second.nodes.brand.root!,'manifest.json'),'utf8'));
  assert.deepEqual(manifest.assets.product.ids,previousManifest.assets.product.ids);
  assert.equal(manifest.assets.product.sha256,replacement.artifact.sha256);
  assert.ok(second.nodes.brand.outputs![0].sourceRefs.some((ref:any)=>ref.assetId==='new-product'&&ref.sha256===replacement.artifact.sha256));
  assert.ok(second.nodes.brand.outputs![0].evidenceRefs.some((ref:any)=>ref.location===manifest.assets.product.path));
  assert.equal(hash(await readFile(join(root,'product.png'))),originalInputHash);
  const repeated=await engine.run(changed);for(const id of ['brand','poster','independent'])assert.equal(repeated.nodes[id].taskId,second.nodes[id].taskId);
  const pixel=await exec(python,['-I','-B','-c','from PIL import Image; import sys,json; print(json.dumps([list(Image.open(p).convert("RGB").getpixel((20,20))) for p in sys.argv[1:]]))',join(first.nodes.brand.root!,'artboard-1.png'),join(second.nodes.brand.root!,'artboard-1.png')]);
  const [red,blue]=JSON.parse(pixel.stdout);assert.deepEqual(red,[237,52,18]);assert.ok(blue.every((v:number,i:number)=>Math.abs(v-[23,92,206][i])<=2));
  if(process.env.CRAFT_NATIVE_VECTOR_ASSETS_EVIDENCE)await writeFile(process.env.CRAFT_NATIVE_VECTOR_ASSETS_EVIDENCE,JSON.stringify({schema:'artcraft-vector-assets-candidate/v1',result:'passed',scope:'current source public Vector/Photo scripts and candidate Art adapter',runtimeIdentities:identities,checks:['real PNG input and collected dependency','native Vector to layered Photo PNG/PSD','JPEG replacement retains raster object IDs','only brand and poster rebuilt','independent icon task reused','all original delivery hashes preserved','repeat allocates no additional task','actual output pixels changed'],excluded:['fixed new release host acceptance','agent model dispatch','full four-domain creative acceptance']},null,2)+'\n');
 }finally{ledger.close();await rm(root,{recursive:true});}
});
