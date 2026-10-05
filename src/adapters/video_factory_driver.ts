/** 监督器内的外部验证驱动，只调用固定公开 argv，输出摘要绑定报告。 */
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,delimiter} from 'node:path';
import {createHash} from 'node:crypto';
const hash=(value:Buffer)=>createHash('sha256').update(value).digest('hex');
try{
 const job=JSON.parse(readFileSync(process.argv[2],'utf8'));
 if(hash(readFileSync(job.input.path))!==job.input.sha256)throw new Error('video_factory_input_changed');
 const env={...process.env,PATH:[dirname(job.ffmpeg),dirname(job.ffprobe)].join(delimiter)};
 const invoke=(args:string[])=>JSON.parse(execFileSync(job.nodeExecutable,[job.entry,...args],{encoding:'utf8',env,maxBuffer:16*1024*1024,timeout:300000}));
 const probe=invoke(['probe']);if(!probe.available || probe.required.ffmpeg!==job.ffmpeg || probe.required.ffprobe!==job.ffprobe)throw new Error('video_factory_media_tools_missing');
 invoke(['validate-plan',job.planFile]);
 const result=invoke(['evaluate',job.input.path,job.planFile,'--stage','final']);
 if(hash(readFileSync(job.input.path))!==job.input.sha256)throw new Error('video_factory_input_changed');
 writeFileSync(job.output,JSON.stringify({schema:'craft-video-evaluation/v1',input:job.input,planSha256:hash(readFileSync(job.planFile)),result})+'\n',{flag:'wx'});
}catch(error){process.stderr.write((error as Error).message+'\n');process.exitCode=1;}
