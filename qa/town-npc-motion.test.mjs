import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectTownNpcClip,townNpcGait} from '../src/town-npc-motion.js';

const root=new URL('../assets/characters/quaternius-outfits/',import.meta.url);
for(const file of ['Male_Peasant.gltf','Female_Peasant.gltf']){
 const gltf=JSON.parse(fs.readFileSync(new URL(file,root),'utf8'));
 assert.equal(gltf.animations?.length??0,0,file+' must never be treated as having a walk clip');
 const names=new Set(gltf.nodes.map(node=>node.name));
 for(const bone of ['upperarm_l','lowerarm_l','upperarm_r','lowerarm_r',
  'thigh_l','thigh_r','calf_l','calf_r','spine_01'])
  assert.ok(names.has(bone),file+' lacks procedural pose bone '+bone);
}
assert.equal(selectTownNpcClip([], 'walk'),null,'skeleton-only GLTF uses procedural gait');
assert.equal(selectTownNpcClip([ {name:'Walk',tracks:[]} ],'walk'),null,
 'a named animation with no tracks cannot prevent procedural T-pose recovery');
assert.equal(selectTownNpcClip([
 {name:'Walk',tracks:[{name:'upperarm_l.quaternion'}]}
 ],'walk'),null,'arm-only clip is not a full walk');
const animated={name:'Walk',tracks:[
 {name:'upperarm_l.quaternion'},{name:'thigh_l.quaternion'}]};
assert.equal(selectTownNpcClip([animated],'walk'),animated,'valid animated skeleton still uses its authored clip');

const idle=townNpcGait(0.77,{walking:false});
assert.equal(idle.leftLeg,0);
assert.equal(idle.leftArm,0);
const move=townNpcGait(0.41,{walking:true});
assert.ok(Math.abs(move.leftLeg)>.1,'real walking needs clear leg stride');
assert.equal(move.leftLeg,-move.rightLeg,'legs must alternate');
assert.equal(move.leftArm,-move.rightArm,'arms must counter-swing');
assert.ok(Math.abs(move.leftArm)>0,'walking must move the upper body, not just the feet');

const html=fs.readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/import \{selectTownNpcClip,createTownNpcProceduralPose\} from '\.\/src\/town-npc-motion\.js'/);
assert.match(html,/citizen\.townProceduralMotion=createTownNpcProceduralPose\(THREE,model\)/);
assert.match(html,/actor\.townProceduralMotion=createTownNpcProceduralPose\(THREE,model\)/);
assert.match(html,/citizen\.townProceduralMotion\?\.update\(elapsed,\{walking:citizen\.walk,phase:citizen\.phase\}\)/);
assert.match(html,/a\.townProceduralMotion\?\.update\(elapsed,\{walking:false,phase:a\.id\*\.7\}\)/);
assert.match(html,/tPoses:\[\.\.\.actors,\.\.\.townStreetCitizens\]\.filter\(/);
console.log('PASS registered GLTF bone chain, lowered-arms idle and articulated town walking');
