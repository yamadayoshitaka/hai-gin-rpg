import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sampleArrowArc,arrowArcVelocity,chooseArrowFlight} from '../src/character-system/ballistic-trajectory.js';

const from={x:-2,y:1.35,z:0},to={x:12,y:1.1,z:8};
const flight=chooseArrowFlight(from,to);
assert.ok(flight.duration>.32&&flight.duration<1.55);
assert.ok(flight.arcHeight>.42);
assert.deepEqual(sampleArrowArc(from,to,0,flight.arcHeight),from,'arrow must leave the bow');
assert.deepEqual(sampleArrowArc(from,to,1,flight.arcHeight),to,'arrow must reach the selected target');
const middle=sampleArrowArc(from,to,.5,flight.arcHeight);
assert.ok(Math.abs(middle.x-5)<1e-8&&Math.abs(middle.z-4)<1e-8,'horizontal flight is continuous');
assert.ok(middle.y>(from.y+to.y)/2+.4,'arrow must travel along a visible ballistic arch');
const launch=arrowArcVelocity(from,to,0,flight.arcHeight),impact=arrowArcVelocity(from,to,1,flight.arcHeight);
assert.ok(launch.y>0&&impact.y<0,'arrow must rise at release and fall into its target');
assert.ok(Math.abs(sampleArrowArc(from,to,-1,flight.arcHeight).y-from.y)<1e-9,'flight clamps negative time');
assert.ok(Math.abs(sampleArrowArc(from,to,2,flight.arcHeight).y-to.y)<1e-9,'flight clamps time after impact');
assert.throws(()=>sampleArrowArc(from,to,.5,-1));
const textures=['slash','heavy-slash','spark','arcane','fire','earth','water','nature'];
for(const texture of textures){
 const path=`assets/vfx/user-imported/${texture}.png`,image=fs.readFileSync(path);
 assert.ok(image.length>500&&image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`missing real PNG sprite: ${texture}`);
}
console.log('PASS quadratic archer projectile from release to impact, ballistic heading and 8 imported VFX sprites');
