import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {CANONICAL_HUMAN_FRONT_Z,LEGACY_COSTUME_FRONT_Z,
 shouldCorrectCostumeFront,alignCostumeToCanonicalFacing}
 from '../src/monster-anatomical-frame.js';
import {createCharacterCrownGeometry,createCharacterHairStrandsGeometry,
 attachCanonicalCharacterGroom}
 from '../src/monster-humanoid-hair.js';
import {HUMANOID_MONSTER_COSTUMES,FEMALE_VAMPIRE_COSTUME}
 from '../src/monster-character-cosplay-manifest.js';
import {FEMALE_SUMMON_FORMS} from '../src/female-summon-forms.js';
import {DEMON_MAKEUP_PRESETS,addDemonicFaceCosmetics}
 from '../src/monster-demon-cosmetics.js';
import {addFemaleSummonCostume}
 from '../src/female-summon-costumes.js';
import {addGothicMonsterSculpt}
 from '../src/monster-gothic-sculpt.js';

assert.equal(CANONICAL_HUMAN_FRONT_Z,1);
assert.equal(LEGACY_COSTUME_FRONT_Z,-1);
assert.equal(shouldCorrectCostumeFront(),true);
assert.equal(shouldCorrectCostumeFront(-1,-1),false);
function createAttachment(){
 const g=new THREE.BoxGeometry(.1,.1,.1);
 const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());
 m.position.set(.1,.2,.39);
 return m;
}
let mesh=createAttachment();
alignCostumeToCanonicalFacing(mesh);
assert.equal(mesh.position.z,-.39,'Legacy wings must be behind canonical chest');
assert.equal(mesh.scale.z,-1);
assert.equal(mesh.userData.canonicalFrontZ,1);
mesh.geometry.dispose();mesh.material.dispose();
mesh=createAttachment();
alignCostumeToCanonicalFacing(mesh,{groom:true});
assert.equal(mesh.position.z,.39,'Donor-skull groom should never be mirrored');
assert.equal(mesh.scale.z,1);
assert.equal(mesh.userData.costumeIsHeadFittedGroom,true);
mesh.geometry.dispose();mesh.material.dispose();

// Full scalp coverage: 0-degree and 270-degree azimuths must not be bald,
// while +Z (source actor front) has a higher forehead hairline than -Z back.
const crown=createCharacterCrownGeometry({center:[0,0,0],radius:[1,1,1]});
const cp=crown.getAttribute('position'),cols=40,rows=16;
assert.equal(cp.count,(cols+1)*(rows+1));
const front=new THREE.Vector3().fromBufferAttribute(cp,rows*(cols+1)+cols/4);
const rear=new THREE.Vector3().fromBufferAttribute(cp,rows*(cols+1)+cols*3/4);
assert.ok(front.z>.7&&rear.z<-.7,'Scalp source face axis was inverted');
assert.ok(front.y>rear.y+.20,'Front hairline must terminate higher than nape');
assert.ok(cp.array.every(Number.isFinite));
assert.ok(crown.getAttribute('normal').array.every(Number.isFinite));
crown.dispose();
const highLocks=createCharacterHairStrandsGeometry({style:'long',detail:'high'});
const lowLocks=createCharacterHairStrandsGeometry({style:'long',detail:'low'});
assert.ok(highLocks.getAttribute('position').count>
 lowLocks.getAttribute('position').count*4,
 'Head closeups need distinct groom/LOD geometry');
assert.ok(highLocks.getAttribute('normal').array.every(Number.isFinite));
highLocks.dispose();lowLocks.dispose();

const profiles=[
 ...Object.values(HUMANOID_MONSTER_COSTUMES),
 FEMALE_VAMPIRE_COSTUME,...Object.values(FEMALE_SUMMON_FORMS)
];
const important=['m044','m034','seraph_guardian','forest_archer','dragon_lord'];
for(const p of profiles){
 const donor=new THREE.Group(),headBone=new THREE.Bone();
 headBone.name='Head';donor.add(headBone);
 const head=new THREE.Group();headBone.add(head);
 const parts=[],attach=(frame,g,role,name)=>{
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());
  m.name='monster-costume-'+name;frame.add(m);parts.push(m);return m;
 };
 const groom=attachCanonicalCharacterGroom({
  model:donor,headBone,profile:p,frames:{head},detail:'low',attach
 });
 if(p.hair==='bald'){
  assert.equal(groom,null,'Intentionally bald skeletal/stone monsters remain bald '+p.id);
  assert.equal(parts.length,0);
 }else{
  assert.ok(groom?.crown&&groom?.locks,'Missing living hair '+p.id);
  assert.equal(parts.length,2);
  assert.equal(groom.crown.geometry.userData.kind,'fully-covered-canonical-head-crown');
  assert.equal(groom.locks.geometry.userData.kind,'scalp-rooted-tapered-hair-strands');
  assert.ok(parts.every(m=>m.parent===head),'Hair not anchored to animated head '+p.id);
  assert.ok(parts.every(m=>m.userData.canonicalHairGroom),'Missing hair diagnostics '+p.id);
  if(important.includes(p.id)){
   assert.equal(p.hair,'long','Angels, forest spirit, succubus and women need long hair '+p.id);
   assert.ok(groom.crown.geometry.getAttribute('position').count>=140);
   assert.ok(groom.locks.geometry.getAttribute('position').count>500);
  }
 }
 for(const m of parts){m.geometry.dispose();m.material.dispose();}
}
assert.equal(HUMANOID_MONSTER_COSTUMES.m044.hair,'long');
assert.equal(FEMALE_VAMPIRE_COSTUME.hair,'long');

