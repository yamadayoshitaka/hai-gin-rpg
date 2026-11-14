import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {CANONICAL_HUMAN_FRONT_Z,LEGACY_COSTUME_FRONT_Z,
 shouldCorrectCostumeFront,alignCostumeToCanonicalFacing}
 from '../src/monster-anatomical-frame.js';
import {createCharacterCrownGeometry,createCharacterHairStrandsGeometry,
 attachCanonicalCharacterGroom,createCanonicalHeadLocalGroomAnchor,
 measureCanonicalScalp}
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
assert.equal(highLocks.userData.poleCoverage,true);
assert.equal(highLocks.userData.crownCanopyStrands,168);
assert.equal(lowLocks.userData.crownCanopyStrands,48);
const locks=highLocks.getAttribute('position');
let northPoleRoots=0;
for(let i=0;i<locks.count;i+=10){
 const x=locks.getX(i),z=locks.getZ(i),y=locks.getY(i);
 // A scalp crown top > .97 of its height must be covered by visible hair
 // ribbons. The old generator placed zero ribbons in this region.
 if(y>.095+.16*.97&&Math.hypot(x,z)<.035)northPoleRoots++;
}
assert.ok(northPoleRoots>=12,
 'Seraph/Forest Archer top crown still lacks central hair roots');
highLocks.dispose();lowLocks.dispose();


// A canonical head bone can have an arbitrary bind-pose orientation. Fitted
// hair points live in its LOCAL coordinates, not in the counter-rotated
// MODEL coordinate frame used by horns and makeup.
{
 const donor=new THREE.Group(),bone=new THREE.Bone();
 donor.position.set(.24,1.2,-.32);
 donor.rotation.set(.10,-.39,.06);
 bone.name='Head';bone.position.set(.04,.47,.02);
 bone.rotation.set(.14,.63,-.22);
 donor.add(bone);
 const anchor=createCanonicalHeadLocalGroomAnchor(bone);
 assert.equal(anchor.parent,bone);
 assert.ok(anchor.userData.canonicalHeadBoneLocal);
 assert.ok(anchor.position.length()<1e-10);
 assert.ok(anchor.quaternion.equals(new THREE.Quaternion()));
 assert.ok(anchor.scale.equals(new THREE.Vector3(1,1,1)));
 const testPoint=new THREE.Vector3(.072,.14,.105);
 donor.updateMatrixWorld(true);
 const expected=bone.localToWorld(testPoint.clone());
 const actual=anchor.localToWorld(testPoint.clone());
 assert.ok(actual.distanceTo(expected)<1e-8,
  'Hair in head bone coordinates misaligned on rotated original donor pose');
 anchor.parent.remove(anchor);
 assert.throws(()=>createCanonicalHeadLocalGroomAnchor(donor),
  /head bone/,'A regular Model Group must not be used as head bone');
}
// A real imported Head bind axis can be rotated 90 degrees relative to
// actor +Y. An ellipsoid head is vertical in MODEL coordinates; measuring
// as uncorrected Head-local +Y turns the scalp 90 degrees and leaves a bald
// patch across the actual crown. The group and measurements must agree.
{
 const donor=new THREE.Group(),bone=new THREE.Bone();
 const geo=new THREE.SphereGeometry(1,24,20);
 geo.scale(.108,.180,.122);geo.translate(0,.055,0);
 const n=geo.getAttribute('position').count;
 const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
 for(let i=0;i<n;i++)weights[i*4]=1;
 geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
 geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const face=new THREE.SkinnedMesh(geo,new THREE.MeshBasicMaterial());
 face.name='FaceBody';face.add(bone);donor.add(face);
 bone.name='Head';bone.rotation.z=Math.PI*.50;
 face.bind(new THREE.Skeleton([bone]));
 const legacy=measureCanonicalScalp(donor,bone);
 const upright=createCanonicalHeadLocalGroomAnchor(bone,donor);
 const fit=measureCanonicalScalp(donor,bone,{groomFrame:upright});
 assert.equal(upright.parent,bone);
 assert.ok(upright.userData.modelUprightGroom);
 assert.ok(fit.fitted && fit.samples>50);
 assert.ok(fit.radius[0]<legacy.radius[0]-.02,
  'Head bone local axis rotated the scalp over the side of the skull');
 donor.updateMatrixWorld(true);
 const modelUp=new THREE.Vector3(0,1,0)
  .applyQuaternion(donor.getWorldQuaternion(new THREE.Quaternion()));
 const groomUp=new THREE.Vector3(0,1,0)
  .applyQuaternion(upright.getWorldQuaternion(new THREE.Quaternion()));
 assert.ok(modelUp.dot(groomUp)>.9999,'Hair must grow upward in model frame');
 assert.throws(()=>measureCanonicalScalp(donor,bone,{groomFrame:donor}),
  /Head bone/,'Never sample hair in an unrelated attachment frame');
 face.geometry.dispose();face.material.dispose();
}
for(const style of ['long','swept','bob','short']){
 const fit={style,detail:'high',center:[0,0,0],radius:[1,1,1]};
 const hi=createCharacterHairStrandsGeometry(fit);
 const low=createCharacterHairStrandsGeometry({...fit,detail:'low'});
 const a=hi.getAttribute('position'),l=low.getAttribute('position');
 assert.ok(a.count>l.count*3,'Missing near-LOD hair coverage '+style);
 assert.ok(a.array.every(Number.isFinite));
 assert.ok(hi.getAttribute('normal').array.every(Number.isFinite));
 for(let i=0;i<a.count;i+=10){
   const x=a.getX(i),y=a.getY(i),z=a.getZ(i);
   const phi=Math.atan2(z,x),front=Math.max(0,Math.sin(phi));
   const theta=Math.acos(Math.max(-1,Math.min(1,y)));
   assert.ok(theta<1.68-.34*front+.075,
     'Disconnected scalp root '+style+' at strand '+i/10);
 }
 hi.dispose();low.dispose();
}


