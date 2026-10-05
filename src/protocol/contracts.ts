/** 公共协议的严格校验、规范化摘要与文件证据核对。 */
import { readFileSync, createReadStream } from 'node:fs';
import { realpath, stat, readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Schema = { [key: string]: any };
const taskSchema: Schema = JSON.parse(readFileSync(new URL('../../schemas/craft-task-v1.json', import.meta.url), 'utf8'));
const artifactSchema: Schema = JSON.parse(readFileSync(new URL('../../schemas/craft-artifact-v1.json', import.meta.url), 'utf8'));

/** 只解释本仓库 schema 使用的固定词汇；不加载外部 schema 或执行表达式。 */
function check(schema: Schema, value: any, path = '$'): void {
  const fail = () => { throw new Error(`protocol_invalid: ${path}`); };
  if (schema.anyOf) {
    if (!schema.anyOf.some((branch: Schema) => { try { check(branch, value, path); return true; } catch { return false; } })) fail();
    return;
  }
  if ('const' in schema && !isDeepStrictEqual(schema.const, value)) fail();
  if (schema.enum && !schema.enum.some((item: any) => isDeepStrictEqual(item, value))) fail();
  if (schema.type === 'null' && value !== null) fail();
  if (schema.type === 'boolean' && typeof value !== 'boolean') fail();
  if (schema.type === 'integer' && !Number.isSafeInteger(value)) fail();
  if (schema.type === 'string' && typeof value !== 'string') fail();
  if (schema.type === 'array' && !Array.isArray(value)) fail();
  if (schema.type === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) fail();
  if (typeof value === 'number' && ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum))) fail();
  if (typeof value === 'string') {
    if ((schema.minLength !== undefined && [...value].length < schema.minLength) || (schema.maxLength !== undefined && [...value].length > schema.maxLength)) fail();
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail();
    if (schema.format === 'date-time') {
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) fail();
      const expected = new Date(value).toISOString();
      if (expected.slice(0,19) !== value.slice(0,19)) fail();
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((item, index) => check(schema.items, item, `${path}[${index}]`));
  if (schema.type === 'object') {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) fail();
    for (const key of Object.keys(value)) {
      if (schema.properties?.[key]) check(schema.properties[key], value[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) fail();
    }
  }
}

/** 校验公共任务；payload 的领域语义由固定版本适配器负责。 */
export function validateTask(value: unknown): Record<string, any> {
  check(taskSchema, value);
  planHash(value as Json); // 嵌套 payload 也必须是无不安全数值的 JSON。
  return structuredClone(value) as Record<string, any>;
}

/** 校验公共素材；语义审阅不由文件摘要自动替代。 */
export function validateArtifact(value: unknown): Record<string, any> {
  check(artifactSchema, value);
  const artifact = value as Record<string, any>;
  if (artifact.technicalMetadata.durationTicks !== undefined && !artifact.technicalMetadata.timeBase) throw new Error('timebase_required');
  for (const dependency of artifact.dependencies) {
    if (dependency.packaged ? dependency.missingReason !== null : dependency.missingReason === null) throw new Error('dependency_packaging_invalid');
  }
  planHash(value as Json);
  return structuredClone(artifact);
}

/** 严格核对交换报告；派生物永不自动替代原生可编辑工程。 */
export function validateExchangeLossReport(value:unknown):Record<string,any> {
  const schema=JSON.parse(readFileSync(new URL('../../schemas/craft-exchange-loss-v1.json',import.meta.url),'utf8'));
  check(schema,value);planHash(value as Json);const report=value as Record<string,any>;
  const safe=(location:string)=>!isAbsolute(location) && !/[\\:\x00]/.test(location) && !location.split('/').some(part=>['','..','.'].includes(part));
  const seen=new Set<string>();
  for(const ref of [report.native,report.inspection,report.psdInspection,...report.outputs].filter(Boolean)){
    if(!safe(ref.location))throw new Error('loss_report_location_invalid');
  }
  const names={filmcraft:'project.fcproj',effectcraft:'project.ecproj',photocraft:'project.pcraft',vectorcraft:'project.vectorcraft'};
  if(report.native.location!==names[report.pluginId as keyof typeof names] || report.inspection.location!=='native.json')throw new Error('loss_report_native_invalid');
  for(const output of report.outputs){
    if(seen.has(output.location) || output.location.split('.').at(-1)!==output.format || !output.changes.length)throw new Error('loss_report_output_invalid');
    seen.add(output.location);
  }
  return structuredClone(report);
}

