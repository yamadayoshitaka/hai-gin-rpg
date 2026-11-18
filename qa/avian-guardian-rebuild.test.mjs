import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {AVIAN_REFRESH_IDS,AVIAN_REALISM_REVISION,avianProfile,PHOENIX_FAMILY_MASTER}
 from '../src/avian-guardian-sculpt.js';

const meshes=root=>{
 const out=[];root.traverse(node=>{if(node.isMesh)out.push(node);});
 return out;
};
const triangles=root=>meshes(root).reduce((acc,m)=>{
 const positions=m.geometry.getAttribute('position');
 assert.ok(positions?.count>2,m.name+' needs actual vertices');
 for(const n of positions.array)assert.ok(Number.isFinite(n),
   m.name+' has broken vertex coordinates');
 const n=m.geometry.index?.count??positions.count;
 return acc+n/3;
},0);
const build=(id,detail='high')=>createMonsterModel(MONSTER_BY_ID[id],{detail});
test('four distinct avian masters reuse the real 82-feather guardian wing',()=>{
 assert.deepEqual(AVIAN_REFRESH_IDS,['m011','m012','m013','m014']);
 const distinct=new Set();
 for(const id of AVIAN_REFRESH_IDS){
  const model=build(id);
  try{
   assert.equal(model.userData.avianRebuildRevision,AVIAN_REALISM_REVISION);
   assert.equal(model.userData.avianGameSourceRevision,AVIAN_REALISM_REVISION);
   assert.equal(model.userData.avianGuardianGeometryDonor,'seraph_guardian');
   assert.equal(model.userData.avianPhoenixSourceMaster,PHOENIX_FAMILY_MASTER);
   assert.equal(model.userData.avianPhoenixMasterRevision,AVIAN_REALISM_REVISION);
   assert.equal(model.userData.avianFlightMode,true);
   distinct.add(model.userData.avianAnatomicalKind);
   const p=model.userData.pivots;
   assert.equal(p.wingL.parent,p.torso);
   assert.equal(p.wingR.parent,p.torso);
   assert.equal(p.wingElbowL.parent,p.wingL);
   assert.equal(p.wingWristL.parent,p.wingElbowL);
   assert.equal(p.tail.parent,p.torso);
   assert.equal(p.head.parent,p.torso);
   for(const suffix of ['L','R']){
    const wing=model.getObjectByName('avian-guardian-three-layer-wing-'+id+'-'+suffix);
    assert.ok(wing?.isMesh&&wing.visible,id+' missing guardian-derived feather wing');
    assert.equal(wing.parent,p['wing'+suffix]);
    assert.equal(wing.userData.angelSource,'seraph_guardian');
    assert.equal(wing.userData.phoenixFamilyMaster,'m013');
    assert.equal(wing.userData.phoenixMasterGeometryRevision,AVIAN_REALISM_REVISION);
    assert.equal(wing.userData.angelFeatherLayers,3);
    assert.equal(wing.userData.angelFeathersPerSide,82);
    assert.ok(wing.userData.angelDonorGeometryTriangles>1000);
    assert.ok(wing.geometry.getAttribute('normal'));
    assert.ok(wing.geometry.getAttribute('uv'));
    assert.ok(wing.geometry.getAttribute('color'));
    assert.ok(wing.geometry.getAttribute('position').count>15000);
    assert.equal(wing.userData.ownedGeometry,true);
    assert.equal(wing.userData.ownedEffectMaterial,true);
   }
   const body=model.getObjectByName('avian-keel-rib-cavity-'+id);
   const plumage=model.getObjectByName('avian-layered-body-plumage-'+id);
   const tail=model.getObjectByName('avian-tail-rooted-streamers-'+id);
   assert.ok(body?.userData.avianClosedThorax);
   assert.ok(plumage?.userData.curvedAvianFeathers>100);
   assert.ok(tail?.userData.curvedAvianFeathers>=9);
   assert.equal(model.getObjectByName('avian-cranium-'+id)?.userData.avianRealCranium,true);
   assert.ok(model.getObjectByName('avian-hooked-beak-'+id)?.userData.avianHookedKeratin);
   for(const suffix of ['L','R']){
    assert.ok(p['avianFoot'+(id==='m012'?'Front':'')+suffix]);
    assert.ok(p['birdAnkle'+(id==='m012'?'Front':'')+suffix]);
   }
   assert.ok(triangles(model)<500000,id+' over playable triangle budget');
  }finally{disposeMonsterSculpture(model);}
 }
 assert.equal(distinct.size,4,'eagle, griffin, phoenix and owl are not one reskinned bird');
});
test('phoenix has richer source geometry, warm feathers and long articulated tail',()=>{
 const counts={};
 for(const detail of ['source','high','medium','low']){
  const m=build('m013',detail);
  try{
   counts[detail]=triangles(m);
   const wing=m.getObjectByName('avian-guardian-three-layer-wing-m013-L');
   assert.ok(wing);
   assert.equal(wing.userData.angelFeathersPerSide,
     detail==='low'||detail==='medium'?18:82);
   assert.ok(m.getObjectByName('avian-articulated-crest-m013'));
   const tail=m.getObjectByName('avian-tail-rooted-streamers-m013');
   assert.equal(tail.userData.curvedAvianFeathers,
     detail==='low'?5:detail==='medium'?17:31);
   assert.ok(m.getObjectByName('avian-layered-body-plumage-m013'));
   assert.equal(wing.material.emissiveIntensity,.21);
   const coords=wing.geometry.getAttribute('position');
   const color=wing.geometry.getAttribute('color');
   let ember=0;
   for(let j=0;j<color.count;j+=Math.max(1,Math.floor(color.count/190))){
    if(color.getX(j)>color.getZ(j)*1.15)ember++;
   }
   assert.ok(ember>20,'fire feathers must be physically recoloured rather than plain angel ivory');
   const bounding=new THREE.Box3().setFromObject(m);
   assert.ok(bounding.getSize(new THREE.Vector3()).x>4,
     'phoenix must have a cathedral-scale wing silhouette');
   assert.ok(coords.count>900,'phoenix wings need curved 3D feather geometry');
  }finally{disposeMonsterSculpture(m);}
 }
 assert.ok(counts.source>counts.high*1.7,
   'source wing must be genuinely finer than in-game near model');
 assert.ok(counts.high>counts.low*1.5,
   'crowd LOD must remove significant feather triangles');
 assert.ok(counts.source<2_000_000,'source must fit the preview GPU limit');
 assert.ok(counts.high<500000,'near battle model must fit the FPS budget');
});
test('phoenix v5 has larger anatomical scales on broad torso, cheeks and crown',()=>{
 const p=avianProfile('m013');
 assert.ok(p.wing[0]>=1.2&&p.tail>=3.2&&p.body>=1.15&&p.head<.75);
 const m=build('m013','high');
 try{
  assert.equal(m.userData.phoenixExpandedThorax,true);
  assert.equal(m.userData.phoenixNoExternalEars,true);
  const body=m.getObjectByName('avian-keel-rib-cavity-m013');
  const scales=m.getObjectByName('avian-layered-body-plumage-m013');
  assert.equal(body?.userData.closedAnatomicalHull,true);
  body.geometry.computeBoundingBox();
  const bodySize=body.geometry.boundingBox.getSize(new THREE.Vector3());
  assert.ok(bodySize.x>.69&&bodySize.y>.85,'chest and belly must be substantial');
  assert.equal(scales.userData.imbricatedKeratinScales,true);
  assert.equal(scales.userData.phoenixScuteType,'close-fitted-thorax-diamond-scales');
  assert.equal(scales.userData.mergedFeatherBatches,1);
  assert.equal(scales.userData.scaleCount,15*14);
  assert.equal(m.userData.phoenixDenseScaleCount,15*14);
  assert.ok(scales.userData.phoenixAbdomenLargeScaleWidth>=.25);
  assert.ok(scales.userData.phoenixScaleWidths.min>=.13);
  assert.ok(scales.userData.phoenixScaleWidths.max>=.25);
  assert.ok(scales.userData.phoenixBellyScaleMultiplier>=11);
  const skull=m.getObjectByName('avian-cranium-m013'),
   forehead=m.getObjectByName('phoenix-fine-head-scales'),
   neck=m.getObjectByName('phoenix-neck-fine-grading-scutes');
  skull.geometry.computeBoundingBox();
  assert.ok(skull.geometry.boundingBox.max.x-skull.geometry.boundingBox.min.x<.40);
  assert.equal(skull.userData.phoenixNoEars,true);
  assert.ok(forehead.userData.scaleCount>90,'face scales must be visible, not tiny dots');
  assert.equal(forehead.userData.phoenixVisibleFaceScales,true);
  assert.equal(forehead.parent,m.userData.pivots.head);
  assert.ok(forehead.userData.phoenixScaleWidthMax>=.09);
  assert.equal(neck.userData.phoenixScalesShrinkTowardsFace,true);
  assert.ok(neck.userData.phoenixScaleWidthBase>neck.userData.phoenixScaleWidthTip);
  const beak=m.getObjectByName('avian-hooked-beak-m013');
  assert.equal(beak.userData.phoenixShortBeak,true);
  assert.equal(beak.userData.phoenixLipReduced,true);
  assert.ok(beak.userData.phoenixBeakLength<.70);
  assert.equal(beak.userData.phoenixLongNarrowBeak,true);
  assert.equal(m.getObjectByName('avian-articulated-crest-m013').userData.phoenixAllBackCrest,true);
  assert.equal(m.getObjectByName('avian-tail-rooted-streamers-m013').userData.curvedAvianFeathers,31);
 }finally{disposeMonsterSculpture(m);}
});
test('phoenix thigh is muscled and separate from slender bird knee, bare shank and four toes',()=>{
 const m=build('m013','high'),p=m.userData.pivots;
 try{
  assert.equal(m.userData.phoenixThighShankSeparated,true);
  for(const side of ['L','R']){
   const leg=p['leg'+side],knee=p['birdKnee'+side],
    shin=p['birdAnkle'+side],foot=p['avianFoot'+side];
   assert.equal(leg.userData.phoenixSeparateThigh,true);
   assert.ok(leg.userData.phoenixThighRadius>.25);
   assert.equal(knee.parent,leg);
   assert.equal(knee.userData.phoenixRealKnee,true);
   assert.equal(shin.parent,knee);
   assert.equal(shin.userData.phoenixBareLowerShank,true);
   assert.equal(foot.parent,shin);
   assert.equal(foot.userData.phoenixChickenToes,4);
   const femur=m.getObjectByName('phoenix-femur-muscle-'+side);
   assert.equal(femur.parent,leg);
   assert.equal(femur.userData.phoenixFemurContinuousSkin,true);
   assert.ok(femur.userData.phoenixFemurMaxRadius>.25);
   const thigh=m.getObjectByName('phoenix-long-thigh-scutes-'+side);
   const shank=m.getObjectByName('phoenix-chicken-shank-scutes-'+side);
   const toes=m.getObjectByName('phoenix-foot-toe-scutes-'+side);
   for(const [part,bone,min] of [
    [thigh,leg,.20],[shank,shin,.047],[toes,foot,.06]]){
    assert.equal(part.parent,bone);
    assert.equal(part.userData.phoenixAttachedScutes,true);
    assert.ok(part.userData.phoenixScaleWidth>=min);
   }
  }
  for(const action of ['idle','walk','run','attack','special']){
   startMonsterAction(m,action,0);
   animateMonsterModel(m,.3);
   m.updateMatrixWorld(true);
   for(const side of ['L','R']){
    const knee=p['birdKnee'+side],foot=p['avianFoot'+side],
     position=foot.getWorldPosition(new THREE.Vector3());
    assert.ok(Number.isFinite(knee.rotation.x));
    assert.ok(position.y>-.35&&position.y<3,'bird foot detached from body');
   }
  }
 }finally{disposeMonsterSculpture(m);}
});
test('phoenix arm scales are anchored to real guardian feathers, never floating at elbow pivots',()=>{
 const m=build('m013','high'),p=m.userData.pivots;
 try{
  for(const side of ['L','R']){
   const source=m.getObjectByName('avian-guardian-three-layer-wing-m013-'+side);
   const positions=source.geometry.getAttribute('position');
   for(const key of ['forearm','hand']){
    const scutes=m.getObjectByName('phoenix-wing-'+key+'-scutes-'+side);
    assert.equal(scutes.parent,p['wing'+side]);
    assert.equal(scutes.userData.phoenixWingFloatingBandsRemoved,true);
    assert.equal(scutes.userData.phoenixWingFeatherSurfaceFitted,true);
    const leaf=scutes.geometry.getAttribute('position');
    let best=Infinity;
    for(let j=0;j<positions.count;j++){
     best=Math.min(best,Math.hypot(
      positions.getX(j)-leaf.getX(0),
      positions.getY(j)-leaf.getY(0),
      positions.getZ(j)-leaf.getZ(0)));
    }
    assert.ok(best<.055,'scales must originate on guardian wing mesh: '+key+side);
   }
  }
 }finally{disposeMonsterSculpture(m);}
});
test('phoenix has independently articulated feather arms with three feather-digit hands on both sides',()=>{
 for(const detail of ['source','high','medium','low']){
  const m=build('m013',detail),p=m.userData.pivots;
  try{
   assert.equal(m.userData.phoenixFeatherHands,true);
   for(const side of ['L','R']){
    const arm=p['phoenixArm'+side],forearm=p['phoenixForearm'+side],
      hand=p['phoenixFeatherHand'+side];
    assert.equal(arm?.parent,p.torso,'arm must grow out of the chest');
    assert.equal(arm.userData.phoenixIndependentFeatherArm,true);
    assert.equal(forearm?.parent,arm);
    assert.equal(forearm.userData.phoenixFeatherWrappedUlna,true);
    assert.equal(hand?.parent,forearm);
    assert.equal(hand.userData.phoenixAvianFeatherHand,true);
    const sleeve=m.getObjectByName('phoenix-feather-arm-sleeve-'+side),
     under=m.getObjectByName('phoenix-feather-forearm-sleeve-'+side),
     fingers=m.getObjectByName('phoenix-feather-hand-vanes-'+side);
    assert.equal(sleeve?.parent,arm);
    assert.equal(under?.parent,forearm);
    assert.equal(fingers?.parent,hand);
    assert.equal(fingers.userData.phoenixFeatherHandDigits,3);
    assert.equal(fingers.userData.phoenixNoHumanFingers,true);
    assert.ok(fingers.userData.curvedAvianFeathers>=9);
    assert.ok(m.getObjectByName('phoenix-feather-hand-palm-'+side));
    for(let digit=0;digit<3;digit++)
     assert.ok(m.getObjectByName('phoenix-feather-hand-digit-'+side+'-'+digit));
   }
   for(const action of ['idle','walk','run','attack']){
    startMonsterAction(m,action,0);
    animateMonsterModel(m,.20);
    m.updateMatrixWorld(true);
    for(const side of ['L','R']){
     const hand=p['phoenixFeatherHand'+side];
     assert.ok([hand.rotation.x,hand.rotation.y,hand.rotation.z].every(Number.isFinite));
    }
   }
  }finally{disposeMonsterSculpture(m);}
 }
});
test('phoenix feather waves travel across both wings, swept crest and tail without CPU rebuilding',()=>{
 const m=build('m013','high');
 try{
  assert.equal(m.userData.phoenixWaveMeshCount,4);
  for(const part of m.userData.phoenixWaveMeshes){
   assert.equal(part.userData.phoenixWaveDynamic,true);
   assert.equal(part.userData.phoenixWaveGPU,true);
   assert.equal(part.userData.ownedGeometry,true);
   const material=part.material;
   const shader={uniforms:{},
    vertexShader:'#include <common>\\nvoid main(){\\n#include <begin_vertex>\\n}'};
   material.onBeforeCompile(shader);
   assert.ok(shader.vertexShader.includes('uniform float phoenixWaveTime;'));
   assert.ok(shader.vertexShader.includes('transformed.y +='));
   assert.ok(shader.vertexShader.includes('avianDistance'));
   assert.ok(!shader.vertexShader.includes('\\\\nuniform'),
    'GLSL uniform declarations cannot contain literal backslash-n');
   assert.ok(shader.uniforms.phoenixWavePower);
  }
  const waveParts=m.userData.phoenixWaveMeshes;
  const geometries=waveParts.map(p=>p.geometry);
  startMonsterAction(m,'run',0);
  animateMonsterModel(m,.2);
  for(const part of waveParts){
   const state=part.material.userData.phoenixWaveState;
   assert.equal(state.power,1.12);
   assert.ok(Number.isFinite(state.time));
   assert.equal(state.uniformTime.value,state.time);
   assert.equal(state.uniformPower.value,state.power);
  }
  assert.deepEqual(waveParts.map(p=>p.geometry),geometries,
   'traveling wing wave cannot reallocate the feather meshes every frame');
  startMonsterAction(m,'idle',0);
  animateMonsterModel(m,.4);
  assert.ok(waveParts.every(p=>p.material.userData.phoenixWaveState.power<1),
   'idle should produce calm feather-wave flow, not attack-strength flapping');
 }finally{disposeMonsterSculpture(m);}
});
test('griffin has four independently animated legs; owl has facial disks',()=>{
 const griffin=build('m012');
 const owl=build('m014');
 try{
  for(const suffix of ['L','R']){
   assert.ok(griffin.userData.pivots['legFront'+suffix]);
   assert.ok(griffin.userData.pivots['legRear'+suffix]);
   assert.ok(owl.getObjectByName('owl-facial-disc-'+suffix));
   assert.ok(owl.getObjectByName('owl-iris-'+(suffix==='L'?-1:1)));
  }
  for(const model of [griffin,owl]){
   for(const action of ['idle','walk','run','attack','special','defeat']){
    startMonsterAction(model,action,0);
    animateMonsterModel(model,action==='defeat'?.9:.32);
    model.updateMatrixWorld(true);
    for(const suffix of ['L','R']){
     for(const name of ['wing','wingElbow','wingWrist']){
      const b=model.userData.pivots[name+suffix];
      assert.ok(b&&[b.rotation.x,b.rotation.y,b.rotation.z].every(Number.isFinite),
       model.userData.speciesId+' '+action+' has invalid wing joint '+name);
     }
    }
   }
  }
 }finally{
  disposeMonsterSculpture(griffin);
  disposeMonsterSculpture(owl);
 }
});
test('m015 humanlike Tengu remains on the previous independently maintained path',()=>{
 const m=build('m015','high');
 try{
  assert.equal(avianProfile('m015'),null);
  assert.equal(m.userData.avianRebuildRevision,undefined);
  const inherited=m.getObjectByName('avian-guardian-three-layer-wing-m015-L');
  assert.ok(inherited?.isMesh,'Tengu wing must share Phoenix feather donor');
  assert.equal(inherited.userData.phoenixFamilyMaster,'m013');
  assert.equal(inherited.userData.phoenixTenguHumanRigPreserved,true);
  assert.ok(!m.userData.pivots.wingElbowL,'Tengu shoulder remains protected');
  assert.ok(m.userData.pivots.wingL&&m.userData.pivots.legL);
 }finally{disposeMonsterSculpture(m);}
});

