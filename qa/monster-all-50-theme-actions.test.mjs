import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {MONSTER_CATALOG,MONSTER_FAMILIES,MONSTER_BY_ID} from '../src/monster-catalog.js';
import {MONSTER_FAMILY_ACTIONS,MONSTER_FAMILY_QUALITY_CONTRACT,
 monsterThemeActionsFor,resolveMonsterThemeAction,defaultMonsterThemeAttack,
 monsterActionQualityPlan,MONSTER_THEME_ACTIONS_PER_SPECIES} from '../src/monster-theme-actions.js';
import {MONSTER_THEME_MOTION_REVISION} from '../src/monster-theme-motion.js';
import {MONSTER_ACTIONS,startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {nonhumanMonsterStage,NONHUMAN_QUALITY_PROGRESS} from '../src/nonhuman-model-quality.js';
import {monsterResolutionFor} from '../src/monster-shape-kit.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {humanoidMonsterCostumeFor} from '../src/monster-character-cosplay-manifest.js';
import {readFileSync} from 'node:fs';
const manager=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
const battle=readFileSync(new URL('../src/monster-summon-renderer.js',import.meta.url),'utf8');
const cosplay=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
const totalFamilies=Object.keys(MONSTER_FAMILIES);
test('all 50 family action catalogs and 50 unique signature descriptions',()=>{
 assert.equal(MONSTER_CATALOG.length,50);
 assert.equal(totalFamilies.length,10);
 assert.equal(monsterActionQualityPlan().length,10);
 assert.equal(MONSTER_THEME_ACTIONS_PER_SPECIES,5);
 assert.equal(MONSTER_ACTIONS.length,11,'do not erase legacy actions');
 const ids=new Set();
 for(const family of totalFamilies){
  const actions=MONSTER_FAMILY_ACTIONS[family];
  assert.equal(actions.length,4,family+' needs four distinct techniques');
  assert.equal(MONSTER_FAMILY_QUALITY_CONTRACT[family].length,4);
  for(const a of actions){
   assert.ok(a.id&&a.label&&a.pose&&a.base);
   assert.ok(!ids.has(a.id),'theme action ID must be globally unique');
   ids.add(a.id);
  }
 }
 let covered=0;
 for(const spec of MONSTER_CATALOG){
  const actions=monsterThemeActionsFor(spec);
  assert.equal(actions.length,5,spec.id);
  assert.equal(actions[4].id,'signature');
  assert.equal(actions[4].label,spec.skill,spec.id);
  assert.equal(monsterThemeActionsFor(spec.id).length,5);
  assert.ok(resolveMonsterThemeAction(spec,'signature'),spec.id);
  assert.equal(resolveMonsterThemeAction(spec,'nonexistent'),null);
  assert.ok(actions.some(x=>x.id===defaultMonsterThemeAttack(spec)),
   'battle strike does not use themed action '+spec.id);
  covered++;
 }
 assert.equal(covered,50);
 assert.equal(ids.size,40);
 assert.equal(MONSTER_THEME_MOTION_REVISION,'50-theme-bone-poses-v1-20261121');
});
test('all seven nonhuman families increase geometry density without heavier mass-battle low LOD',()=>{
 const families=['beast','feline','avian','reptile','insect','arachnid','aquatic'];
 for(const family of families){
  const m=MONSTER_CATALOG.find(x=>x.family===family&&x.id!=='m015');
  assert.ok(m,family);
  assert.equal(nonhumanMonsterStage(m),2,'high quality stage '+family);
  const hi=monsterResolutionFor(m,'high'),lo=monsterResolutionFor(m,'low');
  assert.ok(hi.sphere[0]>lo.sphere[0]);
  assert.ok(hi.tube[0]>lo.tube[0]);
  assert.deepEqual(lo.sphere,[14,10],
   '50vs50 and 1000vs1000 low LOD must not grow');
 }
 assert.equal(nonhumanMonsterStage(MONSTER_BY_ID.m015),0);
 assert.equal(nonhumanMonsterStage(MONSTER_BY_ID.m042),0);
 assert.equal(NONHUMAN_QUALITY_PROGRESS.canineCoat,2);
});
test('quality plan is fully grouped with zero missing species or mobility families',()=>{
 const plans=monsterActionQualityPlan();
 assert.equal(plans.reduce((n,x)=>n+x.species.length,0),50);
 assert.deepEqual([...plans.flatMap(x=>x.species)].sort(),MONSTER_CATALOG.map(x=>x.id).sort());
 for(const p of plans)assert.ok(p.species.every(id=>MONSTER_BY_ID[id]?.family===p.family));
});
test('bestiary, battle, and skinned humanoid paths accept all theme actions',()=>{
 assert.match(manager,/renderMonsterActionButtons\(\)/);
 assert.match(manager,/monsterThemeActionsFor\(specimen\(selected\)\)/);
 assert.match(manager,/action-mode-switch/);
 assert.match(battle,/defaultMonsterThemeAttack\(spec\)/);
 assert.match(battle,/resolveMonsterThemeAction\(spec,action\)/);
 assert.match(cosplay,/applyCanonicalMonsterThemeMotion\(visual/);
 assert.match(cosplay,/monsterThemeBones/);
});
test('50 live low-LOD models can animate signature and four family actions',()=>{
 for(const spec of MONSTER_CATALOG){
  let model=null;
  try{
   model=createMonsterModel(spec,{detail:'low'});
   assert.ok(model?.isGroup,'missing model '+spec.id);
   model.updateMatrixWorld(true);
   let meshes=0,triangles=0;
   model.traverse(node=>{
    if(!node.isMesh)return;
    meshes++;
    const vertices=node.geometry?.getAttribute?.('position');
    if(vertices)assert.ok(vertices.array.every(Number.isFinite),'NaN mesh '+spec.id);
    triangles+=Math.floor((node.geometry?.index?.count??vertices?.count??0)/3);
   });
   assert.ok(meshes>0&&triangles>100,spec.id+' missing live geometry');
   const bounds=new THREE.Box3().setFromObject(model);
   assert.ok(!bounds.isEmpty(),'no model bounds '+spec.id);
   assert.ok([bounds.min.x,bounds.min.y,bounds.min.z,
    bounds.max.x,bounds.max.y,bounds.max.z].every(Number.isFinite),
    'nonfinite bounding volume '+spec.id);
   for(const a of monsterThemeActionsFor(spec)){
    startMonsterAction(model,a.id,0);
    const time=Number.isFinite(a.duration)?Math.min(.52,a.duration*.44):.63;
    const pose=animateMonsterModel(model,time);
    assert.equal(pose.action,a.id,'wrong action '+spec.id+'/'+a.id);
    assert.equal(pose.baseAction,a.base);
    assert.equal(model.userData.themeAction,a.id);
    assert.ok(model.userData.themePose);
   }
   startMonsterAction(model,'idle',12);
   const idle=animateMonsterModel(model,12.1);
   assert.equal(idle.action,'idle');
   assert.equal(model.userData.themeAction,null);
   assert.throws(()=>startMonsterAction(model,'unknown-technique',12));
  }finally{if(model)disposeMonsterSculpture(model);}
 }
});
test('humanoid originals use protected skinned rig, not procedural bestiary replacement',()=>{
 const humans=MONSTER_CATALOG.filter(s=>!!humanoidMonsterCostumeFor(s));
 assert.equal(humans.length,16);
 for(const m of humans){
  assert.equal(monsterThemeActionsFor(m).length,5);
  assert.ok(humanoidMonsterCostumeFor(m).modelId);
 }
});
