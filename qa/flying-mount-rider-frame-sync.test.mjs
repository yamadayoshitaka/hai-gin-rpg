import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CREATURE_PERFORMANCE,creatureFlightHeight,riderSeatHeight,riderSeatLocalOffset,
  mountedFlightSway,mountedFlightBaseHeight,
} from '../src/combat-creature-performance.js';

for(const type of ['wyvern','dragon','elder_dragon']){
  const mount={id:'flight-'+type,type,category:'summon',mountedBy:7,alive:true,flying:true,height:6.4};
  const clearance=CREATURE_PERFORMANCE[type].seat;
  assert.ok(riderSeatLocalOffset(mount).z<0,type+' saddle stays behind shoulder');
  for(let frame=0;frame<600;frame++){
    const time=frame/60,ground=1.7+frame/700;
    const riderY=ground+riderSeatHeight(mount,time);
    const actualBase=mountedFlightBaseHeight(mount,time,ground,riderY);
    assert.ok(Math.abs(actualBase-(ground+creatureFlightHeight(mount,time)))<1e-10,
      type+' rider and mount have the same airborne displacement at frame '+frame);
    assert.ok(Math.abs(actualBase+clearance-riderY)<1e-10,
      type+' saddle clearance is stable at frame '+frame);
    // Flight-to-roof travel changes the rider altitude independently of the
    // creature altitude field. The body MUST follow that exact rider height.
    const roofInsertionY=12+Math.sin(time*1.1)*3.1;
    assert.ok(Math.abs(mountedFlightBaseHeight(mount,time,ground,roofInsertionY)+
      clearance-roofInsertionY)<1e-10,
      type+' roof insertion remains attached at frame '+frame);
    const bank=mountedFlightSway(mount,time);
    assert.ok(Number.isFinite(bank.pitch)&&Number.isFinite(bank.roll));
    assert.ok(Math.abs(bank.pitch)<=.024001&&Math.abs(bank.roll)<=.028001);
  }
  assert.deepEqual(mountedFlightSway({...mount,mountedBy:null},1),{pitch:0,roll:0});
  assert.equal(mountedFlightBaseHeight({...mount,mountedBy:null},2,1.7,50),
    1.7+creatureFlightHeight(mount,2));
}
for(const type of ['horse','wolf']){
  const groundMount={id:type,type,flying:false,mountedBy:3};
  assert.equal(mountedFlightBaseHeight(groundMount,1,2,50),2,
    'ground mounts do not acquire flying altitude');
  assert.deepEqual(mountedFlightSway(groundMount,1),{pitch:0,roll:0});
}
const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const mountRenderer=readFileSync(new URL('../src/combat-world-object-renderer.js',import.meta.url),'utf8');
const gpuRiders=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(page,/let creatureVisualTime=0;/,'single mount and rider display clock');
assert.equal((page.match(/let creatureVisualTime=0;/g)||[]).length,1,
  'flight clock must not be declared twice');
assert.match(page,/riderElevation\(unit,time=creatureVisualTime\)/);
assert.match(page,/out\.y=terrainY\(out\.x,out\.z\)\+riderSeatHeight\(flyingMount,creatureVisualTime\)/);
assert.match(page,/smooth\.y=out\.y/,'GPU pose cache must have the same flying altitude');
assert.match(page,/pos\.frame=massRenderFrame/,'skirmish visual centre records the sampled frame');
assert.match(page,/mountedFlightSway\(ridden,creatureVisualTime\)/,'detailed rider inherits beast bank');
assert.match(page,/a\.character\.object3D\.rotation\.x=flightSway\.pitch/);
assert.match(page,/a\.character\.object3D\.rotation\.z=flightSway\.roll/);
assert.match(mountRenderer,/riderSkirmish\?offset\+riderSkirmish\.x\/cellSize/);
assert.match(mountRenderer,/mountedFlightBaseHeight\(o,time,terrainY\(px,pz\),riderY\)/);
assert.match(mountRenderer,/if\(attachedFlying\)base\.rotation\.set\(flightSway\.pitch,facing,flightSway\.roll\)/);
assert.match(gpuRiders,/mountedFlightSway\(mount,visualTime\)/,'GPU rider banks in the same frame');
assert.match(gpuRiders,/flightEuler\.set\(sway\.pitch,riderYaw,sway\.roll,'XYZ'\)/);
console.log('PASS: flying mount and rider share altitude, saddle anchor, smoothing sample, sway and roof insertion across 600 frames');
