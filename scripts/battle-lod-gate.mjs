#!/usr/bin/env node
/** Inspect true binary GLB output; do not certify photorealism from file size. */
import fs from 'node:fs';
import crypto from 'node:crypto';
export function inspectGlb(bytes){
 if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||
    bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB header');
 const len=bytes.readUInt32LE(12);
 if(len<2||20+len>bytes.length||bytes.toString('ascii',16,20)!=='JSON')throw Error('Missing GLB JSON chunk');
 const json=JSON.parse(bytes.subarray(20,20+len).toString('utf8'));
 if(!Array.isArray(json.meshes)||!json.meshes.length)throw Error('Empty GLB mesh');
 let triangles=0;
 for(const mesh of json.meshes)for(const primitive of mesh.primitives||[]){
  if((primitive.mode??4)!==4)throw Error('Unexpected non-triangle primitive');
  const accessor=Number.isInteger(primitive.indices)?json.accessors?.[primitive.indices]:
    json.accessors?.[primitive.attributes?.POSITION];
  if(!accessor||accessor.count<3)throw Error('Missing mesh accessor');
  triangles+=Math.floor(accessor.count/3);
 }
 if(!triangles)throw Error('No triangles');
 return {triangles,meshParts:json.meshes.length,materials:json.materials?.length||0,
  skins:json.skins?.length||0,animations:json.animations?.length||0,
  morphs:json.meshes.reduce((n,m)=>n+(m.primitives||[]).reduce((x,p)=>x+(p.targets?.length||0),0),0)};
}
export function verifyLodCandidate(manifest,read=p=>fs.readFileSync(p)){
 if(!/^[a-z0-9][a-z0-9_-]{0,49}$/.test(manifest.id)||
   manifest.schema!=='hai-gin/battle-lod-candidate/v1'||
   manifest.generatedFor!=='candidate-review'||manifest.liveModelReplaced!==false||
   manifest.mobileFpsApproved!==false||manifest.pixelComparisonApproved!==false)
  throw Error('Unsafe production status or invalid candidate manifest');
 const source=read(manifest.source),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
 if(hash(source)!==manifest.sourceSha256)throw Error('Master SHA changed');
 const original=inspectGlb(source),stats={};
 for(const tier of ['near','mid','far']){
  const v=manifest.tiers?.[tier];
  if(!v||v.path!=='assets/battle-lod-candidates/'+manifest.id+'/'+tier+'.glb')
   throw Error('Missing/unsafe '+tier+' output');
  const bytes=read(v.path);
  if(hash(bytes)!==v.sha256)throw Error(tier+' SHA mismatch');
  const current=inspectGlb(bytes);
  if(current.triangles!==v.triangles||current.meshParts!==v.meshParts)
   throw Error(tier+' scene stats differ from exported GLB');
  if(original.skins&&!current.skins)throw Error(tier+' lost skin');
  if(original.animations&&!current.animations)throw Error(tier+' lost animation');
  if(original.morphs&&current.morphs<original.morphs)throw Error(tier+' lost morph');
  stats[tier]=current;
 }
 if(stats.near.triangles>original.triangles*1.05||
   stats.mid.triangles>=stats.near.triangles*.95||
   stats.far.triangles>=stats.mid.triangles*.95)
  throw Error('Real triangle reduction was not achieved');
 if(Object.values(stats).some(s=>s.meshParts>original.meshParts||s.materials>original.materials))
  throw Error('Mesh parts/materials increased');
 return {id:manifest.id,source:original,tiers:stats,status:'GEOMETRY_PASS_VISUAL_PENDING'};
}
if(process.argv[1]?.endsWith('battle-lod-gate.mjs')){
 if(process.argv.length<3)throw Error('Pass manifest paths');
 for(const path of process.argv.slice(2))
  console.log(JSON.stringify(verifyLodCandidate(JSON.parse(fs.readFileSync(path,'utf8')))));
}
