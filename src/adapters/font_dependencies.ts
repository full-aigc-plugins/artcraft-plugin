/** 从原生检查事实提取字体需求；不以字体名称推断字体文件已收集。 */
export function photoFontDependencies(inspection:any,nativeProjectSha256:string,inspectionRef:any):any[]{
 const families=new Set<string>();
 const visit=(layers:any,depth:number)=>{
  if(!Array.isArray(layers) || depth>128)throw new Error('font_inspection_invalid');
  for(const layer of layers){
   if(!layer || typeof layer!=='object')throw new Error('font_inspection_invalid');
   if(layer.kind==='Type'){
    const family=layer.text?.font;
    if(typeof family!=='string' || !family.trim() || [...family].length>256)throw new Error('font_inspection_invalid');
    families.add(family);
   }
   if(layer.layers!==undefined)visit(layer.layers,depth+1);
  }
 };
 visit(inspection?.layers,0);
 return [...families].sort().map(family=>({assetRef:null,kind:'font',packaged:false,missingReason:'font_file_not_collected',fontRequirement:{family,nativeProjectSha256,inspectionRef}}));
}
