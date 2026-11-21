import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';
import {CAMPAIGN_STAGE_BY_ID} from '../src/campaign-stage-plan.js';
import {
 ensureSortiePlan,sortieTeams,sortieTeamCount,sortieTeamSquads,
 allowedSortieSlots,availableSortieOrders,setSortieCount,setSortieCaptain,
 setSortieFormation,setSortieSlot,setSortieTactics,setSortieJobSlot,setSortieGridCell,
 setSortieDivisions,sortieAdjacentJobs,SORTIE_GRID_CELLS,SORTIE_FORMATIONS,
 sortieLevel,sortieSquadCap,sortieFormationBuff,sortieDebuffTypes,
 allocateThreeTeamSortie,sortieTemplateCapacity
} from '../src/three-team-sortie.js';
import {renderThreeTeamPlanner} from '../src/three-team-sortie-ui.js';

const stage=CAMPAIGN_STAGE_BY_ID['c01-s02'],game=createNewGame('3班の固定テンプレート');
const plan=ensureSortiePlan(game);
assert.equal(plan.version,1);
assert.equal(sortieTeams(game).length,10);
assert.deepEqual(sortieTeams(game).slice(0,3).map(sortieTeamCount),[40,0,0]);
assert.equal(sortieLevel(game),99);
assert.equal(sortieSquadCap(game),16);
assert.equal(Object.keys(SORTIE_FORMATIONS).length,14);
assert.equal(SORTIE_FORMATIONS.balanced.slots,4);
assert.equal(SORTIE_FORMATIONS.spear.slots,5);
assert.equal(SORTIE_FORMATIONS.spear.level,7);
assert.equal(sortieFormationBuff(game,1).attack,0,
 'two initial job classes cannot activate a four-role fixed formation');
setSortieFormation(game,1,'dragon');
assert.equal(sortieTeams(game)[0].formation,'dragon');
assert.equal(sortieFormationBuff(game,1).attack,0,
 'a 12-role formation never awards buffs for two invented placements');
setSortieFormation(game,1,'balanced');
assert.equal(sortieTeamCount(sortieTeams(game)[0]),40);
assert.equal(sortieTeams(game)[0].slots.filter(Boolean).length,2);
assert.equal(sortieTeams(game)[0].grid.filter(Boolean).length,2);
assert.equal(SORTIE_GRID_CELLS,16);
assert.throws(()=>setSortieGridCell(game,1,5,1),/固定配置/);
assert.throws(()=>setSortieCount(game,1,1,31),/保有|利用/);
assert.deepEqual(allowedSortieSlots(game,stage),[9,10,11,6,7,8,3,4,5,0]);
assert.deepEqual(availableSortieOrders(game,1),[],'unfinished preset does not unlock special tactics');

