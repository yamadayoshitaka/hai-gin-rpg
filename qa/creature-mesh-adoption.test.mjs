import test from 'node:test';
import assert from 'node:assert/strict';
import {applyGreyFangWolfFinish} from '../src/grey-fang-wolf-finish.js';
import {WOLF_ACTION_NAMES,resolveWolfAction,WOLF_ACTION_LIMITS}
 from '../src/grey-wolf-action-contract.js';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {HUMAN_MONSTER_IDS} from '../src/monster-character-cosplay-manifest.js';
import {NONHUMAN_MONSTER_IDS,NONHUMAN_EXTRA_SUMMON_IDS,
 eligibleCreature,baseMonsterId,recommendedMeshSources,adoptedCreatureMesh,
 setAdoptedCreatureMesh,MESH_ADOPTION_STORAGE_KEY,DEFAULT_CREATURE_MESHES}
 from '../src/creature-mesh-adoption.js';

function memoryStorage(){
 const data=new Map();
 return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),data};
}
test('nonhuman species and summon mirrors cover every nonhuman catalog entry',()=>{
 assert.equal(MONSTER_CATALOG.length,50);
 assert.equal(HUMAN_MONSTER_IDS.length,16);
 assert.equal(NONHUMAN_MONSTER_IDS.length,34);
 assert.equal(new Set(NONHUMAN_MONSTER_IDS).size,34);
 for(const m of MONSTER_CATALOG){
  const permitted=!HUMAN_MONSTER_IDS.includes(m.id)&&!['m005','m006'].includes(m.id);
  assert.equal(eligibleCreature(m.id),permitted);
  assert.equal(eligibleCreature('summon_'+m.id),permitted);
 }
 assert.equal(NONHUMAN_EXTRA_SUMMON_IDS.length,6);
});
test('adoption is explicit, persisted, isolated per species and reversible',()=>{
 const storage=memoryStorage();
 assert.equal(adoptedCreatureMesh('m001',storage),'legacy');
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'legacy');
 assert.equal(adoptedCreatureMesh('wolf',storage),'r-wolf');
 assert.equal(DEFAULT_CREATURE_MESHES.m001,undefined);
 setAdoptedCreatureMesh('m001','q022',storage);
 assert.equal(adoptedCreatureMesh('m001',storage),'q022');
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'q022');
 assert.equal(adoptedCreatureMesh('m002',storage),'legacy');
 setAdoptedCreatureMesh('summon_m001','legacy',storage);
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'legacy');
 assert.equal(adoptedCreatureMesh('m001',storage),'q022');
 setAdoptedCreatureMesh('summon_m001','q024',storage);
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'q024');
 setAdoptedCreatureMesh('m001','legacy',storage);
 assert.equal(adoptedCreatureMesh('m001',storage),'legacy');
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'q024');
 assert.ok(storage.data.get(MESH_ADOPTION_STORAGE_KEY));
});
test('human-shaped monsters never accept an animal donor',()=>{
 const storage=memoryStorage();
 for(const id of HUMAN_MONSTER_IDS){
  assert.equal(adoptedCreatureMesh(id,storage),'legacy');
  assert.equal(adoptedCreatureMesh('summon_'+id,storage),'legacy');
  assert.throws(()=>setAdoptedCreatureMesh(id,'q022',storage));
  assert.throws(()=>setAdoptedCreatureMesh('summon_'+id,'q022',storage));
 }
 assert.throws(()=>setAdoptedCreatureMesh('m001','../../oops.glb',storage));
 assert.throws(()=>setAdoptedCreatureMesh('m001','q999',storage));
 setAdoptedCreatureMesh('m001','r-wolf',storage);
 assert.equal(adoptedCreatureMesh('m001',storage),'r-wolf');
 assert.ok(recommendedMeshSources('m001').includes('r-wolf'));
 assert.ok(recommendedMeshSources('m011').includes('r-eagle'));
 assert.ok(!recommendedMeshSources('m016').includes('r-crocodile'));
 assert.deepEqual(recommendedMeshSources('m021'),[]);
 assert.deepEqual(recommendedMeshSources('m023'),[]);
 assert.deepEqual(recommendedMeshSources('m014'),[]);
 assert.deepEqual(recommendedMeshSources('horse'),[]);
 assert.ok(recommendedMeshSources('m008').includes('w-lion'));
 assert.ok(recommendedMeshSources('m010').includes('w-tiger'));
 assert.throws(()=>setAdoptedCreatureMesh('horse','g-horse',storage));
 assert.throws(()=>setAdoptedCreatureMesh('m008','w-lion',storage));
 assert.throws(()=>setAdoptedCreatureMesh('m023','g-mantis',storage));
 assert.equal(adoptedCreatureMesh('horse',storage),'legacy');
 const old=memoryStorage();
 old.setItem(MESH_ADOPTION_STORAGE_KEY,JSON.stringify({m023:'g-mantis',horse:'g-horse'}));
 assert.equal(adoptedCreatureMesh('m023',old),'legacy');
 assert.equal(adoptedCreatureMesh('horse',old),'legacy');
});
test('existing protected original animal geometry is not modified by candidate metadata',()=>{
 assert.equal(baseMonsterId('summon_m005'),'m005');
 assert.equal(baseMonsterId('summon_m006'),'m006');
 assert.deepEqual(recommendedMeshSources('m005'),[]);
 assert.deepEqual(recommendedMeshSources('m006'),[]);
 assert.equal(adoptedCreatureMesh('m005',memoryStorage()),'legacy');
 assert.throws(()=>setAdoptedCreatureMesh('m005','r-wolf',memoryStorage()));
 assert.throws(()=>setAdoptedCreatureMesh('summon_m005','r-wolf',memoryStorage()));
 assert.throws(()=>setAdoptedCreatureMesh('m006','r-jaguar',memoryStorage()));
 assert.throws(()=>setAdoptedCreatureMesh('summon_m006','r-jaguar',memoryStorage()));
 assert.equal(recommendedMeshSources('m026').length,0);
});

