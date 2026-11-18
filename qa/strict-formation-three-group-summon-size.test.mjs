import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {ensureSortiePlan,sortieTeams,sortieTeamCount,setSortieFormation,setSortieGridCell,
 sortiePlanningStage,sortiePlanningLimit,sortieFormationStatus,setSortieFormationSize}
 from '../src/three-team-sortie.js';
import {renderThreeTeamPlanner} from '../src/three-team-sortie-ui.js';
import {threeGroupOverview,reinforceDivision,mergeDivision} from '../src/battle-three-group-hierarchy.js';
import {SUMMON_WORLD_SCALE,creatureSize,riderSeatHeight} from '../src/combat-creature-performance.js';
import {MONSTER_SUMMON_MODEL_HEIGHT,monsterSummonWorldScale} from '../src/monster-summon-registry.js';

const game=createNewGame('人数と3班の固定陣形');
game.townStage='c01-s01';
game.campaign.squads=[
 {id:1,job:'騎士',rarity:'N',count:17,commanderId:'player'},
 {id:2,job:'忍者',rarity:'N',count:10,commanderId:'player'},
 {id:3,job:'僧侶',rarity:'N',count:15,commanderId:'player'},
 {id:4,job:'盾騎士',rarity:'N',count:19,commanderId:'player'},
 {id:5,job:'魔法使い',rarity:'N',count:10,commanderId:'player'},
 {id:6,job:'格闘家',rarity:'N',count:8,commanderId:'player'},
 {id:7,job:'シーフ',rarity:'N',count:7,commanderId:'player'},
 {id:8,job:'召喚士',rarity:'N',count:6,commanderId:'player'}
];
assert.equal(game.campaign.squads.reduce((n,s)=>n+s.count,0),92);
const stage=sortiePlanningStage(game);
assert.equal(stage.id,'c01-s02');
assert.equal(sortiePlanningLimit(game),40);
ensureSortiePlan(game);
assert.equal(sortieTeams(game).reduce((n,t)=>n+sortieTeamCount(t),0),40,
 'the inn must not misrepresent 92 owned soldiers as 92 deployable soldiers');
assert.throws(()=>setSortieGridCell(game,1,5,2),/固定配置/,
 'named formation cannot be manually reordered even between unlocked cells');
const html=renderThreeTeamPlanner({game,teamId:1});
assert.match(html,/予定出撃 40\/40人/);
assert.match(html,/予備52人/);
assert.match(html,/陣形固定・職業と位置は変更不可/);
assert.doesNotMatch(html,/data-sortie-size/,'fixed preset size is no longer manually adjustable');
assert.match(html,/この陣形/,'planner shows the active formation headcount and rarity limits');
setSortieFormation(game,2,'free');
setSortieFormation(game,3,'free');
assert.equal(sortieTeams(game)[1].formation,'free');
assert.equal(sortieTeams(game)[2].formation,'free');
assert.ok(!sortieFormationStatus(game,2).valid);
assert.equal(sortieTeams(game).reduce((n,t)=>n+sortieTeamCount(t),0),40,
 'switching to free formation must not create soldiers');

const mk=(id,squadId,source,group,hp=100,extra={})=>({
 id,team:0,squadId,sourceSquadId:source,armyGroupId:group,
 hp,maxHp:100,alive:true,jobId:'sword',...extra
});
const units=[
 mk('hero','g1-main',1,1,100,{isPlayerHero:true}),
 mk('d1','g1-main',1,1),mk('d2','g1-main',1,1),
 mk('s1','g1-part',1,1,12),mk('s2','g1-part',1,1,17),
 mk('r1','g1-reserve',1,1),mk('r2','g1-reserve',1,1),
 mk('r3','g1-reserve',1,1),mk('r4','g1-reserve',1,1),
 mk('b1','g2-main',2,2),
 {...mk('e1','enemy',9,1),team:1}
];
const initial=units.filter(u=>u.team===0).map(u=>({...u}));
const groups={ 'g1-main':1,'g1-part':1,'g1-reserve':1,'g2-main':2 };
let summary=threeGroupOverview(units,groups,initial);
assert.equal(summary.length,10);
assert.deepEqual(summary.slice(0,3).map(g=>g.alive),[9,1,0]);
const requestForm=initial.map(({team,...u})=>u);
assert.deepEqual(threeGroupOverview(units,groups,requestForm).slice(0,3).map(g=>g.initial),[9,1,0],
 'story battle requests omit team=0 yet must still report correct initial counts');
assert.ok(summary[0].divisions.some(x=>x.id==='g1-part'));
const identity=units.filter(u=>u.team===0).map(u=>u.id).sort().join(',');
const result=reinforceDivision(units,groups,'g1-part',{fromId:'g1-reserve',amount:2});
assert.equal(result.ok,true);
assert.equal(result.count,2);
assert.equal(units.filter(u=>u.squadId==='g1-part'&&u.hp>0).length,4);
assert.equal(units.filter(u=>u.squadId==='g1-reserve'&&u.hp>0).length,2);
summary=threeGroupOverview(units,groups,initial);
assert.deepEqual(summary.slice(0,3).map(g=>g.alive),[9,1,0],'reinforcements move real people, never duplicate');
assert.equal(units.filter(u=>u.team===0).map(u=>u.id).sort().join(','),identity);
assert.equal(reinforceDivision(units,groups,'g1-part',{fromId:'g2-main'}).ok,false);
assert.equal(mergeDivision(units,groups,'g1-main').ok,false,'hero stays in command');
const merged=mergeDivision(units,groups,'g1-part',{intoId:'g1-main'});
assert.equal(merged.ok,true);
assert.equal(merged.count,4);
assert.equal(units.filter(u=>u.squadId==='g1-part'&&u.hp>0).length,0);
assert.equal(units.filter(u=>u.squadId==='g1-main'&&u.hp>0).length,7);
assert.equal(units.filter(u=>u.team===0).map(u=>u.id).sort().join(','),identity);

assert.equal(SUMMON_WORLD_SCALE,1);
assert.equal(MONSTER_SUMMON_MODEL_HEIGHT,1.7);
assert.equal(creatureSize('horse'),1);
assert.ok(creatureSize('dragon')<3);
assert.ok(riderSeatHeight({id:'wolf-1',type:'wolf',flying:false})<3);
assert.ok(monsterSummonWorldScale('summon_m001',1.7)<10);
const source=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(source,/createBattleThreeGroupPanel/);
assert.match(source,/threeGroupPanel\?\.render/);
assert.match(source,/storyRequest\.units\.length,storyRequest\.enemyCount/);
assert.match(source,/ターンの目的を確認/);
assert.match(source,/20261117-horse-saddle-fix1/);
for(const file of ['src/battle-three-group-hierarchy.js','src/battle-three-group-panel.js',
 'src/three-team-sortie.js','src/three-team-sortie-ui.js']){
 new SourceTextModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{identifier:file});
}
console.log('PASS: 92 owned / 40 deployed, locked formations, 10-group UI, zero-copy support/merge and restored natural summons');