const groups=()=>({head:new THREE.Group(),chest:new THREE.Group(),
 pelvis:new THREE.Group(),arms:[new THREE.Group(),new THREE.Group()],
 forearms:[new THREE.Group(),new THREE.Group()],
 legs:[new THREE.Group(),new THREE.Group()],
 calves:[new THREE.Group(),new THREE.Group()]});
function fixture(){
 const frames=groups(),nodes=[];
 const attach=(frame,g,role,name,pos=[0,0,0],rot=[0,0,0])=>{
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial());
  m.name=name;m.position.set(...pos);m.rotation.set(...rot);
  alignCostumeToCanonicalFacing(m);
  frame.add(m);nodes.push(m);return m;
 };
 const tube=(frame,role,name,points,radius)=>{
  const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>
   new THREE.Vector3(...p))),8,radius||.01,6,false);
  return attach(frame,g,role,name);
 };
 return {frames,nodes,attach,tube};
}
for(const id of Object.keys(DEMON_MAKEUP_PRESETS)){
 const profile=HUMANOID_MONSTER_COSTUMES[id],test=fixture();
 assert.equal(addDemonicFaceCosmetics({...test,profile,detail:'low'}),true);
 for(const node of test.nodes){
  assert.ok(node.geometry.getAttribute('position').array.every(Number.isFinite));
  assert.ok(node.geometry.getAttribute('normal').array.every(Number.isFinite));
 }
 const face=test.nodes.filter(n=>n.name.includes('upper-eyeliner'));
 assert.equal(face.length,2,'Demonic eyelids missing '+id);
 // The face (+Z) and membrane wings (-Z) must oppose one another.
 for(const eye of face){
  assert.ok(eye.scale.z<0,'Eye cosmetics not mirrored onto actor '+id);
 }
 const wings=test.nodes.filter(n=>n.name.includes('membranous-wing'));
 for(const wing of wings){
  const box=new THREE.Box3().setFromObject(wing);
  assert.ok(box.max.z<-.07,'Wing membrane still mounted IN FRONT '+id+' '+box.max.z);
  assert.strictEqual(wing.parent,test.frames.chest);
 }
 const tails=test.nodes.filter(n=>n.name.includes('flexible-demon-tail'));
 if(DEMON_MAKEUP_PRESETS[id].tail){
  assert.equal(tails.length,1,'Missing one attached tail '+id);
  assert.strictEqual(tails[0].parent,test.frames.pelvis,
   'Tail must grow from hips instead of abdomen/crotch '+id);
  assert.ok(new THREE.Box3().setFromObject(tails[0]).max.z<-.10,
   'Tail still protrudes ahead of human torso '+id);
 }
 if(id==='m042'){
  assert.ok(test.nodes.some(n=>n.name.includes('gargoyle-fitted-stone-chest')),
   'Gargoyle is still a bare human wearing shorts');
  assert.ok(test.nodes.some(n=>n.name.includes('species-bone-anchored-loin-plate')&&
    n.parent===test.frames.pelvis),
   'Gargoyle hip outfit must cover human underwear');
  assert.equal(test.nodes.filter(n=>n.name.includes('gargoyle-cranial-ridge')).length,3);
 }
 for(const m of test.nodes){m.geometry.dispose();m.material.dispose();}
}
for(const [id,p] of Object.entries(FEMALE_SUMMON_FORMS)){
 const test=fixture();
 assert.equal(addFemaleSummonCostume({...test,profile:p,detail:'low'}),true);
 if(id==='seraph_guardian'){
  const feathers=test.nodes.filter(n=>n.name.includes('seraph-primary'));
  assert.ok(feathers.length>=10,'Do not remove feathered angel wings');
  const featherBox=new THREE.Box3().setFromObject(feathers[0]);
  assert.ok(featherBox.max.z<0,'Seraph wings still in front of body');
  const halo=test.nodes.find(n=>n.name.includes('seraph-open-circular-halo'));
  assert.ok(halo,'Missing halo');
  assert.ok(halo.geometry.type==='TorusGeometry','Halo should not be a flat bar');
 }
 if(id==='dragon_lord'){
  assert.equal(test.nodes.filter(n=>n.name.includes('dragonkin-tail')).length,1);
  assert.ok(test.nodes.some(n=>n.name.includes('dragonkin-tail')&&
   n.parent===test.frames.pelvis),'Dragonkin tail is in front of pelvis');
 }
 for(const m of test.nodes){m.geometry.dispose();m.material.dispose();}
}
const source=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
assert.match(source,/alignCostumeToCanonicalFacing\(mesh,\{groom\}\)/);
assert.match(source,/attachCanonicalCharacterGroom\(/);
assert.match(source,/groom:true/);
assert.match(source,/crownCovered:!!groom\?\.crown/);
assert.match(source,/pelvis:createFrame\(joints\.pelvis/);
console.log('Humanoid wings/tails/scalp regression PASS: all 16 character monsters, succubus hair, blonde seraph, 3 female summons and back-facing wing/tail anatomy');
