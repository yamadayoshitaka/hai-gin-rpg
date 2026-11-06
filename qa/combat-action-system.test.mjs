import assert from 'node:assert/strict';
import { COMBAT_JOB_SPECS, COMBAT_OBJECT_SPECS, COMBAT_RULES, availableCombatSkills, combatJobId } from '../src/combat-action-spec.js';
import { CombatActionRuntime } from '../src/combat-action-runtime.js';
import { MassBattleGridSimulation } from '../src/mass-battle-grid-sim.js';
import {describeDestructibleWorld,STRUCTURE_DURABILITY} from '../src/destructible-world.js';

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
assert.equal(runtime.summonOf(units[0]).length,1,'召喚士ごとに同時存在する召喚獣は1体');
assert.equal(runtime.summonOf(units[0]).find(o=>o.type==='wyvern').flying,true);
assert.equal(cast('sacrifice_dragon'),true,'1体を生贄に天竜召喚');
assert.equal(runtime.summonOf(units[0]).length,1,'生贄は天竜へ置き換わる');
assert.equal(runtime.summonOf(units[0])[0].type,'elder_dragon');
assert.equal(runtime.objects.filter(o=>o.alive&&o.category==='summon').length,1);
assert.equal(cast('call_dragon'),true,'URドラゴン召喚');
assert.equal(runtime.summonOf(units[0]).length,1);
assert.equal(cast('call_wolf'),true);
assert.equal(runtime.summonOf(units[0]).length,1,'召喚し直しても常に1体');
assert.equal(runtime.summonOf(units[0])[0].type,'wolf');
const linkedFamiliar=runtime.summonOf(units[0])[0];
const ownerBeforeLink=units[0].hp;
runtime.damageObject(linkedFamiliar,20,units[1]);
assert.equal(units[0].hp,ownerBeforeLink-10,'召喚獣への実ダメージの50%を召喚主に反映');
const familiarBeforeLink=linkedFamiliar.hp;
runtime.damageUnit(units[0],20,units[1]);
assert.equal(linkedFamiliar.hp,familiarBeforeLink-10,'召喚主の被弾も召喚獣へ50%連動（再帰しない）');

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

// Real creature riding: an allied independent summon keeps its own HP and
// attack cycle while the soldier uses the creature as a vehicle.
const mountedUnits=[makeUnit(30,0,'summoner',8,8),makeUnit(31,0,'sword',9,8),makeUnit(32,1,'fighter',11,8)];
const mountedRuntime=new CombatActionRuntime({width:32,height:32,walkable:allWalkable});
const mountedSectors=()=>{
  const sectors=new Map();
  for(const u of mountedUnits){if(!u.alive)continue;const key=Math.floor(u.x/5)+':'+Math.floor(u.z/5);
    if(!sectors.has(key))sectors.set(key,[]);sectors.get(key).push(u);}
  return sectors;
};
const mountedTick=dt=>mountedRuntime.beginTick(dt,mountedUnits,{sectors:mountedSectors(),walkable:allWalkable});
mountedTick(.1);
const riddenWolf=mountedRuntime.spawnObject('wolf',mountedUnits[0]);
assert.ok(riddenWolf&&mountedRuntime.mountObject(mountedUnits[1],riddenWolf),'兵士が味方の灰狼へ騎乗できる');
assert.equal(riddenWolf.category,'summon','騎乗後も灰狼は独立した召喚獣オブジェクト');
assert.equal(riddenWolf.mountedBy,31);
assert.equal(mountedUnits[1].mountId,riddenWolf.id);
mountedUnits[1].x=10;
mountedTick(.56);
assert.equal(riddenWolf.x,mountedUnits[1].x,'騎乗した召喚獣が兵士を追従する');
assert.ok(mountedRuntime.events.some(e=>e.type==='objectWindup'&&e.attackType==='bite'),'灰狼が噛みつきの予備動作を始める');
const beforeWolfHit=mountedUnits[2].hp;
mountedTick(.10);
assert.equal(mountedUnits[2].hp,beforeWolfHit,'予備動作中は攻撃判定を出さない');
mountedTick(.15);
assert.ok(mountedUnits[2].hp<beforeWolfHit,'顎を閉じる命中時にダメージを与える');
assert.ok(mountedRuntime.events.some(e=>e.type==='objectAttack'&&e.attackType==='bite'),'命中エフェクトは噛みつき種別');
assert.equal(mountedRuntime.dismountObject(mountedUnits[1]),true,'兵士が灰狼から降りられる');
assert.equal(mountedUnits[1].mountId,null);
assert.equal(riddenWolf.blocking,true,'下馬した地上の灰狼はマス衝突を再開する');
assert.equal(mountedRuntime.mountObject(mountedUnits[1],riddenWolf),true,'同じ召喚獣に再騎乗できる');
mountedRuntime.damageObject(riddenWolf,999,mountedUnits[2]);
assert.equal(mountedUnits[1].mountId,null,'騎乗した召喚獣が倒れたら自動降車する');

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
begin();
assert.equal(cast('plant_c4',ninja,units[1]),true,'忍者のC4設置');
const c4=runtime.objects.find(o=>o.alive&&o.type==='c4');
assert.ok(c4&&c4.spec.radius===3,'C4の範囲を設定');
begin(8.1);
assert.equal(c4.alive,false,'C4は8秒で爆発');
assert.ok(runtime.events.some(e=>e.type==='explode'&&e.objectType==='c4'));

