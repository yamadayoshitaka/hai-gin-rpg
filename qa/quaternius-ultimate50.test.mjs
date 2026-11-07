import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
const manifest=JSON.parse(readFileSync(new URL('../data/quaternius-ultimate50-sources.json',import.meta.url),'utf8'));
const registry=JSON.parse(readFileSync(new URL('../assets/creatures/quaternius50/registry.json',import.meta.url),'utf8'));
assert.equal(manifest.schema,'hai-gin/quaternius-ultimate50-sources/v1');
assert.equal(manifest.license,'CC0-1.0');
assert.equal(manifest.official,'https://quaternius.com/packs/ultimatemonsters.html');
assert.equal(manifest.mirrorCommit,'54b3258a7ab6558fee969100aafb24ff285e0f0e');
assert.equal(manifest.entries.length,50,'50 original files required');
const expectedCounts={Big:16,Blob:17,Flying:17},counts={Big:0,Blob:0,Flying:0};
const ids=new Set(),paths=new Set();
for(const row of manifest.entries){
 assert.match(row.id,/^q(?:00[1-9]|0[1-4][0-9]|050)$/);
 assert.ok(!ids.has(row.id));ids.add(row.id);
 assert.ok(!paths.has(row.sourcePath));paths.add(row.sourcePath);
 assert.match(row.sourcePath,/^assets\/Ultimate Monsters\/(Big|Blob|Flying)\/glTF\/[A-Za-z0-9_]+\.gltf$/);
 assert.ok(row.sourcePath.endsWith('/'+row.file));
 assert.ok(row.targetHeight>0&&row.targetHeight<15);
 counts[row.group]++;
}
assert.deepEqual(counts,expectedCounts,'Expected all 50 in 3 upstream folders');
assert.equal(registry.schema,'hai-gin/creature-library/v1');
const entries=Object.entries(registry.entries);
if(process.env.ULTIMATE50_REQUIRE_BUILT==='1')
 assert.equal(entries.length,50,'Every registered source must produce 3 binary LODs');
if(entries.length>0)assert.equal(entries.length,50,'No partial pack may be published');
function verifyGLB(file){
 const bytes=readFileSync(file);
 assert.equal(bytes.toString('ascii',0,4),'glTF',file+' magic');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB declared length mismatch');
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const len=bytes.readUInt32LE(12);
 assert.ok(len>4&&len<bytes.length-20);
 const payload=JSON.parse(bytes.toString('utf8',20,20+len));
 assert.ok(payload.meshes?.length>0);
 assert.ok(payload.nodes?.length>0);
 assert.ok(payload.animations?.length>0,'Animations lost: '+file);
 return payload;
}
const upstreamById=new Map(manifest.entries.map(e=>[e.id,e]));
for(const [id,entry] of entries){
 const original=upstreamById.get(id);
 assert.ok(original,id+' has no matching original');
 assert.equal(entry.author,'Quaternius');
 assert.equal(entry.license,'CC0-1.0');
 assert.equal(entry.group,original.group);
 assert.match(entry.sourceSha256,/^[a-f0-9]{64}$/);
 assert.equal(entry.match,'library');
 const triangleCounts=[];
 for(const lod of ['source','high','low']){
  const expectedPath='./assets/creatures/quaternius50/'+id+'/'+lod+'.glb';
  assert.equal(entry.models[lod],expectedPath);
  const filename=resolve(root,expectedPath.slice(2));
  assert.ok(existsSync(filename),id+' '+lod+' missing');
  const size=statSync(filename).size;
  assert.ok(size>100&&size<16_000_000,id+' '+lod+' invalid binary size');
  const glb=verifyGLB(filename);
  const metrics=entry.metrics?.[lod];
  assert.ok(metrics.triangles>0&&metrics.vertices>0);
  assert.equal(glb.animations.length,metrics.animations.length,id+' '+lod+' animation count');
  triangleCounts.push(metrics.triangles);
 }
 assert.ok(triangleCounts[2]<=triangleCounts[1]*1.01,
  id+' low LOD should not exceed high');
}
console.log('Quaternius CC0 original 50 registered; converted GLB entries: '+entries.length+
 ' / 50; distinct source, animated 3 LODs and license checks PASS');