// A hidden donor helmet or model-side hair must not enlarge the measured
// skull and re-introduce a bald cap / hovering wig above a real head.
{
 const donor=new THREE.Group(),head=new THREE.Bone();
 head.name='Head';
 const makeSkin=(radius,name,visible=true)=>{
   const geo=new THREE.SphereGeometry(radius,18,12),n=geo.getAttribute('position').count;
   const indices=new Uint16Array(n*4),weights=new Float32Array(n*4);
   for(let i=0;i<n;i++)weights[i*4]=1;
   geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
   geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
   const mesh=new THREE.SkinnedMesh(geo,new THREE.MeshBasicMaterial());
   mesh.name=name;mesh.visible=visible;donor.add(mesh);return mesh;
 };
 const skin=makeSkin(.122,'FaceBody');
 skin.add(head);skin.bind(new THREE.Skeleton([head]));
 const helmet=makeSkin(.275,'HiddenHairHelmet',false);
 helmet.bind(new THREE.Skeleton([head]));
 let scalp=measureCanonicalScalp(donor,head);
 assert.ok(scalp.fitted&&scalp.samples>20,
  'Real donor head vertices should be measured with bound skin weights');
 assert.ok(scalp.radius[0]<.16,
  'Invisible donor hair/helmet must not inflate fitted scalp');
 helmet.visible=true;
 scalp=measureCanonicalScalp(donor,head);
 assert.ok(scalp.radius[0]<.16,
  'Decorative helmet geometry is never a valid skull measurement source');
 skin.geometry.dispose();skin.material.dispose();
 helmet.geometry.dispose();helmet.material.dispose();
}

const profiles=[
 ...Object.values(HUMANOID_MONSTER_COSTUMES),
 FEMALE_VAMPIRE_COSTUME,...Object.values(FEMALE_SUMMON_FORMS)
];
const important=['m044','m034','seraph_guardian','forest_archer'];
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
  if(important.includes(p.id)&&!(p.id==='m034'&&p.sex==='male')){
   assert.equal(p.hair,'long','Angels, forest spirit, succubus and women need long hair '+p.id);
   assert.ok(groom.crown.geometry.getAttribute('position').count>=140);
   assert.ok(groom.locks.geometry.getAttribute('position').count>500);
  }
 }
 for(const m of parts){m.geometry.dispose();m.material.dispose();}
}
assert.equal(HUMANOID_MONSTER_COSTUMES.m044.hair,'long');
assert.equal(FEMALE_VAMPIRE_COSTUME.hair,'long');
assert.equal(FEMALE_SUMMON_FORMS.dragon_lord.hair,'bald',
 'Dragon king crown uses dragon plates and yellow eyes, not a misplaced wig');

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
  const wings=test.nodes.filter(n=>n.geometry.userData.kind===
   'original-guardian-overlapping-feather-wing');
  assert.equal(wings.length,2,'Both original multilayer Angel wings must remain');
  // Fixture groups are detached from a real model, so the parent's world
  // matrices must be updated before evaluating the installed wing bounds.
  test.frames.chest.updateMatrixWorld(true);
  const featherBox=new THREE.Box3().setFromObject(wings[0]);
  assert.ok(wings[0].parent.position.z<0,
   'Original Seraph wing root must sit behind real shoulder blades');
  assert.ok(featherBox.max.z<.12,
   'Original Seraph wing has moved to the front of the face');
  assert.ok(wings.every(n=>n.geometry.getAttribute('color')),
   'Keep the original high-quality feather shading');
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
assert.match(source,/frames\.headGroom=createCanonicalHeadLocalGroomAnchor\(joints\.head,model\)/,
 'Missing head-bone local groom instance in monster runtime');
assert.match(source,/frames:\{\.\.\.frames,head:frames\.headGroom\}/,
 'Do not attach hair into reoriented makeup frame');
assert.match(source,/headBoneLocalGroom:/,
 'Diagnostics must expose skull-local groom attachment');
console.log('Humanoid wings/tails/scalp regression PASS: all 16 character monsters, succubus hair, blonde seraph, 3 female summons and back-facing wing/tail anatomy');
