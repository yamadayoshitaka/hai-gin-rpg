import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';

const unit=(id,x=2,z=2)=>({id,team:0,squadId:'1',alive:true,hp:100,
 x,z,mountId:null,highGroundRouteIndex:-1,highGroundPhase:0});
function mockSquad(){
 const sim=Object.create(MassBattleGridSimulation.prototype);
 sim.width=8;sim.height=8;
 sim.units=[unit(1),unit(2,3,2),unit(3,2,3)];
 sim.highGroundRoutes=[{buildingIndex:0,kind:'window',level:3,access:{x:4,z:4},
  points:[{x:0,y:0,z:0},{x:0,y:10,z:0}]}];
 sim._highGroundFlows=[new Int32Array(64).fill(1)];
 sim._highGroundClaims=new Map();
 sim.autoStrategySquads=new Set();
 sim.squadDestinations=new Map();sim.squadFlows=new Map();
 sim.squadMissions=new Map();sim.squadHealTargets=new Map();
 sim.squadCommands=new Map();sim.clearSquadExploration=()=>{};
 return sim;
}
test('one high-ground order moves every living soldier in the squad',()=>{
 const sim=mockSquad();
 assert.equal(sim.orderSquadHighGround('1',0,0),true);
 assert.deepEqual(sim.units.map(u=>u.highGroundRouteIndex),[0,0,0]);
 assert.ok(sim.units.every(u=>u.highGroundManualHold===true));
 assert.equal(sim._highGroundClaims.get('0:0'),'1');
});
test('if one soldier cannot reach castle stairs, nobody is sent alone',()=>{
 const sim=mockSquad();sim._highGroundFlows[0][sim.units[2].z*8+sim.units[2].x]=0x3fffffff;
 assert.equal(sim.orderSquadHighGround('1',0,0),false);
 assert.ok(sim.units.every(u=>u.highGroundRouteIndex===-1));
});
test('a new squad order releases the old high-ground assignment as a unit',()=>{
 const sim=mockSquad();sim.orderSquadHighGround('1',0,0);
 assert.equal(sim.setSquadCommand('1','hold',0),true);
 assert.ok(sim.units.every(u=>u.highGroundRouteIndex===-1));
 assert.equal(sim._highGroundClaims.size,0);
});
test('castle floors and skirmish orders are not hardcoded to 2F or one scout',()=>{
 const files=[
  'src/mass-battle-highground.js','tactics-wireframe.html',
  'src/targeted-strategy-runtime.js'];
 const [routes,page,tactics]=files.map(file=>readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 assert.match(routes,/for\(let floor=2;floor<=b\.structure\.floors\.length;floor\+\+\)/);
 assert.match(routes,/const stageCandidates=\[\]/);
 assert.match(page,/for\(let floor=2;floor<=structure\.floors\.length\+1;floor\+\+\)/);
 assert.match(page,/for\(const unit of eligible\)/);
 assert.match(tactics,/scope='group';preferredSquad=null/);
});

test('arrival waits for the entire elevated squad and changes all combat postures',()=>{
 const sim=mockSquad();assert.equal(sim.orderSquadHighGround('1',0,0),true);
 assert.equal(sim.setSquadHighGroundArrival('1','charge',0),false,
  'premature arrival must not release waiting soldiers');
 assert.ok(sim.units.every(u=>u.highGroundManualHold));
 for(const u of sim.units)u.highGroundPhase=2;
 assert.equal(sim.setSquadHighGroundArrival('1','charge',0),true);
 assert.ok(sim.units.every(u=>u.highGroundManualHold===false));
 assert.ok(sim.units.every(u=>u.highGroundRouteIndex===0));
 assert.equal(sim.setSquadHighGroundArrival('1','hold',0),true);
 assert.ok(sim.units.every(u=>u.highGroundManualHold===true));
});
test('high-ground wizard, arrival dispatcher and worker use one squad-level target',()=>{
 const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const wizard=read('src/battle-command-wizard.js');
 const commands=read('src/battle-realtime-commands.js');
 const worker=read('src/mass-battle-worker-runtime.js');
 const client=read('src/mass-battle-worker-client.js');
 const page=read('tactics-wireframe.html');
 assert.match(wizard,/highGroundTarget:String\\(current.id\\)/);
 assert.match(commands,/height.highGroundArrived/);
 assert.match(worker,/case 'squadHighGroundArrival'/);
 assert.match(client,/setSquadHighGroundArrival\\(squadId,command,team=0\\)/);
 assert.match(page,/const highGroundArrived=Boolean/);
 assert.match(page,/massSim.setSquadHighGroundArrival\\(id,mode,0\\)/);
});
