import assert from 'node:assert/strict';
import {
 creatureFaceVolume,sculptAxialFacePoint
} from '../src/creature-face-volume.js';

// Check actual vertex displacement, not a label, reference image or registry.
const point=[.12,.06,.43,.66,.34];
const vertex=(id,family,enable)=>sculptAxialFacePoint(
 ...point,{...creatureFaceVolume(id,family),anatomicalRims:enable});
const changed=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const changedIds=['m002','m003','m004','m007','m008','m009','m010'];
for(const id of changedIds){
 const family=Number(id.slice(1))<=4?'beast':'feline';
 const enabled=creatureFaceVolume(id,family);
 assert.equal(enabled.anatomicalRims,true,id+' missing physical axial face gate');
 const sculpted=vertex(id,family,true),legacy=vertex(id,family,false);
 assert(changed(sculpted,legacy)>.00001,id+' unchanged anatomical surface');
 assert(sculpted.every(Number.isFinite));
}
// No geometry change to protected m005/m006, including mirrored summons.
for(const [id,family] of [['m005','beast'],['m006','feline']]){
 const preset=creatureFaceVolume(id,family);
 assert.notEqual(preset.anatomicalRims,true,id+' protected geometry gate changed');
 const original=vertex(id,family,false),actual=sculptAxialFacePoint(...point,preset);
 assert.deepEqual(actual,original,id+' must preserve original head geometry');
}
const wolf=creatureFaceVolume('wolf');
assert.equal(wolf.anatomicalRims,true,'Dedicated summoned wolf source needs physical face');
assert(changed(vertex('wolf','beast',true),vertex('wolf','beast',false))>.00001);
const cat=creatureFaceVolume('feline');
assert.notEqual(cat.anatomicalRims,true,'Protected panther shares generic feline family');
console.log('PASS: seven enemy skull meshes, dedicated wolf source, protected unchanged');
