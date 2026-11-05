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

// Occupancy is a dense lookup table but only the soldiers' active cells are
// cleared next tick. Empty map regions must not cost an O(map size) reset.
const sparse=new MassBattleGridSimulation(50,20261105,options);
assert.equal(sparse._occupancy[idx(20,20)],-1,'未使用マスは初期状態で空き');
sparse.step(.1);
assert.ok(sparse._occupiedTouched.length<500,
  '100人の現在位置・出発位置・予約先だけを次回初期化する');
const structure={id:'sparse-occupancy-structure',x:20,z:20,category:'structure',
  type:'building',team:-1,hp:100,maxHp:100,alive:true,blocking:true,
  mountedBy:null,expiresAt:Infinity};
sparse.objects.push(structure);
sparse.step(.1);
assert.equal(sparse._occupancy[idx(20,20)],-2,'建造物の衝突判定を保持する');
assert.ok(sparse._occupiedTouched.includes(idx(20,20)),'建造物のマスも次回初期化対象に含める');
sparse.actions.removeObject(structure);
sparse.step(.1);
assert.equal(sparse._occupancy[idx(20,20)],-1,'建造物消失後に透明な壁を残さない');
const millionWidth=1000,millionHeight=1000;
const million=new MassBattleGridSimulation(50,20261105,{
  width:millionWidth,height:millionHeight,
  walkable:new Uint8Array(millionWidth*millionHeight).fill(1),bridges,riverXAt:()=>116
});
million.step(.1);
assert.equal(million._occupancy.length,1000000,'100万マスも整数の衝突マップとして保持');
assert.ok(million._occupiedTouched.length<500,'100万マスでも初期化対象は100兵士の使用マスだけ');
console.log('100万マスでも占有セルのみ初期化・建造物消失後の衝突解除 OK');

for(const count of [50,100,200,1000]){
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
  console.log(`${count}対${count}: 橋限定ルート・建物回避・マス重複なし・攻撃${sim.attacks}回、橋通過${sim.crossings.join('/') }、渋滞${sim.units.filter(u=>u.alive&&u.action==='blocked').length}体 OK`);
}

const sim=new MassBattleGridSimulation(50,88,options);
const changed=walkable.slice();
const brokenCells=new Set();
for(let x=111;x<=121;x++){changed[idx(x,177)]=0;brokenCells.add(x+',177')}
sim.killAtCells(brokenCells);sim.updateWalkable(changed);
assert.equal(sim.activeBridges.length,1,'橋が壊れたら破壊済みの橋を進軍目標から除外する');
assert.ok(sim.flowEast[idx(136,177)]>0,'破壊済み木橋の東岸は到達目標のままにしない');
for(let tick=0;tick<600;tick++)sim.step(.1);
assert.ok(sim.units.filter(u=>u.alive).every(u=>changed[idx(u.x,u.z)]===1),'破壊済み橋には進入しない');
console.log('木橋崩落後の再経路探索 OK');

// Completely destroyed bridges cannot turn every survivor into an inert
// soldier. Ordinary troops regroup at a bank, ninjas run across the surface.
const riverWater=new Uint8Array(size*size);
for(let z=0;z<size;z++)for(let x=111;x<=121;x++)riverWater[idx(x,z)]=1;
const flood=new MassBattleGridSimulation(50,7829,{...options,water:riverWater});
const noBridges=walkable.slice();
for(let z=115;z<=117;z++)for(let x=111;x<=121;x++)noBridges[idx(x,z)]=0;
for(let x=111;x<=121;x++)noBridges[idx(x,177)]=0;
flood.updateWalkable(noBridges);
assert.equal(flood.activeBridges.length,0,'崩落した2本の橋はどちらも進軍先に残さない');
assert.ok(flood.flowEast[idx(106,50)]<0x3fffffff,'全橋崩落後も西岸の陣地に進む経路が残る');
const waterNinja=flood.units.find(u=>u.team===0&&u.jobId==='ninja');
const landSoldier=flood.units.find(u=>u.team===0&&u.jobId==='sword');
assert.ok(waterNinja&&landSoldier,'通常兵と忍者の両方をテストする');
for(const u of flood.units)if(u!==waterNinja&&u!==landSoldier){u.alive=false;}
waterNinja.x=waterNinja.fromX=106;waterNinja.z=waterNinja.fromZ=50;
waterNinja.moveElapsed=waterNinja.moveDuration=0;
landSoldier.x=landSoldier.fromX=104;landSoldier.z=landSoldier.fromZ=52;
landSoldier.moveElapsed=landSoldier.moveDuration=0;
let walkedWater=false;
for(let tick=0;tick<500;tick++){
  flood.step(.1);
  if(riverWater[idx(waterNinja.x,waterNinja.z)])walkedWater=true;
  assert.equal(riverWater[idx(landSoldier.x,landSoldier.z)],0,'一般兵は崩落した橋の水面に入らない');
  assert.notEqual(waterNinja.x+','+waterNinja.z,landSoldier.x+','+landSoldier.z,'忍者と一般兵も同じマスを占めない');
}
assert.ok(walkedWater,'忍者は水面のマスを実際に通過する');
assert.ok(waterNinja.x>121,'忍者は全橋崩落後でも川の対岸へ渡る');
assert.ok(landSoldier.x>104,'橋がない時も一般兵は岸へ移動する');
console.log('全橋崩落: 一般兵は岸に再配置・忍者は水面横断・マス重複なし OK');

