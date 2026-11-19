import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {battleMapCell} from '../src/battle-realtime-commands.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

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
 assert.match(battle,/issueSquadOrder\('move',point\)/);
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
