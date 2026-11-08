import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {COMBAT_RULES} from '../src/combat-action-spec.js';
import {MASS_MOVEMENT_SCALE,MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {riderSeatLocalOffset,riderSeatHeight} from '../src/combat-creature-performance.js';
import {heightAdvanceCost,isHeightTactician,shouldSeekHighGround} from '../src/tactical-height-priority.js';

const get=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const game=get('../tactics-wireframe.html');
const rider=get('../src/combat-world-object-renderer.js');
const gpu=get('../src/mass-battle-real-army.js');
const commentary=get('../src/battle-strategist-dialogue.js');
const grid=get('../src/mass-battle-grid-sim.js');
const worker=get('../src/mass-battle-worker-client.js');
const workerRuntime=get('../src/mass-battle-worker-runtime.js');

// 1: Default fast dash without removing per-tile collision.
assert.equal(MASS_MOVEMENT_SCALE,.70);
assert.match(game,/a\.speed\*CELL\*\.88/,'50v50 uses the faster dash coefficient');
assert.match(game,/requestMotion\(a,'run'\)/,'Detailed actors really request the running clip');
assert.match(grid,/occupied\[z\*this\.width\+x\]!==-1/,'The dash must not bypass occupied cells');

// 2: Rider and mount remain separate. The saddle is behind the neck.
assert.ok(riderSeatLocalOffset({type:'horse'}).z<0);
assert.ok(riderSeatLocalOffset({type:'wolf'}).z<0);
assert.ok(riderSeatLocalOffset({type:'dragon'}).z<0);
assert.ok(riderSeatHeight({type:'horse',commanderMount:true})>
  riderSeatHeight({type:'horse'}),'Larger commander horse has a taller saddle');
assert.match(game,/riderSeatLocalOffset\(ridden\)/,
  'All detailed riders align to their creature-specific seat');
assert.match(gpu,/riderSeatLocalOffset\(mount\)/,
  'GPU instanced riders align to the SAME saddle location');
assert.match(rider,/o\.mountedBy!=null&&riderFacing!=null\?riderFacing/,
  'Mounted horse retains rider heading while attacking');

// 3: Right command panel only appears on a blue squad/radar tap.
assert.match(game,/body\.squad-menu-closed #dockCommandSlot\{display:none!important\}/);
assert.match(game,/document\.body\.classList\.add\('squad-menu-closed'\)/);
assert.match(game,/#battleDock\{display:none!important\}/,'The old bottom dock is never displayed');
assert.match(game,/#topRadarSlot #squadMiniMap/,'Radar is in the top status row');
assert.match(game,/document\.body\.appendChild\(\$\('squadTactics'\)\)/,
 'The squad popup is mounted at screen level, not in the retired dock');
assert.match(game,/function positionSquadMenuBelowLabel\(id,force=false\)/,
 'The command popup tracks the pressed squad label, not the bottom right panel');
assert.match(game,/positionSquadMenuBelowLabel\(id,true\)/);
assert.match(game,/label\.onclick=\(\)=>activateSquadLabel\(id,team\)/);
assert.match(game,/label\.setPointerCapture\(event\.pointerId\)/,
 'Touching a moving squad label retains the pointer until release');
assert.match(game,/function openSquadTactics\(id\)/);

// 4: The text panel itself locates the reporting squad's strategist.
assert.match(commentary,/onFocus\(\{\.\.\.currentEvent,fromMessageTap:true\}\)/);
assert.match(commentary,/if\(!event\.target\.closest\('button'\)\)followReport\(\)/);
assert.match(game,/roster\.find\(u=>u\.team===0&&u\.isStrategist/);
assert.match(game,/focusedHumanUnitId=massSim\?unit\.id:null/);
assert.match(game,/if\(report\.fromMessageTap&&report\.squadId!=null\)/,
 'Tapping a message opens the same squad command popup');

// 5: Elevation AI must be local, legal and usable in both battle modes.
for(const job of ['archer','ninja','thief']){
 assert.equal(isHeightTactician(job),true);
 assert.ok(heightAdvanceCost(job,0,1)<0,'High tile is preferred by '+job);
 assert.ok(heightAdvanceCost(job,1,0)>0,'Leaving a vantage point has a penalty');
 assert.ok(shouldSeekHighGround(job,0,[.1,.9],{enemyDistanceSquared:100}));
}
assert.equal(isHeightTactician('shield'),false);
assert.equal(heightAdvanceCost('shield',0,2),0);
assert.equal(shouldSeekHighGround('archer',0,[2],{enemyDistanceSquared:1}),false,
 'An immediate adjacent enemy still requires self-defence');
assert.equal(shouldSeekHighGround('archer',0,[2],{hasForcedDestination:true}),false,
 'User-issued orders override autonomous terrain seeking');
assert.match(game,/combatElevationMap\[z\*WORLD_SIZE\+x\]=terrainY/);
assert.match(worker,/elevationMap:heightCopy/);
assert.match(workerRuntime,/elevationMap\}/);
assert.match(grid,/heightAdvanceCost\(u\.jobId,heightHere/);
assert.match(game,/priorities=\{'弓使い':0,'忍者':1,'盗賊':2,'シーフ':2,'魔法使い':4\}/);
assert.match(game,/const throwingRange=a\.jobId==='ninja'\?10:a\.jobId==='thief'\?6/);

const walkable=new Uint8Array(60*60).fill(1);
const heights=new Float32Array(60*60);
heights[31*60+25]=3;
const sim=new MassBattleGridSimulation(20,1234,{width:60,height:60,walkable,bridges:[],elevationMap:heights});
assert.equal(sim.elevationMap[31*60+25],3);
assert.throws(()=>new MassBattleGridSimulation(20,1234,{
 width:60,height:60,walkable,bridges:[],elevationMap:new Float32Array(3)
}),/高低差マップ/);

// Summon HP loss always links to the OWNER, not the passenger. Falls are the
// sole damage caused to the passenger when that summon disappears.
const unit=(id,jobId,x,z,team=0)=>({
 id,jobId,team,x,z,hp:100,maxHp:100,mp:100,maxMp:100,
 alive:true,rarity:'N'
});
const owner=unit(0,'summoner',5,5);
const passenger=unit(1,'sword',6,5);
const enemy=unit(2,'fighter',12,12,1);
const combat=new CombatActionRuntime({width:32,height:32,walkable:new Uint8Array(32*32).fill(1)});
combat.beginTick(.1,[owner,passenger,enemy]);
const wolf=combat.spawnObject('wolf',owner);
assert.ok(wolf,'A live summoner spawns a familiar');
assert.equal(combat.mountObject(passenger,wolf),true,'A different job can mount it');
const linkedOwnerHp=owner.hp,passengerHp=passenger.hp;
combat.damageObject(wolf,20,enemy);
assert.equal(owner.hp,linkedOwnerHp-Math.round(20*COMBAT_RULES.summonDamageLinkRatio));
assert.equal(passenger.hp,passengerHp,'The non-owner passenger gets NO shared creature damage');
const wolfHp=wolf.hp;
combat.damageUnit(owner,20,enemy);
assert.equal(wolf.hp,wolfHp-Math.round(20*COMBAT_RULES.summonDamageLinkRatio),
 'The summoner still shares damage with its familiar');
const ownerHpBeforeRiderHit=owner.hp,wolfHpBeforeRiderHit=wolf.hp;
combat.damageUnit(passenger,20,enemy);
assert.equal(owner.hp,ownerHpBeforeRiderHit,'A passenger hit does not wound the summoner');
assert.equal(wolf.hp,wolfHpBeforeRiderHit,'A passenger hit does not wound its mount');
const riderBeforeFall=passenger.hp;
owner.hp=0;owner.alive=false;
combat.tickSummons(.1,[owner,passenger,enemy]);
assert.equal(wolf.alive,false,'Summoner death dismisses its familiar');
assert.equal(passenger.mountId,null,'Fall dismounts only the passenger');
assert.equal(passenger.hp,riderBeforeFall-Math.ceil(passenger.maxHp*.35));
assert.ok(combat.events.some(e=>e.type==='riderFall'&&e.riderId===passenger.id));
const horseman=unit(3,'sword',9,9);
const horseRuntime=new CombatActionRuntime({width:32,height:32,walkable:new Uint8Array(32*32).fill(1)});
horseRuntime.beginTick(.1,[horseman,enemy]);
const horse=horseRuntime.spawnObject('horse',horseman,horseman.x,horseman.z,{mounted:true});
assert.ok(horse);
horseRuntime.damageObject(horse,25,enemy);
assert.equal(horseman.hp,100,'Damage to a separate horse does not link to its rider');

console.log('PASS five battle features, mounted ownership link and passenger fall damage');
