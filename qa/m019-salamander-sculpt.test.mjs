import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {MAGMA_SALAMANDER_REVISION,MAGMA_SALAMANDER_LEG_REACH,
 magmaSkullFromWolfKing,magmaTorsoFromWolfKing} from '../src/magma-salamander-sculpt.js';
import {M019_HERO_REVISION,M019_BODY_DROP,M019_TAIL_LENGTH,
 M019_BODY_STRETCH,M019_LIMB_REACH,M019_LIMB_WIDTH,
 M019_APPROVED_SILHOUETTE,M019_SPRAWL_KNEE_X,M019_SPRAWL_FOOT_X,
 m019HeroSkullRings,m019HeroTorsoRings}
 from '../src/m019-hero-sculpt.js';
import {m019FullBodyFit} from '../src/m019-full-body-camera.js';

test('m019 is an explicitly m001-derived original salamander, not a copied wolf',()=>{
 const donor=[{z:.5,y:0,rx:.1,ry:.1},{z:.4,y:0,rx:.2,ry:.2},
 {z:.3,y:0,rx:.3,ry:.3},{z:.2,y:0,rx:.4,ry:.3},
 {z:.1,y:0,rx:.4,ry:.3},{z:0,y:0,rx:.3,ry:.3},
 {z:-.1,y:0,rx:.25,ry:.2},{z:-.2,y:0,rx:.15,ry:.15}];
 const m=magmaSkullFromWolfKing(donor);
 assert.equal(m.length,donor.length);
 assert(m.every((p,i)=>i===0||p.z<m[i-1].z));
 assert(m.some((p,i)=>p.rx!==donor[i].rx));
 assert.equal(donor[0].rx,.1,'m001 donor must remain unmodified');
 const body=magmaTorsoFromWolfKing(Array.from({length:8},(_,i)=>({
  z:1-i*.25,y:1.3,rx:.4,ry:.35
 })));
 assert.equal(body.length,8);
 assert(body.every(x=>x.rx>.4&&x.ry>.35));
 assert.equal(MONSTER_BY_ID.m019.family,'reptile');
});

