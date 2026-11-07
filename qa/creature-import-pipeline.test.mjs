import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
const sources=JSON.parse(readFileSync(new URL('../data/creature-external-sources.json',import.meta.url),'utf8'));
const registry=JSON.parse(readFileSync(new URL('../assets/creatures/external/registry.json',import.meta.url),'utf8'));
assert.equal(sources.schema,'hai-gin/creature-source-manifest/v1');
assert.equal(sources.upstream.license,'CC0-1.0');
assert.match(sources.upstream.mirrorCommit,/^[a-f0-9]{40}$/);
assert.ok(sources.upstream.official.startsWith('https://quaternius.com/'));
assert.equal(registry.schema,'hai-gin/creature-library/v1');
const allowed=/^(?:m(?:00[1-9]|0[1-4][0-9]|050)|wolf|horse|wyvern|dragon|elder_dragon|dragon_lord|forest_archer|seraph_guardian)$/;
const ids=new Set();
for(const source of sources.entries){
 assert.match(source.id,allowed);
 assert.ok(!ids.has(source.id),'Duplicate source id '+source.id);
 ids.add(source.id);
 assert.match(source.file,/^[A-Za-z0-9_-]+\.gltf$/);
}
if(process.env.CREATURE_REQUIRE_IMPORTS==='1')
 assert.equal(Object.keys(registry.entries).length,sources.entries.length,
  'Pipeline must build all provenance-verified entries');

function parseGLB(file){
 const bytes=readFileSync(file);
 assert.ok(bytes.length>=20,file+' GLB is incomplete');
 assert.equal(bytes.toString('ascii',0,4),'glTF',file+' bad GLB magic');
 assert.equal(bytes.readUInt32LE(4),2,file+' must be GLB v2');
 assert.equal(bytes.readUInt32LE(8),bytes.length,file+' has invalid length header');
 const jsonLength=bytes.readUInt32LE(12);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 assert.ok(jsonLength>5&&20+jsonLength<=bytes.length);
 return JSON.parse(bytes.toString('utf8',20,20+jsonLength));
}
for(const [id,entry] of Object.entries(registry.entries)){
 assert.match(id,allowed);
 assert.ok(ids.has(id),'GLB lacks registered provenance '+id);
 assert.equal(entry.license,'CC0-1.0');
 assert.equal(entry.author,'Quaternius');
 assert.match(entry.sourceSha256,/^[a-f0-9]{64}$/);
 assert.ok(entry.models?.source&&entry.models.high&&entry.models.low);
 const triangles=[];
 for(const tier of ['source','high','low']){
  const rel=entry.models[tier];
  assert.equal(rel,'./assets/creatures/external/'+id+'/'+tier+'.glb');
  const file=resolve(new URL('..',import.meta.url).pathname,rel.slice(2));
  assert.ok(existsSync(file),file+' must exist');
  assert.ok(statSync(file).size>100,'Empty GLB');
  const json=parseGLB(file);
  assert.ok(json.meshes?.length,'Missing mesh in '+file);
  assert.ok(json.nodes?.length,'Missing node in '+file);
  assert.ok(!json.extensionsRequired?.includes('EXT_meshopt_compression'),
    'Compressed geometry must carry a runtime decoder; not enabled');
  assert.ok(!json.extensionsRequired?.includes('KHR_draco_mesh_compression'));
  const t=entry.metrics?.[tier]?.triangles;
  assert.ok(Number.isFinite(t)&&t>0,'Triangle count invalid');
  triangles.push(t);
  if(entry.metrics.source.animations.length){
    assert.ok((json.animations?.length||0)>0,'Animation lost in '+tier);
  }
 }
 assert.ok(triangles[2]<=triangles[1]*1.01,'Low LOD must not be denser than high '+id);
}
console.log('CC0 sourced creature models: '+Object.keys(registry.entries).length+
 ' / expected '+sources.entries.length+'; GLB topology, provenance and animation checks PASS');
