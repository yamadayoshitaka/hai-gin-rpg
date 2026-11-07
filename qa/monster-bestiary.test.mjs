import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_CATALOG,MONSTER_BY_ID,MONSTER_FAMILIES,monsterList,validateMonsterCatalog} from '../src/monster-catalog.js';
import {MONSTER_ACTIONS,startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {CREATURE_POSE_DURATIONS,startCreaturePose,creaturePoseFrame} from '../src/combat-creature-actions.js';

assert.ok(validateMonsterCatalog());
assert.equal(MONSTER_CATALOG.length,50);
assert.equal(Object.keys(MONSTER_FAMILIES).length,10);
assert.equal(new Set(MONSTER_CATALOG.map(m=>m.id)).size,50);
for(const family of Object.keys(MONSTER_FAMILIES))
 assert.equal(monsterList({family}).length,5,'Each monster family should have five species: '+family);
for(const m of MONSTER_CATALOG){
 assert.strictEqual(MONSTER_BY_ID[m.id],m);
 assert.ok(m.name.length>2&&m.skill.length>1);
 assert.ok(m.stats.hp>0&&m.stats.attack>0&&m.stats.speed>0);
 assert.match(m.colors.base,/^#[0-9a-f]{6}$/i);
}
assert.ok(MONSTER_ACTIONS.length>=10);
assert.ok(Object.keys(CREATURE_POSE_DURATIONS).length>=7);
const preview={};
startCreaturePose(preview,'hit',10);
assert.equal(creaturePoseFrame(preview,10.15).action,'hit');
assert.equal(creaturePoseFrame(preview,12).action,null);

const gallery=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
for(const fragment of ['monster-catalog.js','monster-geometry.js','monster-animation.js',
  'edit-name','edit-hp','importFile','export','save','items','actions'])
  assert.ok(gallery.includes(fragment),'Monster management UI missing '+fragment);
const faceSource=readFileSync(new URL('../src/combat-summon-face-library.js',import.meta.url),'utf8');
const headSource=readFileSync(new URL('../src/combat-humanoid-summons.js',import.meta.url),'utf8');
assert.match(faceSource,/smoothCoincidentNormals/,'Donor facial normals should be smooth');
assert.match(headSource,/Raised, sculpted neckline/,'Summon neckline needs seam cover');

let threeAvailable=false;
try{await import('three');threeAvailable=true;}catch(e){
 if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;
}
if(threeAvailable){
 const {createMonsterModel,disposeMonsterSculpture}=await import('../src/monster-geometry.js');
 const families=new Map();
 for(const spec of MONSTER_CATALOG){
   const model=createMonsterModel(spec,{detail:'high'});
   assert.ok(model.isGroup,'Monster model should use real Three.js geometry');
   let count=0,triangles=0;
   model.traverse(node=>{
     if(!node.isMesh)return;
     count++;
     const geo=node.geometry,pos=geo.getAttribute('position');
     assert.ok(pos?.count>2,spec.id+' invalid geometry');
     triangles+=(geo.index?.count??pos.count)/3;
     assert.ok(Number.isFinite(pos.getX(0)+pos.getY(0)+pos.getZ(0)));
   });
   assert.ok(count>=18,spec.id+' must have an articulated 3D sculpture');
   assert.ok(triangles>500,spec.id+' must be more than a low-poly icon');
   families.set(spec.family,[...(families.get(spec.family)||[]),count]);
   for(const [action] of MONSTER_ACTIONS){
     startMonsterAction(model,action,10);
     const pose=animateMonsterModel(model,10.3);
     assert.equal(pose.action,action);
     assert.ok(Number.isFinite(model.position.x+model.position.y+model.rotation.z));
   }
   disposeMonsterSculpture(model);
 }
 for(const [family,counts] of families)
   assert.ok(new Set(counts).size>=2,family+' variants need different silhouettes/mesh parts');
 console.log('3D geometry, 50 variants, actions: PASS');
}
console.log('Monster catalog 50 / 10 families, editor, summon face seams, extra actions: PASS'+
  (threeAvailable?'':' (Three.js mesh checks skipped: package not installed)'));
