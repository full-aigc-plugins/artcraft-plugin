/** 复用前从完整原生证据重建字体需求，拒绝旧缓存省略的字体记录。 */
import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {verifyArtifact} from '../protocol/contracts.ts';
import {domainFontDependencies} from './font_dependencies.ts';

const projects:Record<string,string>={photocraft:'project.pcraft',vectorcraft:'project.vectorcraft',filmcraft:'project.fcproj',effectcraft:'project.ecproj'};
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

/** 核验指定领域公共产物；不更新账本、原生文件或旧的公共依赖记录。 */
export async function verifyDomainFontOutput(root:string,output:Record<string,any>,pluginId:string,runtimeSha256:string):Promise<void>{
 const project=projects[pluginId],native=output.nativeProjectRef;
 if(!project || native?.location!==project)throw new Error('font_inspection_missing');
 const manifests=output.evidenceRefs.filter((ref:any)=>ref.location==='manifest.json');
 if(manifests.length!==1)throw new Error('font_inspection_missing');
 const readJson=async(location:string,digest:string)=>{
  if(typeof digest!=='string' || !/^[a-f0-9]{64}$/.test(digest))throw new Error('font_inspection_invalid');
  const bytes=(await stat(join(root,location))).size;
  if(bytes>16*1024*1024)throw new Error('font_inspection_invalid');
  // 通用文件合同负责段内符号链接、摘要和读期间变更检查；原工程字体记录不会污染单文件核验。
  await verifyArtifact({...output,location,version:digest,sha256:digest,bytes,mediaType:'application/json',nativeProjectRef:null,dependencies:[],evidenceRefs:[],renditions:[],lossReportRef:null,technicalMetadata:{}},root);
  const content=await readFile(join(root,location));
  if(content.length>16*1024*1024 || hash(content)!==digest)throw new Error('font_inspection_invalid');
  try{return JSON.parse(content.toString('utf8'));}catch{throw new Error('font_inspection_invalid');}
 };
 const manifest=await readJson('manifest.json',manifests[0].sha256);
 if(manifest.schema!==pluginId+'-delivery/v1' || manifest.runtimeSha256!==runtimeSha256 || manifest.files?.[project]!==native.sha256)throw new Error('font_inspection_invalid');
 const location=['filmcraft','effectcraft'].includes(pluginId)?project:'native.json',digest=manifest.files?.[location];
 const inspection=await readJson(location,digest);
 const references=output.evidenceRefs.filter((ref:any)=>ref.location===location && ref.sha256===digest);
 const expected=domainFontDependencies(pluginId,inspection,native.sha256,references[0]);
 const actual=output.dependencies.filter((dependency:any)=>dependency.kind==='font');
 if(expected.length && references.length!==1)throw new Error('font_dependency_mismatch');
 // 字体清单顺序不改变语义；重复、额外、缺失、错误状态或引用均不能混入复用。
 const ordered=(values:any[])=>[...values].sort((a,b)=>String(a.fontRequirement?.family).localeCompare(String(b.fontRequirement?.family)));
 if(!isDeepStrictEqual(ordered(actual),ordered(expected)))throw new Error('font_dependency_mismatch');
}
