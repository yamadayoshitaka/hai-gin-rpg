import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNewGame} from '../src/game-core-flow.js';
import {ensureSortiePlan,sortieTeams,sortieTeamCount} from '../src/three-team-sortie.js';
import {inspectInnFormation} from '../src/inn-formation-rules.js';
import {renderInnFormationWizard} from '../src/inn-formation-wizard.js';
import {trainingSoldierStock,inspectTrainingFormationPurchase,
 purchaseAndArrangeTrainingFormation} from '../src/training-formation-purchase.js';

test('training stock exposes unassigned troops, ranks and wallet independently',()=>{
 const game=createNewGame('在庫兵の確認');
 ensureSortiePlan(game);
 const stock=trainingSoldierStock(game,1);
 assert.equal(stock.wallet,300);
 assert.ok(stock.assigned>0);
 assert.ok(stock.byJob.some(x=>x.job==='騎士'));
 assert.equal(stock.unassigned+stock.reserve+stock.assigned,
  game.campaign.squads.reduce((n,s)=>n+s.count,0));
 const html=renderInnFormationWizard({game,view:'roster',teamId:1});
 for(const label of ['在庫兵','所持金','追加雇用','trainingFormationQuote',
  'data-training-auto-formation'])assert.ok(html.includes(label),label);
});

test('formation preview hires only the exact deficit then places real soldiers',()=>{
 const game=createNewGame('兵員自動配置');
 game.sortieTestLevel=99;
 ensureSortiePlan(game);
 const before=game.campaign.treasury;
 const quote=inspectTrainingFormationPurchase(game,1,'attack');
 assert.equal(quote.possible,true);
 assert.equal(quote.hireCount,2,'uses stock Knight and hires only two ranged soldiers');
 assert.equal(quote.cost,20);
 assert.ok(quote.allocations.some(x=>x.job==='騎士'&&x.hire===0));
 assert.ok(quote.allocations.some(x=>x.job==='魔法使い'&&x.hire===2));
 const executed=purchaseAndArrangeTrainingFormation(game,1,'attack');
 assert.equal(executed.cost,20);
 assert.equal(game.wallet,280);
 assert.equal(game.campaign.treasury,before,'payment does not affect campaign treasury');
 assert.equal(sortieTeamCount(sortieTeams(game)[0]),5);
 assert.equal(inspectInnFormation(game,1,'attack').eligible,true);
 assert.equal(sortieTeams(game)[0].formation,'attack');
 const second=inspectTrainingFormationPurchase(game,1,'attack');
 assert.equal(second.cost,0);
 assert.equal(second.already,true);
 purchaseAndArrangeTrainingFormation(game,1,'attack');
 assert.equal(game.wallet,280,'repeated click does not charge twice');
});

test('insufficient gold blocks payment without changing the game',()=>{
 const game=createNewGame('所持金不足');
 game.wallet=0;
 const quote=inspectTrainingFormationPurchase(game,1,'attack');
 assert.equal(quote.possible,false);
 assert.equal(quote.cost,20);
 assert.match(quote.reason,/所持金/);
 const before=JSON.stringify(game.campaign);
 assert.throws(()=>purchaseAndArrangeTrainingFormation(game,1,'attack'),/所持金/);
 assert.equal(game.wallet,0);
 assert.equal(JSON.stringify(game.campaign),before);
});

test('formation pricing respects rarity and occupation of other teams',()=>{
 const game=createNewGame('他隊の兵を盗まない');
 game.sortieTestLevel=99;
 ensureSortiePlan(game);
 const teams=sortieTeams(game),knight=game.campaign.squads[0];
 teams[0].counts[String(knight.id)]=3;
 teams[1].slots[0]=String(knight.id);
 teams[1].counts[String(knight.id)]=27;
 teams[1].divisions[String(knight.id)]=1;
 const quote=inspectTrainingFormationPurchase(game,1,'attack');
 assert.equal(quote.possible,true);
 assert.equal(quote.hireCount,2);
 purchaseAndArrangeTrainingFormation(game,1,'attack');
 assert.equal(sortieTeams(game)[1].counts[String(knight.id)],27);
 const elite=inspectTrainingFormationPurchase(game,1,'dragon');
 assert.equal(elite.possible,false);
 assert.match(elite.reason,/出撃可能人数/,'another squad consumes the deployment limit');
});

test('town click, cached module version and compact layout remain wired',()=>{
 const html=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/three-team-sortie-ui.css',import.meta.url),'utf8');
 assert.match(html,/data-training-auto-formation/);
 assert.match(html,/purchaseAndArrangeTrainingFormation/);
 assert.match(html,/training-auto-formation-20261122/);
 assert.match(css,/trainingStockOverview/);
 assert.match(css,/trainingFormationQuote/);
 assert.match(css,/overflow:hidden!important/);
});
