/** Film 固定原生 CLI 的 ticks 与探测报告映射；不从浮点秒反推时间。 */
const ticksPerSecond=254016000000n;
const invalid=():never=>{throw new Error('film_export_metadata_invalid');};
const ticks=(value:unknown):bigint=>{
 if(typeof value!=='string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value)>9223372036854775807n)invalid();
 return BigInt(value as string);
};
const dimension=(value:unknown)=>typeof value==='number' && Number.isInteger(value) && value>0 && value<=16384 ? value : invalid();
const frameRate=(value:any)=>{
 if(!value || ![value.num,value.den].every(n=>Number.isSafeInteger(n)&&n>0) || value.num/value.den<1 || value.num/value.den>240)invalid();
 return {num:value.num as number,den:value.den as number};
};

/** 参数为已绑定摘要的原生与导出 JSON、导出文件名及实际字节数；返回公共技术元数据。 */
export function filmExportMetadata(nativeText:string,probeText:string,location:string,bytes:number):Record<string,any>{
 let native:any,probe:any;try{native=JSON.parse(nativeText);probe=JSON.parse(probeText);}catch{invalid();}
 const settings=native?.sequence?.settings,video=probe?.video;
 if(!settings || !video || probe.kind!=='Movie' || probe.name!==location || probe.file_size!==bytes || typeof video.has_alpha!=='boolean')invalid();
 const duration=ticks(probe.duration),nativeDuration=ticks(native.sequence.duration);
 const rate=frameRate(video.frame_rate),nativeRate=frameRate(settings.frame_rate);
 const width=dimension(video.width),height=dimension(video.height);
 if(width!==dimension(settings.width) || height!==dimension(settings.height) || BigInt(rate.num)*BigInt(nativeRate.den)!==BigInt(nativeRate.num)*BigInt(rate.den))invalid();
 // 原生固定 CLI 的 Tick 约定为每秒254016000000；外部声明不能改写它。
 if(probe.timeBase!==undefined && (!probe.timeBase || Object.keys(probe.timeBase).sort().join(',')!=='den,num' || probe.timeBase.num!==1 || probe.timeBase.den!==Number(ticksPerSecond)))invalid();
 const difference=duration-nativeDuration;
 // 以整数交叉乘比较一帧容差，避免大整数转Number或先整除导致边界损失。
 if((difference<0n?-difference:difference)*BigInt(rate.num)>ticksPerSecond*BigInt(rate.den))invalid();
 const result:Record<string,any>={durationTicks:probe.duration,timeBase:{num:1,den:Number(ticksPerSecond)},frameRate:rate,width,height,alpha:video.has_alpha};
 if(probe.audio!==null && probe.audio!==undefined){
  const audio=probe.audio;
  if(!Number.isSafeInteger(audio.sample_rate) || audio.sample_rate<=0 || !Number.isSafeInteger(audio.channels) || audio.channels<=0)invalid();
  result.audio={sampleRate:audio.sample_rate,channels:audio.channels};
 }
 return result;
}
