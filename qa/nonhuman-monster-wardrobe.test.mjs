import assert from 'node:assert/strict';
import {MONSTER_CATALOG,MONSTER_BY_ID} from '../src/monster-catalog.js';
import {SPECIES_COSPLAY_IDS,SPECIES_COSPLAY_WARDROBE}
 from '../src/monster-species-wardrobe.js';
import {createMonsterModel,disposeMonsterSculpture,monsterSculptCacheStats,
 NONHUMAN_MONSTER_WARDROBE} from '../src/monster-geometry.js';

const humanoid=new Set(['m015',...Array.from({length:15},(_,i)=>
 'm'+String(i+31).padStart(3,'0'))]);
const nonhuman=MONSTER_CATALOG.filter(s=>!humanoid.has(s.id));
assert.equal(nonhuman.length,34);
assert.deepEqual(SPECIES_COSPLAY_IDS,nonhuman.map(s=>s.id));
assert.deepEqual(Object.keys(NONHUMAN_MONSTER_WARDROBE),
 ['m008','m012','m017','m050']);
for(const spec of nonhuman){
 const profile=SPECIES_COSPLAY_WARDROBE[spec.id];
 assert.equal(profile.baseFamily,spec.family);
 assert.equal(profile.source,'native-species-anatomy');
 for(const detail of (['m001','m006','m011','m016','m021','m026',
   'm046','m047','m048','m050'].includes(spec.id)?['low','high']:['low'])){
  const model=createMonsterModel(spec,{detail});
  assert.ok(model.userData.nonhumanOutfit,'Missing costume: '+spec.id);
  assert.equal(model.userData.speciesCosplay.id,spec.id);
  assert.ok(model.userData.pivots.torso);
  assert.ok(model.userData.pivots.head,
   'Original species head must be preserved: '+spec.id);
  const costume=[];
  model.traverse(mesh=>{
   if(mesh.isMesh&&mesh.name.startsWith('monster-outfit-'))costume.push(mesh);
  });
  assert.ok(costume.length>=3,'Missing fitted outfit meshes: '+spec.id);
  for(const piece of costume){
   assert.ok(piece.parent,'Outfit piece detached: '+spec.id);
   assert.ok(piece.geometry?.getAttribute('position')?.count>10);
   assert.ok(piece.geometry.getAttribute('position').array.every(Number.isFinite));
   if(!profile.legacy){
    assert.equal(piece.userData.costumeSpeciesId,spec.id);
    assert.ok(piece.parent===model.userData.pivots.torso||
     Object.values(model.userData.pivots).includes(piece.parent),
     'Outfit must follow anatomical pivot: '+piece.name);
   }
  }
  if(profile.legacy)assert.equal(model.userData.speciesCosplay.applied,
    'existing-boss-regalia');
  else assert.equal(model.userData.speciesCosplay.applied,'species-fitted');
  disposeMonsterSculpture(model);
 }
}
for(const spec of MONSTER_CATALOG.filter(s=>humanoid.has(s.id))){
 assert.equal(SPECIES_COSPLAY_WARDROBE[spec.id],undefined,
  'Human-rigged monster must retain separate wardrobe: '+spec.id);
}
assert.equal(monsterSculptCacheStats().activeMaterials,0);
console.log('Species cosplay wardrobe PASS: 34/34 real-anatomy bases, 4 preserved bosses, both LODs, no human replacement');
