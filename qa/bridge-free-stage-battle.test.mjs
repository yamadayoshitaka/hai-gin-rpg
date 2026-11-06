import assert from 'node:assert/strict';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

// Border fort, deep forest and desert intentionally have zero bridges. They
// must load, deploy both armies and cross open ground without fake crossings.
for(const sideCount of [50,100,1000]){
 const width=188,height=188,walkable=new Uint8Array(width*height).fill(1);
 const sim=new MassBattleGridSimulation(sideCount,20261106,{
  width,height,walkable,bridges:[],riverXAt:()=>width/2,
 });
 assert.equal(sim.bridges.length,0,'Do not synthesize a physical bridge');
 assert.equal(sim.activeBridges.length,0);
 assert.equal(sim.units.length,sideCount*2);
 assert.ok(sim.units.filter(u=>u.team===0).every(u=>u.x<width/2),
  'Blue troops start on the west side of an open field');
 assert.ok(sim.units.filter(u=>u.team===1).every(u=>u.x>width/2),
  'Red troops start on the east side of an open field');
 for(const unit of sim.units){
  assert.ok(Number.isInteger(unit.x)&&Number.isInteger(unit.z));
  assert.ok(unit.x>=0&&unit.x<width&&unit.z>=0&&unit.z<height);
 }
 const before=sim.units.map(u=>[u.x,u.z]);
 for(let i=0;i<18;i++)sim.step(.1);
 assert.ok(sim.units.some((u,i)=>u.alive&&(u.x!==before[i][0]||u.z!==before[i][1])),
  'An open-field army must begin moving toward the opponent');
 assert.ok(sim.flowEast.some(v=>v===0)&&sim.flowWest.some(v=>v===0),
  'Both armies have reachable navigation goals without a river');
}
console.log('橋なし50/100/1000対戦: 初期配置・左右進軍・橋ゼロ維持 PASS');
