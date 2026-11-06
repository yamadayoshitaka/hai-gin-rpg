import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRidingPoseController,RIDING_JOINTS} from '../src/character-system/riding-pose.js';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(base,name),'utf8');

class Quaternion{
  constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w})}
  clone(){return new Quaternion(this.x,this.y,this.z,this.w)}
  copy(q){Object.assign(this,{x:q.x,y:q.y,z:q.z,w:q.w});return this}
  setFromAxisAngle(axis,angle){const s=Math.sin(angle/2);return this.copy(new Quaternion(axis.x*s,axis.y*s,axis.z*s,Math.cos(angle/2)))}
  multiply(q){const {x,y,z,w}=this;return this.copy(new Quaternion(
    x*q.w+w*q.x+y*q.z-z*q.y,
    y*q.w+w*q.y+z*q.x-x*q.z,
    z*q.w+w*q.z+x*q.y-y*q.x,
    w*q.w-x*q.x-y*q.y-z*q.z))}
}
const bones=Object.keys(RIDING_JOINTS).map(name=>({name,isBone:true,quaternion:new Quaternion()}));
const model={traverse(callback){for(const bone of bones)callback(bone)}};
const ride=createRidingPoseController(model);
assert.equal(ride.jointCount,6,'both complete legs must bend around the saddle');
ride.apply();
assert.equal(ride.applied,true);
assert.ok(bones.every(b=>Math.abs(b.quaternion.w-1)>.001),'thighs, knees and ankles are not a standing pose');
ride.apply();ride.restore();
assert.ok(bones.every(b=>Math.abs(b.quaternion.w-1)<1e-10),'repeating the riding pose must not accumulate rotations');
// If an authored clip updates a leg, the controller must preserve its current
// phase instead of snapping back to a cached T-pose on mounting/dismounting.
bones[0].quaternion.setFromAxisAngle({x:0,y:1,z:0},.51);
const animated=bones[0].quaternion.clone();
ride.apply();ride.restore();
assert.deepEqual(bones[0].quaternion,animated,'mounted pose must restore the exact animated frame');

const game=read('tactics-wireframe.html');
const army=read('src/mass-battle-real-army.js');
const outfit=read('src/outfit-maintenance-model.js');
const armor=read('src/character-system/segmented-armor-runtime.js');
assert.match(game,/a\.mountId=u\.mountId\|\|null/, 'worker mount state must reach detailed humanoid rigs');
assert.match(game,/a\._ridingPose\?\.restore\(\)/,'riding pose must be reversible before animation update');
assert.match(game,/applyCreatureRidingPose\(a\);a\.outfit\?\.sync\(\)/,'clothes must follow seated skeleton');
assert.match(army,/crowdRide/,'GPU soldier meshes must include a skinned mounted pose');
assert.match(army,/\!u\.mountId&&useCrowdImpostor/,'standing card must not replace mounted 3D rig');
assert.match(army,/u\.mountId\?\(striking\?5\.5:5\)/,'GPU rider must not keep walking through the horse');
assert.match(outfit,/complete-back-tunic-lining/,'all jobs must have a closed back tunic');
assert.match(outfit,/heroic-cuirass-backplate/,'swordsmen must have real rear armor');
assert.match(outfit,/cuirass-closed-flank/,'chest plate cannot be open at both sides');
assert.match(armor,/scalpCenterWorld\.clone\(\)/,'helmet must fit the anatomical scalp centre');
assert.doesNotMatch(armor,/delta\.z=slot==='helmet'\?\.015/,'helmet depth cannot be pinned to chest axis');
console.log('PASS: both-leg saddle posture, frame restoration, GPU riders, helmet placement and complete rear outfit coverage');