test('four natural Phoenix-derived birds have unique coloured wings and maintain flight',()=>{
 const unique=new Set();
 for(const id of AVIAN_REFRESH_IDS){
  const m=build(id,'medium');
  try{
   const w=m.getObjectByName('avian-guardian-three-layer-wing-'+id+'-L');
   assert.equal(w.userData.phoenixFamilyMaster,'m013');
   assert.equal(w.userData.birdWingDetail,'medium');
   const colours=w.geometry.getAttribute('color');
   unique.add([...colours.array.slice(0,9)].map(n=>n.toFixed(5)).join(','));
   for(const action of ['idle','run','attack']){
    startMonsterAction(m,action,0);
    animateMonsterModel(m,.24);
    assert.equal(m.userData.avianInAir,true,id+' grounded in '+action);
    assert.ok(m.position.y>.40,id+' should stay above ground');
    assert.ok(Number.isFinite(m.userData.pivots.wingL.rotation.z));
   }
  }finally{disposeMonsterSculpture(m);}
 }
 assert.equal(unique.size,4,'the species must not share identical colour schemes');
});
test('Phoenix physical eyebrow feathers frame forward-projecting eyeliner and iris',()=>{
 const m=build('m013','high');
 try{
  const brow=m.getObjectByName('phoenix-orbital-brow-feathers');
  assert.ok(brow?.isMesh,'rooted brow feather mesh missing');
  assert.ok(brow.userData.phoenixRootedBrowVanes>=16);
  assert.equal(brow.userData.phoenixEyesUncovered,true);
  for(const side of ['L','R']){
   const socket=m.getObjectByName('phoenix-sculpted-orbit-'+side);
   assert.ok(socket.position.x*(side==='L'?-1:1)>.11);
   assert.equal(socket.userData.phoenixEyeProjectionFollowsEyeliner,true);
   assert.ok(m.getObjectByName('phoenix-upper-eyeliner-'+side));
   assert.ok(m.getObjectByName('phoenix-iris-'+side));
  }
 }finally{disposeMonsterSculpture(m);}
});


