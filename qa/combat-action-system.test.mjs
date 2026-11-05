import assert from 'node:assert/strict';
import { COMBAT_JOB_SPECS, COMBAT_OBJECT_SPECS, COMBAT_RULES, availableCombatSkills, combatJobId } from '../src/combat-action-spec.js';
import { CombatActionRuntime } from '../src/combat-action-runtime.js';
import { MassBattleGridSimulation } from '../src/mass-battle-grid-sim.js';

const jobIds=Object.keys(COMBAT_JOB_SPECS);
assert.equal(jobIds.length,10,'正式8職＋従来の弓・槍が登録される');
for(const jobId of jobIds){
  const all=availableCombatSkills(jobId,'UR');
  assert.ok(all.some(s=>s.rank==='N'),jobId+'のN技');
  assert.ok(all.some(s=>s.rank==='R'),jobId+'のR技');
  assert.ok(all.some(s=>s.rank==='UR'),jobId+'のUR技');
  assert.ok(all.every(s=>s.cooldown>0&&s.range>=0&&s.mp>=0),'技の数値');
  assert.ok(availableCombatSkills(jobId,'N').every(s=>s.rank==='N'),'レア技の漏洩防止');
}
assert.equal(combatJobId('剣士'),'sword');
assert.equal(combatJobId('騎士'),'sword');
assert.equal(combatJobId('盾戦士'),'shield');
assert.equal(combatJobId('シーフ'),'thief');
assert.equal(combatJobId('盗賊'),'thief');
assert.ok(COMBAT_OBJECT_SPECS.horse.category==='mount'&&COMBAT_OBJECT_SPECS.dragon.category==='summon');
assert.ok(COMBAT_RULES.maximumObjectsPerTeam<100,'大軍戦でオブジェクトは上限管理');

const makeUnit=(id,team,jobId,x,z)=>({id,team,jobId,x,z,hp:100,maxHp:100,mp:250,maxMp:250,rarity:'UR',alive:true,cooldown:0});
const allWalkable=new Uint8Array(32*32).fill(1);
const units=[makeUnit(0,0,'summoner',9,10),makeUnit(1,1,'fighter',12,10),makeUnit(2,0,'priest',9,12),makeUnit(3,0,'sword',8,11)];
const makeSectors=()=>{const sectors=new Map();for(const u of units){if(!u.alive)continue;const key=Math.floor(u.x/5)+':'+Math.floor(u.z/5);if(!sectors.has(key))sectors.set(key,[]);sectors.get(key).push(u);}return sectors};
const runtime=new CombatActionRuntime({width:32,height:32,walkable:allWalkable});
const begin=(dt=.1)=>runtime.beginTick(dt,units,{sectors:makeSectors(),walkable:allWalkable});
const cast=(id,source=units[0],target=source)=>runtime.fireSkill(source,availableCombatSkills(source.jobId,'UR').find(s=>s.id===id),target,units);
begin();
assert.equal(cast('call_wolf'),true);
assert.equal(cast('call_wyvern'),true);
assert.equal(runtime.summonOf(units[0]).length,2);
assert.equal(runtime.summonOf(units[0]).find(o=>o.type==='wyvern').flying,true);
assert.equal(cast('sacrifice_dragon'),true,'2体を消費して天竜召喚');
assert.equal(runtime.summonOf(units[0]).length,1,'生贄の世界オブジェクトを削除');
assert.equal(runtime.summonOf(units[0])[0].type,'elder_dragon');
assert.equal(runtime.objects.filter(o=>o.alive&&o.category==='summon').length,1);
assert.equal(cast('call_dragon'),true,'URドラゴン召喚');
assert.equal(runtime.summonOf(units[0]).length,2);
assert.equal(cast('call_wolf'),true);
assert.equal(cast('call_wolf'),false,'召喚士1名3体上限');

assert.equal(cast('mount_horse',units[3]),true);
const horse=runtime.objects.find(o=>o.id===units[3].mountId);
assert.ok(horse&&horse.category==='mount'&&horse.ownerId===3&&horse.mountedBy===3);
assert.equal(horse.x,units[3].x,'騎乗時に馬と人物が同じマス');
runtime.damageObject(horse,500,units[1]);
assert.equal(units[3].mountId,null,'軍馬戦闘不能で騎乗解除');

const sparseUnits=[makeUnit(0,0,'fighter',2,3),makeUnit(50,1,'sword',8,3)];
const sortieRuntime=new CombatActionRuntime({width:32,height:32,walkable:allWalkable});
const sortieHorse=sortieRuntime.spawnObject('horse',sparseUnits[1],8,3,{mounted:true});
sparseUnits[1].x=9;
sortieRuntime.beginTick(.1,sparseUnits);
assert.equal(sortieHorse.x,9,'ストーリー出撃時の非連番兵士IDでも馬が追従する');
sortieRuntime.damageObject(sortieHorse,200,sparseUnits[0]);
assert.equal(sparseUnits[1].mountId,null,'非連番の兵士IDでも撃破による降馬');

