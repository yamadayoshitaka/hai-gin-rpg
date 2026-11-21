import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {battleMonsterIdentity,battleSquadPortraitChoice} from '../src/battle-portrait-identity.js';
import {battleStageType,battleStageObjective} from '../src/battle-stage-identity.js';
import {makeBattleRpgStatusRows,aggregateBattleRpgTeams} from '../src/battle-rpg-squad-source.js';

assert.equal(battleStageType('explore','monsters'),'魔物殲滅戦');
assert.equal(battleStageType('capture'),'陣地制圧戦');
assert.equal(battleStageType('defend'),'拠点防衛戦');
assert.equal(battleStageType('siege'),'攻城戦');
assert.equal(battleStageType('boss'),'ボス決戦');
assert.equal(battleStageObjective('explore'),'出現した全モンスターを討伐');
assert.equal(battleStageObjective('capture','旗を確保'),'旗を確保');

const species=battleMonsterIdentity({isMonster:true,job:{name:'召喚士'},
 monsterSpec:{id:'m001',name:'灰牙の狼王',family:'beast'}});
assert.deepEqual(species,{id:'m001',name:'灰牙の狼王',family:'beast'});
assert.deepEqual(battleSquadPortraitChoice({team:1,monster:species,job:'召喚士'},1),{
 kind:'monster',glyph:'🐺',name:'灰牙の狼王',id:'m001'
});
assert.equal(battleSquadPortraitChoice({team:1,monster:{name:'未知の魔物'},job:'弓使い'},1).glyph,'👾');

const sums=new Map([['0:a',{n:1,total:1,hp:90,maxHp:100,x:10,z:10}],
 ['1:m',{n:1,total:1,hp:80,maxHp:100,x:15,z:15}]]);
const rows=makeBattleRpgStatusRows({sums,
 units:[{team:0,squadId:'a',alive:true,hp:90,maxHp:100},
  {team:1,squadId:'m',alive:true,hp:80,maxHp:100,
   monsterSpec:{id:'m026',name:'洞窟スパイダー',family:'arachnid'}}],
 allyIds:['a'],enemyIds:['m'],getJob:()=> '召喚士'});
assert.equal(rows[1].job,'洞窟スパイダー');
assert.equal(rows[1].monster.family,'arachnid');
const captain={id:42,name:'宿屋で指定した隊長',job:'盾騎士'};
const grouped=aggregateBattleRpgTeams(rows,{a:1},{m:1},{'1':captain});
const own=grouped.find(row=>row.team===0),foe=grouped.find(row=>row.team===1);
assert.equal(own.captain.id,42);
assert.equal(battleSquadPortraitChoice(own,0).kind,'captain');
assert.equal(battleSquadPortraitChoice(own,0).job,'盾騎士');
assert.equal(foe.monster.name,'洞窟スパイダー');
assert.equal(battleSquadPortraitChoice(foe,1).glyph,'🕷️');
assert.equal(battleSquadPortraitChoice({...own,isJobDivision:true},0).kind,'job');
const fallback=makeBattleRpgStatusRows({sums,units:[],
 allyIds:[],enemyIds:['m'],getJob:()=> '魔法使い',
 getMonster:()=>({id:'m020',name:'深海リヴァイアサン',family:'aquatic'})});
assert.equal(fallback[0].job,'深海リヴァイアサン');

const world=readFileSync(new URL('../world-map.html',import.meta.url),'utf8');
const battle=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const realtime=readFileSync(new URL('../src/battle-realtime-commands.js',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../src/three-team-core-bridge.js',import.meta.url),'utf8');
assert.doesNotMatch(world,/id="deploymentRadarBoard"/);
assert.doesNotMatch(world,/id="deploymentPicker"/);
assert.match(world,/beginSortie\(stage\)/);
assert.match(battle,/realtimeCommandUI\?\.openDeployment\(\)/);
assert.doesNotMatch(battle,/startFromPreparedDeployment\(\)/);
assert.match(battle,/requirePrebattleChoices:THREE_TEAM_BATTLE/);
assert.match(battle,/aggregateBattleRpgTeams\(rows,armyGroupBySquad,enemyGroupBySquad,captainByGroup\)/);
assert.match(battle,/battleTypeLabel:battleStageType\(/);
assert.match(bridge,/captain:\(\(\)=>\{/);
assert.match(bridge,/winCondition:stage.winCondition/);
assert.match(realtime,/realtimeRadarExpand/);
assert.match(realtime,/placedTeams\.add\(group\)/);
assert.match(realtime,/requirePrebattleChoices&&\(!placedTeams\.has\(key\)\|\|!selected\)/);
assert.match(realtime,/openDeployment\(\)\{started=false/);
assert.match(realtime,/function beginBattleWithPlans\(\)/);
assert.match(realtime,/battleTypeLabel/);
for(const file of ['src/battle-portrait-identity.js','src/battle-stage-identity.js',
 'src/battle-rpg-squad-source.js','src/battle-rpg-squad-hud.js',
 'src/battle-realtime-commands.js','src/three-team-core-bridge.js']){
 new SourceTextModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{identifier:file});
}
const mainModule=[...battle.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].at(-1)?.[1];
assert.ok(mainModule&&mainModule.length>10000);
new SourceTextModule(mainModule,{identifier:'tactics-wireframe.html'});
console.log('PASS: battle radar placement, stage type, captain/species portraits and syntax');
