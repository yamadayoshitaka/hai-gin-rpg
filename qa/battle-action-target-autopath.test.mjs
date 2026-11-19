import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {battleJobSpecialActions} from '../src/battle-job-special-actions.js';

const commands=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const simulation=readFileSync(new URL('../src/mass-battle-grid-sim.js',import.meta.url),'utf8');

test('live orders require an action, never a movement-only confirmation',()=>{
 assert.match(commands,/if\(!entry\?\.special&&!entry\?\.command\)/);
 assert.match(commands,/openMove\(\)\{return false;/);
 assert.match(commands,/realtimeConfirmStrategy'\)\.disabled=/);
 assert.match(commands,/onTargetOrder\(id,entry\.command,destination\)/);
 assert.match(battle,/onTargetOrder:\(id,mode,target\)=>/);
 assert.match(battle,/type:'eliminate_squad',targetSquadId:String\(target\.squadId\)/);
});

test('high ground is a target with a real map pin and auto staircase order',()=>{
 for(const job of ['弓使い','魔法使い','忍者'])
  assert.equal(battleJobSpecialActions(job).some(action=>
   action.id==='high_ground'&&action.target==='height'),true);
 assert.match(commands,/\['building','bridge','door','height'\]/);
 assert.match(battle,/x:route\.access\.x,z:route\.access\.z/);
 assert.match(battle,/orderSquadHighGround\(id,routeIndex,0\)/);
 assert.match(simulation,/unit\.highGroundRouteIndex=index/);
});

test('thief chooses a locked door, auto approaches and unlocks in combat',()=>{
 const thief=battleJobSpecialActions('シーフ');
 assert.equal(thief[0].id,'unlock_door');
 assert.equal(thief[0].target,'door');
 assert.match(thief[0].label,/鍵開け/);
 assert.match(commands,/鍵開け・盗む/);
 assert.match(battle,/o\.team===1&&o\.locked/);
 assert.match(battle,/type:action,targetId:String\(object\.id\)/);
 assert.match(simulation,/this\.squadDestinations\.set\(id,point\);this\.squadCommands\.set\(id,'mission'\)/);
 assert.match(simulation,/this\.actions\.unlockEnemyDoor\(structure\.id,u\)/);
});