for(const detail of ['low','high']){
 test('m019 real 3D mesh and motion / '+detail,()=>{
  const model=createMonsterModel(MONSTER_BY_ID.m019,{detail});
  try{
   assert.equal(model.userData.m019SculptRevision,MAGMA_SALAMANDER_REVISION);
   assert.equal(model.userData.clonedFromSpecies,'m001');
   assert.equal(model.userData.speciesId,'m019');
   assert.equal(model.userData.m019ShortLegReach,MAGMA_SALAMANDER_LEG_REACH);
   const meshes=[],nameSet=new Set();
   model.traverse(o=>{if(o.isMesh){meshes.push(o);nameSet.add(o.name)}});
   assert(meshes.length>0,'real triangle meshes are required');
   assert(nameSet.has('m019-m001-sourced-closed-cranium'));
   assert.equal(model.userData.m019HeroSilhouette,M019_HERO_REVISION);
   assert.equal(model.userData.gameModelRevision,M019_HERO_REVISION);
   assert.equal(model.userData.m019ModelFollowsFourView,true);
   assert.deepEqual(model.userData.m019ApprovedTurnaround,
     M019_APPROVED_SILHOUETTE);
   assert.equal(model.userData.m019ApprovedTurnaround.legs,4);
   assert(nameSet.has('m019-unbroken-salamander-muzzle'));
   assert(nameSet.has('m019-articulated-wide-mandible'));
   assert(nameSet.has('m019-recessed-mouth-slit'));
   assert(!nameSet.has('quadruped-tongue'),'m019 must never show a floating tongue ball');
   assert(!nameSet.has('reptile-orbital-socket'),'m019 must use its own narrow eyes');
   assert(nameSet.has('m019-continuous-tail-tip'));
   assert.equal(nameSet.has('m019-cheek-horn-L'),false,
    'concept has only two major cranial horns, not extra tusks');
   const tailTipMesh=meshes.find(m=>m.name==='m019-continuous-tail-tip');
   assert.equal(tailTipMesh.userData.m019ClosedTaperedTail,true);
   assert.equal(tailTipMesh.userData.m019UpcurledTip,true);
   assert(tailTipMesh.geometry.getAttribute('position').array.some((v,i)=>
     i%3===1&&v>.47),'tail tip must actually rise in 3D');

   const skull=meshes.find(m=>m.name==='m019-m001-sourced-closed-cranium');
   assert.equal(skull.geometry.userData.faceVolumeApplied,true,
    'm019 must preserve the existing physically sculpted facial surface');
   assert(nameSet.has('m019-grand-horn-L')&&nameSet.has('m019-grand-horn-R'),
    'both large horns must follow the head pivot');
   assert(nameSet.has('m019-vertical-pupil-L')&&nameSet.has('m019-vertical-pupil-R'));
   assert(nameSet.has('m019-amber-iris-L')&&nameSet.has('m019-amber-iris-R'));
   assert([...nameSet].some(n=>n.startsWith('m019-lava-ridge-')));
   assert(![...nameSet].some(n=>n.includes('wolf-mane')||n.includes('canine-fur')),
    'salamander must not grow the m001 fur coat');
   const pivot=model.userData.pivots;
   assert(pivot?.head&&pivot?.torso&&pivot?.tail);
   assert.equal(pivot.head.parent,pivot.torso,'m019 head must move with rib cage');
   assert.equal(pivot.torso.position.y,-M019_BODY_DROP);
   assert.equal(pivot.tail.scale.z,M019_TAIL_LENGTH);
   assert(pivot.tailTip?.userData!==undefined,'tail tip must be a movable pivot');
   assert.equal(pivot.tailMid.parent,pivot.tail);
   assert.equal(pivot.tailTip.parent,pivot.tailMid);
   // A formerly +.164 Y offset created a visible disconnected tail.
   // Current outer mid ring is at y=-.108; the tip inlet is y=-.016.
   assert(Math.abs((pivot.tailTip.position.y-.016)-(-.108))<.075,
    'the upcurled tip must overlap the previous anatomical tail ring');

   const body=meshes.find(o=>o.name==='species-shoulder-rib-pelvis-m019');
   assert.equal(body?.parent,pivot.torso);
   assert(body.userData.anatomicalStations>=8);
   assert.equal(body.userData.closedAnatomicalHull,true,
     'thin torso needs end caps to prevent neck/tail holes');
   model.updateMatrixWorld(true);
   const bodySize=new THREE.Box3().setFromObject(body)
     .getSize(new THREE.Vector3());
   assert(bodySize.z>bodySize.x*3.8,
     'approved side silhouette is a very long narrow lizard');
   assert(bodySize.z>bodySize.y*3.5,
     'approved body is long and dorsoventrally flattened');
   const snout=meshes.find(o=>o.name==='m019-unbroken-salamander-muzzle');
   assert.equal(snout.parent,pivot.head,'snout must not float separately from skull');
   const mandible=meshes.find(o=>o.name==='m019-articulated-wide-mandible');
   assert.equal(mandible.parent,pivot.jaw);
   assert.equal(pivot.jaw.parent,pivot.head);
   for(const legId of ['legfrontL','legfrontR','legrearL','legrearR']){
    const leg=pivot[legId];
    assert(leg?.userData.m019ShortPlantedLeg,legId+' must be short');
    assert.equal(leg.scale.y,MAGMA_SALAMANDER_LEG_REACH);
    assert.equal(leg.parent,pivot.torso,
      'hips must follow body motion without drifting');
    assert.equal(leg.scale.x,M019_LIMB_WIDTH);
    assert.equal(leg.scale.z,M019_LIMB_WIDTH);
    assert.equal(leg.scale.y,M019_LIMB_REACH);
    assert(Math.abs(leg.position.z)>1,
      'fore and hind legs must be separated across elongated body');
    assert(nameSet.has('m019-scaled-upper-limb-'+legId.slice(3)));
    assert(nameSet.has('m019-scaled-lower-limb-'+legId.slice(3)));
    assert(nameSet.has('m019-rooted-claw-'+legId.slice(3)+'-0'));
    assert(nameSet.has('m019-rooted-claw-'+legId.slice(3)+'-3'));
    const toe=pivot['toe'+legId.slice(3)];
    assert(toe?.userData.m019PlantedToeJoint,'m019 toes must follow joint');
    const side=legId.endsWith('L')?-1:1;
    const knee=pivot[legId.replace('leg','lower')];
    assert.equal(knee.userData.m019SprawledKnee,true,
      'true knee bones must spread laterally, not just drawn decorations');
    assert.equal(knee.position.x,side*M019_SPRAWL_KNEE_X);
    assert.equal(toe.position.x,side*M019_SPRAWL_FOOT_X);
    const hipWorld=leg.getWorldPosition(new THREE.Vector3());
    const footWorld=toe.getWorldPosition(new THREE.Vector3());
    assert(side*(footWorld.x-hipWorld.x)>.23,
      'each of four feet must be displaced laterally away from the torso');
    assert.equal(toe.userData.m019SprawledOutward,true);
    model.updateMatrixWorld(true);
    const groundBox=new THREE.Box3().setFromObject(toe);
    assert(groundBox.min.y>-.18&&groundBox.min.y<.16,
      'four small feet must remain grounded at bind pose, '+legId);
    assert.equal(toe.parent,pivot[legId.replace('leg','lower')],
      'toes follow the hock after leg animation');
    const lowerId=legId.replace('leg','lower');
    assert(pivot[lowerId]?.parent===leg,'lower joint must follow upper leg');
   }
   for(const id of ['m019-grand-horn-L','m019-grand-horn-R',
    'm019-amber-iris-L','m019-amber-iris-R']){
    const obj=meshes.find(o=>o.name===id);
    assert.equal(obj.parent,pivot.head,id+' detached from head');
   }
   for(const obj of meshes){
    const p=obj.geometry?.getAttribute('position');
    assert(p?.count>0,obj.name+' missing geometry');
    for(let i=0;i<p.count;i++){
     assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&
      Number.isFinite(p.getZ(i)),obj.name+' has invalid vertex');
    }
   }
   assert.doesNotThrow(()=>{
    startMonsterAction(model,'walk',0);
    for(const time of [0,.15,.4,.85,1.1])animateMonsterModel(model,time);
   });
   model.updateMatrixWorld(true);
   const bounds=new THREE.Box3().setFromObject(model);
   assert(!bounds.isEmpty(),'m019 bounds must be nonempty');
   assert(bounds.max.y>bounds.min.y&&bounds.max.z>bounds.min.z);
  }finally{disposeMonsterSculpture(model)}
 });
}

