import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {createBattleThreeTeamEventTracker,BATTLE_TEAM_COLORS} from '../src/battle-center-radar.js';

const group=(team,groupId,alive,total,inContact=false)=>({
 team,groupId,alive,total,inContact,
 members:[{id:team===0?'ally-job-'+groupId:'enemy-job-'+groupId}]
});

test('contact cut-in fires on first genuine team contact, not every job hit or frame',()=>{
 const tracker=createBattleThreeTeamEventTracker();
 assert.deepEqual(tracker.observe([
  group(0,1,5,6),group(0,2,4,5),group(1,1,6,6)
 ]),{engagements:[],annihilations:[]});
 const first=tracker.observe([
  group(0,1,5,6,true),group(0,2,4,5),group(1,1,6,6,true)
 ]);
 assert.deepEqual(first.engagements,[{team:0,groupId:1}]);
 assert.deepEqual(first.annihilations,[]);
 const repeated=tracker.observe([
  group(0,1,2,6,true),group(0,2,4,5),group(1,1,5,6,true)
 ]);
 assert.deepEqual(repeated,{engagements:[],annihilations:[]});
 assert.deepEqual(tracker.observe([
  group(0,1,2,6,true),group(0,2,4,5,true),group(1,1,5,6,true)
 ]).engagements,[{team:0,groupId:2}]);
});

test('wipeout is a complete command team loss, not a job subdivision loss',()=>{
 const tracker=createBattleThreeTeamEventTracker();
 tracker.observe([group(0,1,8,10),group(1,3,7,9)]);
 assert.deepEqual(tracker.observe([group(0,1,2,10),group(1,3,1,9)]).annihilations,[]);
 const result=tracker.observe([group(0,1,2,10),group(1,3,0,9)]);
 assert.deepEqual(result.annihilations,[{
  team:1,groupId:3,total:9,squadId:'enemy-job-3'
 }]);
 assert.deepEqual(tracker.observe([group(0,1,2,10),group(1,3,0,9)]).annihilations,[]);
 const ally=tracker.observe([group(0,1,0,10),group(1,3,0,9)]);
 assert.deepEqual(ally.annihilations,[{
  team:0,groupId:1,total:10,squadId:'ally-job-1'
 }]);
});

test('radar, visible team HUD and cut-ins share the same battle presentation state',()=>{
 const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
 const commands=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
 const hud=readFileSync(new URL('../src/battle-rpg-squad-hud.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/battle-rpg-squad-hud.css',import.meta.url),'utf8');
 assert.match(game,/latestBattleTeamPresentationRows=teamRows/);
 assert.match(game,/for\(const row of latestBattleTeamPresentationRows\)/);
 assert.match(game,/battleTeamEventTracker\.observe\(teamRows\)/);
 assert.match(game,/if\(!THREE_TEAM_BATTLE&&previousAlive>0&&sum\.n===0\)/);
 assert.match(game,/if\(THREE_TEAM_BATTLE\|\|TOWN_MODE/);
 assert.match(commands,/now-lastRadarRenderAt<120/);
 assert.match(commands,/radarGroups\.get\(pin\.team\+':'\+String\(pin\.id\)\)/);
 assert.match(hud,/BATTLE_TEAM_COLORS\.ally/);
 assert.match(css,/var\(--battle-engaged-color,#ffe091\)/);
 assert.deepEqual(BATTLE_TEAM_COLORS,{
  ally:'#5aceff',enemy:'#ff7884',engaged:'#ffe091'
 });
});
