import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {REGAL_HUMANOID_WARDROBE,wardrobeFor,
 createRegalBodiceGeometry,createRegalSkirtGeometry,
 createRegalHemGeometry,createRegalLimbGeometry,
 createRegalCollarGeometry,createRegalShoulderYokeGeometry,addRegalHumanoidOutfit,
 measureRegalShoulderFit}
 from '../src/monster-regal-garments.js';
import {HUMANOID_MONSTER_COSTUMES,FEMALE_VAMPIRE_COSTUME}
 from '../src/monster-character-cosplay-manifest.js';
import {FEMALE_SUMMON_FORMS} from '../src/female-summon-forms.js';
import {addFemaleSummonCostume}
 from '../src/female-summon-costumes.js';

const fixture=()=>{
 const frames={head:new THREE.Group(),chest:new THREE.Group(),
  pelvis:new THREE.Group(),arms:[new THREE.Group(),new THREE.Group()],
  forearms:[new THREE.Group(),new THREE.Group()],
  legs:[new THREE.Group(),new THREE.Group()],
  calves:[new THREE.Group(),new THREE.Group()]};
 const all=[];
 const attach=(parent,geometry,role,name,p=[0,0,0],r=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  mesh.name=name;
  mesh.position.set(...p);mesh.rotation.set(...r);
  mesh.userData.role=role;parent.add(mesh);all.push(mesh);
  return mesh;
 };
 const tube=(parent,role,name,points,radius=.012)=>{
  const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(
   points.map(p=>new THREE.Vector3(...p))),10,radius,6,false);
  return attach(parent,geometry,role,name);
 };
 return {frames,all,attach,tube,dispose(){
  for(const obj of all){obj.geometry.dispose();obj.material.dispose();}
 }};
};
const validate=(geometry,name)=>{
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),
  uv=geometry.getAttribute('uv');
 assert.ok(p?.count>22,'No real garment surface: '+name);
 assert.ok(geometry.index?.count>35,'No triangles: '+name);
 assert.equal(p.count,n?.count,'Missing normals '+name);
 assert.equal(p.count,uv?.count,'Missing UVs '+name);
 for(const field of ['position','normal','uv'])
  assert.ok(geometry.getAttribute(field).array.every(Number.isFinite),
   'Invalid '+field+' '+name);
};
for(const factory of [
 createRegalBodiceGeometry,createRegalSkirtGeometry,createRegalHemGeometry,
 createRegalLimbGeometry,createRegalCollarGeometry,
 createRegalShoulderYokeGeometry
]){
 const hi=factory({detail:'high'}),lo=factory({detail:'low'});
 validate(hi,factory.name);validate(lo,factory.name);
 assert.ok(hi.getAttribute('position').count>=
  lo.getAttribute('position').count*1.55,'No LOD savings '+factory.name);
 hi.dispose();lo.dispose();
}
// A fitted collar must narrow toward the neck instead of flaring like a
// detached ring, and the yoke must cover both shoulders in one mesh.
for(const detail of ['high','low']){
 const collar=createRegalCollarGeometry({detail}),p=collar.getAttribute('position');
 const segments=detail==='low'?10:28,ringSize=segments+1;
 let bottomRadius=0,topRadius=0;
 for(let j=0;j<ringSize;j++){
  bottomRadius=Math.max(bottomRadius,Math.abs(p.getX(j)));
  topRadius=Math.max(topRadius,Math.abs(p.getX(3*ringSize+j)));
 }
 assert.ok(topRadius<bottomRadius*.7,
  'Collar top must taper around neck, not float as a broad hoop');
 const yoke=createRegalShoulderYokeGeometry({detail,armoured:true});
 validate(yoke,'shoulder yoke');
 const bounds=new THREE.Box3().setFromBufferAttribute(
  yoke.getAttribute('position'));
 assert.ok(bounds.max.x>.28 && bounds.min.x<-.28,
  'Shoulder yoke does not cover both upper arm sleeve roots');
 assert.ok(bounds.max.y<.30,'Shoulder yoke must stay below the face');
 collar.dispose();yoke.dispose();
}
// Calibrate shoulder width from actual donor bone positions (not a one-size
// constant that hovers outside narrow female characters).
for(const [span,expectedMax] of [[.34,.76],[.48,1.01],[.60,1.09]]){
 const root=new THREE.Group();
 const left=new THREE.Bone(),right=new THREE.Bone();
 left.position.x=span/2;right.position.x=-span/2;
 root.add(left,right);root.updateMatrixWorld(true);
 const fit=measureRegalShoulderFit(left,right);
 assert.equal(fit.calibrated,true);
 assert.ok(fit.widthScale<=expectedMax);
 assert.ok(fit.depthScale>=.94&&fit.depthScale<=1.02);
}
assert.equal(measureRegalShoulderFit(null,null).calibrated,false);
{
 const root=new THREE.Group(),a=new THREE.Bone(),b=new THREE.Bone();
 root.add(a,b);a.position.x=.04;b.position.x=-.04;
 root.updateMatrixWorld(true);
 assert.equal(measureRegalShoulderFit(a,b).calibrated,false,
  'Impossible tiny shoulder span must not crush outfit');
}
assert.equal(Object.keys(REGAL_HUMANOID_WARDROBE).length,13);
for(const [type,profile] of Object.entries(REGAL_HUMANOID_WARDROBE)){
 assert.ok(profile.style&&profile.bodice&&profile.hem&&profile.trim);
 assert.ok(profile.skirt>=.5&&profile.skirt<=1,'Uncovered swimsuit '+type);
 assert.ok(profile.flare>=(type==='vampire'?.17:.26),
  'Skirt cannot cover pelvis '+type);
}
assert.equal(wardrobeFor(HUMANOID_MONSTER_COSTUMES.m032),null,
 'Mummies should retain intact wrapped bandage garments');
