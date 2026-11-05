import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {SQUAD_TYPES,SQUAD_TYPE_NAMES,createSquadFormationPlan,squadTypeOf} from '../src/mass-battle-formations.js';

assert.deepEqual(SQUAD_TYPES,['attack','balanced','ranged','support']);
assert.deepEqual(Object.values(SQUAD_TYPE_NAMES),['攻撃','バランス','遠距離','支援']);
const plans=createSquadFormationPlan(1000,3);
assert.equal(plans.length,10,'千人を10個の隊列にまとめる');
assert.deepEqual(plans.slice(0,4).map(p=>p.type),SQUAD_TYPES);
assert.ok(plans[3].advanceDepth>plans[2].advanceDepth&&plans[2].advanceDepth>plans[0].advanceDepth,
  '支援は最後方、遠距離は前衛より後ろに置く');
assert.ok(plans.every(p=>p.slots.length===p.count&&p.slots.every(slot=>Number.isFinite(slot.forward)&&Number.isFinite(slot.lateral))));
assert.equal(new Set(plans[0].slots.map(slot=>slot.row+':'+slot.col)).size,100,
  '各隊列の100人は別の持ち場を持つ');
assert.equal(squadTypeOf(7),'support');

const size=232,walkable=new Uint8Array(size*size).fill(1);
const bridges=[{x:116,z:55,type:'stone'},{x:116,z:116,type:'stone'},{x:116,z:177,type:'timber'}];
const sim=new MassBattleGridSimulation(1000,4223,{
  width:size,height:size,walkable,bridges,riverXAt:()=>116
});
const allies=sim.units.filter(u=>u.team===0);
assert.equal(new Set(sim.units.map(u=>u.x+','+u.z)).size,2000,'両軍の隊列が衝突していない');
const byType=type=>allies.filter(u=>u.formationType===type);
assert.equal(byType('attack').length,300);
assert.equal(byType('support').length,200);
assert.ok(byType('support').filter(u=>u.jobId==='priest').length>byType('support').length/5,
  '支援部隊は僧侶を厚く編成する');
assert.ok(byType('ranged').every(u=>['archer','mage','summoner','priest','lancer'].includes(u.jobId)),
  '遠距離部隊の職業構成を守る');
for(const squadId of [0,1,2,3,4,5,6,7,8,9]){
  const members=allies.filter(u=>u.squadId===squadId);
  assert.equal(new Set(members.map(u=>u.bridgeIndex)).size,1,
    '同じ部隊を複数の橋へ分散させない');
  assert.ok(members.every(u=>u.formationType===squadTypeOf(squadId)));
}
const meanDepth=type=>{
 const us=byType(type);return us.reduce((sum,u)=>sum+(116-u.x),0)/us.length;
};
assert.ok(meanDepth('support')>meanDepth('ranged')&&meanDepth('ranged')>meanDepth('attack'),
  '支援は最後方・遠距離は後衛・攻撃は前衛に初期配置される');
for(let tick=0;tick<45;tick++)sim.step(.1);
assert.ok(meanDepth('support')>meanDepth('ranged')&&meanDepth('ranged')>meanDepth('attack'),
  '進軍開始後も支援・遠距離・攻撃の前後関係を保つ');
assert.equal(new Set(sim.units.filter(u=>u.alive).map(u=>u.x+','+u.z)).size,
  sim.units.filter(u=>u.alive).length,'隊列進軍中も1マス1人を維持する');
assert.ok(sim.units.every(u=>Number.isFinite(u.x)&&Number.isFinite(u.z)));

const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(battle,/squadKey\(1,id\),makeSquadLabel\(id,1\)/,
  '敵軍にも個別の赤い隊列ラベルを用意する');
assert.match(battle,/team===0\?'#78dcff':'#ff6e78'/,
  '味方は青、敵は赤');
assert.match(battle,/a\.squadId=u\.squadId/,
  '詳細モデルだけが別の部隊番号になる不具合を防ぐ');
console.log('前衛・中衛・遠距離・最後方の4編成、部隊隊列、敵味方識別、橋と衝突の回帰 OK');
