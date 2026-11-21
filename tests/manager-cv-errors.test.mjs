import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';

test('CV file preview reports a useful error without writing records', async t => {
 const dir=await mkdtemp(join(tmpdir(),'ibraxis-cv-preview-'));
 const port=31000+Math.floor(Math.random()*18000);
 const child=spawn(process.execPath,['app/server.mjs'],{
  env:{...process.env,HOST:'127.0.0.1',PORT:String(port),
   DATA_DIR:join(dir,'checkpoints'), DB_PATH:join(dir,'test.sqlite'),
   OWNER_PASSWORD:'isolated-cv-test-password', GITHUB_DATA_TOKEN:'',
   GITHUB_DATA_REPO:'', GITHUB_DATA_BOOTSTRAP:'0',
   AI_PROVIDER:'',AI_MODEL:'',AI_API_KEY:'',OLLAMA_MODEL:''},
 });
 let stopped=false;
 child.on('exit',()=>{stopped=true});
 t.after(async()=>{
  if(!stopped){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
  await rm(dir,{recursive:true,force:true});
 });
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('CV test server startup timed out')),12000);
  child.stdout.once('data',()=>{clearTimeout(timer);resolve()});
  child.once('exit',code=>{clearTimeout(timer);reject(Error('CV test server exited '+code))});
 });
 const base=`http://127.0.0.1:${port}`;
 async function post(route,payload,cookie=''){
  const response=await fetch(`${base}/api/${route}`,{
   method:'POST',headers:{'content-type':'application/json',origin:base,
    'x-ibraxis-request':'1',...(cookie?{cookie}:{})},
   body:JSON.stringify(payload),
  });
  return {status:response.status,data:await response.json()};
 }
 const login=await fetch(base+'/api/login',{
  method:'POST',headers:{'content-type':'application/json',origin:base},
  body:JSON.stringify({password:'isolated-cv-test-password'}),
 });
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const preview=input=>post('ai/manager/ingest/preview',{input},cookie);
 const accidentalText=await preview({type:'text',text:''});
 assert.equal(accidentalText.status,400);
 assert.equal(accidentalText.data.code,'BAD_INPUT');
 assert.match(accidentalText.data.error,/فهم الملفات/);
 const pdf={type:'file',filename:'CV.pdf',data:Buffer.from('%PDF-1.4\ntruncated\n').toString('base64')};
 const brokenPdf=await preview(pdf);
 assert.ok([422,503].includes(brokenPdf.status));
 assert.notEqual(brokenPdf.data.error,'Invalid request');
 // A truncated PDF may be rejected as invalid when the reader is installed.
 assert.ok(['PDF_READER_UNAVAILABLE','PDF_READ_FAILED','PDF_INVALID'].includes(brokenPdf.data.code),
  `Unexpected PDF error code: ${brokenPdf.data.code}`);
 assert.ok(brokenPdf.data.error.length>15);
 const notPdf=await preview({...pdf,data:Buffer.from('not a pdf').toString('base64')});
 assert.equal(notPdf.status,422);
 assert.equal(notPdf.data.code,'FILE_SIGNATURE');
 const executable=await preview({type:'file',filename:'cv.exe',data:Buffer.from('abc').toString('base64')});
 assert.equal(executable.status,422);
 assert.equal(executable.data.code,'UNSUPPORTED_FILE');
 const malformed=await preview({...pdf,data:'not-base64'});
 assert.equal(malformed.status,400);
 assert.equal(malformed.data.code,'BAD_INPUT');
 const prepare=await post('ai/manager/ingest/prepare',{input:pdf,selectedIds:['invalid']},cookie);
 assert.ok([422,503].includes(prepare.status));
 assert.notEqual(prepare.data.error,'Invalid request');
 const records=await fetch(base+'/api/records',{headers:{cookie}});
 assert.equal(records.status,200);
 assert.equal((await records.json()).filter(record=>['education','career','certification','skill'].includes(record.kind)).length,0);
});
