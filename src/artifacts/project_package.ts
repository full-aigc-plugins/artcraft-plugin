/** 从可信账本生成可移动交付；只复制登记文件，不执行领域操作或升级创作状态。 */
import {readFile,writeFile,copyFile,mkdir,mkdtemp,rename,rm,lstat,realpath,rmdir,readdir} from 'node:fs/promises';
import {constants,createReadStream} from 'node:fs';
import {join,dirname,isAbsolute,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyArtifact,planHash} from '../protocol/contracts.ts';
import type {TaskLedger} from '../harness/task_ledger.ts';
const hash=(x:Buffer|string)=>createHash('sha256').update(x).digest('hex');
const safe=(x:unknown):x is string=>typeof x==='string' && !!x && !isAbsolute(x) && !/[\\:\x00]/.test(x) && !x.split('/').some(p=>['','..','.'].includes(p));
async function filePath(root:string,location:string):Promise<string>{
 if(!safe(location))throw new Error('package_location_invalid');
 const base=await realpath(root),path=join(base,location),actual=await realpath(path),delta=relative(base,actual);
 if(!delta || delta.startsWith('../') || isAbsolute(delta) || !(await lstat(path)).isFile())throw new Error('package_location_invalid');
 return path;
}
async function fileDigest(path:string):Promise<{sha256:string;bytes:number}>{
 const before=await lstat(path),digest=createHash('sha256');let bytes=0;
 if(!before.isFile())throw new Error('package_location_invalid');
 for await(const chunk of createReadStream(path)){bytes+=(chunk as Buffer).length;digest.update(chunk);}
 const after=await lstat(path);
 if(before.ino!==after.ino || before.size!==after.size || before.mtimeMs!==after.mtimeMs)throw new Error('package_source_changed');
 return {sha256:digest.digest('hex'),bytes};
}
const json=(x:unknown)=>JSON.stringify(x,null,2)+'\n';

/** 必须使用打包回执中的清单摘要；文件表本身不能自证没有被替换。 */
export async function verifyProjectPackage(root:string,expectedSha256:string):Promise<Record<string,any>>{
 if(!isAbsolute(root) || !/^[a-f0-9]{64}$/.test(expectedSha256))throw new Error('package_identity_invalid');
 const text=await readFile(await filePath(root,'project.json'));
 if(hash(text)!==expectedSha256)throw new Error('package_manifest_digest_mismatch');
 const manifest=JSON.parse(text.toString());
 if(manifest.schema!=='craft-project-package/v1' || manifest.state!=='review_ready' || !manifest.files || !Array.isArray(manifest.children) || !manifest.children.length)throw new Error('package_manifest_invalid');
 for(const [location,entry] of Object.entries(manifest.files) as [string,any][]){
  if(!entry || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes<0)throw new Error('package_manifest_invalid');
  const actual=await fileDigest(await filePath(root,location));
  if(actual.bytes!==entry.bytes || actual.sha256!==entry.sha256)throw new Error('package_file_digest_mismatch');
 }
 const listed=new Set([...Object.keys(manifest.files),'project.json']);
 const inventory=async(directory:string,prefix='')=>{
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const location=prefix?prefix+'/'+entry.name:entry.name;
   if(entry.isDirectory())await inventory(join(directory,entry.name),location);
   else if(!entry.isFile() || !listed.delete(location))throw new Error('package_unlisted_file');
  }
 };
 await inventory(root);if(listed.size)throw new Error('package_file_missing');
 const original=JSON.parse(await readFile(await filePath(root,'workflow-plan.json'),'utf8'));
 const portable=JSON.parse(await readFile(await filePath(root,'workflow-plan-portable.json'),'utf8'));
 if(planHash(original)!==manifest.workflow?.planSha256 || planHash(portable)!==manifest.workflow?.portablePlanSha256)throw new Error('package_plan_mismatch');
 const children=[];
 for(const child of manifest.children){
  if(!safe(child.root) || !Array.isArray(child.outputs) || !child.outputs.length)throw new Error('package_location_invalid');
  const childRoot=join(root,child.root);
  for(const output of child.outputs){
   if(!manifest.files[join(child.root,output.location)])throw new Error('package_manifest_invalid');
   await verifyArtifact(output,childRoot);
  }
  children.push({...child,root:childRoot});
 }
 for(const input of manifest.inputs??[]){
  if(!safe(input.root))throw new Error('package_location_invalid');
  await verifyArtifact(input.artifact,join(root,input.root));
 }
 return {...manifest,root,sha256:expectedSha256,children};
}

