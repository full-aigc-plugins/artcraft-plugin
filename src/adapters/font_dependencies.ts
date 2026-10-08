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

/** 统一四领域字体映射；原生 JSON 只用于字体事实，不重写工程或时间数值。 */
export function domainFontDependencies(pluginId:string,inspection:any,nativeProjectSha256:string,inspectionRef:any):any[]{
 if(pluginId==='photocraft')return photoFontDependencies(inspection,nativeProjectSha256,inspectionRef);
 const families=new Set<string>();let nodes=0;
 const invalid=():never=>{throw new Error('font_inspection_invalid');};
 const add=(family:any)=>{
  if(typeof family!=='string' || !family.trim() || [...family].length>256)invalid();
  families.add(family);
 };
 const walk=(value:any,depth:number,visit:(value:any)=>void)=>{
  if(depth>128 || ++nodes>1000000)invalid();
  if(!value || typeof value!=='object')return;
  if(!Array.isArray(value))visit(value);
  for(const child of Object.values(value))walk(child,depth+1,visit);
 };
 if(pluginId==='vectorcraft'){
  if(!Array.isArray(inspection?.layers))invalid();
  walk(inspection,0,value=>{
   if(value.type==='text'){
    if(!Array.isArray(value.runs))invalid();
    for(const run of value.runs)add(run?.style?.font_family);
   }
  });
 }else if(pluginId==='filmcraft'){
  if(inspection?.format!=='filmcraft.project' || inspection.schema_version!==12 || !inspection.project || typeof inspection.project!=='object' || Array.isArray(inspection.project) || !inspection.project.items || typeof inspection.project.items!=='object' || Array.isArray(inspection.project.items))invalid();
  walk(inspection.project,0,value=>{
   if(value.effect==='graphic_text' && value.params?.font===undefined)add('Inter'); // schema12 的图形文字默认字体。
   if(value.caption_tracks!==undefined){
    if(!Array.isArray(value.caption_tracks))invalid();
    for(const track of value.caption_tracks)add(track?.style?.font);
   }
   if(Object.hasOwn(value,'font') && value.font!==null){
    if(typeof value.font==='string')add(value.font);
    else{
     const parameter=value.font;
     if(!parameter || typeof parameter!=='object')invalid();
     add(parameter.value?.Text);
     if(parameter.keyframes!==undefined){
      if(!Array.isArray(parameter.keyframes))invalid();
      for(const key of parameter.keyframes)add(key?.value?.Text);
     }
    }
   }
  });
 }else if(pluginId==='effectcraft'){
  if(inspection?.schema!==1 || !inspection.items || typeof inspection.items!=='object' || Array.isArray(inspection.items))invalid();
  walk(inspection.items,0,value=>{
   if(value.t==='Text'){
    const doc=value.v;add(doc?.font);
    if(doc.runs!==undefined){
     if(!Array.isArray(doc.runs))invalid();
     for(const run of doc.runs)add(run?.style?.font);
    }
   }
   // 原生 Source Text 的旧字符串值按 TextDoc::plain 使用 Inter；不把文字本身当作字体。
   if(value.node==='Prop' && value.match==='sourceText'){
    if(value.keys!==undefined && !Array.isArray(value.keys))invalid();
    for(const text of [value.value,...(value.keys??[]).map((key:any)=>key?.value)]){
     if(text?.t==='Str' && typeof text.v==='string')add('Inter');
     else if(text?.t!=='Text')invalid();
    }
   }
  });
 }else invalid();
 return [...families].sort().map(family=>({assetRef:null,kind:'font',packaged:false,missingReason:'font_file_not_collected',fontRequirement:{family,nativeProjectSha256,inspectionRef}}));
}
