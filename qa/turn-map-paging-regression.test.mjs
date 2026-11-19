import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {battleMapCell} from '../src/battle-realtime-commands.js';
import {squadRadarPins,radarHitPin} from '../src/battle-center-radar.js';
import {BATTLE_ATTACK_CHOICES,battleAttackCommand,isRangedBattleJob} from '../src/battle-attack-choices.js';
import {buildBattleSquadLeaderPins,visibleBattleSquadPins} from '../src/battle-squad-leader-pins.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {planSkirmishDeployment} from '../src/battle-realtime-deployment.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('deployment occurs once, on legal separate cells, preserving live mount positions',()=>{
 const width=96,height=96,walkable=new Uint8Array(width*height).fill(1);
 const sim=new MassBattleGridSimulation(50,20261119,{width,height,walkable,bridges:[],riverXAt:()=>48});
 const group=sim.units.filter(u=>u.team===0&&String(u.squadId)==='0');
 const before=group.map(u=>u.x+','+u.z);
 assert.equal(sim.deploySquadBeforeBattle('0',18,22,0),true);
 const positions=group.map(u=>u.x+','+u.z);
 assert.notDeepEqual(positions,before);
 assert.equal(new Set(sim.units.map(u=>u.x+','+u.z)).size,sim.units.length);
 assert.ok(group.every(u=>u.x<=39&&walkable[u.z*width+u.x]===1));
 for(const rider of group.filter(u=>u.mountId!=null)){
  const mount=sim.objects.find(o=>o.mountedBy===rider.id&&o.alive);
  if(mount)assert.deepEqual([mount.x,mount.z],[rider.x,rider.z]);
 }
 assert.equal(sim.deploySquadBeforeBattle('0',47,47),false,'enemy/river-facing cells cannot host a friendly start');
 assert.equal(sim.deploySquadBeforeBattle('99',18,22),false);
 assert.equal(sim.deploySquadBeforeBattle('0',-2,22),false);
 sim.step(.1);
 assert.equal(sim.deploySquadBeforeBattle('0',18,22),false,
  'A squad cannot teleport when the real-time battle has started');
});
test('mobile map keeps coordinate mapping stable across viewport aspect',()=>{
 assert.deepEqual(battleMapCell(200,200,{left:0,top:0,width:400,height:400},{
  worldSize:232,zoom:1,centerX:116,centerZ:116}),{x:116,z:116});
 assert.deepEqual(battleMapCell(0,0,{left:0,top:0,width:400,height:400},{
  worldSize:232,zoom:2,centerX:116,centerZ:116}),{x:58,z:58});
 assert.equal(battleMapCell(700,0,{left:0,top:0,width:400,height:400}),null);
});
test('turn control is never mounted and realtime squad picker is wired',()=>{
 const battle=read('../tactics-wireframe.html');
 const source=read('../src/battle-realtime-commands.js');
 const style=read('../src/battle-realtime-commands.css');
 assert.doesNotMatch(battle,/import \{installObjectiveTurnPanel\}/);
 assert.match(battle,/const objectiveTurnUI=null/);
 assert.match(battle,/realtimeCommandUI\?\.openDeployment\(\)/);
 assert.match(battle,/setBattlePaused\(false\)/);
 assert.match(battle,/deploySquadBeforeBattle\(id,point\.x,point\.z,0\)/);
 assert.match(battle,/onMove:\(id,point\)=>/);
 assert.match(battle,/issueIndividualSquadOrder\('move',point\)/);
 assert.match(battle,/!hasSquadCommander\(id\)\|\|!canChangeSquadOrder\(id\)/);
 assert.match(battle,/onOrder:\(id,mode\)=>/);
 assert.match(battle,/document\.body\.classList\.add\('battle-realtime-clean'\)/);
 assert.doesNotMatch(battle,/'TURN開始：/);
 assert.match(style,/body\.battle-realtime-clean #battleTopDock/);
 assert.match(style,/body\.battle-realtime-clean #battleRpgSquadHud/);
 assert.match(source,/realtimeBattleDock/);
 assert.match(source,/realtimeBattleCanvas/);
 assert.match(source,/mapPoint\(px,pz\)/);
 assert.match(source,/pointermove/);
 assert.match(source,/realtimeStart/);
 assert.match(source,/onStart\(\)/);
 assert.doesNotMatch(source,/<select[^>]*data-turn/);
});
test('battle inline module still parses after removing objective-turn controller',()=>{
 const html=read('../tactics-wireframe.html');
 const blocks=[...html.matchAll(/<script[^>]*type="module"[^>]*>([\s\S]*?)<\/script>/g)];
 assert.ok(blocks.length,'Expected a browser ES module in tactical game');
 for(const m of blocks)new vm.SourceTextModule(m[1],{identifier:'tactics-wireframe-inline'});
});

test('50v50 skirmish and story modes can position squads before combat',()=>{
 const own=Array.from({length:10},(_,i)=>({id:i,team:0,squadId:'sword',hp:100,alive:true,
  cell:{x:20+i,z:20}}));
 const opponents=Array.from({length:10},(_,i)=>({id:i+20,team:1,squadId:'enemy',hp:100,alive:true,
  cell:{x:54+i,z:20}}));
 const walkable=(x,z)=>!(x===16&&z===16);
 const options={squadId:'sword',team:0,x:16,z:20,width:80,height:80,homeRiverX:()=>40,
  passable:walkable};
 const placements=planSkirmishDeployment([...own,...opponents],options);
 assert.equal(placements.length,10);
 const pos=placements.map(p=>p.x+','+p.z);
 assert.equal(new Set(pos).size,10);
 assert.ok(placements.every(p=>p.x<=31&&walkable(p.x,p.z)));
 assert.equal(planSkirmishDeployment([...own,...opponents],{...options,x:39}),null,
  'No skirmish prebattle teleport into the enemy front');
 const obstructed=planSkirmishDeployment([...own,...opponents],{...options,
  passable:()=>false});
 assert.equal(obstructed,null,'A fully blocked deployment aborts atomically');
 const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.match(battle,/planSkirmishDeployment\(actors,/);
 assert.match(battle,/occupiedCells\.delete\(cellKey\(actor\.cell\.x,actor\.cell\.z\)\)/);
 assert.match(battle,/actor\.root\.position\.set\(wx,terrainY\(wx,wz\),wz\)/);
 assert.match(battle,/occupiedCells\.set\(cellKey\(x,z\),actor\)/);
 assert.match(battle,/const mount=mountedCreatureOf\(actor\)/);
});

test('prebattle squad selection uses back/next paging, not an obstructive select box',()=>{
 const source=read('../src/battle-realtime-commands.js');
 const css=read('../src/battle-realtime-commands.css');
 assert.match(source,/id="realtimeMapPrev"/);
 assert.match(source,/id="realtimeMapNext"/);
 assert.match(source,/id="realtimeMapPage"/);
 assert.match(source,/id="realtimeMapSquadName"/);
 assert.doesNotMatch(source,/<select id="realtimeMapSquad"/);
 assert.match(source,/const next=own\[index\+offset\]/);
 assert.match(source,/if\(next\)setSelected\(next\.id\)/);
 assert.match(source,/realtimeMapPrev'\)\.disabled=index<=0/);
 assert.match(source,/realtimeMapNext'\)\.disabled=index>=own\.length-1/);
 assert.match(css,/#realtimeBattleMapOverlay \.realtimeMapSquadPager/);
});

test('accepted map move reveals an action picker and defers command until arrival',()=>{
 const source=read('../src/battle-realtime-commands.js');
 const css=read('../src/battle-realtime-commands.css');
 assert.match(source,/id="realtimeMapActionSheet"/);
 for(const action of ['defend','charge','hold','support']){
  assert.ok(source.includes('data-action-after-move="'+action+'"'));
 }
 assert.match(source,/if\(applied\)\{\s*deploymentActions\.delete\(String\(selectedId\)\);arrivalActions\.delete\(String\(selectedId\)\);/);
 assert.match(source,/showActionSheet\(selectedId,point\)/);
 assert.match(source,/preferredActions\.get\(String\(selectedId\)\)/);
 assert.doesNotMatch(source,/id="realtimeMapActionSheet" hidden/,'action controls remain visible before a move');
 assert.match(source,/arrivalActions\.set\(id,\{command,point:\{\.\.\.actionDestination\}\}\)/);
 assert.match(source,/Math\.hypot\(own\.x-entry\.point\.x,own\.z-entry\.point\.z\)>3\.5/);
 assert.match(source,/if\(onOrder\(id,entry\.command\)\)arrivalActions\.delete\(id\)/);
 assert.match(source,/deploymentActions\.set\(id,command\)/);
 assert.match(source,/setBattleJobPortrait\(face,own\[index\]\?\.job,own\[index\]\?\.id,0\)/);
 assert.match(css,/#realtimeBattleMapOverlay \.realtimeMapActionButtons/);
});

test('deployment map shows exactly one living commander/leader pin for each squad',()=>{
 const ids=Array.from({length:10},(_,i)=>String(i));
 const units=[];
 for(let team=0;team<=1;team++)for(let squad=0;squad<10;squad++){
  for(let member=0;member<5;member++)units.push({
   id:team*1000+squad*10+member,team,squadId:squad,alive:true,hp:100,
   x:team?175+squad:50+squad,z:50+member*4,
   isStrategist:member===4
  });
 }
 const own=buildBattleSquadLeaderPins(units,{team:0,ids});
 const enemy=buildBattleSquadLeaderPins(units,{team:1,ids});
 assert.equal(own.size,10,'50 soldiers must produce only ten friendly dots');
 assert.equal(enemy.size,10,'50 enemy soldiers must produce only ten enemy dots');
 assert.equal(own.get('0').z,66,'Use actual strategist location, never mean of five soldiers');
 assert.equal(own.get('0').leaderId,4);
 assert.equal(enemy.get('7').leaderId,1074);
 assert.equal(visibleBattleSquadPins([...own.values()],[...enemy.values()],'deploy').length,10,
  'Hide enemy dots on the opening deployment screen');
 assert.equal(visibleBattleSquadPins([...own.values()],[...enemy.values()],'move').length,20,
  'Live map shows one leader dot per squad for both armies');
 units.find(u=>u.team===0&&u.squadId===0&&u.isStrategist).hp=0;
 const recovered=buildBattleSquadLeaderPins(units,{team:0,ids});
 assert.equal(recovered.size,10);
 assert.equal(recovered.get('0').leaderId,0,'Fallback to living soldier after leader loss');
});
test('designated skirmish leaders use the real cell coordinate',()=>{
 const squad=[
  {id:1,team:0,squadId:'7',cell:{x:44,z:34},hp:50,alive:true},
  {id:2,team:0,squadId:'7',cell:{x:46,z:45},hp:75,alive:true,isSquadLeader:true},
  {id:3,team:0,squadId:'7',cell:{x:48,z:43},hp:25,alive:true}
 ];
 const result=buildBattleSquadLeaderPins(squad,{team:0,ids:['7']});
 assert.deepEqual([result.get('7').x,result.get('7').z],[46,45]);
 assert.equal(result.get('7').leaderId,2);
 squad[1].alive=false;
 assert.equal(buildBattleSquadLeaderPins(squad,{team:0,ids:['7']}).get('7').leaderId,1);
});
test('tactical deployment uses only leader coordinates, never soldier dot clouds',()=>{
 const view=read('../src/battle-realtime-commands.js');
 const battle=read('../tactics-wireframe.html');
 assert.match(view,/visibleBattleSquadPins\(allies,enemies,mode\)/);
 assert.match(view,/mode==='deploy'\?\[\]:getEnemies\(\)/);
 assert.match(view,/ctx\.fillText\(String\(number\),x,z\)/);
 assert.match(battle,/buildBattleSquadLeaderPins\(squadRoster,\{team:0,ids:squadIds\}\)/);
 assert.match(battle,/buildBattleSquadLeaderPins\(squadRoster,\{team:1,ids:enemySquadIds\}\)/);
 assert.match(battle,/leader\?\.x\?\?NaN,z:leader\?\.z\?\?NaN/);
 assert.match(battle,/isSquadLeader:!storyRequest&&!TOWN_MODE/);
});

test('one-job squads use a portrait-triggered command dock, not a select box',()=>{
 const src=read('../src/battle-realtime-commands.js');
 const hud=read('../src/battle-rpg-squad-hud.js');
 const page=read('../tactics-wireframe.html');
 const css=read('../src/battle-realtime-commands.css');
 assert.doesNotMatch(src,/<select id="realtimeSquadSelect"/);
 assert.match(src,/id="realtimeBattleDock" hidden/);
 assert.match(src,/id="realtimeDockPrev"/);
 assert.match(src,/id="realtimeDockNext"/);
 assert.match(src,/id="realtimeDockPortrait"/);
 assert.match(src,/id="realtimeDockClose"/);
 assert.match(src,/showSquadControls,/);
 assert.match(hud,/job\.addEventListener\('click',openByIcon\)/);
 assert.match(hud,/event\.stopPropagation\(\)/);
 assert.match(hud,/if\(team===0\)onCommand\(team,String\(row\.id\)\)/);
 assert.match(page,/onCommand:\(team,id\)=>/);
 assert.match(page,/realtimeCommandUI\?\.showSquadControls\(id\)/);
 assert.match(css,/#realtimeBattleDock \.realtimeDockSquadPager/);
});
test('planning pauses the combat clock and only releases its own pause on exit',()=>{
 const src=read('../src/battle-realtime-commands.js');
 const page=read('../tactics-wireframe.html');
 assert.match(src,/function enterPlanning\(\)/);
 assert.match(src,/if\(!started\)return/);
 assert.match(src,/if\(!getPaused\(\)\)\{/);
 assert.match(src,/planningDeadline=nowMs\(\)\+PLAN_LIMIT_MS/);
 assert.match(src,/globalThis\.setInterval\?\.\(updatePlanningCountdown,200\)/);
 assert.match(src,/onPause\(\);planningOwnsPause=Boolean\(getPaused\(\)\)/);
 assert.match(src,/function exitPlanning\(\)/);
 assert.match(src,/if\(!planningOwnsPause\)return/);
 assert.match(src,/if\(getPaused\(\)\)onPause\(\)/);
 assert.match(src,/if\(started\)enterPlanning\(\)/);
 assert.match(src,/if\(onOrder\(id,command\)\)closeSquadControls\(\)/);
 assert.match(page,/onPause:\(\)=>setBattlePaused\(!paused\)/);
});
test('initial and live maps share real attack variants with valid simulation commands',()=>{
 assert.deepEqual(BATTLE_ATTACK_CHOICES.map(x=>x.id),['near','far','intercept','delay']);
 assert.deepEqual(BATTLE_ATTACK_CHOICES.map(x=>x.command),['charge','hold','defend','hold']);
 assert.equal(battleAttackCommand('near','盾騎士'),'charge');
 assert.equal(battleAttackCommand('far','剣士'),null);
 assert.equal(battleAttackCommand('far','魔法使い'),'hold');
 assert.equal(battleAttackCommand('far','弓使い'),'hold');
 assert.equal(battleAttackCommand('intercept','忍者'),'defend');
 assert.equal(battleAttackCommand('delay','僧侶'),'hold');
 assert.equal(battleAttackCommand('bad','剣士'),null);
 assert.equal(isRangedBattleJob('格闘家'),false);
 const src=read('../src/battle-realtime-commands.js');
 assert.match(src,/id="realtimeMapAttackChoices"/);
 assert.match(src,/id="realtimeDockAttackChoices"/);
 for(const kind of BATTLE_ATTACK_CHOICES.map(x=>x.id)){
  assert.ok(src.includes('data-attack-kind="'+kind+'" data-attack-origin="dock"'));
  assert.ok(src.includes('data-attack-kind="'+kind+'" data-attack-origin="map"'));
 }
 assert.match(src,/battleAttackCommand\(preferred\.slice\(7\),squad\.job\)/);
 assert.match(src,/if\(queuedCommand\)arrivalActions\.set/);
});

test('central radar shows only commander positions for 10+10 and highlights selection',()=>{
 const own=Array.from({length:10},(_,i)=>({id:String(i),team:0,x:10+i*5,z:20+i}));
 const enemy=Array.from({length:10},(_,i)=>({id:String(i),team:1,x:190+i,z:120+i*3}));
 const rows=[{team:0,id:'7',alive:0}];
 const radar=squadRadarPins(own,enemy,232,rows);
 assert.equal(radar.length,19);
 assert.equal(radar.filter(p=>p.team===0).length,9);
 assert.equal(radar.filter(p=>p.team===1).length,10);
 assert.equal(radarHitPin(radar,radar[0].x,radar[0].y).id,'0');
 assert.equal(radarHitPin(radar,.50,.50,.02),null);
 assert.ok(radar.every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));
 const view=read('../src/battle-realtime-commands.js');
 const css=read('../src/battle-realtime-commands.css');
 const page=read('../tactics-wireframe.html');
 assert.match(view,/id="realtimeSquadRadar" hidden/);
 assert.match(view,/id="realtimeRadarCanvas"/);
 assert.match(view,/squadRadarPins\(own,enemies,worldSize,currentRows\)/);
 assert.match(view,/radarHitPin\(radarPins,px,py\)/);
 assert.match(view,/if\(pin\.team===0\)showSquadControls\(pin\.id\)/);
 assert.match(css,/#realtimeSquadRadar\{/);
 assert.match(page,/onEnemySelect:id=>battleRpgHud\?\.select\(1,id,\{focus:true\}\)/);
});
test('30-second strategy selection timer keeps previous orders and releases its own pause',()=>{
 const view=read('../src/battle-realtime-commands.js');
 const html=read('../tactics-wireframe.html');
 assert.match(view,/const PLAN_LIMIT_MS=30000/);
 assert.match(view,/id="realtimePlanSeconds"/);
 assert.match(view,/id="realtimeMapPlanningClock"/);
 assert.match(view,/id="realtimeRadarClock"/);
 assert.match(view,/planningTicker=globalThis\.setInterval\?\.\(updatePlanningCountdown,200\)/);
 assert.match(view,/if\(remain===0\)\{/);
 assert.match(view,/if\(!\$\('realtimeBattleMapOverlay'\)\.hidden\)closeMap\(\)/);
 assert.match(view,/closeSquadControls\(\)/);
 assert.match(view,/if\(!planningOwnsPause\)return/);
 assert.match(view,/if\(getPaused\(\)\)onPause\(\)/);
 assert.match(html,/if\(team!==0\|\|!battleReady\|\|finished\)return/);
 assert.doesNotMatch(html,/if\(team!==0\|\|!battleReady\|\|finished\|\|battleCeremony\.locked\)return/);
});
