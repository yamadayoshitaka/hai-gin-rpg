import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {battleMapCell} from '../src/battle-realtime-commands.js';
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
 assert.match(source,/if\(applied\)\{deploymentActions\.delete\(String\(selectedId\)\);arrivalActions\.delete\(String\(selectedId\)\);showActionSheet\(selectedId,point\);\}/);
 assert.match(source,/arrivalActions\.set\(id,\{command,point:\{\.\.\.actionDestination\}\}\)/);
 assert.match(source,/Math\.hypot\(own\.x-entry\.point\.x,own\.z-entry\.point\.z\)>3\.5/);
 assert.match(source,/if\(onOrder\(id,entry\.command\)\)arrivalActions\.delete\(id\)/);
 assert.match(source,/deploymentActions\.set\(id,command\)/);
 assert.match(source,/setBattleJobPortrait\(\$\('realtimeMapPortrait'\)/);
 assert.match(css,/#realtimeBattleMapOverlay \.realtimeMapActionButtons/);
});
