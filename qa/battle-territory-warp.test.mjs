import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {territoryAt,ownTerritory,legalHomeWarpCell,chooseHomeWarpLanding} from '../src/battle-territory.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {packMassUnits,applyMassUnits} from '../src/mass-battle-worker-protocol.js';

const width=232,height=232,riverXAt=z=>116+Math.round(5*Math.sin(z*.055));
const world={width,height,riverXAt};
for(const z of [0,29,110,180,231]){
 const mid=riverXAt(z);
 assert.equal(territoryAt(1,z,world),'blue','Blue controls the full west half');
 assert.equal(territoryAt(width-2,z,world),'red','Red controls the full east half');
 assert.equal(territoryAt(mid,z,world),'neutral','The actual curving river is neutral');
 assert.equal(territoryAt(mid-4,z,world),'blue');
 assert.equal(territoryAt(mid+4,z,world),'red');
}
assert.equal(ownTerritory(0,5,2,world),true);
assert.equal(ownTerritory(1,5,2,world),false);
assert.equal(territoryAt(-1,2,world),'outside');
const walkable=new Uint8Array(width*height).fill(1);
const occupied=new Int32Array(width*height).fill(-1);
const sim=new MassBattleGridSimulation(50,20261108,{width,height,walkable,bridges:[],riverXAt});
const ally=sim.units.find(u=>u.team===0&&u.isStrategist);
const red=sim.units.find(u=>u.team===1&&u.isStrategist);
assert.ok(ally&&red,'Each team fields in-world leaders');
assert.equal(sim.canWarpStrategist(ally.id,5,190),false,'Non-UR general cannot teleport');
ally.rarity='UR';red.rarity='UR';
assert.equal(sim.canWarpStrategist(ally.id,220,190),false,'Red enemy camp rejects blue warp');
assert.equal(sim.canWarpStrategist(ally.id,riverXAt(190),190),false,'No warp into neutral corridor');
const blockedIndex=190*width+5;
walkable[blockedIndex]=0;
assert.equal(sim.canWarpStrategist(ally.id,5,190),false,'Impassable rock and river are rejected');
walkable[blockedIndex]=1;
const taken=sim.units.find(u=>u.alive&&u.team===0&&u.id!==ally.id&&u.x<riverXAt(u.z)-3);
assert.ok(taken);
assert.equal(sim.canWarpStrategist(ally.id,taken.x,taken.z),false,'No overlapping troops');
assert.equal(sim.canWarpStrategist(ally.id,5,190),true,'Any remote tile in blue camp is valid');
const mount=sim.objects.find(o=>o.ownerId===ally.id&&o.alive&&o.mountedBy===ally.id);
assert.ok(mount,'The general owns a single horse');
const previous={x:ally.x,z:ally.z};
assert.equal(sim.warpStrategist(ally.id,5,190),true);
assert.deepEqual({x:ally.x,z:ally.z},{x:5,z:190});
assert.equal(ally.strategistWarpUsed,true);
assert.equal(sim.warpStrategist(ally.id,4,189),false,'Once-per-battle quota cannot be bypassed');
assert.equal(mount.x,ally.x,'The same horse teleports with the general');
assert.equal(mount.z,ally.z);
assert.equal(sim._occupancy[190*width+5],ally.id);
assert.equal(sim._occupancy[previous.z*width+previous.x],-1);
sim.step(.1);
assert.ok(sim.actionEvents.some(e=>e.type==='strategistWarp'&&e.sourceId===ally.id),
 'Warp emits a real synchronized effect event');
assert.equal(sim.territoryAt(ally.x,ally.z),'blue');

const candidate=chooseHomeWarpLanding(red,world,{
 walkable,occupied,units:sim.units,objects:sim.objects
});
assert.ok(candidate,'An emergency landing is found on the entire home side');
assert.equal(territoryAt(candidate.x,candidate.z,world),'red');
assert.equal(legalHomeWarpCell(red,candidate.x,candidate.z,world,{
 walkable,occupied,units:sim.units,objects:sim.objects
}),true);
assert.equal(sim.warpStrategist(red.id,5,190),false,'Red cannot warp to blue territory');
assert.equal(sim.warpStrategist(red.id,225,197),true,'Red may warp to distant eastern corner');

const mirror=new MassBattleGridSimulation(50,20261108,{width,height,walkable,bridges:[],riverXAt});
applyMassUnits(mirror.units,packMassUnits(sim.units).buffer);
assert.equal(mirror.units[ally.id].strategistWarpUsed,true,'Worker mirror receives used warp quota');
assert.equal(mirror.units[red.id].strategistWarpUsed,true);

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/mass-battle-worker-client.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/mass-battle-worker-runtime.js',import.meta.url),'utf8');
assert.match(game,/id="squadStrategistWarp"/,'UR strategist has a tactical button');
assert.match(game,/pickingStrategistWarp/);
assert.match(game,/territoryAt\(position\.x,position\.z,battleTerritoryWorld\(\)\)/);
assert.match(game,/BlueRedInitialTerritoryBoundary/,'Both camps are visibly marked');
assert.match(game,/miniPixels\.data\.set\(\[\.\.\.color,255\],index\)/);
assert.match(client,/warpStrategist\(unitId,x,z\)/);
assert.match(worker,/case 'strategistWarp'/);
console.log('PASS east/west camp boundary, blue/red valid warp and one-use UR general with mount & Worker sync');
