import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {makeBattleRpgStatusRows} from '../src/battle-rpg-squad-source.js';
import {battleJobPortrait,JOB_PORTRAIT_FILES} from '../src/battle-job-portraits.js';
import {rpgHudHealth,rpgHudStatus,rpgHudCompactText,rpgHudIcon,rpgHudEffectIcon,rpgHudStateIcon} from '../src/battle-rpg-squad-hud.js';

test('actual ally/enemy HP and job IDs survive into RPG panels with matching camera keys',()=>{
 const units=[
  {team:0,squadId:'2',maxHp:100},{team:0,squadId:'2',maxHp:100},
  {team:1,squadId:'7',maxHp:120},{team:1,squadId:'7',maxHp:120}
 ];
 const sums=new Map([
  ['0:2',{n:1,total:2,hp:55,maxHp:100,x:80,z:90}],
  ['1:7',{n:1,total:2,hp:85,maxHp:120,x:86,z:92}]
 ]);
 const rows=makeBattleRpgStatusRows({sums,units,allyIds:['2'],enemyIds:['7'],
  getJob:(id,team)=>team?'弓使い':'魔法使い',getMode:()=> 'charge'});
 assert.equal(rows.length,2);
 assert.deepEqual(rows.map(r=>[r.team,r.id,r.name,r.hp,r.maxHp,r.alive,r.total]),[
  [0,'2','第1隊 魔法使い',55,200,1,2],
  [1,'7','第1隊 弓使い',85,240,1,2]
 ]);
 assert.equal(rows[0].inContact,true);
 assert.equal(rows[1].inContact,true);
 assert.equal(rpgHudHealth(55,200),28);
 assert.match(rpgHudCompactText(rows[1]),/交戦中/);
 assert.equal(rpgHudIcon('魔法使い'),'✦');
});
test('effects are never invented and actual timers are presented in combat seconds',()=>{
 const sums=new Map([
  ['0:a',{n:1,total:1,hp:90,maxHp:100,x:20,z:20}],
  ['1:b',{n:1,total:1,hp:60,maxHp:100,x:80,z:80}]
 ]);
 const rows=makeBattleRpgStatusRows({
  sums,units:[{team:0,squadId:'a',maxHp:100},{team:1,squadId:'b',maxHp:100}],
  allyIds:['a'],enemyIds:['b'],now:10,simTime:25,mass:true,
  getJob:()=> '剣士',getMode:()=> 'hold',
  itemTypes:{war_banner:{id:'war_banner',attack:.2}},
  auras:new Map([['a:war_banner',{until:30}],['a:old',{until:1}]]),
  massDebuffs:new Map([['1:b',{defense:.18,speed:.25,until:35}]])
 });
 assert.deepEqual(rows[0].effects,[{kind:'buff',label:'攻↑20%',seconds:20}]);
 assert.deepEqual(rows[1].effects,[
  {kind:'debuff',label:'防↓18%',seconds:10},
  {kind:'debuff',label:'速↓25%',seconds:10}
 ]);
 assert.equal(rpgHudStatus({...rows[0],alive:0}),'☠ 全滅');
 assert.equal(rpgHudStatus({alive:1,total:10,hp:10,maxHp:100}),'🆘 壊滅寸前');
 assert.equal(rpgHudStatus({alive:10,total:10,hp:100,maxHp:100,mode:'move'}),'➤ 移動中');
});
test('skirmish item buff and strategic enemy debuff expiry use real elapsed time',()=>{
 const input={sums:new Map([['0:a',{n:1,total:1,hp:80,maxHp:100,x:0,z:0}],
  ['1:b',{n:1,total:1,hp:50,maxHp:100,x:100,z:100}]]),
  units:[{team:0,squadId:'a',maxHp:100},{team:1,squadId:'b',maxHp:100}],
  allyIds:['a'],enemyIds:['b'],mass:false,now:50,
  skirmishBuffs:new Map([['a',[{attack:.12,until:53},{speed:.4,until:20}]]]),
  skirmishDebuffs:new Map([['b',{attack:.15,until:57}]])};
 const rows=makeBattleRpgStatusRows(input);
 assert.equal(rows[0].effects.length,1);
 assert.equal(rows[0].effects[0].seconds,3);
 assert.equal(rows[1].effects[0].label,'攻↓15%');
 assert.equal(makeBattleRpgStatusRows({...input,now:70}).flatMap(r=>r.effects).length,0);
});
test('RPG status is sourced from real squads but collapsed by default to reveal the battlefield',()=>{
 const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const map=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 const clean=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
 assert.match(battle,/createBattleRpgSquadHud/);
 assert.match(battle,/makeBattleRpgStatusRows/);
 assert.match(battle,/refreshBattleRpgSquadHud\(sums\)/);
 assert.match(battle,/battleRpgHud\?\.select\(team,id\)/);
 assert.match(battle,/label\.userDataSquadTitle\.textContent/);
 assert.match(battle,/realtimeCommandUI\?\.update\(rows\)/);
 assert.match(map,/realtimeRoster/);
 assert.match(map,/onRoster\(\)/);
 assert.match(clean,/battle-realtime-clean\.battle-roster-open/);
 assert.match(clean,/body\.battle-realtime-clean #battleRpgSquadHud/);
 assert.match(css,/#battleRpgSquadHud .rpgSquadSide\.enemy/);
 assert.match(css,/rpgSquadEffects/);
});

test('all squads use the same compact icon + meter + effect row, with five per page',()=>{
 const js=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 const realtime=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
 assert.equal(rpgHudEffectIcon({kind:'debuff',label:'防↓18%'}),'🛡↓');
 assert.equal(rpgHudEffectIcon({kind:'buff',label:'攻↑20%'}),'⚔↑');
 assert.equal(rpgHudEffectIcon({kind:'debuff',label:'速↓25%'}),'⚡↓');
 assert.equal(rpgHudStateIcon({alive:1,total:10,hp:10,maxHp:100}),'🆘');
 assert.equal(rpgHudStateIcon({alive:10,total:10,hp:100,maxHp:100,mode:'move'}),'➤');
 assert.match(js,/const pageSize=expanded\[team\]\?Math\.max\(1,own\.length\):5/);
 assert.match(js,/metrics\.append\(hp,hpValue,count,effects,attack,mana\)/);
 assert.match(js,/for\(const fx of valid\.slice\(0,3\)\)/);
 assert.match(css,/\.rpgSquadMetrics\{display:flex/);
 assert.match(css,/\.rpgSquadEffects \.debuff/);
 assert.match(realtime,/body\.battle-realtime-clean #battleRpgSquadHud:not\(\[hidden\]\)\{display:block!important\}/);
 assert.match(realtime,/body\.battle-realtime-clean\.battle-roster-open #battleRpgSquadHud:not\(\[hidden\]\)\{display:none!important\}/);
});

test('approved face atlas uses canonical campaign job rows, stable variants, and ten compact rows',()=>{
 assert.equal(battleJobPortrait('格闘家',4,0).sheet,'b');
 assert.equal(battleJobPortrait('格闘家',4,0).y,100);
 assert.equal(battleJobPortrait('盾騎士',1,0).sheet,'a');
 assert.equal(battleJobPortrait('魔法使い',2,0).y,100/3);
 assert.equal(battleJobPortrait('僧侶',9,1).sourceJob,'僧侶');
 assert.equal(battleJobPortrait('剣士',7,0).fallback,true);
 assert.ok(JOB_PORTRAIT_FILES.a.endsWith('frontline-v1.webp'));
 const js=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 assert.match(js,/setBattleJobPortrait\(job,row\.job,row\.id,team\)/);
 assert.match(js,/expanded=\[true,true\]/);
 assert.match(css,/grid-template-columns:26px minmax\(0,1fr\)/);
 assert.match(css,/background-size:400% 400%/);
});
