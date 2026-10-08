/** LUT 类型绑定只能由登记输入获得路径，不接受模型私有路径。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {publicSkillFactory} from '../src/adapters/public_skill.ts';
const hash=(data:Buffer|string)=>createHash('sha256').update(data).digest('hex');
test('typed Film LUT binding uses public LUT argv and rejects wrong domain/type/extension',async()=>{
 const root=await mkdtemp(join(tmpdir(),'craft-lut-binding-'));
 try{
  const skillRoot=join(root,'skill');await mkdir(join(skillRoot,'scripts'),{recursive:true});
  const files=await Promise.all(['workflow.py','bootstrap.py','mcp_session.py','runtime.lock.json','exchange_loss.py','preserved_stage.py'].map(async name=>{const path=join(skillRoot,'scripts',name);await writeFile(path,'fixture');return {path,sha256:hash('fixture')};}));
  const data='registered cube fixture';await writeFile(join(root,'grade.cube'),data);
  const digest=hash(data),input={root,artifact:{protocolVersion:'craft-artifact/v1',assetId:'grade-source',version:digest,sha256:digest,bytes:Buffer.byteLength(data),mediaType:'application/octet-stream',producerTaskId:'provided',sourceRefs:[],nativeProjectRef:null,renditions:[],dependencies:[],technicalMetadata:{},lossReportRef:null,evidenceRefs:[],location:'grade.cube'}};
  const node={id:'film',dependsOn:[],projectKey:'film',runtimeIdentity:{pluginId:'filmcraft'},expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{operations:[{command:'lumetri.setInputLut',params:{clip:2,asset:'grade'}}]},assetBindings:[{name:'grade',assetId:'grade-source',kind:'lut'}],outputs:[{assetId:'film',location:'film.mp4',mediaType:'video/mp4'}]}};
  const config={pluginId:'filmcraft' as const,skillRoot,python:process.execPath,pythonSha256:hash(await readFile(process.execPath)),nativeExecutable:'/usr/bin/true',runtimeHome:root,files,outputRoot:join(root,'output')};
  const factory=publicSkillFactory(config),made=await factory(node,[input],'new');
  const prepared=await made.adapter.prepare({runtimeIdentity:node.runtimeIdentity,expectedRevision:null} as any);
  assert.deepEqual(prepared.args.slice(-2),['--lut-asset','grade='+join(root,'grade.cube')]);
  const before=await readdir(config.outputRoot);
  await assert.rejects(factory({...node,payload:{...node.payload,assetBindings:[{name:'grade',assetId:'grade-source',kind:'unknown'}]}},[input],'bad-kind'),/skill_asset_binding_invalid/);
  await assert.rejects(publicSkillFactory({...config,pluginId:'photocraft'})({...node,runtimeIdentity:{pluginId:'photocraft'}},[input],'bad-domain'),/skill_lut_domain_unsupported/);
  await writeFile(join(root,'grade.png'),data);
  await assert.rejects(factory(node,[{root,artifact:{...input.artifact,location:'grade.png'}}],'bad-extension'),/skill_lut_format_unsupported/);
  assert.deepEqual(await readdir(config.outputRoot),before,'invalid LUT binding must not create a task directory or plan file');
 }finally{await rm(root,{recursive:true,force:true});}
});
