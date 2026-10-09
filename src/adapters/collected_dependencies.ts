/** 把已核验的领域收集事实映射为公共依赖与包内文件证据。 */
import {createHash} from 'node:crypto';

/** 内部引用保留 location；发布时拆分为现有依赖身份与完整 evidenceRef，不扩展协议字段。 */
export function collectedDependencies(manifest:any,bindings:any[],source:any,sourceManifest:any,namespace:string):any[]{
 const result:any[]=[],seen=new Set<string>();
 for(const [alias,collected] of Object.entries(manifest.assets??{}) as [string,any][]){
  if(!collected || typeof collected.path!=='string' || !/^[a-f0-9]{64}$/.test(collected.sha256) || manifest.files?.[collected.path]!==collected.sha256)throw new Error('skill_dependency_uncollected');
  const kind=collected.kind==='lut'?'lut':'media',bound=bindings.filter(binding=>binding.alias===alias);
  if(bound.length>1)throw new Error('skill_dependency_ambiguous');
  let references:any[]=[];
  if(bound.length){
   const input=bound[0].artifact;
   if((bound[0].kind==='lut'?'lut':'media')!==kind || (input.sha256!==collected.sha256 && !(collected.kind==='image-sequence' && input.sha256===collected.sourceSequenceSha256)))throw new Error('skill_dependency_uncollected');
   if(input.sha256===collected.sha256)references=[input];
  }else{
   const prior=sourceManifest?.assets?.[alias];
   // 只继承同别名、同字节和同类型的历史身份；变化后的文件不能冒充原输入版本。
   if(prior?.sha256===collected.sha256 && (prior.kind==='lut'?'lut':'media')===kind){
    references=[...(source?.dependencies??[]).filter((d:any)=>d.kind===kind).map((d:any)=>d.assetRef),...(source?.sourceRefs??[])].filter(ref=>ref?.sha256===collected.sha256);
   }
  }
  if(!references.length){
   // 未知原始血缘和规范化字节只登记收集素材身份；不把该身份伪装为原始输入 sourceRef。
   const scope=bound[0]?.artifact.assetId??namespace;
   const assetId='collected-'+createHash('sha256').update(JSON.stringify([scope,alias])).digest('hex').slice(0,32);
   references=[{assetId,version:collected.sha256,sha256:collected.sha256}];
  }
  for(const reference of references){
   const assetRef={assetId:reference.assetId,version:reference.version,sha256:reference.sha256,location:collected.path};
   const key=JSON.stringify([assetRef.assetId,assetRef.version,assetRef.sha256,kind]);
   if(!seen.has(key)){seen.add(key);result.push({assetRef,kind,packaged:true,missingReason:null});}
  }
 }
 return result;
}
