import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {FORMATION_TEMPLATE_LIMITS,formationTemplate,formationCapacityStatus,
 formationRarityCounts,SORTIE_RARITIES} from '../src/sortie-formation-template-rules.js';
import {SORTIE_FORMATIONS,ensureSortiePlan,sortieTeams,sortieTeamCount,sortieTemplateCapacity,
 sortieFormationStatus,sortieSquadCap,setSortieFormation,setSortieFormationSize,setSortieCount,
 sortieAllowedCells} from '../src/three-team-sortie.js';
import {FORMATION_ROLES} from '../src/sortie-formation-logic.js';
import {renderThreeTeamPlanner} from '../src/three-team-sortie-ui.js';

const rarities=['N','R','SR','SSR','UR'];
assert.deepEqual([...SORTIE_RARITIES],rarities);
assert.equal(Object.keys(SORTIE_FORMATIONS).length,14);
assert.equal(Object.keys(FORMATION_TEMPLATE_LIMITS).length,15);
for(const [id,formation] of Object.entries(SORTIE_FORMATIONS)){
 const spec=formationTemplate(id);
 assert.equal(formation.slots,spec.slots);
 assert.equal(formation.maxTroops,spec.maxTroops);
 assert.ok(spec.slots>=4&&spec.slots<=16);
 assert.ok(spec.maxTroops>=spec.slots&&spec.maxTroops<=50);
 assert.deepEqual(Object.keys(spec.rarityCaps),rarities);
 for(const r of rarities)assert.ok(spec.rarityCaps[r]>0&&spec.rarityCaps[r]<=spec.maxTroops,id+' '+r);
 assert.ok(FORMATION_ROLES[id].slice(0,spec.slots).every(x=>x!=='any'),
  id+' must assign a specific job-role type to every occupied cell');
}
assert.deepEqual(formationTemplate('balanced'),{
 slots:4,maxTroops:40,rarityCaps:{N:40,R:14,SR:8,SSR:4,UR:2}
});
const lineup=[{id:1,rarity:'R',count:30},{id:2,rarity:'SR',count:20},
 {id:3,rarity:'N',count:50},{id:4,rarity:'SSR',count:10},{id:5,rarity:'UR',count:10}];
let totals=formationRarityCounts({counts:{1:14,2:8,3:12,4:4,5:2}},lineup);
assert.deepEqual(totals,{N:12,R:14,SR:8,SSR:4,UR:2});
assert.equal(formationCapacityStatus({formation:'balanced',counts:{1:14,2:8,3:12,4:4,5:2}},lineup,40).valid,true);
assert.equal(formationCapacityStatus({formation:'balanced',counts:{1:15,2:8}},lineup,40).valid,false);
assert.match(formationCapacityStatus({formation:'balanced',counts:{1:15,2:8}},lineup,40).error,/R/);
assert.equal(formationCapacityStatus({formation:'balanced',counts:{1:14,2:8,3:19}},lineup,40).valid,false);

const game=createNewGame('固定陣形レアリティ枠');
game.townStage='c01-s01';
game.sortieTestLevel=99;
game.campaign.squads=[
 {id:1,job:'騎士',rarity:'R',count:30,commanderId:'player'},
 {id:2,job:'僧侶',rarity:'SR',count:20,commanderId:'player'},
 {id:3,job:'魔法使い',rarity:'N',count:50,commanderId:'player'},
 {id:4,job:'忍者',rarity:'SSR',count:10,commanderId:'player'},
 {id:5,job:'シーフ',rarity:'UR',count:10,commanderId:'player'},
 {id:6,job:'盾騎士',rarity:'R',count:20,commanderId:'player'}
];
ensureSortiePlan(game);
setSortieFormation(game,1,'balanced');
const team=sortieTeams(game)[0],budget=sortieTemplateCapacity(game,1);
assert.equal(team.formation,'balanced');
assert.equal(sortieAllowedCells(game,1).length,4,'fixed four-slot template at Lv99 does not grow when selected');
assert.ok(sortieTeamCount(team)<=budget.capacity);
assert.ok(budget.valid);
for(const tier of rarities)assert.ok(budget.rarity[tier]<=budget.spec.rarityCaps[tier],
 'auto assignment must obey '+tier+' quota');
assert.throws(()=>setSortieFormationSize(game,1,5),/テンプレート固定/);
const html=renderThreeTeamPlanner({game,teamId:1});
assert.ok(!html.includes('data-sortie-size'),'no manual squad-count plus/minus for fixed presets');
assert.match(html,/R 0?\d+\/14人/);
assert.match(html,/SR 0?\d+\/8人/);
assert.match(html,/SSR 0?\d+\/4人/);
assert.match(html,/UR 0?\d+\/2人/);
const page=renderThreeTeamPlanner({game,teamId:1,view:'templates'});
assert.match(page,/4隊 · 最大40人/);
assert.match(page,/N40 · R14 · SR8 · SSR4 · UR2/);
assert.equal(sortieSquadCap(game),16);
setSortieFormation(game,1,'spear');
assert.equal(sortieAllowedCells(game,1).length,5,'five-slot size comes from selecting a different preset');
assert.equal(sortieTeams(game)[0].formation,'spear');
setSortieFormation(game,1,'free');
assert.equal(sortieAllowedCells(game,1).length,16,'free editing remains separate');
assert.ok(!sortieFormationStatus(game,1).valid);
const town=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
assert.ok(!town.includes('data-sortie-size'));
for(const file of ['src/sortie-formation-template-rules.js','src/sortie-formation-logic.js',
 'src/three-team-sortie.js','src/three-team-sortie-ui.js']){
 new SourceTextModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{identifier:file});
}
console.log('PASS: 14 immutable formation templates, rarity quotas, auto allocation, visual counts, stage caps');