const commander=new MassBattleGridSimulation(50,20261108,{...options,water:riverWater});
const initialOther=commander.units.find(u=>u.team===0&&u.squadId===1);
assert.ok(initialOther,'別部隊の兵士も存在する');
assert.equal(commander.setSquadDestination(0,92,116),true,'軍師は味方部隊に目標地を指定できる');
assert.equal(commander.squadFlows.size,1,'100人に個別A*を実行せず部隊で1つの共有フローを使う');
assert.equal(commander.setSquadDestination(0,116,60),false,'水面・崩落した橋は目的地に指定できない');
const ordered=commander.units.filter(u=>u.team===0&&u.squadId===0);
const averageDistance=()=>ordered.reduce((sum,u)=>sum+Math.abs(u.x-92)+Math.abs(u.z-116),0)/ordered.length;
const beforeOrder=averageDistance();
for(let tick=0;tick<270;tick++)commander.step(.1);
assert.ok(averageDistance()<beforeOrder,'目的地命令の部隊が指定区域へ前進する');
assert.ok(commander.units.filter(u=>u.alive).every(u=>commander._walkable(u.x,u.z,u.jobId)),'編成命令でも通行不能に入らない');
assert.equal(commander.setSquadCommand(0,'charge'),true,'部隊単位の突撃号令');
assert.equal(commander.squadDestinations.size,0,'突撃で古い目的地は解除される');
assert.equal(commander.setSquadCommand(0,'support'),true,'部隊単位の支援号令');
assert.equal(commander.squadCommands.get('0'),'support');
commander.clearSquadDestination(0);
assert.equal(commander.squadCommands.size,0,'部隊命令解除後は自動行動に戻る');
console.log('編成命令: 部隊の行先指定・突撃・支援・解除・共同フローの移動 OK');

// A fallen soldier freezes at the interpolated world position and owns a
// separate, smooth 0..1 death animation even if AI stops after the last kill.
const fall=new MassBattleGridSimulation(50,987,options);
fall.step(.1);
const moving=fall.units.find(u=>u.alive&&u.moveDuration>u.moveElapsed);
assert.ok(moving,'歩行中の兵士がいる');
// A tile is one adult step. All joints and garment vertices use the same
// phase, and animation speed is exactly tied to actual tile progress.
assert.equal(fall.getStepPhase(moving,0),0,'one-step walk begins in a neutral pose');
const progress=.5;
assert.ok(fall.getStepPhase(moving,progress)>0,'walking phase advances during tile interpolation');
assert.ok(fall.getStepPhase(moving,progress)<Math.PI,'a single tile may not skip a full step');
const before=fall.getRenderCell(moving);
fall.killAtCells(new Set([moving.x+','+moving.z]));
assert.equal(moving.alive,false);
assert.deepEqual(fall.getRenderCell(moving,.4),before,'転倒開始時に位置が飛ばない');
assert.equal(fall.getDeathProgress(moving),0,'転倒開始は0%');
fall.step(.2);fall.step(.2);
assert.ok(fall.getDeathProgress(moving)>.3&&fall.getDeathProgress(moving)<.7,'転倒姿勢は途中経過を持つ');
assert.equal(fall.getDeathProgress(moving,0,.5),1,'AI終了後も描画時間で転倒を完了する');
assert.equal(fall.getRenderCell(moving).x,before.x,'死体は移動しない');
console.log('全兵士の個別転倒補間・途中での位置固定・終了後のアニメーション継続 OK');

const stride=new MassBattleGridSimulation(50,271,options);
stride.step(.1);
const marcher=stride.units.find(u=>u.alive&&u.moveDuration>u.moveElapsed);
assert.ok(marcher,'a soldier begins a one-tile stride');
for(let tick=0;tick<100&&marcher.completedSteps===0;tick++)stride.step(.1);
assert.equal(marcher.completedSteps,1,'the first tile completes exactly one step');
assert.equal(stride.getStepPhase(marcher),Math.PI,'one tile corresponds to half a stride cycle');
console.log('1マス＝1歩、全身モーション位相の足運び同期 OK');
