/**
 * Converts verified source .gltf/.glb into self-contained source/high/low GLBs,
 * with PBR texture compression, weld/dedup and mesh simplification.
 *
 * Dependencies (only in the build runner):
 * npm install --no-save --package-lock=false @gltf-transform/core@4.5.1
 *   @gltf-transform/extensions@4.5.1 @gltf-transform/functions@4.5.1
 *   meshoptimizer@0.25.0 sharp@0.34.5
 *
 * node tools/build-creature-library.mjs .creature-import-inputs/approved-inputs.json
 *                                      assets/creatures/external
 */
import {readFile,mkdir,writeFile,stat,realpath,rm} from 'node:fs/promises';
import {resolve,relative,dirname,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,weld,simplify,textureCompress} from '@gltf-transform/functions';
import {MeshoptSimplifier} from 'meshoptimizer';
import sharp from 'sharp';

const inputsFile=resolve(process.argv[2]||'.creature-import-inputs/approved-inputs.json');
const output=resolve(process.argv[3]||'assets/creatures/external');
const config=JSON.parse(await readFile(inputsFile,'utf8'));
if(config.schema!=='hai-gin/creature-approved-inputs/v1'||!Array.isArray(config.entries))
  throw Error('Input manifest must be verified and explicit');
const allowedIds=/^(?:m(?:00[1-9]|0[1-4][0-9]|050)|wolf|horse|wyvern|dragon|elder_dragon|dragon_lord|forest_archer|seraph_guardian)$/;
const root=await realpath(dirname(inputsFile));
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const toMB=n=>Number((n/1048576).toFixed(2));
function info(doc){
 let triangles=0,vertices=0,meshes=0;
 for(const mesh of doc.getRoot().listMeshes()){
   meshes++;
   for(const p of mesh.listPrimitives()){
     const index=p.getIndices(),pos=p.getAttribute('POSITION');
     vertices+=pos?.getCount()||0;
     if(p.getMode()===4)triangles+=Math.floor((index?.getCount()||pos?.getCount()||0)/3);
   }
 }
 return {triangles,vertices,meshes,
   animations:doc.getRoot().listAnimations().map(a=>a.getName()||'clip'),
   textures:doc.getRoot().listTextures().length,
   materials:doc.getRoot().listMaterials().length};
}
async function safeSource(entry){
 if(!allowedIds.test(entry.id)||entry.license!=='CC0-1.0'||
   !entry.sourceUrl?.startsWith('https://quaternius.com/')||
   !entry.sourceSha256?.match(/^[a-f0-9]{64}$/))
   throw Error('Unauthorized source metadata: '+JSON.stringify(entry));
 const resolved=await realpath(entry.sourceFile);
 const relativePath=relative(root,resolved);
 if(relativePath.startsWith('..'+sep)||relativePath==='..'||relativePath.startsWith(sep))
   throw Error('Source file outside manifest directory: '+entry.id);
 if(!/\.(glb|gltf)$/i.test(resolved))throw Error('Expected GLB/glTF: '+resolved);
 const len=(await stat(resolved)).size;
 if(len<=0||len>16_000_000)throw Error('Source is empty or too large: '+entry.id);
 const data=await readFile(resolved);
 if(createHash('sha256').update(data).digest('hex')!==entry.sourceSha256)
   throw Error('Checksum mismatch: '+entry.id);
 return resolved;
}
const registry={
 schema:'hai-gin/creature-library/v1',
 provenance:'Verified CC0 external sources only; candidate previews, no automatic game combat replacement',
 entries:{}
};
await mkdir(output,{recursive:true});
for(const entry of config.entries){
 if(registry.entries[entry.id])throw Error('Duplicate creature asset: '+entry.id);
 const sourceFile=await safeSource(entry),dir=join(output,entry.id);
 await mkdir(dir,{recursive:true});
 const srcDoc=await io.read(sourceFile),srcMetrics=info(srcDoc);
 if(!srcMetrics.triangles||srcMetrics.triangles>3_000_000)
   throw Error('Invalid creature source topology: '+entry.id);
 const sourceOut=join(dir,'source.glb');
 await io.write(sourceOut,srcDoc);
 const highDoc=await io.read(sourceOut);
 await highDoc.transform(dedup(),weld(),prune());
 await highDoc.transform(textureCompress({
   encoder:sharp,targetFormat:'webp',slots:/^(?!normalTexture).*$/,
   resize:[1024,1024]
 }));
 const highOut=join(dir,'high.glb');
 await io.write(highOut,highDoc);
 const lowDoc=await io.read(highOut);
 await lowDoc.transform(weld(),simplify({
   simplifier:MeshoptSimplifier,ratio:.44,error:.025,lockBorder:true
 }),prune());
 await lowDoc.transform(textureCompress({encoder:sharp,targetFormat:'webp',
   slots:/^(?!normalTexture).*$/,resize:[512,512]}));
 const lowOut=join(dir,'low.glb');
 await io.write(lowOut,lowDoc);
 const high=info(await io.read(highOut)),low=info(await io.read(lowOut));
 if(high.triangles<1||low.triangles<1||low.triangles>high.triangles*1.01)
   throw Error('Invalid optimized geometry: '+entry.id);
 if(srcMetrics.animations.length && (!high.animations.length||!low.animations.length))
   throw Error('Animations lost during optimization: '+entry.id);
 const size={
   source:toMB((await stat(sourceOut)).size),
   high:toMB((await stat(highOut)).size),
   low:toMB((await stat(lowOut)).size)
 };
 registry.entries[entry.id]={
   name:entry.name,
   match:entry.match||'candidate',
   targetHeight:entry.targetHeight,
   sourceUrl:entry.sourceUrl,
   mirroredFile:entry.mirroredFile,
   license:entry.license,licenseUrl:entry.licenseUrl,
   author:entry.author,
   sourceSha256:entry.sourceSha256,
   models:{
     source:'./assets/creatures/external/'+entry.id+'/source.glb',
     high:'./assets/creatures/external/'+entry.id+'/high.glb',
     low:'./assets/creatures/external/'+entry.id+'/low.glb'
   },
   metrics:{source:srcMetrics,high,low},
   sizeMB:size
 };
 console.log(entry.id+' triangles '+srcMetrics.triangles+' → '+high.triangles+
   ' → '+low.triangles+' / '+JSON.stringify(size)+' MiB');
}
await writeFile(join(output,'registry.json'),JSON.stringify(registry,null,2)+'\n');
console.log('Approved external 3D creature library: '+config.entries.length+' items');
