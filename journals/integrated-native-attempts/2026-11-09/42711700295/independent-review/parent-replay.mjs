import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const root=path.resolve(import.meta.dirname,'..'),run='42711700295',source='c338a93c97ffebeeef318e679ff82b7dbf309dd5'
const original=path.join(root,`out/native-ci-${run}`),receipts=`${original}-receipts`,output=path.join(root,`out/native-review-${run}`),copy=path.join(output,'parent-replay'),cache=path.join(root,'out/frozen-native-source-c338a93')
const hash=x=>createHash('sha256').update(x).digest('hex')
const members=JSON.parse(fs.readFileSync(path.join(receipts,'members.json')))
assert.equal(members.source,source);assert.equal(hash(fs.readFileSync(`${original}.zip`)),members.archiveSha256)
function verifyOriginal(){const actual=[];function walk(dir){for(const name of fs.readdirSync(dir)){const full=path.join(dir,name),stat=fs.lstatSync(full);assert.ok(!stat.isSymbolicLink());if(stat.isDirectory())walk(full);else{const bytes=fs.readFileSync(full);actual.push({path:path.relative(original,full),size:bytes.length,sha256:hash(bytes)})}}}walk(original);actual.sort((a,b)=>a.path.localeCompare(b.path));assert.deepEqual(actual,members.members);return actual.length}
const before=verifyOriginal();fs.mkdirSync(output,{recursive:true});assert.ok(!fs.existsSync(copy));fs.cpSync(original,copy,{recursive:true,errorOnExist:true,force:false})
const startedAt=new Date().toISOString();const result=spawnSync(process.execPath,[path.join(cache,'scripts/verify-native-integrated.mjs'),copy],{cwd:cache,env:{...process.env,RUSTUP_TOOLCHAIN:'1.88.0'},encoding:'utf8',timeout:600000,maxBuffer:32*1024*1024})
const log=path.join(output,'parent-replay.log');fs.writeFileSync(log,result.stdout+'\n'+result.stderr,{flag:'wx'});const after=verifyOriginal()
const outputs={}
for(const name of ['qualification.json','integrated-qualification.json'])if(fs.existsSync(path.join(copy,name))){const bytes=fs.readFileSync(path.join(copy,name));outputs[name]={sha256:hash(bytes),originalExists:fs.existsSync(path.join(original,name))};if(outputs[name].originalExists){assert.deepEqual(bytes,fs.readFileSync(path.join(original,name)));outputs[name].byteEqualOriginal=true}}
const receipt={schema:'tpnil-native-parent-independent-replay@1',claim:'INDEPENDENT_REPLAY_REQUIRES_JOINED_REVIEW',run,source,startedAt,endedAt:new Date().toISOString(),status:result.status,signal:result.signal,error:result.error?.message,originalMembersUnchanged:{before,after,verified:true},logSha256:hash(fs.readFileSync(log)),outputs}
fs.writeFileSync(path.join(output,'parent-replay.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));if(result.status!==0)process.exitCode=1