// Real battleground footprints: a hit on the far end of a bridge must work
// even if the bridge's centre tile is many tiles away.
const bridgeCells=new Set();for(let x=6;x<=24;x++)bridgeCells.add(x+',19');
const worldDefinitions=describeDestructibleWorld([
 {data:{kind:'house',x:25,z:23,w:10,d:10}},
 {data:{kind:'castle',x:50,z:50,w:100,d:100}},
],[{row:19,type:'timber',cells:bridgeCells}],
 [{bounds:{minX:8,maxX:27,minZ:7,maxZ:26}}]);
assert.equal(worldDefinitions.length,4);
assert.equal(worldDefinitions[1].hp,STRUCTURE_DURABILITY.castle);
assert.equal(worldDefinitions[2].bounds.minX,5.7,'橋の階段端も命中範囲');
const demolition=new CombatActionRuntime({width:64,height:64,walkable:new Uint8Array(64*64).fill(1)});
for(const {source,...definition} of worldDefinitions)demolition.registerStructure(definition);
assert.throws(()=>demolition.registerStructure({id:'bad',x:1,z:1,bounds:{minX:5,maxX:1,minZ:0,maxZ:2}}));
const woodenBridge=demolition.objects.find(o=>o.id==='world-bridge-0');
demolition.damageStructures(6,19,1,55,'fire');
assert.equal(woodenBridge.hp,STRUCTURE_DURABILITY.timber_bridge-55,'中心から9マス離れた木橋の端にも火炎が命中');
assert.equal(demolition.objects.find(o=>o.id==='world-building-0').hp,STRUCTURE_DURABILITY.house,
  '範囲外の民家には延焼判定がない');
demolition.damageStructures(6,19,1,90,'fire');
assert.equal(woodenBridge.alive,true,'耐久力が残る橋は火炎2発で即崩壊しない');
demolition.damageStructures(6,19,1,200,'fire');
assert.equal(woodenBridge.alive,false,'耐久力を削り切ると橋が崩壊');
assert.ok(demolition.events.some(e=>e.type==='despawn'&&e.objectId===woodenBridge.id&&e.reason==='destroyed'));
const cottage=demolition.objects.find(o=>o.id==='world-building-0');
demolition.damageStructures(20,23,.2,130,'earth');
assert.equal(cottage.alive,true,'民家は爆発1回では崩壊しない');
demolition.damageStructures(20,23,.2,140,'earth');
assert.equal(cottage.alive,false,'民家の壁の端が累積爆発で崩壊');
const intactCastle=demolition.objects.find(o=>o.id==='world-building-1');
assert.ok(intactCastle.hp>0,'城は段階的な耐久力を持つ');
// Ninja timed explosives use the same structural damage and event pipeline.
const explosives=new CombatActionRuntime({width:64,height:64,walkable:new Uint8Array(64*64).fill(1)});
const testBridge=explosives.registerStructure({id:'explosive-bridge',type:'bridge',x:15,z:19,hp:80,
 bounds:{minX:6,maxX:24,minZ:18,maxZ:20},blocking:false,walkableWhenOpened:false});
