import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {applyWardrobeInspectionPose,restoreWardrobeInspectionPose} from '../src/character-system/wardrobe-inspection-pose.js';

const root=new THREE.Group(),rest=new Map();
for(const side of ['l','r']){
  const direction=side==='l'?1:-1;
  const upper=new THREE.Bone();upper.name=`upperarm_${side}`;
  upper.position.set(direction*.18,1.44,0);
  const elbow=new THREE.Bone();elbow.name=`lowerarm_${side}`;
  elbow.position.set(direction*.32,0,0);
  upper.add(elbow);root.add(upper);
  rest.set(side,upper.quaternion.clone());
}
const pose=applyWardrobeInspectionPose(root);
for(const side of ['l','r']){
  const upper=root.getObjectByName(`upperarm_${side}`);
  const elbow=upper.children[0];
  const dir=elbow.getWorldPosition(new THREE.Vector3())
    .sub(upper.getWorldPosition(new THREE.Vector3())).normalize();
  assert.ok(dir.y<-.88,`${side}: hand remains at eyebrow height in the T pose`);
  assert.ok(Math.abs(dir.x)<.40,`${side}: sword hand still crosses the head silhouette`);
  assert.ok(pose[`upperarm_${side}`],`${side}: missing arm calibration`);
}
assert.ok(restoreWardrobeInspectionPose(root),'studio arm rotations must be reversible');
for(const side of ['l','r']){
  const upper=root.getObjectByName(`upperarm_${side}`);
  assert.ok(upper.quaternion.angleTo(rest.get(side))<1e-7,'restoring the bind pose must be exact');
}
console.log('PASS: male/female-style T-pose arms lower beside the body without altering the source rig');

// Real source-rig check: every hand (and the sword on it) must start below
// face height in the maintenance viewer, not remain in its imported T-pose.
for(const sex of ['Male','Female']){
  const data=JSON.parse(readFileSync(new URL(`../assets/characters/quaternius-base/Superhero_${sex}_FullBody.gltf`,import.meta.url),'utf8'));
  const nodes=data.nodes.map(n=>{
    const o=new THREE.Bone();o.name=n.name||'';
    if(n.translation)o.position.fromArray(n.translation);
    if(n.rotation)o.quaternion.fromArray(n.rotation);
    if(n.scale)o.scale.fromArray(n.scale);
    return o;
  });
  data.nodes.forEach((n,i)=>{for(const child of n.children||[])nodes[i].add(nodes[child])});
  const character=new THREE.Group();
  nodes.filter(n=>!n.parent).forEach(n=>character.add(n));
  character.updateMatrixWorld(true);
  const head=nodes.find(n=>n.name.toLowerCase()==='head');
  assert.ok(head,`${sex}: head bone missing`);
  const before=head.getWorldPosition(new THREE.Vector3());
  for(const side of ['l','r']){
    const hand=nodes.find(n=>n.name.toLowerCase()===`hand_${side}`);
    assert.ok(hand,`${sex}: hand ${side} missing`);
  }
  applyWardrobeInspectionPose(character);
  for(const side of ['l','r']){
    const hand=nodes.find(n=>n.name.toLowerCase()===`hand_${side}`);
    const handPosition=hand.getWorldPosition(new THREE.Vector3());
    assert.ok(handPosition.y<before.y-.19,
      `${sex}/${side}: weapon hand still appears in front of the eyes: hand ${handPosition.y}, head ${before.y}`);
  }
  restoreWardrobeInspectionPose(character);
  console.log(`PASS ${sex}: real asset hands are lowered away from face level in wardrobe inspection`);
}
