import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture}
 from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel}
 from '../src/monster-animation.js';
import {referenceBeastFxBudget}
 from '../src/beast-action-effects.js';

const specimen=id=>createMonsterModel(MONSTER_BY_ID[id],{detail:'high'});
const meshes=root=>{
 const list=[];root.traverse(v=>{if(v.isMesh)list.push(v)});
 return list;
};
const first=(root,name)=>meshes(root).find(x=>x.name===name);
test('m002 REALLY inherits the m001 physical skull, rhinarium and scalp source',()=>{
 const m=specimen('m002');
 try{
  const p=m.userData.pivots,head=p.head;
  const skull=first(m,'organic-cranium-m002');
  const nose=first(m,'m002-rhinarium');
  assert.ok(skull?.userData.m001SourceDonor==='M001_CRANIUM_RINGS');
  assert.equal(m.userData.m002SkullIsPhysicalM001Morph,true);
  assert.equal(m.userData.m002FaceQualityDonor,'m001');
  assert.equal(m.userData.m002SourceM001Mane,true);
  assert.ok(m.userData.m002M001ContourGuides>1400,
   'm002 must use the dense physical m001 cheek/crown roots');
  assert.equal(m.userData.m002FaceCoatDensityMultiplier,2);
  assert.equal(head.children.filter(x=>x.isMesh&&x.userData.furStrands>0).length,3,
   '2x density must still be batched in three wolf fur materials');
  assert.ok(nose,'m002 must keep its authored wet rhinarium');
  const pNose=nose.geometry.getAttribute('position');
  let half=0;
  for(let i=0;i<pNose.count;i++)half=Math.max(half,Math.abs(pNose.getX(i)));
  assert.ok(half>.05&&half<.065,'m002 should have m001-like compact nose, actual '+half);
  assert.equal(p.jaw.parent,head,
   'm002 mandible should follow head turns like the m001 reference');
  assert.equal(p.legfrontL.parent,p.torso,
   'forelimbs must be attached to the moving torso, not the root');
  assert.ok(first(m,'m002-upper-incisor-0'));
  assert.ok(first(m,'m002-lower-incisor-0'));
  assert.ok(first(m,'m002-fang-labial-root-L')?.userData.wolfGumEmbedded);
  assert.ok(first(m,'m002-eyebrow-ridge-L'));
  const eyes=meshes(m).filter(x=>x.userData.m002OpticalSkullAdvance>.06);
  assert.ok(eyes.length>=8,'both sets of eyes, iris, pupil and eyelids must fit skull');
  assert.ok(first(m,'m002-masseter'));
  assert.ok(meshes(m).filter(x=>x.userData.jointSeamSleeve).length>=4);
  assert.ok(meshes(m).filter(x=>x.userData.buriedScapula).length>=2);
 }finally{disposeMonsterSculpture(m);}
});
test('m002 uses fixed-length articulated wolf gait and near-only action effects',()=>{
 const m=specimen('m002');
 try{
  const p=m.userData.pivots;
  startMonsterAction(m,'walk',0);
  animateMonsterModel(m,.15);
  const hip1=p.legfrontL.rotation.x,len1=p.legfrontL.scale.y;
  animateMonsterModel(m,.33);
  assert.notEqual(hip1,p.legfrontL.rotation.x);
  assert.equal(p.legfrontL.scale.y,len1,
   'support phases must not squeeze the proximal bone and open a seam');
  startMonsterAction(m,'attack',0);
  animateMonsterModel(m,.50);
  assert.ok(p.jaw.rotation.x>.20);
  assert.equal(referenceBeastFxBudget(m).meshes,3);
  assert.ok(referenceBeastFxBudget(m).visible>0);
  startMonsterAction(m,'idle',.60);
  animateMonsterModel(m,.68);
  assert.equal(referenceBeastFxBudget(m).visible,0);
 }finally{disposeMonsterSculpture(m);}
});
test('m007 source has embedded feline teeth, no spherical hips and real walk/leap',()=>{
 const m=specimen('m007');
 try{
  const p=m.userData.pivots;
  const all=meshes(m);
  assert.ok(first(m,'feline-master-rhinarium-m007')?.userData.felineTriangularRhinarium);
  assert.ok(first(m,'feline-philtrum-m007'));
  assert.equal(all.filter(x=>x.userData.felineDentalRoot==='maxilla').length,6,
    'six real upper teeth plus separate gum sockets, not twelve teeth');
  assert.equal(all.filter(x=>x.userData.felineDentalRoot==='mandible').length,8,
    'six lower incisors plus two small lower canines');
  assert.equal(all.filter(x=>x.name.startsWith('feline-upper-gum-socket-m007-')).length,2);
  assert.ok(first(m,'feline-master-upper-canine-m007-L')?.userData.gumCovered);
  assert.equal(p.jaw.parent,p.head);
  for(const limb of ['frontL','frontR','rearL','rearR']){
   const leg=p['leg'+limb];
   assert.ok(leg?.userData.felineJointSeamRefinement);
   assert.ok(!leg.children.some(x=>x.isMesh&&x.geometry?.type==='SphereGeometry'),
    'legacy floating ball on each feline upper leg must be removed');
   assert.ok(all.some(x=>x.name==='feline-upper-knee-fascia-'+limb));
   assert.ok(all.some(x=>x.name==='feline-lower-knee-fascia-'+limb));
  }
  startMonsterAction(m,'walk',0);
  animateMonsterModel(m,.14);
  const hip=p.legfrontL.rotation.x;
  const toe=p.toefrontL.rotation.x;
  animateMonsterModel(m,.31);
  assert.notEqual(hip,p.legfrontL.rotation.x);
  assert.notEqual(toe,p.toefrontL.rotation.x);
  startMonsterAction(m,'leap',0);
  const leap=animateMonsterModel(m,.53);
  assert.ok(leap.leapPhase==='airborne'||leap.leapPhase==='takeoff');
  animateMonsterModel(m,1.05);
  assert.equal(referenceBeastFxBudget(m).meshes,3);
  assert.ok(m.userData.referenceBeastFx.impact.visible,
   'jump landing effect must align with the impact animation window');
 }finally{disposeMonsterSculpture(m);}
});
test('performance low LOD and protected m005/m006 do not allocate extra VFX',()=>{
 for(const id of ['m002','m007','m008','m009','m010','m005','m006']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   startMonsterAction(model,'leap',0);
   animateMonsterModel(model,1.05);
   assert.equal(referenceBeastFxBudget(model).meshes,0,id);
   assert.equal(model.userData.referenceBeastFx,undefined);
  }finally{disposeMonsterSculpture(model);}
 }
});
