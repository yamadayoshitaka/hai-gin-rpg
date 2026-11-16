import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {indexBattleDecisionUnits} from '../src/battle-ai-decision-index.js';
import {makeSelectableMapOverlay,isSelectableMapPoint} from '../src/battle-target-highlight.js';
import {zoomedSquadMember} from '../src/battle-zoom-squad-badge.js';
import {chooseEnemyOrder,enemyOrderRefreshSeconds} from '../src/battle-tactical-policy.js';

const units=[];
for(let i=0;i<2000;i++){
 const team=i%2,id='s'+(i%14),hp=i%11===0?0:30+i%70;
 units.push({id:i,team,squadId:id,jobId:i%4===0?'mage':'sword',
  hp,maxHp:100,alive:hp>0,x:(i*3)%232,z:(i*7)%232,
  isStrategist:i%17===0});
}
const index=indexBattleDecisionUnits(units);
for(const team of [0,1]){
 const expected=units.filter(u=>u.team===team&&u.hp>0&&u.alive!==false&&!u.isStrategist);
 assert.deepEqual(team===0?index.allies:index.enemies,expected,
  'the indexed living army must have exactly the old roster and order');
 for(const id of new Set(units.filter(x=>x.team===team).map(x=>String(x.squadId)))){
  assert.deepEqual(index.roster(team,id),units.filter(u=>u.team===team&&String(u.squadId)===id&&!u.isStrategist),
   'losses stay in the doctrine input so retreats are not suppressed');
  assert.deepEqual(index.living(team,id),units.filter(u=>u.team===team&&String(u.squadId)===id&&!u.isStrategist&&u.hp>0&&u.alive!==false));
  assert.equal(index.livingStrategists[team].has(id),
   units.some(u=>u.team===team&&String(u.squadId)===id&&u.isStrategist&&u.alive===true&&u.hp>0));
 }
}
for(const [id,members] of [...new Set(units.filter(u=>u.team===1).map(u=>String(u.squadId)))].map(id=>[id,index.roster(1,id)])){
 const expectedAll=units.filter(u=>u.team===1&&String(u.squadId)===id&&!u.isStrategist);
 for(const previous of ['charge','defend','hold','retreat']){
  const context={friendlyArmy:index.enemies,defenseElapsed:140};
  assert.deepEqual(chooseEnemyOrder(members,index.allies,previous,context),
   chooseEnemyOrder(expectedAll,units.filter(u=>u.team===0&&u.hp>0&&u.alive!==false&&!u.isStrategist),previous,context),
   'enemy AI order and rationale must remain identical after indexing');
 }
}
assert.equal(enemyOrderRefreshSeconds('defend',60,30),20);
assert.equal(enemyOrderRefreshSeconds('defend',30,60),120);

const walkable=(x,z)=>x!==3&&z<6;
const overlay=makeSelectableMapOverlay(8,walkable);
assert.equal(overlay.size,8);
assert.equal(overlay.total,64);
assert.equal(overlay.selectable,58);
assert.deepEqual([...overlay.pixels.slice(0,4)],[24,240,139,68]);
assert.deepEqual([...overlay.pixels.slice((2*8+3)*4,(2*8+3)*4+4)],[108,17,26,98]);
assert.equal(isSelectableMapPoint({x:3,z:2},8,walkable),false);
assert.equal(isSelectableMapPoint({x:4,z:2},8,walkable),true);
assert.equal(isSelectableMapPoint({x:9,z:2},8,walkable),false);
assert.equal(isSelectableMapPoint({x:1.5,z:2},8,walkable),false);

const a={id:1,team:0,squadId:'a1',jobId:'sword',hp:50,alive:true,root:{position:{x:10,z:12}}};
const e={id:2,team:1,squadId:'e3',jobId:'archer',hp:65,alive:true,root:{position:{x:11,z:12}}};
const dead={id:3,team:0,squadId:'a2',hp:0,alive:false,root:{position:{x:11,z:12}}};
const focus={x:10.9,z:12};
assert.equal(zoomedSquadMember([a,e,dead],focus,{maxDistance:4}),e,
 'zoom identifies the nearest living enemy, not the selected allied squad');
assert.equal(zoomedSquadMember([a,e,dead],focus,{preferredId:1,maxDistance:4}),a);
assert.equal(zoomedSquadMember([a,e,dead],{x:250,z:250},{maxDistance:10}),null);
assert.equal(zoomedSquadMember([{id:4,team:1,squadId:'m',hp:80,alive:true,x:12,z:8}],
 {x:100,z:100},{cellSize:2,offset:6}),null);
assert.equal(zoomedSquadMember([{id:4,team:1,squadId:'m',hp:80,alive:true,x:12,z:8}],
 {x:12,z:4},{cellSize:2,offset:6})?.id,4);

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const radar=readFileSync(new URL('../src/targeted-strategy-runtime.js',import.meta.url),'utf8');
assert.match(game,/indexBattleDecisionUnits\(massSim\?\.units\?\?actors\)/);
assert.match(game,/const own=indexed\.roster\(1,id\),living=indexed\.living\(1,id\)/);
assert.match(game,/const members=indexed\.living\(1,id\)/);
assert.match(game,/const owner=indexed\.aliveById\.get\(String\(stack\.ownerId\)\)/);
assert.match(game,/getMapCellEligible:\(x,z\)=>traversableCell\(x,z\)/);
assert.match(radar,/makeSelectableMapOverlay\(size,getMapCellEligible\)/);
assert.match(radar,/isSelectableMapPoint\(point,size,getMapCellEligible\)/);
assert.match(radar,/if\(selectable\)\{ctx\.shadowColor='#ffe36d'/);
assert.match(game,/id='battleZoomSquadBadge'/);
assert.match(game,/zoomedSquadMember\(massSim\?\.units\?\?actors,controls\.target/);
assert.match(game,/nextZoomSquadBadgeAt=stamp\+240/,'the HUD must not scan 2k people every rendered frame');
console.log('PASS: parity-preserving enemy AI index, terrain-exact glowing target map, zoomed ally/enemy squad identity');
