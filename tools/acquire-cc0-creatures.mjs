/**
 * Download a *pinned* CC0 Quaternius sample from a documented open-source mirror.
 * This is a preview library, not an assertion of AAA quality or an automatic
 * replacement of user-authored monsters. No other hosts/files are downloaded.
 *
 * node tools/acquire-cc0-creatures.mjs [manifest] [outputDir]
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const manifestPath=resolve(process.argv[2]||'data/creature-external-sources.json');
const output=resolve(process.argv[3]||'.creature-import-inputs');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
if(manifest.schema!=='hai-gin/creature-source-manifest/v1')throw Error('Unknown source manifest');
const u=manifest.upstream;
if(u.author!=='Quaternius'||u.license!=='CC0-1.0'||
 !/^[a-f0-9]{40}$/.test(u.mirrorCommit)||
 u.mirror!=='https://github.com/kxpedro/vp-game'||
 u.mirrorPath!=='assets/enemies/quaternius_ultimate_monsters')
 throw Error('Unverified source, version or license');
if(!Array.isArray(manifest.entries)||manifest.entries.length>50)throw Error('Invalid source entries');
const base='https://raw.githubusercontent.com/kxpedro/vp-game/'+
  u.mirrorCommit+'/'+u.mirrorPath+'/';
const sha256=b=>createHash('sha256').update(b).digest('hex');
async function download(name){
 if(!/^[A-Za-z0-9_-]+\.(?:gltf|png)$/.test(name))throw Error('Unsafe source name: '+name);
 const url=base+name;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
 try{
  const response=await fetch(url,{signal:controller.signal,redirect:'error'});
  if(!response.ok)throw Error('HTTP '+response.status+' '+url);
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>15_000_000)throw Error('File exceeds 15 MB: '+name);
  const data=Buffer.from(await response.arrayBuffer());
  if(data.length===0||data.length>15_000_000)throw Error('Invalid file size: '+name);
  return data;
 }finally{clearTimeout(timer);}
}
const used=new Set(),inputs=[];
await mkdir(output,{recursive:true});
for(const entry of manifest.entries){
 if(!/^(m0(?:[1-4][0-9]|50)|(?:wolf|horse|wyvern|dragon|elder_dragon|dragon_lord|forest_archer|seraph_guardian))$/.test(entry.id)||
   !/^[A-Za-z0-9_-]+\.gltf$/.test(entry.file)||used.has(entry.id))
    throw Error('Invalid or duplicated creature id/file: '+JSON.stringify(entry));
 if(!(entry.targetHeight>0&&entry.targetHeight<15))throw Error('Invalid height: '+entry.id);
 used.add(entry.id);
 const dir=join(output,entry.id);
 await mkdir(dir,{recursive:true});
 const data=await download(entry.file);
 const parsed=JSON.parse(data.toString('utf8'));
 if(parsed.asset?.version!=='2.0'||!parsed.meshes?.length)
  throw Error('Not a 3D glTF model: '+entry.file);
 // Remote binary references are not allowed. The certified mirrored files
 // embed their buffer data in a data: URI; external dependencies are PNG only.
 for(const buffer of parsed.buffers||[]){
   if(typeof buffer.uri!=='string'||!buffer.uri.startsWith('data:'))
     throw Error('External/remote buffer not permitted: '+entry.file);
 }
 const dependencies=[];
 for(const image of parsed.images||[]){
   if(!image.uri||image.uri.startsWith('data:')||image.bufferView!=null)continue;
   if(!/^[A-Za-z0-9_-]+\.png$/.test(image.uri))
     throw Error('Unsafe external texture path: '+image.uri);
   const imageData=await download(image.uri);
   await writeFile(join(dir,image.uri),imageData);
   dependencies.push({file:image.uri,sha256:sha256(imageData)});
 }
 await writeFile(join(dir,entry.file),data);
 inputs.push({
   id:entry.id,name:entry.displayName,match:entry.match,
   sourceFile:join(dir,entry.file),targetHeight:entry.targetHeight,
   author:u.author,license:u.license,licenseUrl:u.licenseUrl,
   sourceUrl:u.official,mirroredFile:base+entry.file,
   sourceSha256:sha256(data),dependencies
 });
 console.log(entry.id+' '+entry.file+': '+(data.length/1024).toFixed(0)+
  ' KiB, animations '+(parsed.animations?.length||0)+', textures '+dependencies.length);
}
const registry={schema:'hai-gin/creature-approved-inputs/v1',entries:inputs};
await writeFile(join(output,'approved-inputs.json'),JSON.stringify(registry,null,2)+'\n');
console.log('Approved CC0 mirror inputs: '+inputs.length);
