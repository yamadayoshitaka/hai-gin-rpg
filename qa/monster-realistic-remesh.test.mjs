import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterAnatomicalLoft,MORTAL_HEAD_RINGS,
 MORTAL_TORSO_RINGS} from '../src/monster-realistic-loft.js';
import {MONSTER_REALISTIC_PALETTE} from '../src/monster-realistic-palettes.js';
import {CREATURE_SURFACE_SOURCES,decorateMonsterPhotoMaterial}
 from '../src/monster-photo-pbr.js';

const three=await import('three');
const body=createMonsterAnatomicalLoft(MORTAL_TORSO_RINGS,
 {detail:'high',kind:'torso'});
const face=createMonsterAnatomicalLoft(MORTAL_HEAD_RINGS,
 {detail:'high',kind:'face',asymmetry:.6});
assert.ok(body.getAttribute('position').count>=1600);
assert.ok(face.getAttribute('position').count>=1600);
assert.ok(face.getAttribute('normal').count===face.getAttribute('position').count);
assert.ok(face.getAttribute('uv').count===face.getAttribute('position').count);
assert.ok(face.getAttribute('position').array.every(Number.isFinite));
assert.ok(face.getAttribute('normal').array.every(Number.isFinite));
assert.equal(face.userData.kind,'realistic-anatomical-loft');
const low=createMonsterAnatomicalLoft(MORTAL_HEAD_RINGS,
 {detail:'low',kind:'face'});
assert.ok(low.getAttribute('position').count<face.getAttribute('position').count*.4,
 'mobile low LOD must remain visibly cheaper');
for(const key of ['linen','velvet','leather','steel'])
 assert.ok(CREATURE_SURFACE_SOURCES[key].albedo,'missing real photo material '+key);
for(const id of ['m031','m032','m033','m034','m035',
 'm041','m042','m043','m044','m045'])
 assert.ok(MONSTER_REALISTIC_PALETTE[id]?.mortalSkin,'missing dark-fantasy palette '+id);
const probe=(role,id)=>{
 const m=new three.MeshStandardMaterial();
 decorateMonsterPhotoMaterial(m,{family:MONSTER_BY_ID[id].family,
  speciesId:id,role,detail:'high'});
 return m;
};
assert.equal(probe('bandage','m032').userData.photoSurface,'linen');
assert.equal(probe('fabric','m034').userData.photoSurface,'velvet');
assert.equal(probe('leather','m034').userData.photoSurface,'leather');
assert.equal(probe('metal','m033').userData.photoSurface,'steel');
assert.equal(probe('mortalSkin','m034').userData.photoSurface,undefined,
 'vampire facial skin must not show coarse cloth textures');
assert.equal(probe('skin','m032').userData.photoSurface,undefined,
 'desiccated skin must not use linen as a diffuse map');

const {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats}=
 await import('../src/monster-geometry.js');
for(const id of ['m031','m032','m033','m034','m035',
 'm041','m042','m043','m044','m045']){
 const spec=MONSTER_BY_ID[id],model=createMonsterModel(spec,{detail:'high'});
 const meshes=[];
 model.traverse(n=>{if(n.isMesh)meshes.push(n);});
 const lofts=meshes.filter(m=>m.userData.anatomyLoft);
 assert.ok(lofts.length>=2,id+' body+face must have contoured topology');
 assert.ok(lofts.some(m=>m.geometry.userData.anatomy==='face'),
  id+' skull must use real anatomical profile');
 assert.ok(lofts.some(m=>m.geometry.userData.anatomy==='torso'),
  id+' body must have ribs, waist, pelvic silhouette');
 const pivots=model.userData.pivots;
 for(const k of ['armL','armR','elbowL','elbowR',
  'legL','legR','kneeL','kneeR','ankleL','ankleR']){
  assert.ok(pivots[k]?.isGroup,'Missing '+k+' for '+id);
 }
 for(const m of meshes){
  const pos=m.geometry.getAttribute('position');
  assert.ok(pos?.array.every(Number.isFinite),'Broken mesh '+id+' '+m.name);
  assert.ok(m.material.emissiveIntensity===0||
   !/orbit|iris|eye|pupil|face|cranium/.test(m.name),
   'Eye/face accidentally emitting light '+id+' '+m.name);
 }
 assert.ok(meshes.reduce((n,m)=>n+(m.geometry.index?.count??0)/3,0)<900000,
  id+' realistic preview must obey the mobile vertex limit');
 if(id==='m032'){
  const mummy=meshes.find(m=>m.name==='m032-desiccated-cranium');
  assert.ok(mummy?.geometry.userData.anatomy==='face');
  assert.equal(meshes.find(m=>m.name==='m032-torso-wrap')?.material.userData.photoSurface,
    'linen','mummy cloth should be linen PBR');
 }
 if(id==='m034'){
  const find=name=>meshes.filter(m=>m.name===name);
  assert.equal(find('m034-velvet-coat').length,1);
  assert.equal(find('m034-velvet-coat')[0].material.userData.photoSurface,'velvet');
  assert.equal(find('m034-rooted-hair-cap').length,1);
  assert.equal(find('m034-iris-L').length,1);
  assert.equal(find('m034-iris-R').length,1);
  assert.equal(find('m034-leather-boot').length,2);
  assert.equal(find('m034-orbit-L').length,1);
  assert.ok(find('m034-iris-L')[0].material.emissiveIntensity===0);
  assert.equal(meshes.filter(m=>m.name==='m034-vest-front').length,1);
  assert.ok(meshes.filter(m=>m.name==='m034-coat-button').length>=4);
  const textureRoles=new Set(meshes.map(m=>m.material.userData.photoSurface));
  assert.ok(textureRoles.has('velvet')&&textureRoles.has('leather')&&
   textureRoles.has('steel'),'vampire lacks material separation');
 }
 disposeMonsterSculpture(model);
 assert.equal(monsterSculptCacheStats().activeMaterials,0,
  'Leaking realism materials after '+id);
}
for(const g of [body,face,low])g.dispose();
const source=readFileSync(new URL('../src/monster-geometry.js',import.meta.url),'utf8');
assert.ok(source.includes('sculptBloodMoonVampire('));
assert.ok(source.includes('MORTAL_TORSO_RINGS'));
assert.ok(!source.includes("if(v>=2)g.spike(head,'accent'"),
 'Generic forehead spike on vampires was an old cartoon artifact');
console.log('Realism regression: 10 bespoke biped monsters, sculpted skull/torso, PBR materials, joint continuity, vampire details and LOD PASS');
