/** 需求记录的闭合字段、授权与按交付检查。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { assessBrief, nodeBriefConstraints, validateBrief } from '../src/planning/project_brief.ts';
function fixture(){
 const budget={currency:'USD',maxMinorUnits:0,maxRevisions:2,maxExternalCalls:0};
 const deliverables=[{id:'logo',nativeFormat:'.vectorcraft',width:320,height:180,dependsOn:[],execution:'local'},{id:'poster',nativeFormat:'.pcraft',width:320,height:400,dependsOn:['logo'],execution:'local'},{id:'icon',nativeFormat:'.vectorcraft',width:32,height:32,dependsOn:[],execution:'local'}];
 const brief={schema:'craft-brief/v1',workflowId:'brand',revision:'brief-v1',ownerId:'user',authorizationRef:'scope',budget,brand:{name:'NOVA',colors:['#ef5b36'],fonts:['Arial'],appliesTo:['logo','poster'],referenceAssets:[]},subjects:[],dataPolicy:{allowUpload:false},ambiguities:[],deliverables};
 const plan={workflowId:'brand',ownerId:'user',authorizationRef:'scope',budget,nodes:deliverables.map((item,index)=>({id:item.id,dependsOn:item.dependsOn,runtimeIdentity:{pluginId:index===1?'photocraft':'vectorcraft'},payload:{plan:{document:{width:item.width,height:item.height},operations:[]}}}))};
 return {brief,plan};
}
test('Brief checks ready plan and keeps unrelated constraints independent',()=>{
 const {brief,plan}=fixture();assert.equal(assessBrief(brief,plan).state,'ready');const before=nodeBriefConstraints(brief,'icon');brief.brand.colors=['#2366e8'];assert.deepEqual(nodeBriefConstraints(brief,'icon'),before);assert.equal(nodeBriefConstraints(brief,'logo').brand.colors[0],'#2366e8');
});
test('Brief ambiguity blocks consumers and reports independent checks',()=>{
 const {brief,plan}=fixture();(brief.ambiguities as any[]).push({id:'name',question:'Confirm name',affects:['logo']});const result=assessBrief(brief,plan);assert.deepEqual(result.ready,['icon']);assert.deepEqual(result.blocked.map(row=>row.nodeId),['logo','poster']);
});
test('Brief rejects unknown fields, malformed dependencies, cycles and mismatched authority',()=>{
 const {brief,plan}=fixture();assert.throws(()=>validateBrief({...brief,extra:true}),/brief_schema_invalid/);const invalid=structuredClone(brief);(invalid.deliverables[0].dependsOn as any[]).push({});assert.throws(()=>validateBrief(invalid),/brief_dependency_invalid/);invalid.deliverables[0].dependsOn=['poster'];assert.throws(()=>validateBrief(invalid),/brief_dependency_cycle/);assert.throws(()=>assessBrief(brief,{...plan,authorizationRef:'other'}),/brief_authorization_mismatch/);assert.throws(()=>assessBrief(brief,{...plan,budget:{...plan.budget,maxMinorUnits:1}}),/brief_budget_mismatch/);
});
test('Brief refuses format substitution, upload, stale references and document conflicts',()=>{
 for(const [change,reason] of [
  [(b:any,p:any)=>b.deliverables[0].nativeFormat='jianying-draft','capability_missing'],
  [(b:any,p:any)=>p.nodes[0].runtimeIdentity.pluginId='filmcraft','native_format_mismatch'],
  [(b:any,p:any)=>b.deliverables[0].execution='cloud','upload_forbidden'],
  [(b:any,p:any)=>b.brand.referenceAssets=[{assetId:'ref',version:'v1',sha256:'a'.repeat(64)}],'reference_asset_missing_or_stale'],
  [(b:any,p:any)=>p.nodes[0].payload.plan.document.width=100,'document_size_mismatch'],
  [(b:any,p:any)=>p.nodes[0].payload.plan.operations=[{params:{font:'Other'}}],'brand_font_mismatch'],
 ] as const){const {brief,plan}=fixture();change(brief,plan);assert.ok(assessBrief(brief,plan).blocked[0].reasons.includes(reason));}
});

test('Brief cannot omit a requested deliverable from the execution plan',()=>{
 const {brief,plan}=fixture();plan.nodes=plan.nodes.filter(node=>node.id!=='icon');assert.throws(()=>assessBrief(brief,plan),/brief_plan_deliverable_missing/);
});
