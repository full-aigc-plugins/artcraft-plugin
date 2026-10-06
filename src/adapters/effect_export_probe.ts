/** 固定 Effect CLI 在独立内存工程中的媒体导入与查询响应。 */
const invalid=():never=>{throw new Error('brief_export_probe_invalid');};
/** 不接受工程声明或同名的其他素材；三步结果必须绑定唯一导入视频。 */
export function parseEffectExportProbe(stdout:string):{width:number;height:number;frameRate:number;duration:number}{
 let responses:any;try{responses=JSON.parse(stdout);}catch{invalid();}
 if(!Array.isArray(responses) || responses.length!==3 || responses[0]?.command!=='file.import' || responses[1]?.command!=='project.summary' || responses[2]?.command!=='file.interpretFootage')invalid();
 const imported=responses[0].result,items=responses[1].result?.items,rates=responses[2].result?.items;
 if(!imported || !Array.isArray(imported.errors) || imported.errors.length || !Array.isArray(imported.items) || imported.items.length!==1 || imported.items[0]!==1 || !Array.isArray(items) || items.length!==1 || items[0].id!==1 || items[0].type!=='Video' || !Array.isArray(rates) || rates.length!==1 || rates[0].item!==1)invalid();
 const [width,height]=items[0].size??[],duration=items[0].duration,frameRate=rates[0].frameRate;
 if(![width,height].every(value=>Number.isInteger(value)&&value>0&&value<=16384) || typeof duration!=='number' || !Number.isFinite(duration) || duration<=0 || typeof frameRate!=='number' || !Number.isFinite(frameRate) || frameRate<1 || frameRate>240)invalid();
 return {width,height,frameRate,duration};
}
