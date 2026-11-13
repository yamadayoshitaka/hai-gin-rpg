import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {skinAgeShadowFactor} from '../src/face-feature-meshes.js';
import {resolveAgeBand,resolveBodyType} from '../src/character-demographics-v47.js';
import {youngHeroMaleControls,YOUNG_HERO_MALE_V50} from '../src/hero-youthful-appearance-v50.js';
import {catalogHairGroom,groomGuideOffset,CATALOG_GROOM_V50} from '../src/face-hair-groom-v50.js';
import {PART_CATALOG} from '../src/face-part-catalog-v32.js';
import {CHARACTER_CAST_BY_ID,characterAppearance} from '../src/character-cast-v46.js';
import {HERO_STUDIO_MALE_BODY_SCALE,HEROINE_STUDIO_BODY_SCALE,
 refineHeroineCostumeSilhouette} from '../src/heroine-battle-costume-bridge.js';
test('20-year-old cheek and lower-lid shadows are not midlife eye bags',()=>{
 assert.equal(resolveAgeBand('twenties').wrinkles,0);
 assert.equal(skinAgeShadowFactor('twenties'),.12);
 assert.ok(skinAgeShadowFactor('thirties')>.12);
 assert.ok(skinAgeShadowFactor('sixties')>.80);
 assert.equal(skinAgeShadowFactor('eightyPlus'),1);
 assert.ok(skinAgeShadowFactor('under10')<skinAgeShadowFactor('twenties'));
});
test('young male hero gets bright eyes and clean-shaven jaw without overwriting user sliders',()=>{
 const before={eyeHeight:1,eyeWidth:1,irisDiameter:1,beardDensity:.35};
 const next=youngHeroMaleControls(before,'twenties');
 assert.ok(next.eyeHeight>=1.16);
 assert.ok(next.eyeWidth>=1.17);
 assert.ok(next.irisDiameter>=1.23);
 assert.equal(next.beardDensity,0);
 assert.equal(next.beardLength,.35);
 assert.equal(before.beardDensity,.35,'artist source untouched');
 assert.equal(youngHeroMaleControls(before,'twenties',{eyeHeight:1.04}).eyeHeight,1.04);
 assert.deepEqual(youngHeroMaleControls(before,'seventies'),before);
 assert.equal(CHARACTER_CAST_BY_ID['commander-male'].facePreset,0);
 const hero=characterAppearance('commander-male');
 assert.ok(hero.controls.eyeHeight>=1.16);
 assert.equal(hero.controls.beardDensity,0);
 assert.ok(hero.controls.irisDiameter>=YOUNG_HERO_MALE_V50.irisDiameter);
});
test('normal body and male armor preview no longer have the heavy 0.93 proportion',()=>{
 assert.equal(resolveBodyType('normal').width,1);
 assert.equal(resolveBodyType('normal').depth,1);
 assert.ok(resolveBodyType('fat').width>1.3);
 assert.equal(HERO_STUDIO_MALE_BODY_SCALE,HEROINE_STUDIO_BODY_SCALE);
 const root=new THREE.Group();
 const part=(name,slot)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.24,.24,.24),
   new THREE.MeshStandardMaterial());
  mesh.name=name;mesh.userData={equipmentClass:'armor',equipmentSlot:slot};
  root.add(mesh);return mesh;
 };
 const chest=part('male-hero-plate','chest');
 const shoulder=part('male-hero-pauldron','shoulder');
 const leg=part('male-hero-knee','knee');
 const sword=part('male-hero-sword','weapon');
 const report=refineHeroineCostumeSilhouette(root,{gender:'male',job:'swordsman'});
 assert.ok(report.narrowedCuirass>=2);
 assert.ok(chest.scale.x<=.84&&chest.scale.z<=.84);
 assert.ok(shoulder.scale.x<=.78&&shoulder.scale.z<=.78);
 assert.ok(leg.scale.x<=.89);
 assert.equal(sword.scale.x,1);
});
test('catalogue cut names are actual distinct guide poses, not only labels',()=>{
 assert.equal(PART_CATALOG.male.hair.length,24);
 assert.equal(PART_CATALOG.female.hair.length,24);
 const male=PART_CATALOG.male.hair.map(c=>c.values.styleId);
 const female=PART_CATALOG.female.hair.map(c=>c.values.styleId);
 for(const [id,s] of Object.entries(CATALOG_GROOM_V50)){
  assert.ok(male.includes(id)||female.includes(id),'orphan hair style '+id);
  assert.ok(s.mode&&Number.isFinite(s.fringeLift));
 }
 const targets=[
  ['male-natural-mash','round-mash'],
  ['male-two-block','undercut-long-top'],
  ['male-comma','comma-fringe'],
  ['male-slick-back','slicked-back'],
  ['male-wave-perm','soft-perm'],
  ['male-short-spiky','spiky'],
  ['female-low-bun','low-bun-up'],
  ['female-curly-bob','curly-bob']
 ];
 const signatures=new Set();
 for(const [id,mode] of targets){
  const p=catalogHairGroom(id);
  assert.equal(p.mode,mode);
  const atRoot=groomGuideOffset(p,{t:0,zone:'fringeLeft',front:true});
  assert.deepEqual(atRoot,{x:0,y:0,z:0},'real scalp root never moves');
  const atTip=groomGuideOffset(p,{t:.85,zone:'fringeLeft',
   front:true,partSide:-1,rootIndex:11});
  signatures.add([atTip.x,atTip.y,atTip.z].map(v=>v.toFixed(5)).join('/'));
  assert.ok(Math.hypot(atTip.x,atTip.y,atTip.z)>0);
 }
 assert.equal(signatures.size,targets.length);
 assert.ok(catalogHairGroom('male-natural-mash').templeFloor>
  catalogHairGroom('male-shoulder-wolf').templeFloor);
 assert.ok(catalogHairGroom('male-slick-back').backward>.20);
 assert.ok(catalogHairGroom('male-wave-perm').wave>.05);
});
