/**
 * Deterministic face image-space ANALYSIS (not brittle screenshot diffs).
 * Project ACTUAL face vertices/rig feature positions into an orthographic
 * portrait camera. Check anatomical landmarks, size changes, jaw opening
 * and preservation of the original donor mesh for all 16 roles, 8 summons
 * and 50 monsters. No browser startup, PNG writes or pixel baselines.
 *
 * This verifies geometric fidelity / articulation. It CANNOT certify that a
 * texture is photorealistic or that a face looks attractive; keep manually
 * reviewed image examples for those separate aesthetic checks.
 */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import * as THREE from 'three';
import {
 createFaceProfile,updateFaceProfile,projectedFaceLandmarks,
 facialSpeechEnvelope,mouthSyllableCount
} from '../src/facial-feature-profiles.js';
import {attachHumanFaceControls} from '../src/facial-feature-runtime.js';
import {JOBS} from '../src/mass-battle-sim.js';
import {JOB_CATALOG} from '../src/job-catalog.js';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from '../src/monster-geometry.js';
import {startMonsterAction,animateMonsterModel} from '../src/monster-animation.js';
import {CREATURE_VISUAL_SPECS,buildCombatObjectGeometry} from '../src/combat-creature-geometry.js';

const begin=performance.now();
const summary={jobs:0,monsters:0,summons:0,eyeProjectionChanges:0,
 noseProjectionChanges:0,mouthProjectionChanges:0,
 actualMorphControllers:0,monsterJawControllers:0,
 noFakeOverlayHeads:true,failures:[]};
const check=(condition,description)=>{if(!condition)summary.failures.push(description)};
function rectFromVertices(geo){
 const points=geo.getAttribute('position');
 const view=new THREE.OrthographicCamera(-3,3,3,-3,.01,50);
 view.position.set(0,0,12);view.lookAt(0,0,0);view.updateMatrixWorld();
 const vec=new THREE.Vector3();
 let left=Infinity,right=-Infinity,top=-Infinity,bottom=Infinity;
 for(let i=0;i<points.count;i++){
  vec.set(points.getX(i),points.getY(i),points.getZ(i)).project(view);
  left=Math.min(left,vec.x);right=Math.max(right,vec.x);
  top=Math.max(top,vec.y);bottom=Math.min(bottom,vec.y);
 }
 return {width:right-left,height:top-bottom,left,right,top,bottom};
}
const profileBase=createFaceProfile({id:'face-01',kind:'human',sex:'female'});
assert.deepEqual(createFaceProfile({id:'face-01',kind:'human',sex:'female'}),profileBase,
 'Random facial identities must be stable across reload and CI');
const l1=projectedFaceLandmarks(updateFaceProfile(profileBase,{eyeSize:.8,eyeSpacing:.82,
 noseWidth:.75,mouthWidth:.8}));
const l2=projectedFaceLandmarks(updateFaceProfile(profileBase,{eyeSize:1.3,eyeSpacing:1.2,
 noseWidth:1.3,mouthWidth:1.3}));
check(l2.leftEye.width>l1.leftEye.width*1.55,'Projected eye area must respond to eye-size slider');
check(l2.nose.width>l1.nose.width*1.55,'Projected nose width must visibly change');
check(l2.mouth.width>l1.mouth.width*1.5,'Projected lip width must visibly change');
check(Math.abs(l2.rightEye.x)>Math.abs(l1.rightEye.x),'Eye spacing must modify both eye landmarks');
check(facialSpeechEnvelope(0,20)===0&&facialSpeechEnvelope(.1,20)>.05&&
 facialSpeechEnvelope(100,20)===0,'Lip aperture must open mid-syllable and close afterwards');
check(mouthSyllableCount('今こそ、戦う！')>=4,'Japanese narration must drive lip syllables');

for(const [key,job] of Object.entries(JOB_CATALOG)){
 const name=job.name||key;
 const p=createFaceProfile({kind:'human',id:name,sex:'male'});
 check(['almond','round','narrow','hooded'].includes(p.eyesType),name+' eye type');
 check(p.mouthWidth>=.72&&p.noseWidth<=1.32,name+' facial sizes');
 summary.jobs++;
}
// Use an ORIGINAL skinned Mesh fixture rather than screenshots or mocks.
function fixture(){
 const root=new THREE.Group();
 const eyePts=[],skinPts=[];
 for(const side of [-1,1])for(let y=0;y<11;y++)for(let x=0;x<11;x++){
  eyePts.push(side*.029+(x-5)*.002,1.698+(y-5)*.002,.075+Math.max(0,1-((x-5)/5)**2)*.003);
 }
 for(let y=0;y<40;y++)for(let x=0;x<34;x++){
  const X=(x-16.5)*.005,Y=1.53+y*.006;
  skinPts.push(X,Y,.112-.028*(X/.09)**2-.012*((Y-1.65)/.13)**2);
 }
 const geo=vertices=>{
  const g=new THREE.BufferGeometry();g.setAttribute('position',
   new THREE.Float32BufferAttribute(vertices,3));return g;
 };
 const eyes=new THREE.SkinnedMesh(geo(eyePts));eyes.name='Eyes';root.add(eyes);
 const body=new THREE.SkinnedMesh(geo(skinPts));body.name='SuperHero_Male';root.add(body);
 return {root,eyes,body};
}
const fixtureHead=fixture();
const originalEye=fixtureHead.eyes.geometry,originalBody=fixtureHead.body.geometry;
const originalEyeRect=rectFromVertices(originalEye);
const features=attachHumanFaceControls(fixtureHead.root,{
 id:'job-test',job:'剣士',quality:'hero',overrides:{eyeSize:1.24,eyeSpacing:1.2,noseWidth:1.3,
  mouthWidth:1.25,mouthFullness:1.3}
});
const diagn=features.diagnostics();
check(diagn.supported&&diagn.eyeVertices>=200,'Donor eyes must be re-shaped');
check(fixtureHead.eyes.geometry!==originalEye&&fixtureHead.body.geometry!==originalBody,
 'Shared donor buffers must NOT be mutated (equipment and other jobs share them)');
