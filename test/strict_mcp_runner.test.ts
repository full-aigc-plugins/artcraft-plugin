/** 自有启动器的严格文本解码及已有错误响应兼容性。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {strictMcpRunner} from '../src/adapters/strict_mcp_runner.ts';
const exec=promisify(execFile);
test('strict MCP runner rejects ambiguous inner JSON without retry and retains valid/error contracts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'art-strict-mcp-'));
 try{
  const runner=join(root,'runner.py'),module=join(root,'mcp_session.py'),entry=join(root,'entry.py'),count=join(root,'calls');
  await writeFile(runner,strictMcpRunner);
  await writeFile(module,`import json,sys\nfrom pathlib import Path\nclass Session:\n def request(self,method,params):\n  with Path(sys.argv[2]).open('a') as f:f.write('request\\n')\n  return json.loads(sys.argv[1])\n`);
  await writeFile(entry,`import importlib.util,sys,json\ns=importlib.util.spec_from_file_location('fixture',sys.argv[3]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nprint(json.dumps(m.Session().request(sys.argv[4],{})))\n`);
  const cases=[
   {text:'{"saved":true,"nested":{"x":1.5},"items":[1,null]}',valid:true},
   {text:'[true,1,"ok"]',valid:true},
   {text:'{"x":NaN}',valid:false},
   {text:'{"x":Infinity}',valid:false},
   {text:'{"x":-Infinity}',valid:false},
   {text:'{"x":1e9999}',valid:false},
   {text:'{"nested":[{"x":-1e9999}]}',valid:false},
   {text:'{"x":1,"x":2}',valid:false},
   {text:'{"x":1,"\\u0078":2}',valid:false},
   {text:'{"nested":{"x":1,"x":2}}',valid:false},
   {text:'not-json',valid:false},
   {text:'native operation refused',valid:true,isError:true},
   {text:'initialize text',valid:true,method:'initialize'},
  ];
  for(const [index,item] of cases.entries()){
   const reply={content:[{type:'text',text:item.text}],...(item.isError?{isError:true}:{})};
   const result=await exec(process.env.CRAFT_TEST_PYTHON||'python3',['-I','-B',runner,module,entry,JSON.stringify(reply),count,module,item.method||'tools/call']).then(value=>({code:0,...value}),error=>({code:error.code,stdout:error.stdout,stderr:error.stderr}));
   assert.equal(result.code===0,item.valid,JSON.stringify({index,result}));
   if(item.valid)assert.deepEqual(JSON.parse(result.stdout),reply);
   else assert.match(result.stderr,/outcome_unknown: invalid_tool_content_json; request not retried/);
   assert.equal((await readFile(count,'utf8')).trim().split('\n').length,index+1);
  }
 }finally{await rm(root,{recursive:true,force:true});}
});
