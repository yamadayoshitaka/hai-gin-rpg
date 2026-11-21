import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {battleThreeTeamRadarSquads,squadRadarPins} from '../src/battle-center-radar.js';

test('radar reduces 8 live job squads to the actual 3 team leaders and keeps two enemies',()=>{
 const ids=['1','2','3','4','5','6','7','8'];
 const groups={'1':1,'2':2,'3':3,'4':2,'5':3,'6':1,'7':1,'8':1};
 const members=ids.map((id,i)=>({id,alive:i===1?0:2,total:2,
  x:i<3?20+i*5:35+i*2,z:20+i*8}));
 const grouped=battleThreeTeamRadarSquads(members,groups);
 assert.equal(grouped.length,3);
 assert.deepEqual(grouped.map(g=>g.groupId),[1,2,3]);
 assert.ok(grouped.every(g=>ids.includes(g.id)));
 assert.equal(grouped[0].alive,8);
 assert.ok(grouped[0].x>20);
 const enemy=[{id:'e1',x:80,z:90},{id:'e2',x:92,z:95}];
 const physicalLive=members.map(m=>({team:0,id:m.id,alive:m.alive}));
 const pins=squadRadarPins(grouped,enemy,232,physicalLive);
 assert.equal(pins.filter(pin=>pin.team===0).length,3);
 assert.equal(pins.filter(pin=>pin.team===1).length,2);
 assert.deepEqual(pins.filter(pin=>pin.team===0).map(pin=>pin.number),[1,2,3]);
 assert.equal(pins[0].id,grouped[0].id,'radar click uses real representative squad');
});

test('empty and invalid team pins are never drawn',()=>{
 const result=battleThreeTeamRadarSquads([
  {id:'dead',alive:0,x:20,z:20},
  {id:'bad',alive:2,x:20,z:20},
  {id:'alive',alive:1,x:30,z:35},
  {id:'nan',alive:2,x:NaN,z:20}
 ],{dead:1,bad:4,alive:3,nan:2});
 assert.deepEqual(result.map(p=>p.groupId),[3]);
 assert.equal(result[0].id,'alive');
});

test('public radar and team HUD use the same group source, while job controls stay physical',()=>{
 const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const realtime=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 assert.match(html,/getRadarSquads:own=>THREE_TEAM_BATTLE\?/);
 assert.match(html,/battleThreeTeamRadarSquads\(own,armyGroupBySquad\)/);
 assert.match(html,/getRadarGroup:id=>THREE_TEAM_BATTLE/);
 assert.match(html,/onRadarTeamCommand:groupId=>/);
 assert.match(html,/targetedStrategyUi\.open\(groupId,\{startAtRecommendations:true,groupOnly:true\}\)/);
 assert.match(realtime,/const own=squads\(\),plannedEnemies=typeof getRadarEnemies==='function'/);
 assert.match(realtime,/radarPins=squadRadarPins\(visibleAllies,enemies,worldSize,currentRows\)/);
 assert.match(realtime,/pin\.number=group;pin\.groupId=group/);
 assert.match(realtime,/onRadarTeamCommand\(pin\.groupId,pin\.id\)/);
 assert.match(html,/getSquads:\(\)=>\{/);
});
