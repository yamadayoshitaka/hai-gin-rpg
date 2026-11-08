import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formatSquadIntent} from '../src/battle-squad-intent.js';
import {createMassHighGroundRoutes} from '../src/mass-battle-highground.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {massCombatEffectBudget,massAttackVariant} from '../src/mass-battle-vfx-policy.js';

const names={balanced:'自動',charge:'突撃',defend:'守備',hold:'待機',retreat:'退却'};
for(const [mode,name] of Object.entries(names)){
  const result=formatSquadIntent({mode,strategy:'eliminate'});
  assert.equal(result.order,'号令：'+name,'全画面共通の号令名 '+mode);
  assert.match(result.purpose,/作戦：全滅/,'号令とは別の固定作戦を情報として残す');
  assert.doesNotMatch(result.order,/均衡|進撃|防御|後退/,'旧号令名を撤廃');
}
assert.equal(formatSquadIntent({team:1}).order,'号令：自動戦闘',
  '敵AIはプレイヤーが命令できる部隊と区別する');
const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/order\.textContent='自動'/,'味方隊列ラベルも自動表示');
assert.match(game,/instant\('⚔ 突撃','charge'\)/);
assert.match(game,/instant\('🛡 守備','defend'\)/);
assert.match(game,/instant\('⏸ 待機','hold'\)/);
assert.match(game,/instant\('↘ 退却','retreat'\)/);

// A real first-floor room is reachable ONLY through its passable wall opening.
// No camera/animation shortcut is allowed to put 2000 soldiers through walls.
const size=232,cellSize=2.2;
const grid=new Uint8Array(size*size).fill(1);
const index=(x,z)=>z*size+x;
const {x:cx,z:cz,w,d}={x:91,z:91,w:12,d:12};
for(let x=cx-w/2;x<=cx+w/2;x++)for(let z=cz-d/2;z<=cz+d/2;z++)
 if(x===cx-w/2||x===cx+w/2||z===cz-d/2||z===cz+d/2)grid[index(x,z)]=0;
const entrance={x:cx,z:cz+d/2};grid[index(entrance.x,entrance.z)]=1;
const building={data:{x:cx,z:cz,w,d},model:{position:{x:(cx-6)*cellSize,y:0,z:(cz-6)*cellSize}},
 structure:{id:'town_house_001',floors:[{height:5,baseY:0}]}};
const kwargs={cellSize,offset:6,passable:grid,terrainY:()=>0,maxBuildings:2};
const routes=createMassHighGroundRoutes([building],kwargs);
const indoor=routes.find(r=>r.kind==='interior');
assert.ok(indoor,'大軍に1階の部屋と実際の出入口を提供する');
assert.equal(indoor.level,1);
assert.equal(indoor.team,0);
assert.ok(indoor.access.x>cx-w/2&&indoor.access.x<cx+w/2);
assert.ok(indoor.access.z>cz-d/2&&indoor.access.z<cz+d/2);
const cells=indoor.points.map(p=>({x:Math.round(p.x/cellSize+6),z:Math.round(p.z/cellSize+6)}));
assert.equal(cells[0].z,cz+d/2+2,'部屋外から進入する');
for(let i=1;i<cells.length;i++){
 const before=cells[i-1],next=cells[i];
 assert.ok(grid[index(next.x,next.z)]===1,'必ず歩行可能な床を通る');
 assert.ok(Math.max(Math.abs(before.x-next.x),Math.abs(before.z-next.z))<=1,
   '通常の斜め/直進1マスずつ移動する');
}
const blocked=grid.slice();blocked[index(entrance.x,entrance.z)]=0;
assert.ok(!createMassHighGroundRoutes([building],{...kwargs,passable:blocked})
 .some(r=>r.kind==='interior'),'施錠・閉鎖した唯一の入口を透過して入室しない');

const sim=new MassBattleGridSimulation(50,20261109,{
 width:size,height:size,walkable:grid,bridges:[],riverXAt:()=>116
});
sim.configureHighGroundRoutes([indoor]);
const scout=sim.units.find(u=>u.team===0&&['sword','thief','fighter','shield'].includes(u.jobId)&&!u.isStrategist);
assert.ok(scout);
for(const unit of sim.units)if(unit!==scout)unit.alive=false;
scout.x=scout.fromX=cx;scout.z=scout.fromZ=cz+d/2+2;
scout.moveDuration=0;scout.moveElapsed=0;scout.cooldown=3;
sim._assignHighGroundUnits();
assert.equal(scout.highGroundRouteIndex,0,'歩行ルートに兵士を選抜');
let entered=false;
for(let i=0;i<300;i++){
 sim.step(.1);
 if(scout.highGroundPhase===2){entered=true;break;}
}
assert.ok(entered,'大軍兵士が実際の歩行・衝突判定で1階の室内へ入る');
assert.equal(scout.highGroundFloor,1);
assert.deepEqual({x:scout.x,z:scout.z},indoor.access,
 'アイテム取得にも使用するauthoritative位置が実際に室内になる');
assert.equal(grid[index(scout.x,scout.z)],1);

// VFX increases under the 49 FPS / 26ms visual budget from the screenshot,
// while it scales down automatically if a phone becomes overloaded.
const normal=massCombatEffectBudget(1000,26);
const slow=massCombatEffectBudget(1000,46);
assert.ok(normal.hits>12&&normal.bursts>9&&normal.magic>3,
 '従来12/9/3個の大軍エフェクト表示制限を解除');
assert.ok(slow.hits<normal.hits&&slow.bursts<normal.bursts,
 '負荷が上がったときはGPU表示件数を自動で減らす');
const variants=new Set(Array.from({length:15},(_,i)=>massAttackVariant({id:i,completedSteps:22})));
assert.deepEqual([...variants].sort(),[0,1,2]);
const gpu=readFileSync(new URL('../src/mass-battle-real-army.js',import.meta.url),'utf8');
assert.match(gpu,/vec3 strikePose = strikeVariant/,'同じ7頭身装備リグの攻撃ポーズを3通りに変える');
assert.match(gpu,/massAttackVariant\(u\)\*100/,'各兵士のバリエーションをGPUへ送る');
assert.match(game,/crowdBursts<massFxBudget\.bursts/,'実戦闘のGPUエフェクト量を増やす');
assert.match(game,/massFxBudget\.hits/,'確定命中エフェクトも増やす');
assert.match(game,/groundFloorIndoors:/,'室内移動の実測状態を公開する');
console.log('PASS: unified squad orders, real door-only first floor entry, 3 attack silhouettes and adaptive 1000v1000 effects');
