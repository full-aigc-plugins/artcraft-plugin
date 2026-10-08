/** 结构夹具显式生成快照；原生测试只读取其现有受信文件。 */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
export async function lockNativeSchema(files:{path:string;sha256:string}[],structuralFixture=false){
 const path=join(dirname(dirname(files[0].path)),'references/native-command-snapshot.json');
 if(structuralFixture){
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,JSON.stringify({tools:[{name:'fixture_only',inputSchema:{type:'object'}}]}));
 }
 files.push({path,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});
}
