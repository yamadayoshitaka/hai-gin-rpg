import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
 HUMANOID_SPELL_PALETTE,humanoidGesturePhases,
 createHumanoidMonsterCombatMotion
} from '../src/monster-humanoid-combat-poses.js';

const p0=humanoidGesturePhases(0),p1=humanoidGesturePhases(.5),
 p2=humanoidGesturePhases(1);
assert.equal(p0.anticipate,0);
assert.equal(p1.anticipate,1);
assert.ok(p1.release>0);
assert.equal(p2.recover,1);
assert.ok(Object.isFrozen(HUMANOID_SPELL_PALETTE));
assert.notEqual(HUMANOID_SPELL_PALETTE.forest_spirit_female,
 HUMANOID_SPELL_PALETTE.seraph_female);
assert.notEqual(HUMANOID_SPELL_PALETTE.seraph_female,
 HUMANOID_SPELL_PALETTE.dragonkin_female);

function fixture(costume){
 const model=new THREE.Group();
 const left=new THREE.Bone();left.name='upperarm_l';
 const right=new THREE.Bone();right.name='upperarm_r';
 const leftForearm=new THREE.Bone();leftForearm.name='lowerarm_l';
 const rightForearm=new THREE.Bone();rightForearm.name='lowerarm_r';
 model.add(left,right);left.add(leftForearm);right.add(rightForearm);
 const motion=createHumanoidMonsterCombatMotion(model,{costume});
 assert.equal(motion.hasHand,true);
 assert.equal(rightForearm.children.filter(n=>n.name==='monster-instance-combat-magic').length,1);
 motion.update('idle',0,0);
 assert.equal(rightForearm.children[0].visible,false);
 motion.update('special',.58,1);
 assert.ok(left.rotation.x<0&&right.rotation.x<0,
  'Both arms must participate in casting');
 assert.equal(rightForearm.children[0].visible,true);
 assert.equal(rightForearm.children[0].children.length,2,
  'No per-frame shader/mesh allocation');
 const mesh=rightForearm.children[0].children[0];
 assert.ok(mesh.material.opacity>0&&mesh.scale.x>1);
 motion.update('special',1,2);
 assert.ok(mesh.material.opacity<.1,'Cast recovery must fade out');
 // Mixer owns the native pose: simulate the next native animation frame.
 left.rotation.set(0,0,0);right.rotation.set(0,0,0);
 motion.update('attack',.5,3);
 assert.ok(right.rotation.x<0,'Normal attack adds emphasis to the native clip');
 assert.ok(left.rotation.x===0,'Normal attack must not lift spellcasting arm');
 motion.dispose();motion.dispose();
 assert.equal(rightForearm.children.length,0,'Effect must be disposed with model');
}
for(const costume of ['forest_spirit_female','seraph_female',
 'dragonkin_female','demon'])fixture(costume);
console.log('Humanoid monster casting gestures PASS');
