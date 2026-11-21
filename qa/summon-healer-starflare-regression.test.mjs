import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {CombatActionRuntime} from '../src/combat-action-runtime.js';
import {COMBAT_OBJECT_SPECS} from '../src/combat-action-spec.js';
import {combatEffectDirective} from '../src/combat-effect-directives.js';
import {CREATURE_PERFORMANCE} from '../src/combat-creature-performance.js';
import {SUMMON_BATTLE_DOCTRINE_REVISION,SUMMON_SUPPORT_PROFILES,
 DRAGON_LORD_STARFLARE,selectSummonHealTarget,selectSummonReviveTarget}
 from '../src/summon-battle-doctrine.js';
import {applySummonHumanoidPBR}
 from '../src/summon-humanoid-pbr.js';

const actor=(id,team,x,z,hp=120)=>({id,team,x,z,hp,maxHp:120,
 alive:hp>0,squadId:team?'enemy':'ally',mp:150,maxMp:150,
 jobId:'summoner',rarity:'UR',cooldown:0});
const runtime=()=>new CombatActionRuntime({
 width:72,height:72,walkable:new Uint8Array(72*72).fill(1)
});
const sectors=units=>{
 const out=new Map();
 for(const u of units.filter(u=>u.alive&&u.hp>0)){
  const key=Math.floor(u.x/5)+':'+Math.floor(u.z/5);
  if(!out.has(key))out.set(key,[]);
  out.get(key).push(u);
 }
 return out;
};
const tick=(sim,dt,units)=>sim.beginTick(dt,units,{sectors:sectors(units)});
test('R forest spirit prioritizes group healing over arrow damage but can still fight',()=>{
 const sim=runtime(),owner=actor(1,0,8,8),ally=actor(2,0,10,8,18),
  ally2=actor(3,0,11,9,46),enemy=actor(4,1,14,8,120);
 const units=[owner,ally,ally2,enemy];
 tick(sim,.1,units);
 const o=sim.spawnObject('forest_archer',owner);assert.ok(o);
 const baseline=enemy.hp;
 tick(sim,.1,units);
 assert.ok(ally.hp>18,'forest healer must restore real unit HP');
 assert.ok(ally2.hp>46,'second ally within grove receives actual group heal');
 assert.equal(enemy.hp,baseline,'healing occurs before attack scheduling');
 assert.equal(o.poseAction,'special');
 assert.equal(o.pendingAttack,null);
 const heal=sim.events.find(e=>e.skillId==='forest_rejuvenation');
 assert.ok(heal&&heal.heal>0&&heal.skillKind==='heal');
 assert.equal(combatEffectDirective(heal).kind,'healArea');
 assert.ok(SUMMON_SUPPORT_PROFILES.forest_archer.heal>=20);
 for(let i=0;i<50&&enemy.hp===baseline;i++)tick(sim,.1,units);
 assert.ok(enemy.hp<baseline,'forest spirit retains meaningful ranged offense');
});
test('UR angel heals, revives before attacking, does not revive enemy',()=>{
 const sim=runtime(),owner=actor(1,0,8,8),
  wounded=actor(2,0,10,8,15),enemy=actor(3,1,12,8,120),
  fallen=actor(4,0,9,9,0),deadEnemy=actor(5,1,9,10,0);
 const units=[owner,wounded,enemy,fallen,deadEnemy];
 tick(sim,.1,units);
 const o=sim.spawnObject('seraph_guardian',owner);assert.ok(o);
 tick(sim,.1,units);
 assert.ok(wounded.hp>15,'angel heals rather than stands still');
 const heal=sim.events.find(e=>e.skillId==='seraph_blessing');
 assert.ok(heal);
 assert.equal(heal.heal,SUMMON_SUPPORT_PROFILES.seraph_guardian.heal);
 assert.equal(enemy.hp,120,'angel prioritises urgent support');
 // Angel revival comes from live simulation, not a cosmetic particle.
 tick(sim,7.1,units);
 assert.equal(fallen.alive,true);
 assert.ok(fallen.hp>=Math.ceil(fallen.maxHp*.45));
 assert.equal(deadEnemy.alive,false,'must never revive the opposing team');
 assert.ok(sim.events.some(e=>e.type==='revive'&&e.skillId==='seraph_resurrection'));
 assert.equal(o.poseAction,'special');
});
test('Dragon Lord ultimate is a timed, real AoE with distinct arcane visuals',()=>{
 const sim=runtime(),owner=actor(1,0,8,8),
 enemy=actor(2,1,13,8,400),enemy2=actor(3,1,15,9,400),
 farEnemy=actor(4,1,27,8,400),ally=actor(5,0,13,9,400);
 for(const u of [enemy,enemy2,farEnemy,ally])u.maxHp=400;
 const units=[owner,enemy,enemy2,farEnemy,ally];
 tick(sim,.1,units);
 const o=sim.spawnObject('dragon_lord',owner);
 assert.ok(o);
 tick(sim,8.05,units);
 assert.equal(o.pendingAttack?.kind,'royal_starflare','charged special must be queued');
 assert.ok(sim.events.some(e=>e.type==='objectWindup'&&
   e.attackType==='royal_starflare'));
 assert.equal(enemy.hp,400,'no damage before the real delayed impact');
 tick(sim,DRAGON_LORD_STARFLARE.windup+.01,units);
 assert.ok(enemy.hp<400&&enemy2.hp<400,
  'real radius attack damages multiple enemy soldiers');
 assert.equal(farEnemy.hp,400,'no phantom damage outside the radius');
 assert.equal(ally.hp,400,'friendly fire disabled');
 const blast=sim.events.find(e=>e.type==='objectAttack'&&
   e.attackType==='royal_starflare');
 assert.ok(blast&&blast.hitCount>=2);
 assert.equal(blast.sourceSkill,'dragon_lord_starflare');
 assert.equal(blast.skillName,'星滅の大焔');
 const fx=combatEffectDirective(blast);
 assert.deepEqual(fx,{kind:'area',element:'arcane',radius:6});
 assert.equal(CREATURE_PERFORMANCE.dragon_lord.ultimate,'royal_starflare');
 assert.ok(o.nextStarflareAt>sim.time-DRAGON_LORD_STARFLARE.cooldown);
});
test('summon support policies do not heal healthy people or foreign armies',()=>{
 const o={type:'forest_archer',team:0,x:5,z:6};
 assert.equal(selectSummonHealTarget([
  actor(1,0,5,7,120),actor(2,1,6,6,20)],o),null);
 assert.equal(selectSummonHealTarget([actor(3,0,6,7,24)],o).id,3);
 assert.equal(selectSummonReviveTarget([actor(4,0,6,7,0)],o),null,
  'forest resurrection requires angel, not archer');
 assert.equal(selectSummonReviveTarget([actor(5,1,6,7,0)],{
  ...o,type:'seraph_guardian'}),null);
 assert.ok(SUMMON_BATTLE_DOCTRINE_REVISION.includes('support-first'));
 assert.equal(COMBAT_OBJECT_SPECS.forest_archer.attack,45);
 assert.equal(COMBAT_OBJECT_SPECS.seraph_guardian.attack,36);
 assert.equal(COMBAT_OBJECT_SPECS.dragon_lord.attack,125);
});
test('battle summon angel wing is real feather PBR, not photographed linen',()=>{
 const mat=new THREE.MeshStandardMaterial({vertexColors:true});
 assert.ok(applySummonHumanoidPBR(mat,{
  id:'seraph_guardian',role:'seraphWing',detail:'high'
 }));
 assert.equal(mat.userData.summonSurfaceKind,'feather');
 assert.ok(mat.map?.isDataTexture&&mat.normalMap?.isDataTexture);
 assert.ok(mat.roughnessMap?.isDataTexture);
 const src=readFileSync(new URL('../src/combat-world-object-renderer.js',
 import.meta.url),'utf8');
 assert.match(src,/applySummonHumanoidPBR\(wingMaterial/);
 assert.doesNotMatch(src,/photos\.get\('\.\.\/assets\/textures\/outfits\/linen\.jpg'/);
 assert.match(src,/type==='seraph_guardian'&&detail==='high'/);
 mat.dispose();
});
