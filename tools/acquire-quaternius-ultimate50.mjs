/**
 * Official Quaternius Ultimate Monsters (50 distinct glTF models).
 * Mirror is an immutable GitHub commit and every source is SHA256 recorded.
 * No unrestricted URLs, credentials, login pages or user-provided paths.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const path=resolve(process.argv[2]||'data/quaternius-ultimate50-sources.json');
const out=resolve(process.argv[3]||'.creature-ultimate50-inputs');
const j=JSON.parse(await readFile(path,'utf8'));
const expected={
  schema:'hai-gin/quaternius-ultimate50-sources/v1',
  mirror:'mlflabs/brain',mirrorCommit:'54b3258a7ab6558fee969100aafb24ff285e0f0e',
  license:'CC0-1.0',official:'https://quaternius.com/packs/ultimatemonsters.html',
};
for(const [k,v] of Object.entries(expected))if(j[k]!==v)
 throw Error('Unapproved source '+k+': '+j[k]);
if(!Array.isArray(j.entries)||j.entries.length!==50)throw Error('Expected 50 original model records');
const names=new Set(),ids=new Set();
for(const e of j.entries){
 const m=/^assets\/Ultimate Monsters\/(Big|Blob|Flying)\/glTF\/([A-Za-z0-9_]+\.gltf)$/.exec(e.sourcePath||'');
 if(!m||m[1]!==e.group||m[2]!==e.file||!/^(q0[0-4][0-9]|q050)$/.test(e.id)
   ||ids.has(e.id)||names.has(e.sourcePath)||!(e.targetHeight>0&&e.targetHeight<15))
  throw Error('Unsafe or repeated source: '+JSON.stringify(e));
 ids.add(e.id);names.add(e.sourcePath);
}
const hash=b=>createHash('sha256').update(b).digest('hex');
const base='https://raw.githubusercontent.com/mlflabs/brain/'+expected.mirrorCommit+'/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function download(path){
 if(!/^assets\/Ultimate Monsters\/(Big|Blob|Flying)\/glTF\/[A-Za-z0-9_]+\.(gltf|png)$/.test(path))
   throw Error('Rejected remote source path: '+path);
 const uri=base+path.split('/').map(encodeURIComponent).join('/');
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);
  try{
   const res=await fetch(uri,{signal:controller.signal,redirect:'error'});
   if(!res.ok)throw Error('HTTP '+res.status+' '+uri);
   const size=Number(res.headers.get('content-length')||0);
   if(size>16_000_000)throw Error('Source exceeds size limit');
   const bytes=Buffer.from(await res.arrayBuffer());
   if(!bytes.length||bytes.length>16_000_000)throw Error('Empty/oversized source');
   return bytes;
  }catch(err){lastError=err;if(attempt<2)await sleep((attempt+1)*800);}
  finally{clearTimeout(timeout);}
 }
 throw lastError;
}
const tasks=j.entries;
let cursor=0,results=new Array(tasks.length);
await mkdir(out,{recursive:true});
async function worker(){
 while(cursor<tasks.length){
  const n=cursor++,e=tasks[n],dir=join(out,e.id);
  await mkdir(dir,{recursive:true});
  const bytes=await download(e.sourcePath);
  const doc=JSON.parse(bytes.toString('utf8'));
  if(doc.asset?.version!=='2.0'||!doc.meshes?.length||
     !doc.nodes?.length||!doc.animations?.length)
   throw Error('3D animation/geometry missing: '+e.id);
  if((doc.buffers||[]).some(b=>typeof b.uri!=='string'||!b.uri.startsWith('data:')))
   throw Error('External buffers not allowed: '+e.id);
  const deps=[];
  for(const img of doc.images||[]){
   if(!img.uri||img.bufferView!=null||img.uri.startsWith('data:'))continue;
   if(!/^[A-Za-z0-9_]+\.png$/.test(img.uri))
    throw Error('Unsafe image URI: '+img.uri);
   const texturePath=e.sourcePath.replace(/[^/]+$/,img.uri);
   const png=await download(texturePath);
   await writeFile(join(dir,img.uri),png);
   deps.push({file:img.uri,sha256:hash(png)});
  }
  await writeFile(join(dir,e.file),bytes);
  results[n]={
    id:e.id,name:e.name+' ('+e.group+')',match:'library',
    group:e.group,sourceFile:join(dir,e.file),targetHeight:e.targetHeight,
    author:'Quaternius',license:'CC0-1.0',
    licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',
    sourceUrl:expected.official,mirroredFile:base+e.sourcePath.split('/').map(encodeURIComponent).join('/'),
    sourceSha256:hash(bytes),dependencies:deps,
  };
  console.log(e.id+' '+e.group+'/'+e.file+' : '+bytes.length+' bytes, '+
    doc.animations.length+' clips');
 }
}
await Promise.all(Array.from({length:4},()=>worker()));
if(results.some(x=>!x)||new Set(results.map(x=>x.sourceSha256)).size!==50)
 throw Error('Could not fetch 50 distinct original models');
await writeFile(join(out,'approved-inputs.json'),JSON.stringify({
 schema:'hai-gin/creature-approved-inputs/v1',
 entries:results
},null,2)+'\n');
console.log('Collected all '+results.length+' unique CC0 animated monster glTF files');
