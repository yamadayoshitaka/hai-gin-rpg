import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createRidingPoseController,resolveRidingJointName,ridingStyleForCreature,
 RIDING_JOINTS,RIDING_TORSO_JOINTS,DRAGON_SEATED_TORSO_JOINTS
} from '../src/character-system/riding-pose.js';

class Quaternion{
 constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w})}
 clone(){return new Quaternion(this.x,this.y,this.z,this.w)}
 copy(q){Object.assign(this,{x:q.x,y:q.y,z:q.z,w:q.w});return this}
 setFromAxisAngle(v,a){let t=Math.sin(a/2);return this.copy(
  new Quaternion(v.x*t,v.y*t,v.z*t,Math.cos(a/2)))}
 multiply(q){const {x,y,z,w}=this;return this.copy(new Quaternion(
 x*q.w+w*q.x+y*q.z-z*q.y,y*q.w+w*q.y+z*q.x-x*q.z,
 z*q.w+w*q.z+x*q.y-y*q.x,w*q.w-x*q.x-y*q.y-z*q.z))}
}
const qValues=q=>[q.x,q.y,q.z,q.w];
assert.equal(resolveRidingJointName('J_Bip_L_UpperLeg'),'thigh_l');
assert.equal(resolveRidingJointName('RightLowerLeg'),'calf_r');
assert.equal(resolveRidingJointName('spine_01'),'spine_01');
assert.equal(resolveRidingJointName('Spine2'),'spine_02');
assert.equal(resolveRidingJointName('mixamorigHips'),'pelvis');
assert.equal(ridingStyleForCreature('dragon'),'throne');
assert.equal(ridingStyleForCreature('wolf'),'low-straddle');
assert.ok(DRAGON_SEATED_TORSO_JOINTS.pelvis.pitch!==RIDING_TORSO_JOINTS.pelvis.pitch);
const names=[...Object.keys(RIDING_JOINTS),'pelvis','spine_01','spine_02'];
const bones=names.map(name=>({name,isBone:true,quaternion:new Quaternion()}));
const model={traverse(callback){for(const bone of bones)callback(bone)}};
const controller=createRidingPoseController(model);
assert.equal(controller.jointCount,6,'existing 6 leg joints remain independent');
assert.equal(controller.torsoJointCount,3,'pelvis and both torso bones must seat');
for(let frame=0;frame<180;frame++){
 const q=bones[0].quaternion;
 q.setFromAxisAngle({x:0,y:1,z:0},frame*.005);
 const before=bones.map(b=>qValues(b.quaternion));
 controller.apply(['straddle','throne','low-straddle'][frame%3]);
 const pose=bones.map(b=>qValues(b.quaternion));
 assert.notDeepEqual(pose[6],before[6],'pelvis must not remain upright');
 assert.notDeepEqual(pose[7],before[7],'spine must counterbalance seated hips');
 assert.notDeepEqual(pose[0],before[0],'thighs must wrap mount saddle');
 controller.restore();
 assert.deepEqual(bones.map(b=>qValues(b.quaternion)),before,
  'dismount or new clip frame restores all 65-bone animation keys');
}
assert.equal(controller.applied,false);

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const battle=read('tactics-wireframe.html');
const hair=read('src/face-scalp-wig.js');
const rig=read('src/character-system/rigged-outfit-runtime.js');
const army=read('src/mass-battle-real-army.js');
const graft=read('src/character-system/battle-artist-head-graft.js');
assert.match(battle,/else actor\._ridingPose\.restore\(\)/,
 'dismounted soldiers restore standing pose');
assert.match(battle,/next\.outfit\?\.setHairVisible\(!next\.masterHead\?\.studioWig\)/,
 'a failed middle/near hair bake must not overlay an incorrect GLB wig');
assert.match(battle,/riding-pose\.js\?v=20261117-three-seats-v3/);
assert.match(army,/riding-pose\.js\?v=20261117-three-seats-v3/,
 'GPU crowd ride capture must use the same seated pose');
assert.match(rig,/jobId==='job06'&&role==='body'/);
assert.match(rig,/battleThiefClosedBack:true/);
assert.match(rig,/copy\.alphaTest=0;copy\.depthWrite=true;copy\.depthTest=true/);
assert.match(hair,/rearShortCover=shortHair&&battleStableCoverage&&zNorm<-.025/);
assert.match(graft,/face-scalp-wig\.js\?v=20261117-nape-silhouette-v2/);
assert.match(battle,/battle-artist-head-graft\.js\?v=20261117-shading-back1/);
assert.match(battle,/rigged-outfit-runtime\.js\?v=20261117-exposed-only3/);
console.log('PASS: 180 seated frame restores, 3 torso bones, GPU mount capture, thief-back opacity and short rear scalp coverage');
