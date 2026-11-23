import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {
 bridgeCrossingWaypoint,bridgeReverseOnCooldown,
 BRIDGE_LANDING_OFFSET,BRIDGE_REVERSAL_LOCK_SECONDS
} from '../src/battle-bridge-crossing-lock.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('both armies and every wide lane cross toward far bank without reentering the near bank',()=>{
 const center=116,row=100;
 for(const fromSide of [-1,1])for(const laneOffset of [-4,-2,0,2,4]){
  const opts={center,row,fromSide,laneOffset};
  const laneZ=row+laneOffset;
  // Before entry: stage on the exact selected lane.
  let state=bridgeCrossingWaypoint(
   {x:center+fromSide*21,z:laneZ+1},opts);
  assert.equal(state.phase,'approach',String(fromSide)+' lane '+laneOffset);
  assert.equal(state.x,center+fromSide*12);
  assert.equal(state.z,laneZ);
  // At near entrance, align laterally but never walk backward into another lane.
  state=bridgeCrossingWaypoint({x:center+fromSide*12,z:laneZ+1},opts);
  assert.equal(state.phase,'approach');
  assert.equal(state.x,center+fromSide*12);
  for(let progress=11;progress>=-BRIDGE_LANDING_OFFSET;progress--){
   const z=laneZ+(progress===1?1:0); // bump off the row mid-span
   state=bridgeCrossingWaypoint({x:center+fromSide*progress,z},opts);
   assert.equal(state.x,center-fromSide*BRIDGE_LANDING_OFFSET,
    'mid-span goal must always be ahead: '+fromSide+'/'+laneOffset+'/'+progress);
   assert.equal(state.z,laneZ,'lane identity is immutable');
   assert.equal(state.landed,progress===-BRIDGE_LANDING_OFFSET);
  }
 }
});

test('changing target banks on each AI tick cannot trigger immediate reverse crossing',()=>{
 for(const fromSide of [-1,1]){
  // The unit has just landed on the other bank while its nearest target
  // jumps between both halves of the battle every second.
  const landingTime=120,currentSide=-fromSide;
  for(let seconds=0;seconds<BRIDGE_REVERSAL_LOCK_SECONDS;seconds+=.5){
   assert.equal(bridgeReverseOnCooldown(
    currentSide,fromSide,fromSide,landingTime,landingTime+seconds),true);
   assert.equal(bridgeReverseOnCooldown(
    currentSide,currentSide,fromSide,landingTime,landingTime+seconds),false);
  }
  assert.equal(bridgeReverseOnCooldown(currentSide,fromSide,
   fromSide,landingTime,landingTime+BRIDGE_REVERSAL_LOCK_SECONDS),false);
 }
});

test('landing is only accepted beyond the far steps, not at the old terminal plank',()=>{
 const p={center:116,row:100,fromSide:-1,laneOffset:2};
 assert.equal(bridgeCrossingWaypoint({x:130,z:102},p).landed,false);
 assert.equal(bridgeCrossingWaypoint({x:131,z:102},p).landed,false);
 assert.equal(bridgeCrossingWaypoint({x:132,z:102},p).landed,true);
 assert.equal(bridgeCrossingWaypoint({x:132,z:107},p).landed,false);
});

test('battle runtime uses lane-indexed forward reservations and never rear-goal recovery on the span',()=>{
 const battle=read('tactics-wireframe.html');
 assert.match(battle,/import \{bridgeCrossingWaypoint,bridgeReverseOnCooldown\}/);
 assert.match(battle,/const laneZ=activeBridge\?\.row\+\(a\.crossing\?\.laneOffset\|\|0\)/);
 assert.match(battle,/if\(activeBridge&&!activeBridge\.destroyed&&a\.cell\.z===laneZ\)/);
 assert.match(battle,/progress>=-12&&progress<16/);
 assert.match(battle,/if\(crossing\.waiting\)\{a\.poseMoving=false;return;\}/);
 assert.match(battle,/const reversing=onBridge&&\(path\.x-a\.cell\.x\)\*direction<0/);
 assert.doesNotMatch(battle,/if\(activeBridge&&!activeBridge\.destroyed&&a\.cell\.z===activeBridge\.row\)/);
});
console.log('PASS: east/west banks and five lanes remain monotonic through far landing');
