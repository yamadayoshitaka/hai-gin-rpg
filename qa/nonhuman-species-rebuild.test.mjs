import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {HUMAN_MONSTER_IDS} from '../src/monster-character-cosplay-manifest.js';
import {CREATURE_SPECIES_BLUEPRINTS,NONHUMAN_REBUILD_IDS,
 PROTECTED_NONHUMAN_IDS,creatureSpeciesBlueprint,defaultCreatureSource}
 from '../src/creature-species-blueprints.js';
import {refineNonhumanCreatureHandle}
 from '../src/creature-species-refinement.js';
import {DEFAULT_CREATURE_MESHES,adoptedCreatureMesh,
 setAdoptedCreatureMesh} from '../src/creature-mesh-adoption.js';

const storage=()=>{const data=new Map();return {
 getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)
};};
function mockCreature(){
 const root=new THREE.Group(),source=new THREE.Group();
 const skin=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),
  new THREE.MeshStandardMaterial({name:'Fur',color:0x999999,roughness:.7}));
 skin.name='Body';
 const eye=new THREE.Mesh(new THREE.SphereGeometry(.12,8,8),
  new THREE.MeshStandardMaterial({name:'Eye',color:0xffffff}));
 eye.name='Eyeball';
 source.add(skin,eye);
 const limb=new THREE.Bone();limb.name='LeftThigh';
 limb.position.y=.4;source.add(limb);
 root.add(source);
 let dead=false;
 const actions=[];
 const handle={root,clips:['IDLE'],play(action){
  actions.push(action);return action==='idle';
 },update(){},dispose(){dead=true;}};
 return {handle,skin,eye,limb,actions,get dead(){return dead;}};
}
test('all 34 nonhumanoid species have unique traits and anatomy',()=>{
 assert.equal(MONSTER_CATALOG.length,50);
 assert.equal(Object.keys(CREATURE_SPECIES_BLUEPRINTS).length,34);
 assert.equal(NONHUMAN_REBUILD_IDS.length,32);
 assert.deepEqual(PROTECTED_NONHUMAN_IDS,['m005','m006']);
 const seen=new Set();
 for(const m of MONSTER_CATALOG){
  const p=creatureSpeciesBlueprint(m.id);
  if(HUMAN_MONSTER_IDS.includes(m.id)){assert.equal(p,null);continue;}
  assert.ok(p,p?.id||m.id);
  assert.equal(p.id,m.id);
  assert.equal(creatureSpeciesBlueprint('summon_'+m.id),p);
  assert.equal(typeof p.feature,'string');
  assert.ok(p.feature.length>10);
  assert.equal(p.actionSlots.length,11);
  assert.ok(!seen.has(p.feature));
  seen.add(p.feature);
 }
 assert.equal(creatureSpeciesBlueprint('wolf'),CREATURE_SPECIES_BLUEPRINTS.m001);
 assert.equal(creatureSpeciesBlueprint('summon_m031'),null);
});
test('never adopt animal bodies onto protected sources or human shaped rigs',()=>{
 for(const id of PROTECTED_NONHUMAN_IDS){
  assert.equal(defaultCreatureSource(id),null);
  assert.equal(DEFAULT_CREATURE_MESHES[id],undefined);
 }
 for(const id of HUMAN_MONSTER_IDS)assert.equal(defaultCreatureSource(id),null);
 assert.equal(defaultCreatureSource('m002'),'r-wolf');
 assert.equal(defaultCreatureSource('m003'),'r-wolf');
 assert.equal(defaultCreatureSource('m004'),'r-wolf');
 assert.equal(defaultCreatureSource('m007'),'r-tiger');
 assert.equal(defaultCreatureSource('m011'),'r-eagle');
 assert.equal(defaultCreatureSource('m016'),'r-crocodile');
 assert.equal(defaultCreatureSource('m046'),'q024');
 assert.equal(defaultCreatureSource('m026'),null);
 assert.equal(defaultCreatureSource('m012'),null);
 assert.equal(defaultCreatureSource('m018'),null);
 assert.equal(defaultCreatureSource('m047'),null);
 assert.equal(adoptedCreatureMesh('summon_m003',storage()),'r-wolf');
 assert.equal(adoptedCreatureMesh('summon_m046',storage()),'q024');
 const s=storage();
 setAdoptedCreatureMesh('m003','legacy',s);
 assert.equal(adoptedCreatureMesh('summon_m003',s),'legacy');
 setAdoptedCreatureMesh('summon_m003','r-wolf',s);
 assert.equal(adoptedCreatureMesh('summon_m003',s),'r-wolf');
});
test('manual external GLB recoloring retains original geometry UV and eye materials',()=>{
 const m=mockCreature();
 const geometry=m.skin.geometry,eyeMat=m.eye.material,skinMat=m.skin.material;
 const wrapped=refineNonhumanCreatureHandle(m.handle,'summon_m003');
 assert.notEqual(wrapped,m.handle);
 assert.equal(m.skin.geometry,geometry);
 assert.notEqual(m.skin.material,skinMat);
 assert.equal(m.eye.material,eyeMat);
 assert.equal(wrapped.root.userData.speciesRefinement.speciesId,'m003');
 assert.equal(wrapped.root.userData.speciesRefinement.qualityApproved,false);
 wrapped.dispose();
 assert.equal(m.dead,true);
 geometry.dispose();m.eye.geometry.dispose();eyeMat.dispose();
});
test('all eleven actions are addressable; missing clips move bones without altering game root',()=>{
 for(const id of ['m002','m007','m011','m016','m026','m046','m047']){
  const m=mockCreature();
  const wrapped=refineNonhumanCreatureHandle(m.handle,id);
  const originalRootPosition=wrapped.root.position.clone();
  for(const action of creatureSpeciesBlueprint(id).actionSlots){
   assert.equal(wrapped.play(action,{restart:true}),true);
   wrapped.update(.08);
   if(action!=='idle'){
    assert.equal(wrapped.root.userData.speciesMotionState.action,action);
    assert.equal(wrapped.root.userData.speciesMotionState.source,
     'manual-procedural-fallback');
   }
   assert.deepEqual(wrapped.root.position,originalRootPosition);
  }
  wrapped.play('run',{restart:true});
  wrapped.update(.08);
  assert.notEqual(m.limb.rotation.x,0,'Expected actual limb rotation '+id);
  wrapped.play('idle',{restart:true});
  assert.equal(m.limb.rotation.x,0,'Must reset motion when restoring native clip');
  wrapped.dispose();
  assert.equal(m.dead,true);
  m.skin.geometry.dispose();m.eye.geometry.dispose();m.eye.material.dispose();
 }
});
test('m001 wolf, protected m005/m006 and 16 human types are never reprocessed',()=>{
 for(const id of ['m001','m005','m006','m031','summon_m044']){
  const m=mockCreature();
  assert.equal(refineNonhumanCreatureHandle(m.handle,id),m.handle);
  m.handle.dispose();
  m.skin.geometry.dispose();m.skin.material.dispose();
  m.eye.geometry.dispose();m.eye.material.dispose();
 }
});