test('Phoenix v11 physically refreshes all five bird species without losing battle LOD',()=>{
 for(const id of ['m011','m012','m013','m014','m015']){
  const m=build(id,'high');
  try{
   for(const side of ['L','R']){
    const cover=m.getObjectByName(
      'avian-phoenix-master-wing-coverts-'+id+'-'+side);
    assert.ok(cover?.isMesh,id+' missing fitted feather coat '+side);
    assert.equal(cover.userData.avianDonorSurfaceAttached,true);
    assert.ok(cover.userData.avianMergedOverlappingCoverts>5);
    const wing=m.getObjectByName(
      'avian-guardian-three-layer-wing-'+id+'-'+side);
    const donor=wing.geometry.getAttribute('position');
    const points=cover.geometry.getAttribute('position');
    const root=new THREE.Vector3(points.getX(0),points.getY(0),points.getZ(0));
    let nearest=Infinity;
    for(let i=0;i<donor.count;i++)nearest=Math.min(nearest,
      root.distanceTo(new THREE.Vector3(
       donor.getX(i),donor.getY(i),donor.getZ(i))));
    assert.ok(nearest<.03,id+' wing root is detached from donor '+nearest);
   }
   if(id==='m013'){
    const fire=m.getObjectByName('phoenix-master-volumetric-fire-plumage');
    assert.equal(fire?.userData.phoenixVolumetricFireAnatomy,true);
    assert.ok(fire.userData.phoenixSurfaceRootedFlames>75);
   }else if(id==='m015'){
    assert.ok(m.getObjectByName('avian-phoenix-master-tail-m015'));
    assert.ok(m.userData.pivots.legL,'Tengu must retain humanoid legs');
    assert.ok(!m.userData.pivots.wingElbowL,'Tengu keeps protected upper-body rig');
   }else{
    const body=m.getObjectByName('avian-layered-body-plumage-'+id);
    assert.equal(body?.userData.avianPlumageAttachedToActualLoft,true);
    assert.equal(body.userData.avianFeatherRows,15);
    assert.ok(body.userData.curvedAvianFeathers>=300);
    if(id!=='m014')assert.equal(m.userData.pivots.head.userData.avianPhoenixMasterEyes,true);
   }
   assert.ok(triangles(m)<500000,id+' exceeds mobile triangle budget');
  }finally{disposeMonsterSculpture(m);}
 }
});

