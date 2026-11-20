import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {createNewGame} from '../src/game-core-flow.js';
import {MassBattleGridSimulation} from '../src/mass-battle-grid-sim.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';
import {
 ensureSortiePlan,setSortieFormation,setSortieGridCell,setSortieTactics,sortieFormationStatus,sortieFormationBuff,
 availableSortieOrders,sortieTeamCount,sortieDebuffTypes,SORTIE_FORMATION_CELLS
} from '../src/three-team-sortie.js';
import {FORMATION_ROLES,ROLE_JOBS} from '../src/sortie-formation-logic.js';
import {renderThreeTeamPlanner} from '../src/three-team-sortie-ui.js';
import {STRATEGY_TREE,STRATEGY_METHODS} from '../src/three-step-strategy-catalog.js';
import {planStrategyDistribution} from '../src/targeted-strategy-runtime.js';

const game=createNewGame('正確な陣形回帰');
game.campaign.squads.push(
 {id:3,job:'魔法使い',rarity:'N',count:10,commanderId:'player'},
 {id:4,job:'忍者',rarity:'N',count:10,commanderId:'player'});
ensureSortiePlan(game);
assert.equal(sortieTeamCount(game.sortiePlan.teams[0]),40);
assert.equal(sortieFormationStatus(game,1).valid,true,'initial knight and priest occupy their matching roles');
const originalAttack=sortieFormationBuff(game,1).attack;
assert.ok(originalAttack>0);
for(const [id,cells] of Object.entries(SORTIE_FORMATION_CELLS)){
 assert.equal(cells.length,16,'each formation supports extra reserve jobs');
 assert.equal(new Set(cells).size,16,'formation cells must be unique');
 assert.equal(FORMATION_ROLES[id].length,16);
 assert.ok(FORMATION_ROLES[id].slice(0,4).every(role=>ROLE_JOBS[role]?.length));
}
const signatures=Object.values(SORTIE_FORMATION_CELLS).map(c=>c.slice(0,4).slice().sort((a,b)=>a-b).join(','));
assert.equal(new Set(signatures).size,14,'all 14 formation preview silhouettes must differ');
const templates=renderThreeTeamPlanner({game,teamId:1,view:'templates'});
assert.equal((templates.match(/class="occupied"/g)||[]).length,24,
 'six cards show exactly four occupied cells each, rather than all 16');
assert.match(templates,/前衛/);assert.match(templates,/盾役/);

setSortieFormation(game,1,'free');
setSortieGridCell(game,1,15,1);
assert.equal(sortieFormationStatus(game,1).valid,false);
assert.equal(sortieFormationStatus(game,1).id,'free');
assert.deepEqual(sortieFormationBuff(game,1),{attack:0,defense:0,mobility:0,healing:0});
assert.deepEqual(availableSortieOrders(game,1),[],'free layout has no battle orders');
assert.deepEqual(sortieDebuffTypes(game,1),[],'free layout has no weakening commands');
assert.equal(sortieTeamCount(game.sortiePlan.teams[0]),40,'moving does not duplicate or consume troops');
setSortieFormation(game,1,'balanced');
assert.equal(sortieFormationStatus(game,1).valid,true);
assert.equal(sortieFormationBuff(game,1).attack,originalAttack);
assert.throws(()=>setSortieGridCell(game,1,6,1),/固定配置/,
 'a frontline knight cannot occupy a support slot');
setSortieFormation(game,1,'attack');
assert.ok(!game.sortiePlan.teams[0].slots.filter(Boolean).includes('2'),
 'auto-selected attack formation excludes priests rather than placing them in invalid front/scout/ranged cells');
setSortieFormation(game,1,'balanced');
setSortieTactics(game,1,['melee_focus','heal_wounded']);
assert.deepEqual(game.sortiePlan.teams[0].tactics,['melee_focus','heal_wounded'],
 'inn saves multiple compatible methods without assigning targets');
assert.throws(()=>setSortieTactics(game,1,['scout_summon']),/職業|条件/,
 'unowned summoner skills cannot be planned');
