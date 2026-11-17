import assert from 'node:assert/strict';
import {MONSTER_BY_ID} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {wolfKingEffectsBudget} from '../src/m001-action-effects.js';

const model=createMonsterModel(MONSTER_BY_ID.m001,{detail:'high'});
try{
 const p=model.userData.pivots,coats=[];
 model.traverse(n=>{if(n.isMesh)coats.push(n);});
 const headFur=coats.filter(m=>m.parent===p.head&&m.userData.wolfKingMane);
 assert.equal(headFur.length,3,'head ruff must still use three batched PBR materials');
 const legFur=coats.filter(m=>m.userData.furRegion==='limb');
 assert.equal(legFur.length,4,'only one GPU-skinned coat per articulated limb');
 assert.ok(legFur.every(m=>m.isSkinnedMesh),
   'seam hair must bend with real shoulder / elbow / toe joints');
 const scalp={front:0,rear:0,left:0,right:0};
 for(const coat of headFur){
  const vertices=coat.geometry.getAttribute('position');
  for(let i=0;i+4<vertices.count;i+=5){
   const x=(vertices.getX(i)+vertices.getX(i+1))*.5;
   const y=(vertices.getY(i)+vertices.getY(i+1))*.5;
   const z=(vertices.getZ(i)+vertices.getZ(i+1))*.5;
   if(Math.abs(x)<.18&&y>.12&&y<.30){
    if(z>-.23&&z<-.075)scalp.rear++;
    if(z>.065&&z<.175)scalp.front++;
    if(x<0)scalp.left++;else scalp.right++;
   }
  }
 }
 assert.ok(scalp.rear>90&&scalp.front>85,
   'crown must be densely rooted from brow to rear scalp, no bald ridge: '+JSON.stringify(scalp));
 assert.ok(Math.abs(scalp.left-scalp.right)<(scalp.left+scalp.right)*.28,
   'symmetric crown must not have a sparse side');
 assert.equal(model.userData.m001CrownSweepDirection,'backward',
   'crown fibres should be styled as a rear-swept mane');
 assert.ok(model.userData.m001CrownLongHairBase>=.235,
   'long guard fibres need meaningful sweep length');
 const longBackSweep={count:0,left:0,right:0,rootFront:0,rootRear:0};
 for(const coat of headFur){
   const v=coat.geometry.getAttribute('position');
   for(let i=0;i+4<v.count;i+=5){
     const x=(v.getX(i)+v.getX(i+1))*.5;
     const y=(v.getY(i)+v.getY(i+1))*.5;
     const z=(v.getZ(i)+v.getZ(i+1))*.5;
     // The dense crown covers both its frontal and occipital portion.
     if(Math.abs(x)>.175||y<.155||y>.29||z<-.30||z>.18)continue;
     const swept=z-v.getZ(i+4);
     if(swept>.095){
       longBackSweep.count++;
       if(x<0)longBackSweep.left++;else longBackSweep.right++;
       if(z>0)longBackSweep.rootFront++;
       else longBackSweep.rootRear++;
     }
   }
 }
 assert.ok(longBackSweep.count>80&&longBackSweep.rootFront>12&&
   longBackSweep.rootRear>30,
   'long crown hairs must sweep backward on BOTH front and rear scalp: '+
   JSON.stringify(longBackSweep));
 assert.ok(longBackSweep.left>25&&longBackSweep.right>25,
   'slicked-back longer crown needs bilateral coverage');
 const nasal=coats.find(m=>m.name==='wolf-nasal-cartilage');
 assert.ok(nasal,'m001 must have its anatomical rhinarium');
 let largestNoseHalfWidth=0,largestNoseHalfHeight=0;
 const nosePos=nasal.geometry.getAttribute('position');
 for(let i=0;i<nosePos.count;i++){
   largestNoseHalfWidth=Math.max(largestNoseHalfWidth,Math.abs(nosePos.getX(i)));
   largestNoseHalfHeight=Math.max(largestNoseHalfHeight,
     Math.abs(nosePos.getY(i)+.131));
 }
 assert.ok(largestNoseHalfWidth>=.041&&largestNoseHalfWidth<=.048,
   'nose should be smaller but still visible: '+largestNoseHalfWidth);
 assert.ok(largestNoseHalfHeight<.040,
   'black nose should not bulge vertically over the narrowed muzzle');
 assert.equal(model.userData.m001NoseWidthScale,.80,
   'nose-shrink setting must remain m001-only');
 const torsoCoats=coats.filter(m=>m.parent===p.torso&&m.userData.furStrands);
 let shoulderRoots=0;
 for(const coat of torsoCoats){
  const vertices=coat.geometry.getAttribute('position');
  for(let i=0;i+4<vertices.count;i+=5){
   const x=(vertices.getX(i)+vertices.getX(i+1))*.5;
   const y=(vertices.getY(i)+vertices.getY(i+1))*.5;
   const z=(vertices.getZ(i)+vertices.getZ(i+1))*.5;
   if(Math.abs(x)>.28&&y>.96&&y<1.49&&z>.18&&z<.66)
     shoulderRoots++;
  }
 }
 assert.ok(shoulderRoots>25,
   'shoulder fascia needs torso-rooted guard hair across arm-body seam');
 assert.equal(wolfKingEffectsBudget(model).meshes,0,
   'idle must not allocate any VFX geometry');
 startMonsterAction(model,'attack',0);
 animateMonsterModel(model,.16);
 const jawPre=p.jaw.rotation.x;
 animateMonsterModel(model,.48);
 const jawImpact=p.jaw.rotation.x;
 assert.ok(jawPre>jawImpact+.07,
   'bite must open on anticipation, then close near the physical contact frame');
 assert.ok(wolfKingEffectsBudget(model).visible>=1,
   'claw streaks must be visible at bite contact');
 assert.equal(wolfKingEffectsBudget(model).meshes,3,
   'effect budget must be at most three pooled meshes');
 const firstEffects=model.userData.m001ActionEffects;
 startMonsterAction(model,'roar',2);
 animateMonsterModel(model,2.57);
 assert.ok(p.jaw.rotation.x>.43,'roar must open mouth and head in the same motion');
 assert.ok(firstEffects.roar.visible&&firstEffects.roar.material.opacity>.10,
   'roar must create a visible fading pressure wave');
 startMonsterAction(model,'run',4);
 animateMonsterModel(model,4.15);
 assert.ok(firstEffects.dust.visible,
   'paws must stir subtle dust when galloping');
 assert.equal(model.userData.m001ActionEffects,firstEffects,
   'replaying actions must reuse original effect geometry and materials');
 startMonsterAction(model,'idle',6);
 animateMonsterModel(model,6.07);
 assert.equal(wolfKingEffectsBudget(model).visible,0,
   'all translucent action effects must disappear on return to idle');
 assert.equal(wolfKingEffectsBudget(model).meshes,3,
   'no per-frame allocation or leak allowed');
}finally{disposeMonsterSculpture(model);}
const low=createMonsterModel(MONSTER_BY_ID.m001,{detail:'low'});
try{
 startMonsterAction(low,'roar',0);
 animateMonsterModel(low,.5);
 assert.equal(wolfKingEffectsBudget(low).meshes,0,
   '1000-vs-1000 low LOD may not allocate monster FX');
}finally{disposeMonsterSculpture(low);}
console.log('m001 crown, flowing seams, bite/roar/dust FX and low-LOD budget PASS');
