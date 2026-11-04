import assert from 'node:assert/strict';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

const size=232,walkable=new Uint8Array(size*size).fill(1);
const idx=(x,z)=>z*size+x;
// 川は全長を遮断し、橋の通路以外は通過できない。
for(let z=0;z<size;z++)for(let x=111;x<=121;x++)walkable[idx(x,z)]=0;
for(let z=115;z<=117;z++)for(let x=111;x<=121;x++)walkable[idx(x,z)]=1;
for(let x=111;x<=121;x++)walkable[idx(x,177)]=1;
// 岸に建物と木があり、進軍が回り込む必要がある。
for(let z=128;z<=136;z++)for(let x=98;x<=100;x++)walkable[idx(x,z)]=0;
for(let z=170;z<=173;z++)for(let x=135;x<=138;x++)walkable[idx(x,z)]=0;
const bridges=[{x:116,z:116,type:'stone'},{x:116,z:177,type:'timber'}];
const options={width:size,height:size,walkable,bridges,riverXAt:()=>116};

for(const count of [50,200,1000]){
  const sim=new MassBattleGridSimulation(count,20261104,options);
  assert.equal(sim.units.length,count*2);
  assert.equal(new Set(sim.units.map(u=>u.x+','+u.z)).size,count*2,'初期位置の重複は禁止');
  for(const u of sim.units)assert.equal(walkable[idx(u.x,u.z)],1,'木・建物・水域にスポーンしない');
  // One cell takes roughly a second now; allow enough simulated time for
  // both armies to march to the bridge before asserting combat has begun.
  for(let frame=0;frame<600;frame++){
    sim.step(.1);
    const alive=sim.units.filter(u=>u.alive);
    assert.equal(new Set(alive.map(u=>u.x+','+u.z)).size,alive.length,'同じマスに重ならない');
    for(const u of alive){
      assert.equal(walkable[idx(u.x,u.z)],1,'通行不能マスには進入しない');
      const rendered=sim.getRenderCell(u,.5);
      assert.ok(Number.isFinite(rendered.x)&&Number.isFinite(rendered.z),'全兵士の補間位置が有効');
      assert.ok(Math.abs(rendered.x-u.x)<=1&&Math.abs(rendered.z-u.z)<=1,'マスを飛び越えて描画しない');
      if(u.x>=111&&u.x<=121)assert.ok(u.z>=115&&u.z<=117||u.z===177,'川は橋でのみ横断する');
    }
  }
  assert.ok(sim.attacks>0,'大軍が実際に戦闘する');
  console.log(`${count}対${count}: 橋限定ルート・建物回避・マス重複なし・攻撃${sim.attacks}回 OK`);
}

const sim=new MassBattleGridSimulation(50,88,options);
const changed=walkable.slice();
const brokenCells=new Set();
for(let x=111;x<=121;x++){changed[idx(x,177)]=0;brokenCells.add(x+',177')}
sim.killAtCells(brokenCells);sim.updateWalkable(changed);
for(let tick=0;tick<600;tick++)sim.step(.1);
assert.ok(sim.units.filter(u=>u.alive).every(u=>changed[idx(u.x,u.z)]===1),'破壊済み橋には進入しない');
console.log('木橋崩落後の再経路探索 OK');
