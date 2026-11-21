import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {makeBattleRpgStatusRows,aggregateBattleRpgTeams} from '../src/battle-rpg-squad-source.js';
import {battleThreeTeamRadarSquads,squadRadarPins} from '../src/battle-center-radar.js';

const unit=(team,id,cell,stale)=>({
 team,squadId:id,cell,x:stale.x,z:stale.z,
 hp:100,maxHp:100,alive:true,action:'attack'
});

test('small-battle contact uses actual grid cells, not stale actor x/z',()=>{
 const units=[
  unit(0,'a',{x:102,z:80},{x:12,z:20}),
  unit(1,'b',{x:104,z:80},{x:194,z:160})
 ];
 const sums=new Map([
  ['0:a',{n:1,total:1,hp:100,x:102,z:80}],
  ['1:b',{n:1,total:1,hp:100,x:104,z:80}]
 ]);
 const rows=makeBattleRpgStatusRows({
  units,sums,allyIds:['a'],enemyIds:['b'],
  getMode:()=> 'charge',mass:false
 });
 assert.deepEqual(rows.map(r=>r.inContact),[true,true]);
 assert.deepEqual(rows.map(r=>r.engagementPoint),[
  {x:103,z:80},{x:103,z:80}
 ]);
 const grouped=aggregateBattleRpgTeams(rows,{a:1},{b:2});
 assert.equal(grouped.length,2);
 assert.equal(grouped[0].groupId,1);
 assert.equal(grouped[1].groupId,2);
 assert.deepEqual(grouped.map(r=>r.engagementPoint),[
  {x:103,z:80},{x:103,z:80}
 ]);
});

test('three-team radar follows frontline only while actually engaged',()=>{
 const physical=[
  {id:'11',alive:2,total:2,x:12,z:20},
  {id:'12',alive:2,total:2,x:20,z:20},
  {id:'21',alive:1,total:1,x:80,z:80}
 ];
 const mapping={'11':1,'12':1,'21':2};
 const leaders=battleThreeTeamRadarSquads(physical,mapping);
 assert.equal(leaders[0].x,16);
 assert.equal(leaders[0].inContact,false);
 const frontline=new Map([['1',{x:105,z:81}]]);
 const live=battleThreeTeamRadarSquads(physical,mapping,frontline);
 assert.equal(live[0].x,105);
 assert.equal(live[0].z,81);
 assert.equal(live[0].inContact,true);
 assert.equal(live[1].x,80);
 assert.equal(live[1].inContact,false);
 const pins=squadRadarPins(live,[],232,[]);
 assert.equal(pins[0].inContact,true);
 assert.equal(pins[0].x,105/231);
 assert.equal(pins[0].y,81/231);
 // A dead representative must not hide a team with living divisions.
 const hiddenRep=squadRadarPins(live,[],232,[{team:0,id:'11',alive:0}]);
 assert.equal(hiddenRep.length,2);
});

test('compact phone rows and radar show contact independently from the hidden stance icon',()=>{
 const hud=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 const commands=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 assert.equal((hud.match(/engaged.hidden=!row.inContact;/g)||[]).length,2);
 assert.doesNotMatch(hud,/engaged.hidden=!row.inContact.*value==='⚔'/);
 assert.match(css,/\.rpgSquadRow\{position:relative\}/);
 assert.match(css,/\.rpgSquadRowTitle \.rpgSquadEngaged\{[\s\S]*?position:absolute/);
 assert.match(commands,/if\(pin.inContact\)/);
 assert.match(game,/battleThreeTeamRadarSquads\(own,armyGroupBySquad,liveRadarEngagementPoints\(0\)\)/);
 assert.match(game,/enemyGroupBySquad,liveRadarEngagementPoints\(1\)/);
 assert.match(game,/battle-rpg-squad-hud\.css\?v=20261122-contact-badge3/);
});
