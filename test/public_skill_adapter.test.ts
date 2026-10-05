/** 仅通过技能公开脚本运行原生合成，不导入独立技能私有模块。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { publicSkillFactory } from '../src/adapters/public_skill.ts';
import { TaskLedger } from '../src/harness/task_ledger.ts';
import { LocalRunner } from '../src/harness/local_runner.ts';
import { WorkflowEngine } from '../src/planning/workflow_engine.ts';
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const cli=process.env.CRAFT_EFFECTCRAFT_CLI;
const skill=process.env.CRAFT_EFFECTCRAFT_SKILL;
test('public EffectCraft skill script produces registered native project and render',{skip:!cli||!skill},async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-public-skill-'));const ledger=new TaskLedger(join(root,'tasks.sqlite'));
 try{
  const python='/opt/anaconda3/bin/python3',runtimeHome=join(homedir(),'.local/share/craft-runtimes');
  const scripts=['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json'];
  const files=await Promise.all(scripts.map(async name=>({path:join(skill!,'scripts',name),sha256:hash(await readFile(join(skill!,'scripts',name)))})));
  const factory=publicSkillFactory({pluginId:'effectcraft',skillRoot:skill!,python,pythonSha256:hash(await readFile(python)),nativeExecutable:cli!,runtimeHome,files,outputRoot:join(root,'deliveries')});
  const runtimeIdentity={pluginId:'effectcraft',pluginVersion:'0.1.0',cliVersion:'0.2.0',sha256:hash(await readFile(cli!)),mode:'headless',capabilitySnapshotSha256:hash(JSON.stringify(files))};
  const plan={workflowId:'public-intro',ownerId:'test',revision:'v1',authorizationRef:'test-scope',budget:{currency:'USD',maxMinorUnits:0,maxRevisions:0,maxExternalCalls:0},deadline:new Date(Date.now()+60000).toISOString(),nodes:[{id:'intro',dependsOn:[],projectKey:'intro-project',runtimeIdentity,expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{document:{name:'Public intro',width:320,height:180,frameRate:12,duration:1},operations:[{command:'layer.newText',params:{name:'Title',text:'NOVA',font:'Arial',size:30,position:[120,90]}}],frames:[0],exports:[{format:'mp4'}]},assetBindings:[],outputs:[{assetId:'intro-video',location:'intro.mp4',mediaType:'video/mp4'}]}}]};
  const engine=new WorkflowEngine(ledger,new LocalRunner(ledger,async request=>assert.equal(request.authorizationRef,'test-scope')),{effectcraft:factory});
  const result=await engine.run(plan);
  assert.equal(result.state,'review_ready',JSON.stringify(result));
  const output=result.nodes.intro.outputs![0];
  assert.equal(output.assetId,'intro-video');assert.equal(output.nativeProjectRef.location,'project.ecproj');
  assert.ok(output.evidenceRefs.some((item:{location:string})=>item.location==='manifest.json'));
  assert.equal((await engine.run(plan)).nodes.intro.taskId,result.nodes.intro.taskId);
  const badFactory=publicSkillFactory({pluginId:'effectcraft',skillRoot:skill!,python,pythonSha256:hash(await readFile(python)),nativeExecutable:cli!,runtimeHome,files:files.map((file,index)=>index===0?{...file,sha256:'0'.repeat(64)}:file),outputRoot:join(root,'bad')});
  await assert.rejects(badFactory(plan.nodes[0],[],'bad'),/launcher_file_identity_mismatch/);
 }finally{ledger.close();await rm(root,{recursive:true});}
});

test('public skill preflight rejects arbitrary paths, inline assets and unsupported revisions before writes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-skill-preflight-'));
 try{
  const files=['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json'].map(name=>({path:join(root,'scripts',name),sha256:'0'.repeat(64)}));
  const factory=publicSkillFactory({pluginId:'effectcraft',skillRoot:root,python:process.execPath,pythonSha256:'0'.repeat(64),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'output')});
  const node={id:'intro',dependsOn:[],projectKey:'intro',runtimeIdentity:{pluginId:'effectcraft'},expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{},assetBindings:[],outputs:[{assetId:'render',location:'../outside.mp4',mediaType:'video/mp4'}]}};
  await assert.rejects(factory(node,[],'task'),/skill_output_invalid/);
  await assert.rejects(factory({...node,payload:{...node.payload,plan:{assets:{evil:{path:'/outside'}}}}},[],'task'),/skill_payload_invalid/);
  await assert.rejects(factory({...node,expectedRevision:'old'},[],'task'),/skill_revision_adapter_pending/);
  await assert.rejects(factory({...node,payload:{...node.payload,script:'/arbitrary.py'}},[],'task'),/skill_payload_invalid/);
  await assert.rejects(readFile(join(root,'output','plan.json')),/ENOENT/);
 }finally{await rm(root,{recursive:true});}
});