test('avian v12 replaces juvenile rounded eyes with hooded raptor skull detail',()=>{
 for(const detail of ['high','low']){
  for(const id of ['m011','m012','m013','m014']){
   const m=build(id,detail);
   try{
    const head=m.userData.pivots.head;
    const cheeks=m.getObjectByName('avian-predatory-malar-plumage-'+id);
    assert.equal(cheeks?.parent,head);
    assert.equal(cheeks.userData.avianSweptPredatoryCheeks,true);
    assert.ok(cheeks.userData.curvedAvianFeathers>=6);
    for(const side of ['L','R']){
     const brow=m.getObjectByName('avian-predatory-brow-'+id+'-'+side);
     assert.ok(brow?.isMesh,id+' '+detail+' missing solid brow');
     assert.equal(brow.userData.avianBrowBoneSculpt,true);
     assert.ok(brow.userData.avianInnerBrowDecline>.2);
     assert.ok(brow.geometry.index.count>=30);
     const eye=id==='m013'?
       m.getObjectByName('phoenix-amber-eye-'+side):
       id==='m014'?
        m.getObjectByName('owl-iris-'+(side==='L'?-1:1)):
        m.getObjectByName('avian-master-iris-'+side);
     assert.ok(eye?.isMesh,id+' '+detail+' missing eye');
     assert.ok(eye.scale.x>eye.scale.y*1.65,
      id+' eye should be a narrow hunting slit, not round');
     if(id==='m014'){
      const mask=m.getObjectByName('owl-facial-disc-'+side);
      assert.equal(mask?.userData.avianAngularMask,true);
      assert.ok(mask.geometry.index.count>=24);
     }
    }
    if(id==='m013'){
     const beak=m.getObjectByName('avian-hooked-beak-m013');
     assert.ok(beak.userData.phoenixBeakLength>=.68);
    }
    assert.ok(triangles(m)<500000,'face geometry must fit mobile LOD');
   }finally{disposeMonsterSculpture(m);}
  }
 }
});

