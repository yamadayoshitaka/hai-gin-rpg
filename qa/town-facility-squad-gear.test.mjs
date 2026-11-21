import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderInnFormationWizard} from '../src/inn-formation-wizard.js';
import {
 createNewGame,buyTownItem,equipSquadItem,squadEquipmentBonus,
 acceptTownEvent,claimTownEvent,leaveTown
} from '../src/game-core-flow.js';
import {autoFormArmy} from '../src/story-campaign.js';
import {makeCoreBattleRequest} from '../src/core-battle-bridge.js';

const game=createNewGame('QA軍師',{gender:'male',faceId:0});
assert.equal(game.campaign.squads[0].equipment.weapon,'iron_sword');
assert.equal(squadEquipmentBonus(game.campaign.squads[0]).attack,.14);
assert.equal(squadEquipmentBonus(game.campaign.squads[0]).defense,.10);
assert.throws(()=>equipSquadItem(game,game.campaign.squads[1].id,'iron_sword','武器'),/装備できません/);
const first=game.campaign.squads[0];
game.campaign.squads.push({id:999,job:'騎士',count:1,rarity:'N',purpose:'前線',commanderId:'reserve'});
assert.throws(()=>equipSquadItem(game,999,'iron_sword','武器'),/使用中/);
buyTownItem(game,'iron_sword');
equipSquadItem(game,999,'iron_sword','武器');
assert.equal(squadEquipmentBonus(game.campaign.squads.at(-1)).attack,.14);
assert.equal(game.inventory.iron_sword,2);

acceptTownEvent(game,'revna-patrol');
assert.throws(()=>acceptTownEvent(game,'revna-patrol'),/受注済み/);
assert.throws(()=>claimTownEvent(game,'revna-patrol'),/未達成/);
game.completedStages.push('c01-s02');
const wallet=game.wallet;
claimTownEvent(game,'revna-patrol');
assert.equal(game.wallet,wallet+110);
assert.throws(()=>claimTownEvent(game,'revna-patrol'),/受取済み/);

const fresh=createNewGame('編成QA',{gender:'female',faceId:0});
autoFormArmy(fresh.campaign,'player','均衡');
assert.equal(fresh.campaign.squads.filter(s=>s.equipment?.weapon==='iron_sword').length,1,
 'auto-formation must not duplicate purchased squad gear');
assert.equal(fresh.campaign.squads.filter(s=>s.equipment?.armor==='leather_armor').length,1,
 'armor must survive auto-formation exactly once');
leaveTown(fresh);
const battle=makeCoreBattleRequest(fresh,'c01-s02','qa-passive-gear');
const equipped=battle.units.filter(u=>u.equipmentBuff?.attack===.14);
assert.ok(equipped.length>0,'active squad equipment must reach the actual battle units');
assert.ok(equipped.every(u=>u.equipmentBuff.defense===.10));
// Phone-sized training roster stays paged; the optional quote lives on its own
// screen and weapon / armor selection is one explicit next-step action.
const roster=renderInnFormationWizard({game,view:'roster',teamId:1});
assert.match(roster,/data-inn-wizard-quote=/);
assert.match(roster,/data-inn-wizard-preview=/);
assert.match(roster,/trainingFormationAnimation/);
assert.match(roster,/次へ：武器・防具/);
assert.match(roster,/武器・防具は次の画面/);
assert.match(roster,/⚔/);
assert.equal((roster.match(/data-inn-wizard-preview=/g)||[]).length,3,
 'formation list should have just one row of three options');
assert.doesNotMatch(roster,/class="trainingFormationQuote"/,
 'purchase quote should not force the troop roster to scroll');
const chosen=roster.match(/data-inn-wizard-quote="([^"]+)"/)?.[1];
assert.ok(chosen,'selected preview must be reachable');
const quote=renderInnFormationWizard({game,view:'rosterQuote',teamId:1,rosterPreviewId:chosen});
assert.match(quote,/class="trainingFormationQuote"/);
assert.match(quote,/data-training-auto-formation=/);
assert.match(quote,/trainingFormationAnimation/);
const equipment=renderInnFormationWizard({game,view:'equipment',teamId:1});
assert.match(equipment,/data-inn-wizard-gear-source=/);
assert.match(equipment,/武器：/);
assert.match(equipment,/防具：/);
const css=readFileSync(new URL('../src/three-team-sortie-ui.css',import.meta.url),'utf8');
assert.match(css,/#panel\.formation-command-ui:has\(\.innWizardRosterPreview\) \.innWizardBody\{[\s\S]*?overflow:hidden!important/);
const town=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
assert.match(town,/data-inn-wizard-quote/);
assert.match(town,/rosterQuote:'roster'/);
assert.match(town,/rosterQuote:'equipment'/);

console.log('town facility contracts, squad equipment inventory and battle passives: PASS');
