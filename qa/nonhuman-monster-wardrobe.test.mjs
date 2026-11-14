import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture,
 monsterSculptCacheStats,NONHUMAN_MONSTER_WARDROBE}
 from '../src/monster-geometry.js';

assert.deepEqual(Object.keys(NONHUMAN_MONSTER_WARDROBE),
 ['m008','m012','m017','m050']);
for(const [id,style] of Object.entries(NONHUMAN_MONSTER_WARDROBE)){
 const spec=MONSTER_BY_ID[id];
 for(const detail of ['low','high']){
  const model=createMonsterModel(spec,{detail});
  assert.equal(model.userData.nonhumanOutfit,style.name);
  const torso=model.userData.pivots.torso;
  const pieces=[];
  model.traverse(mesh=>{
   if(mesh.isMesh&&mesh.name.startsWith('monster-outfit-'))pieces.push(mesh);
  });
  assert.ok(pieces.length>=8,'Need fitted torso armour '+id);
  assert.ok(pieces.every(mesh=>mesh.parent===torso),
   'No floating body armour on '+id);
  for(const mesh of pieces){
   const p=mesh.geometry.getAttribute('position');
   assert.ok(p?.count>10&&p.array.every(Number.isFinite));
  }
  // Armour is attached to the original model, not a duplicated mannequin.
  assert.ok(model.userData.pivots.head);
  disposeMonsterSculpture(model);
 }
}
for(const id of ['m005','m006','m001','m021','m046']){
 const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
 assert.equal(model.userData.nonhumanOutfit,undefined,
  'Unrelated animal/creature should not gain a generic human coat '+id);
 disposeMonsterSculpture(model);
}
assert.equal(monsterSculptCacheStats().activeMaterials,0);
console.log('Nonhuman monster fitted outfit QA PASS: lion, griffin, basilisk, sea god; untouched wolves, insects, slime');
