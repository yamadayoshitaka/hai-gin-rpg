import test from 'node:test';
import assert from 'node:assert/strict';
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
  assert.equal(eligibleCreature(m.id),!HUMAN_MONSTER_IDS.includes(m.id));
  assert.equal(eligibleCreature('summon_'+m.id),!HUMAN_MONSTER_IDS.includes(m.id));
 }
 assert.equal(NONHUMAN_EXTRA_SUMMON_IDS.length,6);
});
test('adoption is explicit, persisted, isolated per species and reversible',()=>{
 const storage=memoryStorage();
 assert.equal(adoptedCreatureMesh('m001',storage),'r-wolf');
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'r-wolf');
 assert.equal(adoptedCreatureMesh('wolf',storage),'r-wolf');
 assert.equal(DEFAULT_CREATURE_MESHES.m001,'r-wolf');
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
 assert.ok(recommendedMeshSources('m016').includes('r-crocodile'));
});
test('existing protected original animal geometry is not modified by candidate metadata',()=>{
 assert.equal(baseMonsterId('summon_m005'),'m005');
 assert.equal(baseMonsterId('summon_m006'),'m006');
 assert.ok(Array.isArray(recommendedMeshSources('m005')));
 assert.ok(Array.isArray(recommendedMeshSources('m006')));
 assert.equal(recommendedMeshSources('m026').length,0);
});

test('shipped r-wolf defaults yield to deliberate legacy choices, including across reloads',()=>{
 const storage=memoryStorage();
 assert.equal(adoptedCreatureMesh('m001',storage),'r-wolf');
 assert.equal(adoptedCreatureMesh('summon_m001',storage),'r-wolf');
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
