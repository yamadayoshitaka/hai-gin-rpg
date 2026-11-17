import assert from 'node:assert/strict';
import {
 riderSeatAnchor,riderSeatLocalOffset,riderSeatHeight,CREATURE_PERFORMANCE,
 creatureFlightHeight,
} from '../src/combat-creature-performance.js';
const horse={id:'horse-1',type:'horse',alive:true,mountedBy:1,category:'mount'};
const saddle=riderSeatAnchor(horse);
assert.ok(saddle.z<-.15&&saddle.z>-.3,
 'horse pelvis stays over the measured saddle pad near z=-.18, not the rear rump');
assert.ok(saddle.y>=1.82&&saddle.y<=1.95,
 'horse saddle top (1.22 + .51 + .055m) must not bury the pelvis inside the horse');
assert.ok(saddle.y>CREATURE_PERFORMANCE.horse.seat,'horse pelvis requires positive clearance');
assert.equal(riderSeatLocalOffset(horse).z,saddle.z);
assert.equal(riderSeatHeight(horse),saddle.y);
const commander={...horse,commanderMount:true};
assert.ok(riderSeatHeight(commander)>saddle.y,'larger commander horse needs a higher seat');
for(const type of ['wyvern','dragon','elder_dragon']){
 const mount={id:type,type,flying:true,height:6.4,mountedBy:1};
 const at=riderSeatAnchor(mount,3.2);
 assert.equal(at.y,CREATURE_PERFORMANCE[type].seat+creatureFlightHeight(mount,3.2),
  'flight elevation uses exact existing shared animation phase');
}
assert.deepEqual(riderSeatAnchor(null),{x:0,y:0,z:0});
console.log('battle saddle seat anchor: OK');
