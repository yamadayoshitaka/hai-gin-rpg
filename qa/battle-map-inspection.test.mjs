import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findBattleMapPin,formatBattleMapPercent} from '../src/battle-map-inspection.js';

test('map marker selection only hits nearby real squad pins',()=>{
 const pins=[{id:'s1',team:0,groupId:1,px:88,py:130},
  {id:'e1',team:1,groupId:2,px:322,py:299}];
 assert.equal(findBattleMapPin(pins,86,132)?.id,'s1');
 assert.equal(findBattleMapPin(pins,321,304)?.id,'e1');
 assert.equal(findBattleMapPin(pins,213,205),null,'blank ground does not select or move');
 assert.equal(findBattleMapPin(pins,NaN,10),null);
 assert.equal(formatBattleMapPercent(30,60),50);
 assert.equal(formatBattleMapPercent(0,0),0);
});
test('expanded battle map cannot issue a movement command',()=>{
 const js=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const page=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-realtime-commands.css',import.meta.url),'utf8');
 assert.match(js,/realtimeRadarExpand'\)\.onclick=\(\)=>openMap\(started\?'inspect':'deploy'\)/);
 assert.match(js,/if\(next==='inspect'&&started\)/);
 assert.match(js,/if\(mode==='inspect'\)return false; \/\/ Expanded map is observation-only/);
 assert.match(js,/findBattleMapPin\(mapInspectionPins/);
 assert.match(js,/inspectedMapPin=\{\.\.\.pin\}/);
 assert.match(js,/getSquadDetails\(pin.team,pin.id,pin.groupId\)/);
 assert.match(js,/getRadarSquads\(sourceAllies\)/);
 assert.match(js,/realtimeMapActionSheet'\)\.hidden=true/);
 assert.match(page,/getSquadDetails:\(team,id,groupId=null\)=>/);
 assert.match(page,/massSim\.squadDebuffs\?\.get\(/);
 assert.match(css,/#realtimeBattleMapOverlay \.realtimeMapDetail/);
 assert.match(js,/if\(mode==='deploy'\)\{/,'prebattle deployment remains available');
});
