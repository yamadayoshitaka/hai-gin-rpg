import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {availableFormationOpeningTactics} from '../src/prebattle-opening-tactics.js';

const division=(jobs,orders,hasSummon=false)=>({jobs,orders,hasSummon});
const available=(formation,divisions,options={})=>availableFormationOpeningTactics({
 formation,divisions,enemyCount:3,structureCount:1,buildingCount:1,
 supportAvailable:true,...options
});
test('additional opening tactics require formation, compatible jobs and allowed order',()=>{
 assert.deepEqual(available('balanced',[division(['sword'],['charge'])]),[]);
 assert.deepEqual(available('attack',[division(['sword'],['charge'])]),['melee_split']);
 assert.deepEqual(available('attack',[division(['priest'],['support'])]),[]);
 assert.deepEqual(available('attack',[division(['sword'],['charge'])],{active:false}),[]);
 assert.deepEqual(available('attack',[division(['sword'],['charge'])],{enemyCount:1}),[]);
 assert.deepEqual(available('pincer',[
  division(['sword'],['charge']),division(['mage'],['charge'])
 ]),['melee_split','ranged_split']);
 assert.deepEqual(available('ambush',[division(['ninja'],['charge','weaken'])]),
  ['melee_split','cut_speed']);
});
test('special orders need real battlefield targets and available mechanics',()=>{
 assert.deepEqual(available('support',[division(['priest'],['support'])]),['boost_speed']);
 assert.deepEqual(available('support',[division(['priest'],['support'])],{supportAvailable:false}),[]);
 assert.deepEqual(available('constellation',[division(['summoner'],['explore'])]),[]);
 assert.ok(available('constellation',[division(['summoner'],['explore'],true)]).includes('scout_summon'));
 assert.ok(!available('constellation',[division(['summoner'],['explore'],true)],{buildingCount:0})
  .includes('scout_summon'));
 assert.ok(available('constellation',[division(['mage'],['destroy'])]).includes('destroy_path'));
 assert.ok(!available('constellation',[division(['mage'],['destroy'])],{structureCount:0})
  .includes('destroy_path'));
});
test('opening UI, runtime execution and enlarged no-scroll animation stay connected',()=>{
 const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const ui=file('src/battle-realtime-commands.js'),battle=file('tactics-wireframe.html'),
  inn=file('src/inn-formation-wizard.js'),css=file('src/three-team-sortie-ui.css'),
  town=file('town-hub.html');
 const inline=battle.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(inline,'battle inline module exists');
 new SourceTextModule(inline,{identifier:'tactics-wireframe-inline.js'});
 assert.match(ui,/optgroup label="基本作戦"/);
 assert.match(ui,/陣形・ジョブの追加作戦/);
 assert.match(ui,/ADVANCED_FORMATION_TACTICS/);
 assert.match(battle,/availableFormationOpeningTactics/);
 assert.match(battle,/applyOpeningAdditional/);
 assert.match(battle,/issueTargetedPlan\(/);
 assert.match(battle,/strategy='balanced'/);
 assert.match(inn,/trainingHireJobLabel/);
 assert.match(inn,/在庫兵 /);
 assert.doesNotMatch(inn,/trainingStockOverview/);
 assert.match(css,/height:clamp\(122px,21dvh,200px\)/);
 assert.match(css,/:has\(\.innWizardRosterPreview\)/);
 assert.match(town,/formation-3jobs-20261123/);
});