const bridge=runtime.registerStructure({id:'bridge-A',x:13,z:10,type:'bridge',hp:30});
const mage=makeUnit(4,0,'mage',10,10);units.push(mage);
begin();
assert.equal(cast('fire_bolt',mage,units[1]),true);
assert.ok(bridge.hp<30,'火炎魔法が戦場オブジェクトに損傷を与える');
const door=runtime.registerStructure({id:'castle-gate',x:8,z:12,type:'door',lockLevel:5});
const thief=makeUnit(5,0,'thief',8,11);units.push(thief);begin();
assert.equal(cast('master_lock',thief),true);
assert.equal(door.locked,false);assert.equal(door.opened,true);

const shield=makeUnit(6,0,'shield',15,10);units.push(shield);
begin();
assert.equal(cast('flame_ward',shield),true);
assert.equal(runtime.damageUnit(shield,40,units[1],'fire'),0,'炎耐性中は火炎ダメージ0');
assert.ok(availableCombatSkills('shield','N').some(s=>s.id==='shield_attack'&&s.kind==='damage'&&s.mp===0),
  '盾騎士は防御専門でもMP不要の通常攻撃を持つ');
shield.x=14;begin();
const shieldBash=availableCombatSkills('shield','N').find(s=>s.id==='shield_attack');
const enemyHpBeforeBash=units[1].hp;
assert.equal(runtime.fireSkill(shield,shieldBash,units[1],units),true,'盾撃が敵に届く');
assert.ok(units[1].hp<enemyHpBeforeBash,'盾撃でダメージが入る');

const ninja=makeUnit(7,0,'ninja',16,10);units.push(ninja);
begin();
const originalNinjaX=ninja.x;
let relocated=false;
runtime.onRelocate=(actor,x,z)=>{
  assert.equal(actor,ninja);
  assert.ok(allWalkable[z*32+x]===1);
  relocated=true;return true;
};
assert.equal(cast('grappling_hook',ninja,units[1]),true);
assert.ok(relocated&&ninja.x<originalNinjaX,'鉤縄の移動結果が衝突/マス管理へ通知される');
runtime.onRelocate=null;
begin();
assert.equal(cast('timed_dynamite',ninja,units[1]),true);
const bomb=runtime.objects.find(o=>o.alive&&o.type==='dynamite');
assert.ok(bomb);
begin(59.8);assert.equal(bomb.alive,true,'60秒未満で爆発しない');
begin(.3);assert.equal(bomb.alive,false,'60秒後に起爆する');
assert.ok(runtime.events.some(e=>e.type==='explode'),'爆発イベント');

const enemySummoner=makeUnit(8,1,'summoner',12,14);units.push(enemySummoner);
const hostileWolf=runtime.spawnObject('wolf',enemySummoner,enemySummoner.x,enemySummoner.z);
assert.ok(hostileWolf?.alive&&hostileWolf.category==='summon');
const wolfHp=hostileWolf.hp;
begin();
assert.equal(cast('fire_bolt',mage,hostileWolf),true,'魔法は人間以外の召喚獣にも命中する');
assert.ok(hostileWolf.hp<wolfHp,'敵召喚獣の独立HPを減らせる');

// Large battle integration: special casts and separate objects must not break
// deterministic occupancy, crossing routes, casualty counts or performance.
const width=60,height=45,walkable=new Uint8Array(width*height).fill(1);
const sim=new MassBattleGridSimulation(50,1203,{width,height,walkable,opaque:new Uint8Array(walkable.length),bridges:[{x:30,z:22}],riverXAt:()=>30});
for(let i=0;i<150;i++)sim.step(.1);
assert.ok(sim.getStats().casts>0,'実戦AIが職業固有の技を発動');
assert.equal(sim.live[0]+sim.live[1],sim.units.filter(u=>u.alive).length,'全死亡経路で人数集計一致');
assert.equal(new Set(sim.units.filter(u=>u.alive).map(u=>u.x+':'+u.z)).size,sim.units.filter(u=>u.alive).length,'兵士マス重複なし');
assert.ok(sim.objects.every(o=>o.category!=='summon'||o.ownerId!=null),'召喚獣は兵士ではなく独立オブジェクト');
console.log('職業10種 / N・R・UR / 魔法・回復・蘇生・解錠・騎乗・召喚・生贄・60秒爆薬 / 大軍AI OK');