/** 本地版本的规范化 JSON，按码点排序键并拒绝不安全的整数。 */
export function planHash(value: Json): string {
  function canonical(item: Json): string {
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item))) throw new Error('unsafe_number');
      return JSON.stringify(item);
    }
    if (Array.isArray(item)) return '[' + item.map(canonical).join(',') + ']';
    if (typeof item !== 'object' || Object.getPrototypeOf(item) !== Object.prototype) throw new Error('non_json_value');
    return '{' + Object.keys(item).sort().map(key => JSON.stringify(key) + ':' + canonical(item[key])).join(',') + '}';
  }
  return createHash('sha256').update(canonical(value)).digest('hex');
}

/** 公共交付路径仅支持包内相对文件；解析真实路径后阻止穿越与外逃符号链接。 */
async function allowedPath(root: string, location: string): Promise<string> {
  if (!location || isAbsolute(location) || /[\\:\x00]/.test(location) || location.split('/').some(part => part === '..' || part === '')) throw new Error('location_invalid');
  const base = await realpath(root);
  const target = await realpath(resolve(base, location));
  const difference = relative(base, target);
  if (difference.startsWith('../') || isAbsolute(difference) || !difference) throw new Error('location_invalid');
  return target;
}

function matchesMime(prefix: Buffer, type: string): boolean {
  if (type === 'application/octet-stream') return true;
  if (type === 'image/png') return prefix.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'application/pdf') return prefix.subarray(0,5).toString() === '%PDF-';
  if (type === 'image/jpeg') return prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255;
  if (type === 'video/mp4') return prefix.subarray(4,8).toString() === 'ftyp';
  if (type === 'image/svg+xml') return /^\s*(?:<\?xml[^>]*>\s*)?<svg\b/.test(prefix.toString('utf8'));
  throw new Error('media_type_unsupported: ' + type);
}

/** 实际读取文件，检查摘要、字节数和支持的 MIME 文件签名。 */
export async function verifyArtifact(value: unknown, root: string): Promise<Record<string, any>> {
  const artifact = validateArtifact(value);
  const target = await allowedPath(root, artifact.location);
  const before = await stat(target);
  if (!before.isFile()) throw new Error('artifact_not_file');
  let bytes = 0;
  let prefix = Buffer.alloc(0);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(target)) {
    const buffer = chunk as Buffer;
    bytes += buffer.length;
    hash.update(buffer);
    if (prefix.length < 4096) prefix = Buffer.concat([prefix,buffer.subarray(0,4096-prefix.length)]);
  }
  const after = await stat(target);
  if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('artifact_changed_during_read');
  if (bytes !== artifact.bytes || hash.digest('hex') !== artifact.sha256) throw new Error('artifact_digest_mismatch');
  if (!matchesMime(prefix, artifact.mediaType)) throw new Error('media_type_mismatch');
  // 源工程、交换表示与证据也是当前交付的一部分，不能只核验平面输出。
  const references=[artifact.nativeProjectRef,artifact.lossReportRef,...artifact.renditions,...artifact.evidenceRefs].filter(Boolean);
  for(const reference of references){
    const path=await allowedPath(root,reference.location);
    const referenceHash=createHash('sha256');
    for await(const chunk of createReadStream(path))referenceHash.update(chunk);
    if(referenceHash.digest('hex')!==reference.sha256)throw new Error('artifact_reference_mismatch');
  }
  if(artifact.lossReportRef){
    const reportPath=await allowedPath(root,artifact.lossReportRef.location);
    if((await stat(reportPath)).size>16*1024*1024)throw new Error('loss_report_too_large');
    const report=validateExchangeLossReport(JSON.parse(await readFile(reportPath,'utf8')));
    if(!artifact.nativeProjectRef || report.native.location!==artifact.nativeProjectRef.location || report.native.sha256!==artifact.nativeProjectRef.sha256)throw new Error('loss_report_native_mismatch');
    if(artifact.location!==report.native.location && !report.outputs.some((output:any)=>output.location===artifact.location && output.sha256===artifact.sha256))throw new Error('loss_report_output_mismatch');
    for(const ref of [report.inspection,report.psdInspection,...report.outputs].filter(Boolean)){
      const path=await allowedPath(root,ref.location),digest=createHash('sha256');for await(const chunk of createReadStream(path))digest.update(chunk);
      if(digest.digest('hex')!==ref.sha256)throw new Error('loss_report_evidence_mismatch');
    }
  }
  return artifact;
}