test('avian v13 grown-up griffin eagle and owl sculpt is fitted to skull in both LODs',()=>{
 const profiles={m011:.91,m012:.87,m014:1.04};
 for(const detail of ['high','low']){
  for(const [id,ratio] of Object.entries(profiles)){
   const m=build(id,detail);
   try{
    const head=m.getObjectByName('avian-cranium-'+id);
    const feather=m.getObjectByName('avian-adult-cranial-contour-'+id);
    assert.equal(head.userData.avianMatureHeadRatio,ratio);
    assert.equal(feather?.userData.avianAdultFittedHeadPlumage,true);
    assert.equal(feather.userData.avianNoJuvenileFaceVolume,true);
    assert.ok(feather.userData.scaleCount>12,'crown must contain real bevelled geometry');
    assert.ok(feather.geometry.getAttribute('normal'));
    if(id==='m012'){
     assert.ok(avianProfile(id).head<.90,'griffin head too large/baby-like');
     assert.ok(avianProfile(id).crest<=9,'griffin juvenile fluffy crest remains');
    }
    assert.ok(triangles(m)<500000,'mobile avian budget regression');
   }finally{disposeMonsterSculpture(m);}
  }
 }
});

test('avian v14 adult cere, two nostrils and malar bone join to real griffin eagle owl heads',()=>{
 for(const detail of ['high','low']){
  for(const id of ['m011','m012','m014']){
   const m=build(id,detail);
   try{
    const head=m.userData.pivots.head;
    const skull=m.getObjectByName('avian-cranium-'+id);
    const cere=m.getObjectByName('avian-adult-keratin-cere-'+id);
    assert.equal(skull.userData.avianAdultCereFitted,true);
    assert.equal(cere?.parent,head,id+' '+detail+' detached cere');
    assert.equal(cere.userData.avianSourcePhoenixFace,true);
    assert.equal(cere.userData.avianContiguousBeakNasalVolume,true);
    assert.ok(cere.geometry.getAttribute('normal'));
    for(const side of ['L','R']){
     const bone=m.getObjectByName('avian-adult-malar-bone-'+id+'-'+side);
     const nostril=m.getObjectByName('avian-adult-cere-nostril-'+id+'-'+side);
     assert.equal(bone?.parent,head,'malar contour not head-rigged');
     assert.equal(bone.userData.avianMalarContinuousIntoCere,true);
     assert.equal(nostril?.userData.avianKeratinNostril,true);
     const iris=m.getObjectByName('avian-master-iris-'+side);
     if(id!=='m014'){
      assert.equal(iris?.userData.avianIrisRadialMicrotexture,true);
      const colors=iris.geometry.getAttribute('color');
      let lowest=1,highest=0;
      for(let i=0;i<colors.count;i++){
       lowest=Math.min(lowest,colors.getX(i));
       highest=Math.max(highest,colors.getX(i));
      }
      assert.ok(highest-lowest>.025,'physical iris must not be uniformly coloured');
     }
    }
    assert.ok(triangles(m)<500000,'face enhancement exceeds mobile LOD budget');
   }finally{disposeMonsterSculpture(m);}
  }
 }
});