const innOrders=renderThreeTeamPlanner({game,teamId:1,view:'orders',strategyFamily:'support',strategyIntent:'heal'});
assert.match(innOrders,/data-sortie-strategy-method="heal_wounded"/);
assert.match(innOrders,/設定済み作戦・兵員配分率/);
game.location='map';
const request=makeCoreBattleRequest(game,'c01-s02','three-level-inn-planning');
assert.deepEqual(request.sortieTacticTemplate['1'],['melee_focus','heal_wounded'],
 'the real battle request carries the inn template forward');

assert.equal(Object.keys(STRATEGY_TREE).length,6);
for(const [family,x] of Object.entries(STRATEGY_TREE)){
 for(const [goal,detail] of Object.entries(x.intents)){
  assert.ok(detail.methods.length>0,family+' / '+goal+' has actions');
  for(const method of detail.methods){
   assert.equal(STRATEGY_METHODS[method.id],method);
   assert.ok(['enemy','object','map'].includes(method.type));
   assert.ok(['charge','defend','hold','retreat','support','explore','destroy','weaken'].includes(method.mode));
  }
 }
}
assert.equal(STRATEGY_METHODS.prevent_heal.debuff.stat,'heal_block');
assert.equal(STRATEGY_METHODS.prevent_buff.debuff.stat,'buff_block');
const candidates={allowed:['charge','weaken'],squads:[
 {id:'sword',soldiers:2,jobs:['sword'],allowed:['charge']},
 {id:'mage',soldiers:3,jobs:['mage'],allowed:['charge','weaken']},
 {id:'ninja',soldiers:5,jobs:['ninja'],allowed:['charge','weaken']}
]};
const split=planStrategyDistribution(candidates,['sword','mage','ninja'],
 ['melee_focus','cut_attack','cut_speed']);
assert.equal(split.total,0,'different tactics cannot silently split a unified squad');
const uniform={allowed:['hold'],squads:[
 {id:'sword',soldiers:2,jobs:['sword'],allowed:['hold']},
 {id:'mage',soldiers:3,jobs:['mage'],allowed:['hold']},
 {id:'ninja',soldiers:5,jobs:['ninja'],allowed:['hold']}
]};
const plan=planStrategyDistribution(uniform,['sword','mage','ninja'],['hold_line']);
assert.equal(plan.total,3);
assert.equal(plan.unmatched.length,0);
assert.equal(plan.rows.length,1,'the squad has exactly one action');
assert.equal(plan.rows[0].percent,100);
assert.equal(plan.totalSoldiers,10);
assert.deepEqual(plan.rows[0].squadIds,['sword','mage','ninja']);
const invalid=planStrategyDistribution(candidates,['sword','mage','ninja'],['melee_focus']);
assert.equal(invalid.total,0,'incompatible jobs must not be left behind without warning');
assert.equal(invalid.unmatched.length,2);

const sim=Object.create(MassBattleGridSimulation.prototype);
sim.time=1;sim.squadDebuffs=new Map();sim.squadItemBuffs=new Map();sim.enemySquadItemBuffs=new Map();
const enemy={team:1,squadId:'enemy',alive:true,hp:50,maxHp:100};
sim.units=[enemy];
assert.equal(sim.applySquadDebuff('enemy','heal_block',1,20,1),true);
assert.equal(sim.applySquadDebuff('enemy','buff_block',1,20,1),true);
assert.equal(sim._squadDebuff(enemy,'heal_block'),1);
assert.equal(sim.applySquadItemBuff('enemy','test',{attack:.2},20,1),false,
 'suppression must reject active buffs, not merely display a label');
assert.equal(sim.healSquadFromItem('enemy',50,1),false,'healing denial is applied to the simulation');
sim.time=22;
assert.equal(sim._squadDebuff(enemy,'heal_block'),0);

for(const path of ['src/sortie-formation-logic.js','src/three-step-strategy-catalog.js',
 'src/three-team-sortie.js','src/three-team-sortie-ui.js','src/targeted-strategy-runtime.js']){
 new SourceTextModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{identifier:path});
}
const html=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(html,/tacticId/);assert.match(html,/plan\.plans\?\.find/);
assert.match(html,/massWorker\?\.buffSquadItem/);
console.log('PASS: distinct formation silhouettes, real job-role matching, free layout, 3-stage multi-target methods, 100% physical allocations, active prevention buffs');
