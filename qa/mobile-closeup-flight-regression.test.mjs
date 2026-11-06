import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {COMBAT_RULES} from '../src/combat-action-spec.js';

const html=fs.readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/controls\.minDistance=4\b/,'camera can approach closer than the previous nine-unit limit');
assert.match(html,/lastGroundTap/,'two quick taps provide an accessible zoom fallback');
assert.match(html,/distance>65\?Math\.max\(25,distance\*\.25\)/,
 'a double tap from overview can approach the soldiers without many gestures');
assert.match(html,/terrainY\(camera\.position\.x,camera\.position\.z\)\+1\.7/,
 'close-up height correction follows real terrain, not a fixed seven-unit ceiling');

const size=232,sim=new MassBattleGridSimulation(1000,20261106,{
 width:size,height:size,walkable:new Uint8Array(size*size).fill(1),
 bridges:[{x:116,z:55},{x:116,z:116},{x:116,z:177}],riverXAt:()=>116,
});
for(let tick=0;tick<100;tick++)sim.step(.1);
const creatures=sim.objects.filter(o=>o.alive&&o.category!=='structure');
for(const team of [0,1]){
 const allied=creatures.filter(o=>o.team===team);
 const mounts=allied.filter(o=>o.category==='mount');
 const flying=allied.filter(o=>o.flying);
 assert.ok(allied.length<=COMBAT_RULES.maximumObjectsPerTeam,'per-army GPU object budget stays intact');
 assert.ok(mounts.length<=COMBAT_RULES.maximumMountsPerTeam,'horse allocation preserves summon slots');
 assert.ok(flying.length>=2,'1000-soldier army actually produces flying summons');
 for(const o of flying){
  assert.ok(['wyvern','dragon','elder_dragon'].includes(o.type));
  assert.notEqual(sim.units[o.ownerId].rarity,'N','rarity-based air summon retains its appearance');
 }
}
console.log('スマホ接近カメラ・1000対1000飛空召喚獣・軍馬予算 PASS');
