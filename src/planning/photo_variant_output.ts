/** PhotoCraft 尺寸证据必须在新交付、依赖交接与复用时重新核验。 */
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {planHash,verifyArtifact} from '../protocol/contracts.ts';
import type {WorkflowNode} from './workflow_engine.ts';
const digest=(x:Buffer)=>createHash('sha256').update(x).digest('hex');
const invalid=():never=>{throw new Error('photo_variant_evidence_invalid');};
const same=(a:unknown,b:unknown)=>a===undefined||b===undefined ? a===b : planHash(a)===planHash(b);
const size=(value:any)=>Array.isArray(value)&&value.length===2&&value.every(v=>Number.isInteger(v)&&v>0&&v<=16384);
const rectangle=(value:any)=>Array.isArray(value)&&value.length===4&&value.every(v=>typeof v==='number'&&Number.isFinite(v));
const geometry=(command:any)=>['image.canvasSize','image.imageSize'].includes(command);
function roleId(value:any,bindings:any):number{
 let id=value;
 if(value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).length===1 && typeof value.$ref==='string'){
  const parts=value.$ref.split('.');id=bindings?.[parts.shift()!];for(const key of parts)id=id?.[key];
 }
 if(!Number.isSafeInteger(id)||id<=0)invalid();return id;
}
/** 不执行原生写入；缺失或陈旧记录只阻止复用，不重放副作用。 */
export async function verifyPhotoVariantOutput(root:string,outputs:Record<string,any>[],node:WorkflowNode):Promise<void>{
 const requested=node.payload?.plan?.variant;
 if(node.runtimeIdentity.pluginId!=='photocraft'||requested===undefined)return;
 const output=outputs[0],refs=output?.evidenceRefs?.filter((ref:any)=>ref.location==='manifest.json');
 if(!output||refs?.length!==1||output.nativeProjectRef?.location!=='project.pcraft')throw new Error('photo_variant_evidence_missing');
 for(const item of outputs)await verifyArtifact(item,root);
 const manifestBytes=await readFile(join(root,'manifest.json'));
 if(digest(manifestBytes)!==refs[0].sha256)throw new Error('photo_variant_evidence_stale');
 const manifest=JSON.parse(manifestBytes.toString());
 if(manifest.layoutVariant?.path!=='layout-variant.json'||!manifest.files?.['layout-variant.json'])throw new Error('photo_variant_evidence_missing');
 if(manifest.schema!=='photocraft-delivery/v1'||manifest.runtimeSha256!==node.runtimeIdentity.sha256||manifest.files['project.pcraft']!==output.nativeProjectRef.sha256||manifest.sourceProjectSha256!==node.expectedRevision||!(/^[a-f0-9]{64}$/.test(node.expectedRevision??'')))invalid();
 if(manifest.layoutVariant.sha256!==manifest.files['layout-variant.json'])invalid();
 for(const item of outputs)if(item.nativeProjectRef?.sha256!==output.nativeProjectRef.sha256||!item.evidenceRefs?.some((ref:any)=>ref.location==='manifest.json'&&ref.sha256===refs[0].sha256))invalid();
 const load=async(name:string)=>{
  const expected=manifest.files[name];if(typeof expected!=='string'||!(/^[a-f0-9]{64}$/.test(expected)))throw new Error('photo_variant_evidence_missing');
  const bytes=await readFile(join(root,name));if(digest(bytes)!==expected)throw new Error('photo_variant_evidence_stale');return JSON.parse(bytes.toString());
 };
 const [layout,native,operations,savedPlan]=await Promise.all(['layout-variant.json','native.json','operations.json','plan.json'].map(load));
 if(!same(savedPlan.variant,requested)||!same(layout.safeArea,requested.safeArea)||!size([requested.width,requested.height])||!same(layout.targetSize,[requested.width,requested.height])||!same(layout.targetSize,[native.width,native.height])||layout.schema!=='photocraft-layout-variant/v1'||!size(layout.sourceSize)||!rectangle(requested.safeArea))invalid();
 const [x,y,w,h]=requested.safeArea;if(x<0||y<0||w<=0||h<=0||x+w>requested.width||y+h>requested.height)invalid();
 if(!Array.isArray(native.layers)||!requested.roles||!same(Object.keys(requested.roles).sort(),['background','product','text'])||!layout.roles)invalid();
 const identities=new Set<number>();
 for(const role of ['background','product','text']){
  const identity=roleId(requested.roles[role],manifest.bindings);if(identities.has(identity))invalid();identities.add(identity);
  const recorded=layout.roles[role],layers=native.layers.filter((layer:any)=>layer.id===identity);if(layers.length!==1)invalid();const layer=layers[0];
  if(!recorded||recorded.id!==identity||recorded.kind!==layer.kind||recorded.name!==layer.name||!same(recorded.bounds,layer.bounds)||!same(recorded.text??null,layer.text??null)||layer.visible!==true||!rectangle(layer.bounds))invalid();
  if(role==='text'&&(layer.kind!=='Type'||!layer.text))invalid();
  const [a,b,c,d]=layer.bounds;if(role!=='background'&&(c<=0||d<=0||a<x||b<y||a+c>x+w||b+d>y+h))invalid();
 }
 if(!Array.isArray(operations)||!Array.isArray(layout.steps)||!Array.isArray(node.payload.plan.operations))invalid();
 const commands=node.payload.plan.operations.filter((op:any)=>geometry(op.command));
 const receipts=operations.map((receipt:any,index:number)=>({receipt,index})).filter(({receipt}:any)=>receipt.tool==='command_run'&&geometry(receipt.arguments?.id));
 if(!commands.length||commands.length!==layout.steps.length||commands.length!==receipts.length)invalid();
 let previous=layout.sourceSize;
 for(let index=0;index<commands.length;index++){
  const step=layout.steps[index],{receipt, index:position}=receipts[index],before=operations[position-1];
  if(!step||step.command!==commands[index].command||receipt.arguments.id!==step.command||before?.tool!=='doc_inspect'||!same(step.before,[before.result?.width,before.result?.height])||!same(step.before,previous)||!size(step.before)||!size(step.after)||!same(step.after,[receipt.result?.width,receipt.result?.height]))invalid();
  const [ow,oh]=step.before,[nw,nh]=step.after;
  if(step.command==='image.canvasSize'){
   if(!Array.isArray(step.offset)||step.offset.length!==2||!step.offset.every(Number.isSafeInteger)||!same(step.offset,receipt.result.offset))invalid();
   const [dx,dy]=step.offset;
   const crop={left:Math.max(0,-dx),top:Math.max(0,-dy),right:Math.max(0,ow+dx-nw),bottom:Math.max(0,oh+dy-nh)};
   const padding={left:Math.max(0,dx),top:Math.max(0,dy),right:Math.max(0,nw-ow-dx),bottom:Math.max(0,nh-oh-dy)};
   if(!same(step.crop,crop)||!same(step.padding,padding))invalid();
  }else if(!same(step.scale,[nw/ow,nh/oh]))invalid();
  previous=step.after;
 }
 if(!same(previous,layout.targetSize))invalid();
}