setSortieCount(game,1,1,18);
assert.throws(()=>setSortieCount(game,2,1,13),/固定|隊|ステージ|人数/);
setSortieFormation(game,2,'free');
setSortieCount(game,2,1,12);
setSortieCount(game,1,2,7);
setSortieCount(game,2,2,3);
assert.deepEqual(sortieTeams(game).slice(0,3).map(sortieTeamCount),[25,15,0]);
assert.deepEqual(sortieTeamSquads(game,2).map(s=>s.job),['騎士','僧侶']);
assert.equal(sortieTemplateCapacity(game,2).total,15);
setSortieCaptain(game,2,2);
assert.deepEqual(availableSortieOrders(game,2),[],'free formation has zero formation tactics');
setSortieSlot(game,stage,2,11);
assert.throws(()=>setSortieSlot(game,stage,2,9),/別の隊/);
setSortieGridCell(game,2,15,2);
assert.equal(sortieTeams(game)[1].grid[15],'2');
assert.equal(sortieTeams(game).reduce((n,t)=>n+sortieTeamCount(t),0),40);
const html=renderThreeTeamPlanner({game,teamId:2});
assert.match(html,/最大10班/);
assert.match(html,/配置盤 4×4/);
assert.equal((html.match(/data-sortie-cell="/g)||[]).length,16);
assert.match(html,/陣形：自由陣形/);
assert.ok(!html.includes('data-sortie-size'));
assert.match(html,/R 0\/40人/);
assert.ok(!html.includes('<select'));
const templatePage=renderThreeTeamPlanner({game,teamId:1,view:'templates'});
assert.equal((templatePage.match(/data-sortie-formation="/g)||[]).length,7);
assert.match(templatePage,/4隊 · 最大40人/);
assert.match(templatePage,/N40 · R14 · SR8 · SSR4 · UR2/);
const late=renderThreeTeamPlanner({game,teamId:1,view:'templates',templatePage:2});
assert.match(late,/星鐘陣形/);assert.match(late,/16隊 · 最大50人/);

const assignment=allocateThreeTeamSortie(game,stage);
assert.equal(assignment.reduce((n,x)=>n+x.count,0),40);
assert.equal(new Set(assignment.map(x=>x.teamId)).size,2);
assert.equal(new Set(assignment.map(x=>x.deploymentSlot)).size,2);
game.location='map';
const battle=makeCoreBattleRequest(game,stage.id,'named-and-free');
assert.equal(battle.sortieTeamCount,2);
assert.equal(battle.units.length,40);
assert.equal(new Set(battle.units.map(u=>u.armyGroupId)).size,2);
assert.equal(new Set(battle.units.map(u=>u.squadId)).size,4);
assert.equal(battle.units.filter(u=>u.isPlayerHero).length,1);
assert.equal(battle.units.filter(u=>u.isStrategist).length,1);
assert.ok(Object.values(battle.formationBonuses).every(b=>!b.attack&&!b.defense));
assert.ok(Object.values(battle.availableSquadOrders).every(list=>list.length===0));
game.completedStages.push(stage.id);
assert.equal(allowedSortieSlots(game,stage).length,12);
setSortieSlot(game,stage,2,0);
game.campaign.squads[0].count=20;
ensureSortiePlan(game);
assert.equal(sortieTeams(game).reduce((n,t)=>n+(t.counts['1']||0),0),20,
 'battle casualties never leave duplicated or ghost troops');

const roster=createNewGame('有効な四職業テンプレート');
roster.campaign.squads.push(
 {id:3,job:'魔法使い',rarity:'N',count:10,commanderId:'player'},
 {id:4,job:'忍者',rarity:'N',count:10,commanderId:'player'});
ensureSortiePlan(roster);
assert.equal(sortieTeams(roster)[0].slots.filter(Boolean).length,4);
assert.equal(sortieFormationBuff(roster,1).attack,.04);
assert.ok(availableSortieOrders(roster,1).includes('support'));
assert.ok(availableSortieOrders(roster,1).includes('explore'));
assert.ok(availableSortieOrders(roster,1).includes('weaken'));
assert.ok(availableSortieOrders(roster,1).includes('destroy'));
assert.ok(sortieDebuffTypes(roster,1).length>=4);
setSortieTactics(roster,1,['melee_focus','heal_wounded']);
setSortieDivisions(roster,1,1,3);
assert.equal(sortieTeams(roster)[0].divisions['1'],3);
roster.location='map';
const staffed=makeCoreBattleRequest(roster,stage.id,'fully-staffed');
assert.equal(staffed.units.length,40);
assert.equal(staffed.formationIntegrity['1'].active,true);
assert.ok(staffed.units.some(u=>u.formationBuff.attack===.04));
assert.deepEqual(staffed.sortieTacticTemplate['1'],['melee_focus','heal_wounded']);
roster.sortieTestLevel=1;
assert.equal(sortieSquadCap(roster),4);
assert.throws(()=>setSortieFormation(roster,1,'dragon'),/レベル/);
roster.sortieTestLevel=99;
setSortieFormation(roster,2,'free');
setSortieJobSlot(roster,2,1,1);
assert.equal(sortieTeams(roster)[1].slots[1],'1');
assert.ok(sortieTeams(roster).reduce((n,t)=>n+(t.counts['1']||0),0)<=roster.campaign.squads[0].count);
setSortieJobSlot(roster,2,1,null);

const many=createNewGame('ステージ出撃人数');
many.campaign.squads[0].count=80;
ensureSortiePlan(many);
assert.equal(allocateThreeTeamSortie(many,stage).reduce((n,x)=>n+x.count,0),40);
const town=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
const world=readFileSync(new URL('../world-map.html',import.meta.url),'utf8');
const battleHtml=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.ok(!town.includes('data-sortie-size'));
assert.match(town,/renderThreeTeamPlanner/);
assert.doesNotMatch(world,/id="deploymentPicker"/);
assert.match(world,/beginSortie\(stage\)/);
assert.match(battleHtml,/createTargetedStrategyUi/);
assert.match(battleHtml,/applySquadDebuff/);
for(const [id,doc] of [['town',town],['world',world],['battle',battleHtml]]){
 const modules=[...doc.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
 assert.ok(modules.length,id);
 new SourceTextModule(modules.at(-1)[1],{identifier:id});
}
console.log('PASS: strict preset squads, rarity-stage caps, 10 available groups, free edit, 3-stage orders and real battle handoff');
