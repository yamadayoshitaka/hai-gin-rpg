import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {adoptedCreatureMesh,setAdoptedCreatureMesh} from '../src/creature-mesh-adoption.js';
const ROOT=new URL('../',import.meta.url);
function parseGLB(rel){
 const bytes=readFileSync(new URL(rel,ROOT));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.byteLength);
 assert.equal(bytes.toString('ascii',16,20),'JSON');
 const n=bytes.readUInt32LE(12);
 assert.ok(n>0&&20+n<=bytes.byteLength);
 const g=JSON.parse(bytes.toString('utf8',20,20+n));
 const binOffset=20+n;
 assert.equal(bytes.toString('ascii',binOffset+4,binOffset+8),'BIN\0');
 assert.equal(binOffset+8+bytes.readUInt32LE(binOffset),bytes.byteLength);
 return {bytes,g};
}
test('m020 has new original high-density 3D source, near and far with real skin and 7 clips',()=>{
 const manifest=JSON.parse(readFileSync(new URL('assets/creatures/original/m020/manifest.json',ROOT),'utf8'));
 assert.equal(manifest.id,'m020');
 assert.equal(MONSTER_BY_ID.m020.name,'深海リヴァイアサン');
 assert.equal(manifest.model.ffQualityApproved,false);
 assert.equal(manifest.model.photogrammetry,false);
 assert.equal(manifest.model.jointCount,4);
 assert.equal(manifest.model.realAnimationClips,7);
 const tri=[];
 for(const tier of ['source','high','low']){
  const rel='assets/creatures/original/m020/'+tier+'.glb';
  assert.ok(existsSync(new URL(rel,ROOT)));
  const {bytes,g}=parseGLB(rel);
  assert.ok(bytes.byteLength>100_000,rel);
  assert.equal(g.meshes.length,2);
  assert.equal(g.skins.length,1);
  assert.equal(g.skins[0].joints.length,4);
  assert.equal(g.nodes[6].name,'JawHinge');
  assert.ok(g.materials.some(m=>m.normalTexture&&m.pbrMetallicRoughness.metallicRoughnessTexture));
  assert.ok(g.meshes[0].primitives.every(p=>p.attributes.JOINTS_0!==undefined&&
    p.attributes.WEIGHTS_0!==undefined),tier);
  assert.ok(g.meshes[1].primitives.length>=2,tier);
  assert.deepEqual(g.animations.map(a=>a.name),
   ['idle','walk','run','attack','roar','hit','defeat']);
  assert.ok(g.extras.modelData.sourceSkinWeightsFixed);
  const actual=g.meshes.flatMap(m=>m.primitives).reduce((n,p)=>
   n+g.accessors[p.indices].count/3,0);
  const report=manifest.generated.find(a=>a.tier===tier);
  assert.equal(actual,report.triangles);
  tri.push(actual);
 }
 assert.ok(tri[0]>tri[1]&&tri[1]>tri[2]);
});
test('enemy and summon m020 opt into new asset, retain reversibility and protect other species',()=>{
 const storage=()=>{const x=new Map();return {
  getItem:k=>x.get(k)||null,setItem:(k,v)=>x.set(k,v)
 }};
 let s=storage();
 assert.equal(adoptedCreatureMesh('m020',s),'original-m020');
 assert.equal(adoptedCreatureMesh('summon_m020',s),'original-m020');
 setAdoptedCreatureMesh('m020','legacy',s);
 assert.equal(adoptedCreatureMesh('m020',s),'legacy');
 assert.equal(adoptedCreatureMesh('summon_m020',s),'legacy');
 setAdoptedCreatureMesh('m020','original-m020',s);
 assert.equal(adoptedCreatureMesh('m020',s),'original-m020');
 assert.throws(()=>setAdoptedCreatureMesh('m016','original-m020',s));
 assert.equal(adoptedCreatureMesh('m005',s),'legacy');
 const source=readFileSync(new URL('src/creature-real-source-catalog.js',ROOT),'utf8');
 assert.match(source,/sourceId==='original-m020'/);
 const r=readFileSync(new URL('src/monster-summon-renderer.js',ROOT),'utf8');
 assert.match(r,/loadCreatureMeshSource\(sourceId,registry,detail,\{creatureId:object.type\}\)/);
 const runtime=readFileSync(new URL('src/creature-master-runtime.js',ROOT),'utf8');
 assert.match(runtime,/original-m020-glb/);
 const gallery=readFileSync(new URL('monster-manager.html',ROOT),'utf8');
 assert.match(gallery,/value="original"/);
 assert.match(gallery,/original-m020/);
});
