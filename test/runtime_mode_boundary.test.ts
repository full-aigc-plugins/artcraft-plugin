import {lockNativeSchema} from './fixtures/native_schema_lock.ts';
/** DAG 领域工作流不得把显式 bridge 身份降级为 headless 启动。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {publicSkillFactory} from '../src/adapters/public_skill.ts';
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
for(const pluginId of ['filmcraft','effectcraft','photocraft','vectorcraft'] as const){
 test(pluginId+' rejects explicit bridge before preparing a headless workflow',async()=>{
  const root=await mkdtemp(join(tmpdir(),'craft-mode-'));
  try{
   const skillRoot=join(root,'skill');await mkdir(join(skillRoot,'scripts'),{recursive:true});
   const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(skillRoot,'scripts',name);await writeFile(path,'fixture');return {path,sha256:hash('fixture')};}));
   await lockNativeSchema(files,true);
   const outputRoot=join(root,'outputs');
   const factory=publicSkillFactory({pluginId,skillRoot,python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:process.execPath,runtimeHome:root,files,outputRoot});
   const node={id:'mode',dependsOn:[],projectKey:'mode',runtimeIdentity:{pluginId,mode:'bridge'},expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{operations:[],exports:[]},assetBindings:[],outputs:[{assetId:'native',location:'project.native',mediaType:'application/octet-stream'}]}};
   await assert.rejects(factory(node,[],'bridge'),/capability_missing: .*bridge/);
   await assert.rejects(access(outputRoot),/ENOENT/);
   const headless=await factory({...node,runtimeIdentity:{pluginId,mode:'headless'}},[],'headless');
   const prepared=await headless.adapter.prepare({runtimeIdentity:{pluginId,mode:'headless'},expectedRevision:null} as any);
   assert.ok(prepared.args.includes(join(skillRoot,'scripts/workflow.py')));
   assert.ok(!prepared.args.includes('--connect'));
  }finally{await rm(root,{recursive:true});}
 });
}