test('registered procedural wolf-king default and explicit r-wolf still persist across reloads',()=>{
 const storage=memoryStorage();
 assert.equal(adoptedCreatureMesh('m001',storage),'legacy');
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'legacy');
 assert.equal(adoptedCreatureMesh('wolf',storage),'r-wolf');
 setAdoptedCreatureMesh('m001','legacy',storage);
 assert.equal(adoptedCreatureMesh('m001',storage),'legacy');
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'legacy');
 setAdoptedCreatureMesh('m001','r-wolf',storage);
 assert.equal(adoptedCreatureMesh('m001',storage),'r-wolf');
 setAdoptedCreatureMesh('summon_m001','legacy',storage);
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'legacy');
 assert.equal(adoptedCreatureMesh('m001',storage),'r-wolf');
 setAdoptedCreatureMesh('wolf','legacy',storage);
 assert.equal(adoptedCreatureMesh('wolf',storage),'legacy');
 assert.equal(adoptedCreatureMesh('m001',storage),'r-wolf');
 const persisted=JSON.parse(storage.getItem(MESH_ADOPTION_STORAGE_KEY));
 assert.equal(persisted.wolf,'legacy');
 assert.equal(persisted.summon_m001,'legacy');
});

test('wolf finish keeps source mesh count, UV/material maps and rig, hides only known white shells',()=>{
 const createMaterial=(name,map=null)=>({
  isMaterial:true,name,map,color:{multiplyScalar(n){this.factor=n;return this;}},
  emissive:{setHex(v){this.hex=v}},
  roughness:.8,
  clone(){return createMaterial(name,map)}
 });
 const nodes=[
  {isMesh:true,name:'Object_9',visible:true,geometry:{id:'original-wolf-skin'},
   material:createMaterial('Wolf coat',{id:'source-PBR-map'})},
  {isMesh:true,name:'Object_74',visible:true,geometry:{id:'duplicate-white-outline'},
   material:createMaterial('white outline')},
  {isMesh:true,name:'Object_76',visible:true,geometry:{id:'overlapping-textured-shell'},
   material:createMaterial('duplicate shell')},
  {isMesh:true,name:'Eye_left',visible:true,geometry:{id:'original-eye'},
   material:createMaterial('eye original')}
 ];
 const root={userData:{},traverse(fn){nodes.forEach(fn)}};
 const handle={root};
 const oldGeometry=nodes.map(n=>n.geometry);
 applyGreyFangWolfFinish(handle,{creatureId:'summon_m001'});
 assert.equal(root.userData.greyFangWolfFinish.mode,'shader-only-v3');
 assert.equal(root.userData.greyFangWolfFinish.addedMeshes,0);
 assert.equal(root.userData.greyFangWolfFinish.hiddenOutline,2);
 assert.equal(nodes.length,4);
 assert.deepEqual(nodes.map(n=>n.geometry),oldGeometry);
 assert.equal(nodes[0].visible,true);
 assert.equal(nodes[1].visible,false);
 assert.equal(nodes[2].visible,false);
 assert.equal(nodes[3].visible,true);
 assert.equal(nodes[0].material.map.id,'source-PBR-map');
 assert.equal(nodes[0].material.color.factor,0.83);
 assert.equal(nodes[3].material.emissive.hex,0x8bceef);
 // No added geometry on re-entry or cross-scene repeated updates.
 applyGreyFangWolfFinish(handle,{creatureId:'summon_m001'});
 assert.equal(nodes.length,4);
});

test('licensed wolf uses real IDLE / RRAR / SLEEP clips and authored limb movement for missing walk/run',()=>{
 const clips=['metarig.002|eating','metarig.002|IDLE',
  'metarig.002|RRAR','metarig.002|SLEEP'];
 const expectations={
  idle:'idle',walk:'idle',run:'idle',
  attack:'roar',roar:'roar',special:'roar',
  hit:'idle',defeat:'defeat'
 };
 for(const [action,sourceAction] of Object.entries(expectations)){
  assert.equal(resolveWolfAction(clips,action).sourceAction,sourceAction,action);
  assert.ok(WOLF_ACTION_NAMES.includes(action));
 }
 assert.equal(resolveWolfAction(clips,'walk').procedural,'walk');
 assert.equal(resolveWolfAction(clips,'run').procedural,'run');
 assert.equal(resolveWolfAction(['idle','walk','run','attack','death'],'walk').sourceAction,'walk');
 assert.equal(resolveWolfAction(['idle','walk','run','attack','death'],'run').sourceAction,'run');
 assert.equal(resolveWolfAction(['idle','walk','run','attack','death'],'defeat').sourceAction,'defeat');
 assert.ok(Number.isFinite(WOLF_ACTION_LIMITS.hit));
 assert.equal(WOLF_ACTION_LIMITS.defeat,Infinity);
 assert.equal(resolveWolfAction(clips,'invalid').action,'idle');
});