assert.equal(wardrobeFor(HUMANOID_MONSTER_COSTUMES.m037),null,
 'Golems retain their own plated stone outfits');

const cases=[
 HUMANOID_MONSTER_COSTUMES.m015,
 HUMANOID_MONSTER_COSTUMES.m031,
 HUMANOID_MONSTER_COSTUMES.m033,
 HUMANOID_MONSTER_COSTUMES.m034,
 FEMALE_VAMPIRE_COSTUME,
 HUMANOID_MONSTER_COSTUMES.m035,
 HUMANOID_MONSTER_COSTUMES.m041,
 HUMANOID_MONSTER_COSTUMES.m042,
 HUMANOID_MONSTER_COSTUMES.m043,
 HUMANOID_MONSTER_COSTUMES.m044,
 HUMANOID_MONSTER_COSTUMES.m045,
 ...Object.values(FEMALE_SUMMON_FORMS)
];
const report=[];
for(const profile of cases){
 const hi=fixture(),lo=fixture();
 assert.equal(addRegalHumanoidOutfit({...hi,profile,detail:'high'}),true);
 assert.equal(addRegalHumanoidOutfit({...lo,profile,detail:'low'}),true);
 const find=(f,kind)=>f.all.filter(m=>m.geometry.userData.kind===kind);
 for(const f of [hi,lo]){
  assert.equal(f.all.filter(o=>o.name.includes('fitted-bodice')).length,1,
   'Bare human chest '+profile.costume);
  assert.equal(f.all.filter(o=>o.name.includes('full-skirt')).length,1,
   'Visible underwear in '+profile.costume);
  assert.equal(f.all.filter(o=>o.name.includes('sleeve')).length,2,
   'Sleeve missing from arms '+profile.costume);
  assert.ok(f.all.some(o=>o.name.includes('floor-hem')),
   'Missing continuous hem '+profile.costume);
  assert.ok(f.all.filter(o=>o.parent===f.frames.chest).length>=3,
   'Bodice, yoke and collar must follow animated chest bone');
  const yokes=f.all.filter(o=>o.name.includes('shoulder-yoke'));
  assert.equal(yokes.length,1,'Shoulder seal missing '+profile.costume);
  assert.equal(yokes[0].parent,f.frames.chest,
   'Shoulder bridge cannot be a detached upper-arm sphere');
  assert.ok(yokes[0].geometry.userData.kind.startsWith('shoulder-yoke-'));
  const yokeBounds=new THREE.Box3().setFromBufferAttribute(
   yokes[0].geometry.getAttribute('position'));
  const collar=f.all.find(o=>o.name.endsWith('-collar'));
  const topCrown=collar.geometry.getAttribute('position');
  const ringVertices=f.all.find(o=>o.name.includes('fitted-bodice')).geometry.getAttribute('position');
  assert.ok(yokeBounds.max.x>.27 && yokeBounds.min.x<-.27,
   'No coverage between torso and shoulder sleeve roots');
  assert.ok(yokeBounds.max.y>.25 && yokeBounds.max.y<.30 &&
    yokeBounds.min.y<-.04,
   'Shoulder seam must stay under face and overlap collar/torso');
  assert.ok(topCrown.count>20 && ringVertices.count>20);
  assert.equal(f.all.filter(o=>o.parent===f.frames.pelvis).length,2,
   'Skirt and floor hem must follow pelvis');
  assert.equal(f.all.filter(o=>o.parent===f.frames.arms[0]).length,1);
  for(const o of f.all){
   assert.ok(o.geometry.getAttribute('position').array.every(Number.isFinite));
   assert.ok(o.geometry.getAttribute('normal').array.every(Number.isFinite));
  }
 }
 const verts=f=>f.all.reduce((n,o)=>n+o.geometry.getAttribute('position').count,0);
 const high=verts(hi),low=verts(lo);
 assert.ok(high>low*1.65,'Insufficient LOD '+profile.costume);
 assert.ok(high<13000,'Mobile costume too dense '+profile.costume+' '+high);
 report.push({costume:profile.costume,high,low});
 hi.dispose();lo.dispose();
}
assert.equal(FEMALE_SUMMON_FORMS.dragon_lord.hair,'bald',
 'Dragon king must be hairless as the user specified');