test('m019 does not change other reptile silhouettes',()=>{
 const other=createMonsterModel(MONSTER_BY_ID.m016,{detail:'low'});
 try{
  assert.equal(other.userData.m019SculptRevision,undefined);
  const names=[];
  other.traverse(obj=>{if(obj.isMesh)names.push(obj.name)});
  assert(!names.some(n=>n.startsWith('m019-')));
 }finally{disposeMonsterSculpture(other)}
});

test('m019 heroic silhouette is genuinely flatter and longer than the wolf donor',()=>{
 const donor=[
 {z:.80,y:1.27,rx:.12,ry:.25},{z:.63,y:1.29,rx:.39,ry:.34},
 {z:.44,y:1.31,rx:.49,ry:.38},{z:.19,y:1.32,rx:.45,ry:.36},
 {z:-.15,y:1.28,rx:.37,ry:.31},{z:-.42,y:1.27,rx:.34,ry:.28},
 {z:-.72,y:1.26,rx:.26,ry:.24},{z:-.83,y:1.26,rx:.11,ry:.10}
 ];
 const grown=m019HeroTorsoRings(donor);
 assert.equal(grown.length,donor.length);
 assert(grown[0].z>donor[0].z&&grown.at(-1).z<donor.at(-1).z,
  'rib cage must extend forward and backward');
 assert(grown.every((p,i)=>p.rx<donor[i].rx*.7),
  'approved narrow silhouette requires a small cross-sectional width');
 assert(grown.every((p,i)=>Math.abs(p.z-donor[i].z*M019_BODY_STRETCH)<1e-10),
  'all torso source stations must stretch in the long axis');
 assert(grown.every((p,i)=>p.ry<donor[i].ry),
  'reptilian chest should be flatter than the wolf mother');
 assert.equal(donor[0].z,.80,'never mutate wolf-donor stations');
 const head=m019HeroSkullRings([
  {z:.36,y:-.16,rx:.03,ry:.035},
  {z:.33,y:-.14,rx:.08,ry:.06},
  {z:.30,y:-.11,rx:.11,ry:.09},
  {z:.27,y:-.04,rx:.17,ry:.12},
  {z:.20,y:-.01,rx:.21,ry:.14},
  {z:.15,y:.02,rx:.23,ry:.17},
  {z:.06,y:.05,rx:.27,ry:.19},
  {z:-.12,y:.06,rx:.29,ry:.2},
  {z:-.33,y:.02,rx:.24,ry:.17},
  {z:-.51,y:-.01,rx:.17,ry:.12},
  {z:-.64,y:-.03,rx:.05,ry:.06}
 ]);
 assert(head.every((r,i)=>i===0||r.z<head[i-1].z));
 assert(head.every(r=>r.rx>0&&r.ry>0));
 assert(head[6].ry<head[6].rx,'head must be a flattened wedge');
});

test('m016/m017 retain their separate salamander lineages',()=>{
 for(const id of ['m016','m017']){
  const model=createMonsterModel(MONSTER_BY_ID[id],{detail:'low'});
  try{
   assert.equal(model.userData.m019HeroSilhouette,undefined);
   assert(model.userData.salamanderLineageRevision);
   let count=0;
   model.traverse(obj=>{if(obj.name.startsWith('m019-'))count++});
   assert.equal(count,0,'m019-exclusive meshes must not leak into '+id);
  }finally{disposeMonsterSculpture(model)}
 }
});


test('portrait and landscape camera fit the entire m019 from nose to tail',()=>{
 for(const aspect of [.34,.43,.57,.72,1.33,1.80]){
  const fit=m019FullBodyFit({
    width:1.30,height:2.0,depth:9.2,aspect,fovDegrees:42
  });
  const halfHorizontal=Math.tan(fit.horizontalFovRadians/2);
  assert(fit.horizontalSpan/(2*fit.distance)<=halfHorizontal*.88+1e-10,
   'camera must use horizontal FOV to fit the tail at aspect '+aspect);
  assert(fit.distance>=4);
  assert.equal(fit.azimuth,'negative-x-side-head-right');
 }
});
