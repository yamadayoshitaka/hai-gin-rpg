import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {MONSTER_CATALOG,MONSTER_BY_ID,MONSTER_FAMILIES}
 from '../src/monster-catalog.js';
import {MONSTER_ALL50_SURFACE_PROFILES,FAMILY_MICROSTRUCTURES,
 decorateAll50MonsterSurface,monsterAll50SurfaceStats}
 from '../src/monster-all50-surface.js';
import {CREATURE_FAMILY_SURFACE,CREATURE_SURFACE_SOURCES,decorateMonsterPhotoMaterial}
 from '../src/monster-photo-pbr.js';

test('all 50 registered species have material profiles in all ten families',()=>{
 assert.equal(MONSTER_CATALOG.length,50);
 assert.equal(Object.keys(MONSTER_ALL50_SURFACE_PROFILES).length,50);
 assert.deepEqual(Object.keys(FAMILY_MICROSTRUCTURES).sort(),
  Object.keys(MONSTER_FAMILIES).sort());
 for(const species of MONSTER_CATALOG){
  const profile=MONSTER_ALL50_SURFACE_PROFILES[species.id];
  assert.ok(profile?.kind, species.id+' has no surface');
  assert.equal(profile.family,species.family);
 }
 const stats=monsterAll50SurfaceStats();
 assert.equal(stats.profiles,50);
 assert.ok(stats.surfaceKinds>=12,'species must not share one generic material');
});
test('no inappropriate dragon-scale, linen or steel photographs',()=>{
 for(const family of ['insect','arachnid','avian','aquatic','undead',
  'golem','fiend','feline']){
  assert.equal(CREATURE_FAMILY_SURFACE[family],null,family);
 }
 assert.equal(CREATURE_FAMILY_SURFACE.beast,'fur');
 assert.equal(CREATURE_FAMILY_SURFACE.reptile,'scales');
 assert.match(CREATURE_SURFACE_SOURCES.stone.albedo,/cc0-aerial-rocks-02/);
 assert.match(CREATURE_SURFACE_SOURCES.stone.roughness,/cc0-aerial-rocks-02/);
 assert.equal(MONSTER_ALL50_SURFACE_PROFILES.m037.kind,'bronze');
 assert.equal(MONSTER_ALL50_SURFACE_PROFILES.m038.kind,'crystal');
 assert.equal(MONSTER_ALL50_SURFACE_PROFILES.m039.kind,'lava');
 assert.equal(MONSTER_ALL50_SURFACE_PROFILES.m042.kind,'stone');
 assert.equal(MONSTER_ALL50_SURFACE_PROFILES.m046.kind,'gel');
 assert.equal(MONSTER_ALL50_SURFACE_PROFILES.m047.kind,'cephalopod');
 assert.equal(MONSTER_ALL50_SURFACE_PROFILES.m049.kind,'cephalopod');
});
test('all 50 material targets receive shared high-detail GPU maps',()=>{
 const maps=new Map();
 for(const spec of MONSTER_CATALOG){
  const mat=new THREE.MeshStandardMaterial({color:spec.colors.base});
  assert.equal(decorateAll50MonsterSurface(mat,{
   speciesId:spec.id,family:spec.family,detail:'high',role:'skin'
  }),true,spec.id+' surface attachment');
  assert.ok(mat.map?.isDataTexture && mat.normalMap?.isDataTexture &&
    mat.roughnessMap?.isDataTexture,spec.id+' PBR maps');
  assert.equal(mat.userData.all50SurfaceSpecies,spec.id);
  assert.equal(mat.userData.all50SurfaceKind,
    MONSTER_ALL50_SURFACE_PROFILES[spec.id].kind);
  assert.equal(mat.map.colorSpace,THREE.SRGBColorSpace);
  assert.equal(mat.normalMap.colorSpace,THREE.NoColorSpace);
  assert.ok(mat.roughness>=.9);
  assert.ok(mat.metalness>=0&&mat.metalness<=.78);
  const prior=maps.get(mat.userData.all50SurfaceKind);
  if(prior)assert.equal(mat.normalMap,prior,
    'one texture atlas per material type, never per species');
  else maps.set(mat.userData.all50SurfaceKind,mat.normalMap);
  mat.dispose();
 }
 assert.ok(monsterAll50SurfaceStats().atlasVariants<=20,
  'atlas reuse is essential for mass battle');
});
test('monster horns get keratin but eyes, glow and low LOD remain untouched',()=>{
 const horn=new THREE.MeshStandardMaterial();
 assert.equal(decorateMonsterPhotoMaterial(horn,{
  speciesId:'m020',family:'reptile',role:'bone',detail:'high'
 }).userData.all50SurfaceKind,'keratin');
 const eye=new THREE.MeshStandardMaterial();
 decorateMonsterPhotoMaterial(eye,{
  speciesId:'m020',family:'reptile',role:'eye',detail:'high'
 });
 assert.equal(eye.normalMap,null,'eyes must keep independent cornea');
 const low=new THREE.MeshStandardMaterial();
 assert.equal(decorateAll50MonsterSurface(low,{
  speciesId:'m049',family:'aquatic',role:'skin',detail:'low'
 }),false);
 assert.equal(low.normalMap,null);
 const flame=new THREE.MeshStandardMaterial();
 assert.equal(decorateAll50MonsterSurface(flame,{
  speciesId:'m029',role:'skin',detail:'high',glow:true
 }),false);
 assert.equal(flame.normalMap,null);
});
test('do not replace existing photographic and approved specialist maps',()=>{
 const originalMap=new THREE.DataTexture(new Uint8Array(16),2,2);
 const m=new THREE.MeshStandardMaterial();
 m.map=originalMap;
 assert.equal(decorateAll50MonsterSurface(m,{
  speciesId:'m049',role:'skin',detail:'high'
 }),false);
 assert.equal(m.map,originalMap);
 for(const id of ['m016','m017','m019']){
  const mat=new THREE.MeshStandardMaterial();
  decorateMonsterPhotoMaterial(mat,{
   family:MONSTER_BY_ID[id].family,speciesId:id,
   role:'skin',detail:'high'
  });
  assert.ok(mat.map&&mat.normalMap&&mat.roughnessMap,
   'approved salamander PBR retained '+id);
  assert.notEqual(mat.userData.all50SurfaceKind,'stone');
 }
 const stone=new THREE.MeshStandardMaterial();
 decorateMonsterPhotoMaterial(stone,{
  family:'golem',speciesId:'m036',role:'skin',detail:'high'
 });
 assert.equal(stone.userData.photoSurface,'stone');
 assert.equal(stone.userData.all50PhotoNormal,'stone-micro-relief');
 assert.ok(stone.map&&stone.roughnessMap&&stone.normalMap,
  'photoscanned stone must combine color, roughness and normal relief');
});
