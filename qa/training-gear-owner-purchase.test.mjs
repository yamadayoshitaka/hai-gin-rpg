import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createNewGame,buyAndEquipSquadItem,transferSquadItem,squadEquipmentUsers,
 equipSquadItem,squadEquipmentBonus
} from '../src/game-core-flow.js';
import {ensureSortiePlan} from '../src/three-team-sortie.js';
import {renderInnFormationWizard} from '../src/inn-formation-wizard.js';

const makeShieldGame=()=>{
 const game=createNewGame('装備確認QA');
 const source=game.campaign.squads[0];
 const shield={id:999,job:'盾騎士',rarity:'N',count:3,commanderId:'player',purpose:'前線'};
 game.campaign.squads.push(shield);
 ensureSortiePlan(game);
 for(const team of game.sortiePlan.teams){
  team.formation='free';team.slots=[null,null,null];team.counts={};
  team.divisions={};team.grid=Array(16).fill(null);
 }
 const team=game.sortiePlan.teams[0];
 team.formation='free';team.slots=['999',null,null];team.counts={'999':3};
 team.divisions={'999':1};team.grid=Array(16).fill(null);
 return {game,source,shield};
};

test('initial sword is assigned to a named squad even when that squad is not currently deployed',()=>{
 const {game,source,shield}=makeShieldGame();
 assert.equal(source.equipment.weapon,'iron_sword');
 assert.equal(game.inventory.iron_sword,1);
 assert.deepEqual(squadEquipmentUsers(game,'iron_sword',shield.id).map(u=>u.squadId),[source.id]);
 const html=renderInnFormationWizard({game,teamId:1,view:'equipmentPick',
  gearSourceId:String(shield.id),gearCategory:'武器'});
 assert.match(html,/鉄の剣/);
 assert.match(html,/未使用 0個/);
 assert.match(html,/使用中：/);
 assert.match(html,/#/);
 assert.match(html,/編成外/);
 assert.match(html,/data-inn-wizard-buy-equip="iron_sword"/);
 assert.match(html,/購入 120G ＋ 装備/);
 assert.match(html,/data-inn-wizard-transfer="iron_sword"/);
 assert.match(html,/元の装備は解除/);
});

test('buy and equip atomically increases physical inventory, charges wallet once and respects class',()=>{
 const {game,source,shield}=makeShieldGame();
 const wallet=game.wallet;
 assert.throws(()=>equipSquadItem(game,shield.id,'iron_sword','武器'),/使用中/);
 const bought=buyAndEquipSquadItem(game,shield.id,'iron_sword','武器');
 assert.equal(bought.price,120);
 assert.equal(game.wallet,wallet-120);
 assert.equal(game.inventory.iron_sword,2);
 assert.equal(shield.equipment.weapon,'iron_sword');
 assert.equal(source.equipment.weapon,'iron_sword');
 assert.equal(squadEquipmentBonus(shield).attack,.14);
 const incompatible={id:998,job:'僧侶',count:1,rarity:'N',commanderId:'player'};
 game.campaign.squads.push(incompatible);
 const oldBalance=game.wallet,oldQty=game.inventory.iron_sword;
 assert.throws(()=>buyAndEquipSquadItem(game,incompatible.id,'iron_sword','武器'),/装備できません/);
 assert.equal(game.wallet,oldBalance);
 assert.equal(game.inventory.iron_sword,oldQty);
 game.wallet=0;
 assert.throws(()=>buyAndEquipSquadItem(game,shield.id,'iron_sword','武器'),/所持金が不足/);
 assert.equal(game.inventory.iron_sword,oldQty);
});

test('transfer moves exactly one equipped sword without cost or gear duplication',()=>{
 const {game,source,shield}=makeShieldGame();
 const oldWallet=game.wallet,oldStock=game.inventory.iron_sword;
 const moved=transferSquadItem(game,source.id,shield.id,'iron_sword','武器');
 assert.equal(moved.from.id,source.id);
 assert.equal(source.equipment.weapon,null);
 assert.equal(shield.equipment.weapon,'iron_sword');
 assert.equal(game.wallet,oldWallet);
 assert.equal(game.inventory.iron_sword,oldStock);
 assert.equal(squadEquipmentUsers(game,'iron_sword').length,1);
 assert.throws(()=>transferSquadItem(game,source.id,shield.id,'iron_sword','武器'),/移し替え元/);
});

test('town buttons and phone layout expose purchases without detouring through the blacksmith',()=>{
 const town=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/three-team-sortie-ui.css',import.meta.url),'utf8');
 assert.match(town,/data-inn-wizard-buy-equip/);
 assert.match(town,/data-inn-wizard-transfer/);
 assert.match(town,/buyAndEquipSquadItem/);
 assert.match(town,/transferSquadItem/);
 assert.match(css,/\.innGearCatalog/);
 assert.match(css,/:has\(\.innGearCatalog\) \.innWizardBody\{[\s\S]*?overflow:hidden!important/);
});
