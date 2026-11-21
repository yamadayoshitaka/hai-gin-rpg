import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
 BATTLE_BRIDGE_WIDTH_CELLS,BATTLE_BRIDGE_HALF_WIDTH_CELLS,
 BATTLE_BRIDGE_LANE_OFFSETS,monsterGroundRadiusCells,monsterHasClearance
} from '../src/battle-wide-bridge-clearance.js';

const hydra={id:'m018',family:'reptile'};
const drake={id:'m017',family:'reptile'};
const actor=(spec,x,z)=>({monsterSpec:spec,cell:{x,z},hp:100,defeated:false});

test('large enemies reserve different ground-space cells instead of visual overlap',()=>{
 const other=actor(drake,20,30);
 assert.equal(monsterGroundRadiusCells(hydra)>2,true);
 assert.equal(monsterHasClearance(22,30,hydra,[other]),false);
 assert.equal(monsterHasClearance(25,30,hydra,[other]),true);
 other.nextCell={x:24,z:30};
 assert.equal(monsterHasClearance(25,30,hydra,[other]),false,'predict the reserved destination');
 other.defeated=true;
 assert.equal(monsterHasClearance(24,30,hydra,[other]),true,'a defeated monster releases its clearance');
 const self=actor(hydra,15,30);
 assert.equal(monsterHasClearance(15,30,hydra,[self],self),true);
 assert.equal(monsterHasClearance(15,30,null,[self]),true,'humans keep their melee access');
});

test('wood and stone bridges share all nine collision lanes and their wide stairs',()=>{
 assert.equal(BATTLE_BRIDGE_WIDTH_CELLS,9);
 assert.equal(BATTLE_BRIDGE_HALF_WIDTH_CELLS,4);
 assert.deepEqual(new Set(BATTLE_BRIDGE_LANE_OFFSETS).size,9);
 assert.deepEqual([...BATTLE_BRIDGE_LANE_OFFSETS].sort((a,b)=>a-b),[-4,-3,-2,-1,0,1,2,3,4]);
 const catalog=readFileSync(new URL('../src/object-catalog.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(catalog,/const L=15\*cellSize,W=BATTLE_BRIDGE_WIDTH_CELLS\*cellSize/);
 assert.match(catalog,/const length=15\*cellSize,W=BATTLE_BRIDGE_WIDTH_CELLS\*cellSize/);
 assert.match(catalog,/widthCells:BATTLE_BRIDGE_WIDTH_CELLS/);
 assert.match(html,/for\(let z=row-BATTLE_BRIDGE_HALF_WIDTH_CELLS;z<=row\+BATTLE_BRIDGE_HALF_WIDTH_CELLS;z\+\+\)/);
 assert.match(html,/const width=BATTLE_BRIDGE_WIDTH_CELLS\*CELL/);
 assert.match(html,/stairCells\.set\(key,\{height:y,bridge:record\}\)/);
 assert.match(html,/bridgeSafeCells\.add\(x\+','\+\(b\.row\+dz\)\)/);
});

test('skirmish placement, movement and routing use collision-safe wide bridge lanes',()=>{
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(html,/spawnOutside\(candidate\.x,candidate\.z,team,monsterSpec\)/);
 assert.match(html,/monsterHasClearance\(nx,nz,monsterSpec,actors\)/);
 assert.match(html,/monsterHasClearance\(x,z,actor\?\.monsterSpec,actors,actor\)/);
 assert.match(html,/for\(const laneOffset of BATTLE_BRIDGE_LANE_OFFSETS\)/);
 assert.match(html,/actor\.crossing=\{bridge:chosen\.bridge,fromSide:currentSide,laneOffset:chosen\.laneOffset\}/);
 assert.match(html,/return \{x:safeApproach\(farX\),z:laneZ\}/);
});