test('Tengu takes flight with preserved humanlike face and real flying animations',()=>{
 for(const detail of ['high','low']){
  const m=build('m015',detail);
  try{
   assert.equal(m.userData.avianFlightMode,true);
   assert.equal(m.userData.tenguFlightMode,true);
   assert.equal(m.userData.avianFlightHeight,1.42);
   assert.equal(m.userData.avianGameSourceRevision,AVIAN_REALISM_REVISION);
   assert.ok(m.userData.pivots.head);
   assert.ok(m.userData.pivots.legL);
   assert.equal(m.userData.pivots.wingElbowL,undefined);
   let previousRotation=null;
   for(const action of ['idle','walk','run','attack','special','leap']){
    startMonsterAction(m,action,0);
    animateMonsterModel(m,.18);
    assert.ok(m.userData.avianInAir,action+' must be airborne');
    assert.ok(m.position.y>.4,action+' must be above terrain');
    assert.ok(m.userData.tenguLegsTucked,action+' tuck must be active');
    assert.ok(m.userData.pivots.legL.rotation.x>.15);
    assert.ok(Number.isFinite(m.userData.pivots.wingL.rotation.z));
    if(action==='run')previousRotation=m.userData.pivots.wingL.rotation.z;
   }
   startMonsterAction(m,'run',0);
   animateMonsterModel(m,.34);
   assert.notEqual(m.userData.pivots.wingL.rotation.z,previousRotation,
     'flying Tengu wing must flap across time');
   startMonsterAction(m,'defeat',0);
   animateMonsterModel(m,1.2);
   assert.ok(m.position.y<.08,'defeated Tengu must land');
   assert.equal(m.userData.avianInAir,false);
   assert.equal(m.userData.tenguLegsTucked,false);
  }finally{disposeMonsterSculpture(m);}
 }
});
