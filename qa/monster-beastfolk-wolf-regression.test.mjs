import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {MONSTER_BY_ID,MONSTER_CATALOG} from '../src/monster-catalog.js';
import {BEASTFOLK_PROTOTYPE_IDS,BEASTFOLK_PROTECTED_IDS,
 BEASTFOLK_RECIPES,BEASTFOLK_ROADMAP,beastfolkRecipeFor,
 validateBeastfolkRecipes} from '../src/monster-beastfolk-manifest.js';
import {createBeastfolkMonsterModel,disposeBeastfolkMonsterModel,
 startMonsterAction,animateMonsterModel}
 from '../src/monster-beastfolk-geometry.js';
import {createMonsterModel,disposeMonsterSculpture}
 from '../src/monster-geometry.js';

assert.equal(validateBeastfolkRecipes(),true);
assert.deepEqual(BEASTFOLK_PROTOTYPE_IDS,['m001','m002','m003']);
assert.deepEqual(BEASTFOLK_PROTECTED_IDS,['m005','m006']);
assert.equal(BEASTFOLK_ROADMAP.length,5);
assert.equal(MONSTER_CATALOG.length,50);
assert.equal(beastfolkRecipeFor('m005'),null);
assert.equal(beastfolkRecipeFor('m006'),null);
assert.throws(()=>createBeastfolkMonsterModel(MONSTER_BY_ID.m005),
 /m001|m002|m003|requires/);

const uniqueShapes=new Set();
for(const id of BEASTFOLK_PROTOTYPE_IDS){
 const spec=MONSTER_BY_ID[id],recipe=BEASTFOLK_RECIPES[id];
 assert.equal(recipe.source,'original-wolf');
 for(const detail of ['low','high']){
  const source=createMonsterModel(spec,{detail});
  const originalHeadGeometry=source.userData.pivots.head.children
   .filter(x=>x.isMesh).map(x=>x.geometry.type);
  assert.ok(originalHeadGeometry.length>=3);
  const sourcePartPositions=new THREE.Box3().setFromObject(source);
  const beast=createBeastfolkMonsterModel(spec,{detail});
  const box=new THREE.Box3().setFromObject(beast);
  const size=box.getSize(new THREE.Vector3());
  assert.ok(size.y>2.0&&size.y<3.5,id+' torso must be two-legged anthropomorphic');
  assert.ok(size.y>sourcePartPositions.getSize(new THREE.Vector3()).y*.6);
  assert.ok(size.x>0.9&&size.x<2.3,id+' shoulder width');
  const p=beast.userData.pivots;
  for(const name of ['head','jaw','tail','armL','armR','legL','legR',
   'lowerArmL','lowerArmR','lowerLegL','lowerLegR','torso','pelvis']){
   assert.ok(p[name]?.isGroup,id+' missing joint '+name);
  }
  assert.equal(beast.userData.beastfolkSource,id);
  assert.equal(beast.userData.beastfolkOriginalParts.sourcePaws,4);
  assert.equal(beast.userData.beastfolkOriginalParts.head,true);
  assert.equal(beast.userData.beastfolkOriginalParts.jaw,true);
  assert.equal(beast.userData.beastfolkOriginalParts.tail,true);
  assert.equal(p.head.children.some(x=>x.userData.originalCanineHead),true);
  assert.ok(p.jaw.userData.originalCanineJaw);
  assert.ok(p.tail.userData.originalCanineTail);
  let originalPaws=0;
  beast.traverse(x=>{if(x.userData.originalCaninePaw)originalPaws++});
  assert.equal(originalPaws,4);
  const skullMeshes=[];
  p.head.traverse(x=>{if(x.isMesh&&x.name&&!x.name.startsWith('beastfolk-'))
   skullMeshes.push(x)});
  assert.ok(skullMeshes.length>=25,id+' must inherit actual source animal cranium');
  let meshes=0,vertices=0,sourceMeshes=0;
  beast.traverse(x=>{
   if(!x.isMesh)return;
   meshes++;
   vertices+=x.geometry.getAttribute('position')?.count??0;
   if(x.name.startsWith('beastfolk-'))sourceMeshes++;
   const pos=x.geometry.getAttribute('position');
   assert.ok(pos?.count>=3&&Number.isFinite(pos.getX(0)+pos.getY(0)+pos.getZ(0)));
  });
  assert.ok(meshes>=70,id+' anatomy missing photo fur or paws');
  assert.ok(sourceMeshes>=30,id+' has not built full biped joints');
  assert.ok(vertices>2000&&vertices<900000,id+' invalid geometry budget: '+vertices);
  const before=p.armL.rotation.x;
  startMonsterAction(beast,'walk',0);
  animateMonsterModel(beast,.16);
  assert.notEqual(p.armL.rotation.x,before,id+' arms must animate when walking');
  startMonsterAction(beast,'attack',.25);
  animateMonsterModel(beast,.71);
  assert.ok(p.jaw.rotation.x>.05,id+' animal jaw must open on a strike');
  startMonsterAction(beast,'roar',1.1);
  animateMonsterModel(beast,1.51);
  assert.ok(p.jaw.rotation.x>.25,id+' wolf howl must open source jaws');
  assert.equal(p.head.userData.originalCanineHead,undefined,
    'Flag is on the transplanted real skull, not a fake biped skull');
  uniqueShapes.add(recipe.style);
  disposeBeastfolkMonsterModel(beast);
  assert.equal(beast.userData.beastfolkOwnedMaterials.every(m=>m._disposed!==false),
   true);
  disposeMonsterSculpture(source);
 }
}
assert.equal(uniqueShapes.size,3);
const ui=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
for(const snippet of [
 'id="beastfolkFormControl"','id="beastfolkForm"',
 'createBeastfolkMonsterModel','disposeBeastfolkMonsterModel',
 'window.__monsterBeastfolkQA','beastfolkRecipeFor(selected)',
 "location.search).get('monster')"
])assert.ok(ui.includes(snippet),'Beastfolk viewer missing '+snippet);
console.log('Original animal head/jaw/paws/tail preserved, wolf biped rigs x3, original quadrupeds untouched: PASS');