const enlarged=rectFromVertices(fixtureHead.eyes.geometry);
check(enlarged.width>originalEyeRect.width*1.1,'Real projected eye bounding box must enlarge');
if(diagn.animatedMouth){
 features.speak('我々が前線を突破する！');features.update(.11);
 check(fixtureHead.body.morphTargetInfluences[diagn.mouthMorphIndex]>.05,
  'The real skinned lip morph must respond when an actor speaks');
 summary.actualMorphControllers++;
}else summary.failures.push('Original donor skin has no functional mouth animation');
features.setProfile({eyesType:'narrow',eyeSize:.80,noseWidth:.80,mouthWidth:.82});
const narrowed=rectFromVertices(fixtureHead.eyes.geometry);
check(narrowed.width<enlarged.width,'Changing eye sliders must alter actual 2D projection');
summary.eyeProjectionChanges++;
features.dispose();
check(fixtureHead.eyes.geometry===originalEye&&fixtureHead.body.geometry===originalBody,
 'Disposing an actor must restore its own original geometry');

for(const spec of MONSTER_CATALOG){
 const monster=createMonsterModel(spec,{detail:'low'});
 const controller=monster.userData.facialControls;
 check(!!controller?.profile,'Every monster must have a facial identity: '+spec.id);
 check(controller?.profile?.kind==='monster',spec.id+' profile category');
 if(controller){
  const eye=controller.diagnostics().eyeMeshes;
  if(eye>0)summary.eyeProjectionChanges++;
  const mouth=controller.diagnostics().jawAnimated;
  const before=monster.userData.pivots?.jaw?.scale.x;
  controller.setProfile({mouthWidth:1.30,eyeSize:1.26,noseWidth:1.27});
  const after=monster.userData.pivots?.jaw?.scale.x;
  if(mouth){
   check(after>before,spec.id+' must physically alter jaw width');
   startMonsterAction(monster,'idle',0);
   controller.speak('攻撃する！');
   animateMonsterModel(monster,.12);
   const jaw=monster.userData.pivots.jaw;
   check(jaw.rotation.x>.015,spec.id+' spoken jaw must articulate');
   summary.monsterJawControllers++;
  }
  if(controller.diagnostics().noseMeshes)summary.noseProjectionChanges++;
  if(mouth)summary.mouthProjectionChanges++;
 }
 disposeMonsterSculpture(monster);
 summary.monsters++;
}
const keys=Object.keys(CREATURE_VISUAL_SPECS);
assert.equal(keys.length,8,'Every summon and mount species has a facial adapter');
for(const type of keys){
 const low={eyesType:'narrow',eyeSize:.75,eyeSpacing:.80,
  noseType:'short',noseWidth:.75,noseLength:.8,mouthWidth:.8,mouthFullness:.8};
 const high={eyesType:'round',eyeSize:1.3,eyeSpacing:1.2,
  noseType:'broad',noseWidth:1.3,noseLength:1.2,mouthWidth:1.3,mouthFullness:1.3};
 const left=buildCombatObjectGeometry(type,{detail:'low',faceOverrides:low});
 const right=buildCombatObjectGeometry(type,{detail:'low',faceOverrides:high});
 if(left.eyes&&right.eyes){
  const eyeA=rectFromVertices(left.eyes),eyeB=rectFromVertices(right.eyes);
  check(eyeB.width>eyeA.width*1.01,type+' actual summon eye projection must respond');
  summary.eyeProjectionChanges++;
 }
 if(left.jaw&&right.jaw){
  const mouthA=rectFromVertices(left.jaw),mouthB=rectFromVertices(right.jaw);
  check(mouthB.width>mouthA.width*1.04,type+' summon jaw width must respond');
  summary.mouthProjectionChanges++;
 }
 for(const g of Object.values(left))g.dispose();
 for(const g of Object.values(right))g.dispose();
 summary.summons++;
}
summary.elapsedMs=Math.round(performance.now()-begin);
console.log('FACE_2D_LANDMARK_ANALYSIS '+JSON.stringify(summary));
if(summary.jobs<15||summary.monsters!==50||summary.summons!==8)
 summary.failures.push('Incomplete role / monster / summon coverage');
assert.deepEqual(summary.failures,[],
 'Deterministic vertex projection / anatomy / speech metrics detected regression');
