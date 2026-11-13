import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {HUMAN_MONSTER_IDS,humanoidMonsterCostumeFor,FEMALE_VAMPIRE_COSTUME}
 from '../src/monster-character-cosplay-manifest.js';
import {COSPLAY_INHUMAN_SKIN_IDS,classifyCosplaySurface,
 applyMonsterMaterialPigment} from '../src/monster-cosplay-pigmentation.js';
import {isConstructCostume,addConstructMonsterCostume,
 createConstructCarapaceGeometry,createConstructHeadPlateGeometry,
 CONSTRUCT_COSTUME_KINDS} from '../src/monster-construct-costume.js';

assert.equal(HUMAN_MONSTER_IDS.length,16);
assert.deepEqual(new Set(COSPLAY_INHUMAN_SKIN_IDS),new Set(HUMAN_MONSTER_IDS));
const colorDistanceSquared=(a,b)=>
  (a.r-b.r)**2+(a.g-b.g)**2+(a.b-b.b)**2;
const skins=new Map(),uniqueColors=new Set();
for(const id of HUMAN_MONSTER_IDS){
 const spec=MONSTER_BY_ID[id],profile=humanoidMonsterCostumeFor(spec);
 assert.ok(profile,'Missing person skeleton costume '+id);
 assert.ok(['undead','fiend','golem'].includes(spec.family)||id==='m015');
 assert.equal(profile.id,id);
 const skin=new THREE.Color(profile.skin);
 const skinHsl={};skin.getHSL(skinHsl);
 // All flesh is materially different from a healthy RGB peach material.
 const peach=new THREE.Color(0xcfa892);
 const distance=Math.sqrt(colorDistanceSquared(skin,peach));
 assert.ok(distance>.14,'Monster remains normal human skin '+id+' '+distance);
 uniqueColors.add(profile.skin);skins.set(id,skin);
 const original=new THREE.MeshStandardMaterial({
  color:0xf0bfab,roughness:.60,metalness:0
 });
 const inputColor=original.color.clone();
 const map={id:'original-character-texture'};
 original.map=map;
 const cloned=applyMonsterMaterialPigment(original,'skin',profile);
 assert.notStrictEqual(cloned,original,'Cannot recolor shared playable hero material');
 assert.ok(cloned.userData.monsterCosplayPigment);
 assert.equal(cloned.userData.monsterId,id);
 assert.strictEqual(cloned.map,map,'Skin PBR photo texture was discarded');
 assert.equal(original.color.getHex(),inputColor.getHex(),'Modified shared hero material '+id);
 const actual=new THREE.Color(profile.skin);
 assert.ok(colorDistanceSquared(cloned.color,actual)<.012,
   'Imported costume skin did not take distinct species pigment '+id);
 assert.ok(cloned.roughness>=.70,'Monster flesh too shiny '+id);
 assert.equal(cloned.emissiveIntensity,0,'Body becomes luminous toy '+id);
 original.dispose();cloned.dispose();
}
assert.ok(uniqueColors.size>=15,'16 monsters visually reuse human skin palette');
assert.equal(humanoidMonsterCostumeFor('m034',{genderVariant:'female'}),FEMALE_VAMPIRE_COSTUME);
assert.ok(FEMALE_VAMPIRE_COSTUME.skin!==humanoidMonsterCostumeFor('m034').skin);
for(const [mesh,material,skinned,role] of [
 ['Superhero_Male_FullBody','Material',true,'skin'],
 ['Mesh001','default',true,'skin'],
 ['face','mesh',true,'skin'],
 ['torso','Skin_Base',true,'skin'],
 ['body_high','Mat',true,'skin'],
 ['EyeLashes','Mesh',true,'preserve'],
 ['eye_white','default',true,'preserve'],
 ['pupil','default',true,'preserve'],
 ['Hair','default',true,'hair'],
 ['armor','Material',true,'metal'],
 ['Tunic','Material',true,'cloth'],
 ['Boots','default',true,'cloth'],
 ['Dress','cloth',true,'cloth']
 ]){
 assert.equal(classifyCosplaySurface(mesh,material,{isSkinnedMesh:skinned}),role,
  'GLB material classification regression '+mesh+'/'+material);
}
assert.equal(CONSTRUCT_COSTUME_KINDS.length,5);
for(const detail of ['high','low']){
 for(const factory of [createConstructCarapaceGeometry,createConstructHeadPlateGeometry]){
  const mesh=factory({detail,material:'crystal'});
  const pos=mesh.getAttribute('position'),normal=mesh.getAttribute('normal');
  assert.ok(pos.count>20);
  assert.equal(normal.count,pos.count);
  assert.equal(mesh.getAttribute('uv').count,pos.count);
  assert.ok(pos.array.every(Number.isFinite));
  assert.ok(normal.array.every(Number.isFinite));
  mesh.dispose();
 }
}
for(const id of ['m036','m037','m038','m039','m040']){
 const profile=humanoidMonsterCostumeFor(id);
 assert.equal(isConstructCostume(profile),true);
 const frames={head:new THREE.Group(),chest:new THREE.Group(),
  arms:[new THREE.Group(),new THREE.Group()],
  forearms:[new THREE.Group(),new THREE.Group()],
  legs:[new THREE.Group(),new THREE.Group()],
  calves:[new THREE.Group(),new THREE.Group()]};
 let count=0;
 const refs=[];
 const attach=(parent,geometry,role,name,position=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  mesh.position.set(...position);mesh.name=name;mesh.userData.role=role;
  parent.add(mesh);refs.push(mesh);count++;return mesh;
 };
 const tube=(parent,role,name,points,radius)=>{
  const geo=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p))),8,radius,6,false);
  return attach(parent,geo,role,name);
 };
 const ok=addConstructMonsterCostume({
  profile,frames,attach,tube,detail:'high'
 });
 assert.equal(ok,true,'Missing construct cosplay '+id);
 assert.ok(count>=18,'Construct lacks body armour '+id+'/'+count);
 for(const name of ['head','chest']){
  assert.ok(frames[name].children.length>0,'No sculpt for '+id+'/'+name);
 }
 for(const frame of [...frames.arms,...frames.forearms,
   ...frames.legs,...frames.calves])
  assert.ok(frame.children.length>0,'Moving construct joints have no guards '+id);
 for(const mesh of refs){
  assert.ok(mesh.geometry.getAttribute('position').array.every(Number.isFinite),
   'Construct contains NaNs');
  mesh.geometry.dispose();mesh.material.dispose();
 }
}
assert.equal(addConstructMonsterCostume({
 profile:humanoidMonsterCostumeFor('m034')}),false,
 'Vampire must not become a golem');
console.log('Inhuman skin + 16 humanoid cosplay PASS: non-peach skin, 5 canonical rigged constructs, eye preservation, GPU-ready geometry');