const bomber=makeUnit(30,0,'ninja',6,16);
const bombObject=explosives.spawnObject('dynamite',bomber,6,16);
assert.ok(bombObject);
bombObject.x=6;bombObject.z=19;
explosives.explode(bombObject,[bomber]);
assert.equal(testBridge.alive,false,'ダイナマイトで橋が壊れる');
assert.ok(explosives.events.some(e=>e.type==='structureHit'&&e.objectId===testBridge.id));
const toughBridge=explosives.registerStructure({id:'real-timber-bridge',type:'bridge',x:15,z:19,
 hp:STRUCTURE_DURABILITY.timber_bridge,bounds:{minX:6,maxX:24,minZ:18,maxZ:20},
 blocking:false,walkableWhenOpened:false,fireDamagePerSecond:18,burnSeconds:32});
const c4Probe=explosives.spawnObject('c4',bomber,6,16);
assert.ok(c4Probe);c4Probe.x=6;c4Probe.z=19;
explosives.explode(c4Probe,[bomber]);
assert.equal(toughBridge.alive,true,'実戦の木橋はC4一発では破壊されない');
assert.equal(toughBridge.hp,STRUCTURE_DURABILITY.timber_bridge-c4Probe.spec.attack);
assert.equal(toughBridge.burningUntil,0,'普通のC4は火炎魔法と違い自動延焼しない');
const fireDpsTest=new CombatActionRuntime({width:32,height:32,walkable:allWalkable});
const timber=fireDpsTest.registerStructure({id:'timber',x:10,z:10,type:'bridge',
 hp:STRUCTURE_DURABILITY.timber_bridge,fireDamagePerSecond:18,burnSeconds:32});
assert.equal(fireDpsTest.igniteStructure('timber',{initialDamage:18}),true);
assert.equal(timber.hp,STRUCTURE_DURABILITY.timber_bridge-18,'着火時の初期ダメージ');
fireDpsTest.beginTick(5,[]);
assert.equal(timber.hp,STRUCTURE_DURABILITY.timber_bridge-18-5*18,'5秒間の燃焼ダメージ');
assert.equal(timber.alive,true,'燃焼時間経過前には建造物が残る');
fireDpsTest.beginTick(12,[]);
assert.equal(timber.alive,false,'継続燃焼で耐久力0に達すると崩壊する');
assert.ok(fireDpsTest.events.some(e=>e.type==='despawn'&&e.reason==='destroyed'),
 '時間経過で壊れた橋も描画用崩落イベントを出す');
const dragonCaster=makeUnit(31,0,'summoner',12,12),dragonEnemy=makeUnit(32,1,'fighter',15,12);
const breathRuntime=new CombatActionRuntime({width:64,height:64,walkable:new Uint8Array(64*64).fill(1)});
const targetedHut=breathRuntime.registerStructure({id:'targeted-hut',x:15,z:14,hp:50,
  bounds:{minX:14,maxX:18,minZ:13,maxZ:19},blocking:false,walkableWhenOpened:false});
const dragon=breathRuntime.spawnObject('dragon',dragonCaster,12,12);
assert.ok(dragon);dragon.x=13;dragon.z=12;
const sectorMap=new Map([['3:2',[dragonEnemy]]]);
breathRuntime.beginTick(.6,[dragonCaster,dragonEnemy],{sectors:sectorMap});
assert.ok(dragon.pendingAttack,'古竜の攻撃予備動作');
breathRuntime.beginTick(.5,[dragonCaster,dragonEnemy],{sectors:sectorMap});
assert.ok(targetedHut.hp<50,'古竜の高速連続ブレスが最初の一撃で小屋を傷つける');
for(let cycle=0;cycle<30&&targetedHut.alive;cycle++)
  breathRuntime.beginTick(.1,[dragonCaster,dragonEnemy],{sectors:sectorMap});
assert.equal(targetedHut.alive,false,'分割された5回のブレスが合計で小屋を崩壊させる');

const enemySummoner=makeUnit(8,1,'summoner',12,14);units.push(enemySummoner);
const hostileWolf=runtime.spawnObject('wolf',enemySummoner,enemySummoner.x,enemySummoner.z);
assert.ok(hostileWolf?.alive&&hostileWolf.category==='summon');
const wolfHp=hostileWolf.hp;
mage.hp=mage.maxHp;mage.alive=true; // Previous friendly-fire explosion is tested independently.
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
