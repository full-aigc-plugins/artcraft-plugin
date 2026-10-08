/** 固定安装公开入口的长时间线完整导出；仅在显式提供隔离验收路径时运行。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile),hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const skill=process.env.CRAFT_PUBLIC_BIG_TIME_SKILL,runtime=process.env.CRAFT_PUBLIC_BIG_TIME_RUNTIME,output=process.env.CRAFT_PUBLIC_BIG_TIME_ROOT;
test('installed public workflow exports the full large-tick timeline and preserves exact handoff',{skip:!skill||!runtime||!output,timeout:900000},async()=>{
 const root=resolve(output!);await mkdir(root,{recursive:false});
 const python='/opt/anaconda3/bin/python3',image=join(root,'still.png'),start=9007199254740993n,frame=254016000000n/12n,end=start+frame;
 await exec(python,['-I','-B','-c',"import struct,zlib,sys\ndef chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)\nraw=(b'\\x00'+bytes([239,91,54,255])*32)*32\nopen(sys.argv[1],'wb').write(b'\\x89PNG\\r\\n\\x1a\\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',32,32,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw))+chunk(b'IEND',b''))",image]);
 const inputSha=hash(await readFile(image)),entry=join(resolve(skill!),'scripts/workflow.py'),entrySha=hash(await readFile(entry));
 const plan={workflowId:'public-big-time',revision:'v1',budget:{currency:'USD',maxMinorUnits:0,maxExternalCalls:0,maxRevisions:1},nodes:[{id:'film',pluginId:'filmcraft',providedAssets:['still'],dependsOn:[],projectKey:'long-film',expectedRevision:null,payload:{schemaVersion:'craft-skill-workflow/v1',plan:{document:{name:'Full large-tick export',width:32,height:32,frameRate:{num:12,den:1}},operations:[{command:'asset.import',params:{asset:'still'},as:'still'},{command:'timeline.place',params:{item:{$ref:'still.item'},track:'V1',time:String(start),sourceIn:'0',duration:String(frame),insert:false},as:'clip'}],frames:[String(start)],export:{audioRequired:false}},assetBindings:[{name:'still',assetId:'still'}],outputs:[{assetId:'long-film',location:'film.mp4',mediaType:'video/mp4'}]}}]};
 const planPath=join(root,'plan.json');await writeFile(planPath,JSON.stringify(plan,null,2)+'\n');
 const argv=['-I','-B',entry,planPath,'--output',join(root,'project'),'--owner','long-time-qa','--authorization','isolated-native-long-time','--runtime-home',resolve(runtime!),'--asset','still='+image];
 const started=Date.now();let child;
 try{child=await exec(python,argv,{timeout:840000,maxBuffer:16*1024*1024});}
 catch(error:any){await writeFile(join(root,'stdout'),error.stdout||'');await writeFile(join(root,'stderr'),error.stderr||'');await writeFile(join(root,'failed-call.json'),JSON.stringify({exitCode:error.code,killed:error.killed,seconds:(Date.now()-started)/1000,argv},null,2));throw error;}
 await writeFile(join(root,'stdout'),child.stdout);await writeFile(join(root,'stderr'),child.stderr);const result=JSON.parse(child.stdout);
 assert.equal(result.state,'review_ready',child.stdout);const node=result.nodes.film;assert.equal(node.status,'review_ready');
 const artifact=node.outputs.find((value:any)=>value.assetId==='long-film');assert.ok(artifact);const delivery=node.root;
 const native=JSON.parse(await readFile(join(delivery,'native.json'),'utf8')),probe=JSON.parse(await readFile(join(delivery,'export-probe.json'),'utf8'));
 assert.equal(native.sequence.duration,String(end));const clip=native.sequence.video.flatMap((track:any)=>track.items).find((value:any)=>value.start===String(start));assert.ok(clip);assert.equal(clip.duration,String(frame));
 const metadata=artifact.technicalMetadata;assert.equal(typeof metadata.durationTicks,'string');assert.ok(BigInt(metadata.durationTicks)>BigInt(Number.MAX_SAFE_INTEGER));assert.deepEqual(metadata.timeBase,{num:1,den:254016000000});assert.deepEqual(metadata.frameRate,{num:12,den:1});assert.equal(metadata.durationTicks,probe.duration);
 const delta=BigInt(probe.duration)-end;assert.ok((delta<0n?-delta:delta)<=frame);const exchanged=JSON.parse(JSON.stringify(artifact));assert.equal(BigInt(exchanged.technicalMetadata.durationTicks),BigInt(probe.duration));assert.equal(BigInt(exchanged.technicalMetadata.durationTicks)%frame,0n);
 for(const name of ['native.json','export-probe.json'])assert.ok(artifact.evidenceRefs.some((ref:any)=>ref.location===name&&ref.sha256));
 const media=join(delivery,artifact.location);assert.equal(hash(await readFile(media)),artifact.sha256);const decoded=JSON.parse((await exec('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',media],{timeout:300000,maxBuffer:4*1024*1024})).stdout);await writeFile(join(root,'ffprobe.json'),JSON.stringify(decoded,null,2));
 const video=decoded.streams.find((value:any)=>value.codec_type==='video');assert.deepEqual([video.width,video.height,video.avg_frame_rate],[32,32,'12/1']);assert.equal(BigInt(video.nb_read_frames),(end+frame-1n)/frame);
 assert.equal(hash(await readFile(image)),inputSha);assert.equal(hash(await readFile(entry)),entrySha);assert.equal(node.taskReceipt.runtimeIdentity.mode,'headless');assert.equal(node.taskReceipt.error,null);
 const install=JSON.parse(await readFile(join(root,'project/installation-receipt.json'),'utf8'));const proof={schema:'artcraft-public-big-time-export/v1',result:'PASS',platform:process.platform+'-'+process.arch,entrySha256:entrySha,sourcePlanSha256:hash(await readFile(planPath)),runtimeRoot:install.runtimeRoot,runtimeVersion:install.runtimeVersion,nativeSha256:install.skills.filmcraft.runtimeIdentity.sha256,startTicks:String(start),frameTicks:String(frame),nativeDurationTicks:String(end),exportDurationTicks:metadata.durationTicks,decodedFrames:video.nb_read_frames,artifact,taskReceipt:node.taskReceipt,delivery,projectSha256:hash(await readFile(join(delivery,'project.fcproj'))),inputSha256:inputSha,seconds:(Date.now()-started)/1000,scope:['actual installed Art public workflow','full sparse long-timeline export','native reopen and decimal tick preservation','entire movie independent frame decode','versioned public artifact and bound metadata','unchanged input and installed entry'],excluded:['creative quality','complete artifact protocol matrix','other platforms']};await writeFile(join(root,'proof.json'),JSON.stringify(proof,null,2)+'\n');
});
