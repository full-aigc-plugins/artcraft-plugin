/** 有界采集子进程输出，仅持久化摘要与已知错误码，不保存用户文本。 */
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

export type OutputDigest={bytes:number;sha256:string;truncated:boolean;complete:boolean};
export type NativeDiagnostics={schema:'craft-native-diagnostics/v1';domainCode:string|null;source:'stdout'|'stderr'|null;stdout:OutputDigest;stderr:OutputDigest};
const limit=16384;
const codes=new Set(['protected_region_changed','missing_fonts','unsupported_command','unsupported_mapping','parameter_contract_identity_mismatch','parameter_schema_mismatch','revision_conflict','asset_checksum_mismatch','asset_svg_external_dependency','unresolved_reference','invalid_source','export_missing','export_audio_missing','editable_layer_gate_failed','invalid_export','protected_source_required','command_failed']);

/** 持续排空管道并计算全部已观察字节摘要，结构化解析缓冲最多 16 KiB。 */
export class OutputObservation {
 private hash=createHash('sha256');
 private bytes=0;
 private chunks:Buffer[]=[];
 private complete=false;
 constructor(stream:Readable){
  stream.on('data',(value:Buffer)=>{
   const chunk=Buffer.isBuffer(value) ? value : Buffer.from(value);
   this.hash.update(chunk);this.bytes+=chunk.length;
   if(this.bytes<=limit)this.chunks.push(chunk);else this.chunks=[];
  });
  stream.once('end',()=>{this.complete=true;});
  stream.on('error',()=>{this.complete=false;});
 }
 /** 仅在进程 close 后调用一次；超限和不完整输出不解析错误。 */
 finish():{digest:OutputDigest;code:string|null}{
  let code:string|null=null;
  if(this.complete && this.bytes<=limit){
   try{
    const value=JSON.parse(Buffer.concat(this.chunks).toString('utf8'));
    if(value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).length===1 && typeof value.error==='string'){
     const prefix=value.error.split(':',1)[0];if(codes.has(prefix))code=prefix;
    }
   }catch{} // 非结构化输出只保留字节数和摘要，不猜测原因。
  }
  this.chunks=[];
  return {digest:{bytes:this.bytes,sha256:this.hash.digest('hex'),truncated:this.bytes>limit,complete:this.complete},code};
 }
}

/** 两条管道报告不同错误码时不选择其中之一；输出仍是未验证的子任务报告。 */
export function nativeDiagnostics(stdout:OutputObservation,stderr:OutputObservation):NativeDiagnostics {
 const out=stdout.finish(),err=stderr.finish();
 const conflict=out.code && err.code && out.code!==err.code;
 return {schema:'craft-native-diagnostics/v1',domainCode:conflict ? null : out.code ?? err.code,source:conflict ? null : out.code ? 'stdout' : err.code ? 'stderr' : null,stdout:out.digest,stderr:err.digest};
}