/** 仅打包已停止且技术核验通过的工作流；新目录独占发布，失败不覆盖用户目录。 */
export async function packageProject(ledger:TaskLedger,runKey:string,owner:string,authorization:string,destination:string):Promise<Record<string,any>>{
 if(!isAbsolute(destination) || resolve(destination)!==destination)throw new Error('package_output_invalid');
 try{await lstat(destination);throw new Error('package_output_exists');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
 const snapshot=ledger.packageSnapshot(runKey,owner,authorization);
 const sources:{root:string;outputs:any[]}[]=Object.values(snapshot.nodes).map((node:any)=>({root:node.root,outputs:node.outputs}));
 for(const node of snapshot.plan.nodes)for(const input of node.externalInputs??[])sources.push({root:input.root,outputs:[input.artifact]});
 for(const source of sources){
  const base=await realpath(source.root),delta=relative(base,destination);
  if(source.outputs.some(output=>output.nativeProjectRef) && (!delta || (!delta.startsWith('../') && !isAbsolute(delta))))throw new Error('package_output_inside_source');
  for(const output of source.outputs)await verifyArtifact(output,source.root);
 }
 await mkdir(dirname(destination),{recursive:true});
 const stage=await mkdtemp(join(dirname(destination),'.craft-package-'));
 let reservedInode:number|undefined;
 const files:Record<string,{sha256:string;bytes:number}>={};
 const add=async(location:string,bytes:Buffer|string)=>{
  if(!safe(location) || Object.hasOwn(files,location))throw new Error('package_location_invalid');
  const buffer=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
  await mkdir(dirname(join(stage,location)),{recursive:true});await writeFile(join(stage,location),buffer,{flag:'wx',mode:0o600});
  files[location]={sha256:hash(buffer),bytes:buffer.length};
 };
 const copy=async(source:string,location:string,digest:string,prefix:string)=>{
  const path=await filePath(source,location),target=join(prefix,location);
  if(!/^[a-f0-9]{64}$/.test(digest))throw new Error('package_manifest_invalid');
  await mkdir(dirname(join(stage,target)),{recursive:true});
  await copyFile(path,join(stage,target),constants.COPYFILE_EXCL);
  const actual=await fileDigest(join(stage,target));
  if(actual.sha256!==digest)throw new Error('package_source_changed');
  files[target]=actual;
 };
 const collect=async(root:string,outputs:any[],prefix:string,pluginId?:string)=>{
  const native=outputs.find(output=>output.nativeProjectRef);
  if(native){
   const evidence=native.evidenceRefs.filter((ref:any)=>ref.location==='manifest.json');
   if(evidence.length!==1)throw new Error('package_delivery_manifest_missing');
   const bytes=await readFile(await filePath(root,'manifest.json'));
   if(hash(bytes)!==evidence[0].sha256)throw new Error('package_source_changed');
   const manifest=JSON.parse(bytes.toString());
   if((pluginId && manifest.schema!==pluginId+'-delivery/v1') || !manifest.files || typeof manifest.files!=='object' || Array.isArray(manifest.files))throw new Error('package_delivery_manifest_invalid');
   for(const output of outputs){
    if(manifest.files[output.location]!==output.sha256 || !output.nativeProjectRef || manifest.files[output.nativeProjectRef.location]!==output.nativeProjectRef.sha256)throw new Error('package_delivery_manifest_invalid');
   }
   for(const [location,digest] of Object.entries(manifest.files))await copy(root,location,digest as string,prefix);
   for(const asset of Object.values(manifest.assets??{}) as any[])if(!asset || !safe(asset.path) || manifest.files[asset.path]!==asset.sha256)throw new Error('package_dependency_missing');
   await add(join(prefix,'manifest.json'),bytes);
  }else{
   const refs=new Map<string,string>();
   for(const output of outputs){refs.set(output.location,output.sha256);for(const ref of [...output.evidenceRefs,...output.renditions,output.lossReportRef].filter(Boolean))refs.set(ref.location,ref.sha256);}
   for(const [location,digest] of refs)await copy(root,location,digest,prefix);
  }
 };
 try{
  const children=[];
  for(const node of snapshot.plan.nodes){
   const record=snapshot.nodes[node.id],prefix='children/'+hash(node.id);
   await collect(record.root,record.outputs,prefix,node.runtimeIdentity.pluginId);
   children.push({nodeId:node.id,taskId:record.taskId,projectKey:node.projectKey,runtimeIdentity:node.runtimeIdentity,root:prefix,outputs:record.outputs});
  }
  const inputs:any[]=[],portable=structuredClone(snapshot.plan),seen=new Map<string,string>();
  for(const node of portable.nodes)for(const input of node.externalInputs??[]){
   const key=planHash({root:input.root,artifact:input.artifact});let prefix=seen.get(key);
   if(!prefix){prefix='inputs/'+key;await collect(input.root,[input.artifact],prefix);seen.set(key,prefix);inputs.push({root:prefix,artifact:input.artifact});}
   input.root=prefix;
  }
  await add('workflow-plan.json',json(snapshot.plan));
  await add('workflow-plan-portable.json',json(portable));
  await add('workflow-record.json',json({runKey,tasks:snapshot.tasks,budget:snapshot.budget,state:'review_ready'}));
  const manifest={schema:'craft-project-package/v1',state:'review_ready',workflow:{runKey,ownerId:owner,workflowId:snapshot.plan.workflowId,revision:snapshot.plan.revision,authorizationRef:authorization,planSha256:snapshot.planSha256,portablePlanSha256:planHash(portable)},children,inputs,files};
  const text=json(manifest),digest=hash(text);await writeFile(join(stage,'project.json'),text,{flag:'wx',mode:0o600});
  await verifyProjectPackage(stage,digest);
  // 源快照在发布前再核验，不能把复制期间的外部改动当作同一交付版本。
  for(const source of sources)for(const output of source.outputs)await verifyArtifact(output,source.root);
  ledger.packageSnapshot(runKey,owner,authorization);
  try{await mkdir(destination,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new Error('package_output_exists');throw error;}
  reservedInode=(await lstat(destination)).ino;
  await rename(stage,destination);reservedInode=undefined;
  return {schema:'craft-project-package-receipt/v1',state:'review_ready',root:destination,sha256:digest,runKey,children};
 }finally{
  await rm(stage,{recursive:true,force:true});
  if(reservedInode!==undefined){try{if((await lstat(destination)).ino===reservedInode)await rmdir(destination);}catch{/* 只清理本调用保留的空目录；用户写入的内容保留。 */}}
 }
}
