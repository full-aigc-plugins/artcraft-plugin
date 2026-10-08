/** 固定安装的失败保全模块必须绑定快照与启动身份；受控缺失／摘要漂移不写输出。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdir, access, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const receipt=process.env.CRAFT_STAGE_BINDING_RECEIPT,root=process.env.CRAFT_STAGE_BINDING_ROOT;
const hash=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
test('current installed four-domain failed-stage binding refuses missing and drifted modules',{skip:!receipt||!root},async()=>{
 await mkdir(root!,{recursive:false});
 const installation=JSON.parse(await readFile(receipt!,'utf8'));
 const {publicSkillFactory}=await import(pathToFileURL(join(installation.runtimeRoot,'src/adapters/public_skill.ts')).href);
 const records=[];
 for(const [domainId,entry] of Object.entries(installation.skills) as [string,any][]){
  const files=entry.files, modulePath=join(entry.skillRoot,'scripts/preserved_stage.py');
  const bound=files.find((f:any)=>f.path===modulePath);assert.ok(bound);
  const moduleHash=hash(await readFile(modulePath));assert.equal(bound.sha256,moduleHash);
  assert.ok(Object.values(entry.capabilitySnapshot.scriptHashes).includes(moduleHash));
  const config={pluginId:domainId,skillRoot:entry.skillRoot,python:installation.pythonExecutable,pythonSha256:installation.pythonSha256,nativeExecutable:entry.executable,runtimeHome:installation.runtimeHome,files,outputRoot:join(root!,domainId)};
  assert.throws(()=>publicSkillFactory({...config,files:files.filter((f:any)=>f.path!==modulePath)}),/skill_lock_incomplete/);
  const node={id:'stage',runtimeIdentity:entry.runtimeIdentity,expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{operations:[]},assetBindings:[],outputs:[{assetId:'native',location:'project.native',mediaType:'application/octet-stream'}]}};
  const drift=publicSkillFactory({...config,files:files.map((f:any)=>f.path===modulePath?{...f,sha256:'0'.repeat(64)}:f)});
  await assert.rejects(drift(node,[],'drift'),/launcher_file_identity_mismatch/);
  await assert.rejects(access(config.outputRoot),/ENOENT/);
  const good=await publicSkillFactory(config)(node,[],'bound');
  const prepared=await good.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:null});
  assert.ok(prepared.launcherIdentity.files.some((f:any)=>f.path===modulePath&&f.sha256===moduleHash));
  assert.equal(hash(await readFile(modulePath)),moduleHash);
  records.push({domainId,moduleSha256:moduleHash,moduleInReceipt:true,moduleInCapabilitySnapshot:true,moduleInLauncher:true,missingRejected:true,driftRejectedBeforeOutput:true});
 }
 assert.equal(records.length,4);
 await writeFile(join(root!,'proof.json'),JSON.stringify({schema:'artcraft-current-stage-binding/v1',result:'PASS',cases:records,scope:'actual installed modules and immutable files; config faults controlled, no native edits'},null,2)+'\n');
});