assert.notEqual(FEMALE_SUMMON_FORMS.seraph_guardian.face,
 FEMALE_SUMMON_FORMS.dragon_lord.face,
 'Angel and dragon should not have the same facial character');
assert.equal(FEMALE_SUMMON_FORMS.seraph_guardian.hair,'long');
assert.equal(FEMALE_SUMMON_FORMS.forest_archer.hair,'long');
const dragon=fixture();
assert.equal(addFemaleSummonCostume({
 ...dragon,profile:FEMALE_SUMMON_FORMS.dragon_lord,detail:'high'
}),true);
assert.equal(dragon.all.filter(o=>o.name.includes('dragonkin-solid-golden-eye-')).length,2,
 'Dragon king must have two pupil-free yellow eyes');
assert.ok(dragon.all.every(o=>!o.name.includes('dragonkin-hair')));
const dragonEyes=dragon.all.filter(o=>o.name.includes('dragonkin-solid-golden-eye-'));
assert.ok(dragonEyes.every(o=>o.userData.role==='dragonEye'),
 'Pupil-free almond eyes must retain muted golden iris material');
assert.ok(dragonEyes.every(o=>o.geometry.userData.kind==='dragonkin-inset-almond-golden-eye'),
 'Screenshot regression: never replace the female face with flat yellow marble eyeballs');
for(const n of dragonEyes){
 const bb=new THREE.Box3().setFromBufferAttribute(n.geometry.getAttribute('position'));
 assert.ok(bb.max.y-bb.min.y<.029&&bb.max.z-bb.min.z<.012,
  'Eyes must remain small shallow almonds and preserve natural eye socket');
}
assert.ok(dragon.all.some(o=>o.name.includes('dragonkin-scaled-hairless-crown')&&
  o.geometry.userData.kind==='dragonkin-scaled-cranial-shell'),
 'Dragon Lord bald skull must be an anatomical continuous scaled plate, not sphere helmet');
assert.equal(dragon.all.filter(o=>o.name.includes('dragonkin-delicate-upper-lid-')).length,2);
assert.equal(dragon.all.filter(o=>o.name.includes('dragonkin-cheekbone-contour-')).length,2);
assert.ok(dragon.all.some(o=>o.name.includes('dragonkin-fine-nasal-bridge')));
assert.ok(dragon.all.some(o=>o.name.includes('dragonkin-natural-lower-lip')));
dragon.dispose();
const runtime=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
const gallery=readFileSync(new URL('../summon-showcase.html',import.meta.url),'utf8');
const bestiary=readFileSync(new URL('../monster-manager.html',import.meta.url),'utf8');
assert.match(runtime,/addRegalHumanoidOutfit\(/,
 'Regal clothes must be instantiated onto actual canonical hero models');
assert.match(runtime,/fullBodyOutfit:royalOutfit\?\.style/,
 'Runtime should expose the full-body outfit actually selected');
assert.match(gallery,/monster-character-cosplay\.js\?v=4\.5\.12/);
assert.match(bestiary,/monster-character-cosplay\.js\?v=4\.5\.12/);
console.log('Full-body reference-inspired humanoid wardrobe regression PASS',report);
