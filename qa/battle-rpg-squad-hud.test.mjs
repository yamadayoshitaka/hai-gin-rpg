import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {makeBattleRpgStatusRows,aggregateBattleRpgTeams,resolveBattleThreeTeamGroups} from '../src/battle-rpg-squad-source.js';
import {battleJobPortrait,JOB_PORTRAIT_FILES} from '../src/battle-job-portraits.js';
import {rpgHudHealth,rpgHudStatus,rpgHudCompactText,rpgHudIcon,rpgHudEffectIcon,rpgHudStateIcon,rpgHudTroopPercent} from '../src/battle-rpg-squad-hud.js';

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
 assert.match(battle,/battleRpgHud\?\.select\(team,team===0&&THREE_TEAM_BATTLE\?/);
 assert.match(battle,/label\.userDataSquadTitle\.textContent/);
 assert.match(battle,/realtimeCommandUI\?\.update\(rows\)/);
 assert.match(map,/realtimeRoster/);
 assert.match(map,/onRoster\(\)/);
 assert.match(clean,/battle-realtime-clean\.battle-roster-open/);
 assert.match(clean,/body\.battle-realtime-clean #battleRpgSquadHud/);
 assert.match(css,/#battleRpgSquadHud .rpgSquadSide\.enemy/);
 assert.match(css,/rpgSquadEffects/);
});

test('all squads use the same compact icon, HP/MP meters and effects',()=>{
 const js=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 const realtime=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
 assert.equal(rpgHudEffectIcon({kind:'debuff',label:'防↓18%'}),'🛡↓');
 assert.equal(rpgHudEffectIcon({kind:'buff',label:'攻↑20%'}),'⚔↑');
 assert.equal(rpgHudEffectIcon({kind:'debuff',label:'速↓25%'}),'⚡↓');
 assert.equal(rpgHudStateIcon({alive:1,total:10,hp:10,maxHp:100}),'🆘');
 assert.equal(rpgHudStateIcon({alive:10,total:10,hp:100,maxHp:100,mode:'move'}),'➤');
 assert.match(js,/const pageSize=expanded\[team\]\?Math\.max\(1,own\.length\):5/);
 assert.match(js,/addMeter\('hp','HP'/);
 assert.doesNotMatch(js,/addMeter\('attack'/);
 assert.match(js,/addMeter\('mp','MP'/);
 assert.doesNotMatch(js,/addMeter\('troops'/);
 assert.match(js,/for\(const fx of valid\.slice\(0,7\)\)/);
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

test('live squad MP, HP-linked attack, reinforcement and rally wiring stay synchronized',()=>{
 const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const commands=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 assert.match(battle,/sums,units:massSim\?\.units\?\?actors,allyIds:squadIds/);
 assert.match(battle,/onReinforce:\(id,itemId\)=>issueCommanderReinforcements/);
 assert.match(battle,/onRally:\(id,type,targets\)=>issueCommanderRally/);
 assert.match(commands,/id="realtimeRally"/);
 assert.match(commands,/function showRallyChoices\(\)/);
 assert.match(commands,/function showSupportChoices\(origin\)/);
 const units=[
  {team:0,squadId:'m',hp:50,maxHp:100,mp:8,maxMp:20,alive:true},
  {team:0,squadId:'m',hp:0,maxHp:100,mp:0,maxMp:20,alive:false}
 ];
 const sums=new Map([['0:m',{n:1,total:2,hp:50,maxHp:200,x:20,z:20}]]);
 const rows=makeBattleRpgStatusRows({sums,units,allyIds:['m'],
  commanderRallies:new Map([['m',[{attack:.2,until:32}]]]),now:10});
 assert.equal(rows[0].mp,8);
 assert.equal(rows[0].maxMp,40);
 assert.equal(rows[0].attackPercent,25);
 assert.equal(rows[0].effects[0].label,'攻↑20%');
 const next=makeBattleRpgStatusRows({sums,units:[{...units[0],mp:3},units[1]],allyIds:['m']});
 assert.equal(next[0].mp,3,'MP meter must use current combat unit values');
});

test('only real HP and MP gauges remain, while buff/debuff badges stay visible',()=>{
 const js=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 assert.equal(rpgHudTroopPercent(2,5),40,'squad population remains available for accessible status');
 assert.match(js,/addMeter\('hp','HP'/);
 assert.match(js,/addMeter\('mp','MP'/);
 assert.doesNotMatch(js,/addMeter\('attack'/);
 assert.doesNotMatch(js,/addMeter\('troops'/);
 assert.match(js,/setAttribute\('role','meter'\)/);
 assert.match(js,/metrics\.append\(effects\)/);
 assert.match(css,/2026-11-19: two-meter squad display/);
 assert.match(css,/\.rpgSquadMeter-mp\{grid-row:6\}/);
 assert.match(css,/background-size:400% 400%/);
 assert.equal(rpgHudEffectIcon({kind:'debuff',label:'回復阻害'}),'✚↓');
});

test('user requested half-width tracks and two-row real effect badges',()=>{
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 assert.match(css,/rpgSquadMeterLine \.rpgSquadMeterTrack\{\s*width:50%;max-width:50%/);
 assert.match(css,/grid-template-columns:repeat\(4,14px\);grid-template-rows:repeat\(2,10px\)/);
 assert.match(css,/rpgSquadMeter-mp\{grid-row:6\}/);
 assert.match(js,/valid\.slice\(0,7\)/);
 assert.match(js,/more\.textContent='\+'\+\(valid\.length-7\)/);
});

test('half-width flank panels and squad-one initial selection retain real status tooltips',()=>{
 const js=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(css,/width:clamp\(52px,13\.5vw,78px\)/);
 assert.match(css,/rpgSquadMeterLine \.rpgSquadMeterTrack\{\s*width:100%;max-width:100%/);
 assert.match(js,/if\(firstRender\)for\(const side of panels\)side\.panel\.scrollTop=0/);
 assert.match(js,/selected=selectionKey\(0,firstAlly\.id\)/);
 assert.match(js,/button\.title=button\.getAttribute\('aria-label'\)/);
 assert.match(html,/followSelectedCommander\(squadIds\[0\]\)/);
});

test('slim rails show 1隊, job name, and two usable gauges',()=>{
 const js=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(js,/jobName\.className='rpgSquadJobName'/);
 assert.match(js,/jobName\.textContent=String\(row\.job\|\|'部隊'\)/);
 assert.match(js,/heading\.append\(job,title,jobName,status,engaged\)/);
 assert.match(js,/title\.textContent=.*\$1隊/);
 assert.match(css,/\.rpgSquadJobName\{\s*grid-column:1\/-1;grid-row:2/);
 assert.match(css,/grid-template-rows:16px 10px 8px 8px repeat\(2,5px\)/);
 assert.match(css,/\.rpgSquadMeter-hp\{grid-row:5\}/);
 assert.match(css,/\.rpgSquadMeter-mp\{grid-row:6\}/);
 assert.match(css,/width:clamp\(52px,13\.5vw,78px\)/);
 assert.match(html,/battle-rpg-squad-hud\.js\?v=/);
});

test('single tap focuses camera; double tap opens allied orders; overview camera is overhead',()=>{
 const js=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(js,/function handleSquadTap\(team,id\)/);
 assert.match(js,/lastTap\?\.key===key&&now-lastTap\.at<=380/);
 assert.match(js,/if\(team===0\)onCommand\(team,String\(id\)\)/);
 assert.match(js,/onFocus\(team,String\(id\)\)/);
 assert.match(js,/pendingTapTimer=setTimeout/);
 assert.match(js,/if\(pendingTapTimer!==null\)clearTimeout\(pendingTapTimer\)/);
 assert.match(html,/cameraOverviewOffset=new THREE\.Vector3\(110,510,110\)/);
});


test('three inn teams aggregate nine job squads in the combat HUD without changing real combat rows',()=>{
 const physical=Array.from({length:9},(_,i)=>({
  team:0,id:String((Math.floor(i/3)+1)*1000+i%3+1),
  name:'第'+(i+1)+'隊',job:['剣士','魔法使い','僧侶'][i%3],
  alive:i===4?0:2,total:2,hp:i===4?0:40,maxHp:80,
  mp:i===4?0:8,maxMp:16,attackPercent:50,
  effects:i===0?[{kind:'buff',label:'攻↑10%',seconds:5}]:[],
  mode:'charge',inContact:i===0
 }));
 const enemies=Array.from({length:2},(_,i)=>({
  team:1,id:String(i),name:'敵'+i,job:'魔獣',alive:1,total:1,hp:60,maxHp:60,
  mp:0,maxMp:0,attackPercent:100,effects:[],mode:'charge',inContact:false
 }));
 const map=Object.fromEntries(physical.map((row,i)=>[row.id,Math.floor(i/3)+1]));
 const result=aggregateBattleRpgTeams([...physical,...enemies],map);
 assert.deepEqual(result.filter(row=>row.team===0).map(row=>row.id),['team:1','team:2','team:3']);
 assert.deepEqual(result.filter(row=>row.team===1),enemies);
 for(const [i,team] of result.slice(0,3).entries()){
  assert.equal(team.members.length,3);
  assert.deepEqual(team.members,physical.slice(i*3,i*3+3));
  assert.equal(team.total,6);
  assert.equal(team.maxHp,240);
  assert.equal(team.maxMp,48);
  assert.equal(team.job,'3ジョブ');
 }
 assert.equal(result[1].alive,4);
 assert.equal(result[1].hp,80);
 assert.equal(result[1].mp,16);
 assert.equal(result[0].inContact,true);
 assert.deepEqual(result[0].effects,physical[0].effects);
 assert.equal(physical[0].id,'1001','physical battle squad ID must remain unchanged');
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const hud=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 assert.match(html,/aggregateBattleRpgTeams\(rows,armyGroupBySquad,enemyGroupBySquad\)/);
 assert.match(html,/targetedStrategyUi\.open\(group,\{startAtRecommendations:true,groupOnly:true\}\)/);
 assert.match(hud,/expandedTeamId/);
 assert.match(hud,/rpgJobDivision/);
});


test('classic story and CPU 8-10 physical squads become at most three real HUD command teams',()=>{
 const squadIds=Array.from({length:8},(_,i)=>String(i+1));
 const jobs=['騎士','僧侶','魔法使い','僧侶','魔法使い','騎士','剣士','剣士'];
 const map=resolveBattleThreeTeamGroups(squadIds,id=>jobs[Number(id)-1],{},false);
 assert.equal(Object.keys(map).length,8);
 assert.deepEqual(new Set(Object.values(map)),new Set([1,2,3]));
 assert.equal(map['1'],map['6']);
 assert.equal(map['2'],map['4']);
 assert.equal(map['3'],map['5']);
 assert.equal(map['7'],map['8']);
 const rows=squadIds.map((id,index)=>({
  team:0,id,job:jobs[index],name:'第'+id+'隊',alive:1,total:1,
  hp:100,maxHp:100,mp:10,maxMp:10,attackPercent:100,
  mode:'charge',effects:[],inContact:false
 }));
 const enemy={...rows[0],id:'e1',team:1,name:'敵'};
 const grouped=aggregateBattleRpgTeams([...rows,enemy],map);
 assert.equal(grouped.filter(x=>x.team===0).length,3);
 assert.deepEqual(grouped.filter(x=>x.team===1),[enemy]);
 assert.equal(grouped.filter(x=>x.team===0).reduce((n,x)=>n+x.total,0),8);
 for(const group of grouped.filter(x=>x.team===0)){
  assert.ok(group.jobs.length<=3,'at most 3 distinct jobs per team');
  assert.ok(group.members.length>0,'no empty replacement teams');
 }
 const tenIds=Array.from({length:10},(_,i)=>String(i+1));
 const nineJobs=['剣士','盾騎士','魔法使い','僧侶','弓使い','忍者','シーフ','召喚士','格闘家','剣士'];
 const tenGroups=resolveBattleThreeTeamGroups(tenIds,id=>nineJobs[Number(id)-1]);
 assert.ok([...new Set(Object.values(tenGroups))].length<=3);
 for(const team of [1,2,3]){
  const distinct=[...new Set(tenIds.filter(id=>tenGroups[id]===team).map(id=>nineJobs[Number(id)-1]))];
  assert.ok(distinct.length<=3,'normal battle team cannot exceed three jobs');
 }
});

test('authoritative inn mapping overrides fallback, but legacy ten-group mapping is normalized',()=>{
 const ids=['11','22','33','44'];
 const modern=resolveBattleThreeTeamGroups(ids,id=>'僧侶',
  {'11':3,'22':1,'33':1,'44':2},true);
 assert.deepEqual(modern,{'11':3,'22':1,'33':1,'44':2});
 const old=resolveBattleThreeTeamGroups(ids,id=>id,
  {'11':1,'22':5,'33':8,'44':10},true);
 assert.equal(Object.keys(old).length,4);
 assert.ok(Object.values(old).every(x=>x>=1&&x<=3));
});

test('every playable battle link and display refresh route to the three-team HUD',()=>{
 const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const map=readFileSync(new URL('../world-map.html',import.meta.url),'utf8');
 const game=readFileSync(new URL('../game.html',import.meta.url),'utf8');
 const story=readFileSync(new URL('../story-mode.html',import.meta.url),'utf8');
 assert.match(battle,/const THREE_TEAM_BATTLE=!TOWN_MODE&&!MASS_SIZE/);
 assert.match(battle,/resolveBattleThreeTeamGroups\(squadIds,id=>squadPrimaryJob\(id\)/);
 assert.match(battle,/battleRpgHud\.update\(THREE_TEAM_BATTLE\?/);
 assert.match(battle,/aggregateBattleRpgTeams\(rows,armyGroupBySquad,enemyGroupBySquad\)/);
 assert.match(battle,/if\(THREE_TEAM_BATTLE\)for\(const unit of squadRoster\)/);
 assert.doesNotMatch(battle,/battleRpgHud\.update\(storyRequest\?\.sortieTeamCount\?/);
 assert.match(map,/v=three-team-radar2-20261120/);
 assert.match(game,/v=three-team-radar2-20261120/);
 assert.match(story,/storyBattle=1&v=three-team-radar2-20261120/);
});
