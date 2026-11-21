import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNewGame,forgeSquadWeapon,squadEquipmentBonus} from '../src/game-core-flow.js';
import {ensureMajorCharacterSquads,recruit} from '../src/story-campaign.js';
import {renderInnFormationWizard} from '../src/inn-formation-wizard.js';
import {makeCoreBattleRequest,settleCoreBattle} from '../src/core-battle-bridge.js';

test('training roster includes exactly one named strategist-swordsman and Garan',()=>{
 const game=createNewGame('新主人公',{gender:'male',faceId:0});
 assert.equal(ensureMajorCharacterSquads(game.campaign).length,2);
 assert.equal(ensureMajorCharacterSquads(game.campaign).length,0);
 const named=game.campaign.squads.filter(s=>s.criticalCharacter);
 assert.deepEqual(named.map(s=>s.characterName),['新主人公','ガラン']);
 assert.deepEqual(named.map(s=>s.job),['剣士','騎士']);
 assert.ok(named.every(s=>s.count===1));
 const html=renderInnFormationWizard({game,view:'roster',teamId:1});
 assert.match(html,/軍訓練所/);
 assert.match(html,/使用可能な陣形/);
 assert.match(html,/innWizardRosterPreview/);
 assert.match(html,/trainingFormationList|trainingFormationEmpty/);
 const cost=recruit(game.campaign,{job:'忍者',rarity:'N',count:2,purpose:'前線',commanderId:'player',faceId:0});
 assert.equal(cost,20);
 assert.ok(game.campaign.squads.some(s=>s.job==='忍者'&&s.count===2));
});
test('blacksmith charges gold, remembers a specific weapon +1 and changes real battle buff',()=>{
 const game=createNewGame('鍛冶QA');
 const squad=game.campaign.squads[0],base=squadEquipmentBonus(squad).attack;
 const old=game.wallet;
 const result=forgeSquadWeapon(game,squad.id);
 assert.equal(result.level,1);
 assert.equal(result.cost,100);
 assert.equal(game.wallet,old-100);
 assert.equal(Math.round((squadEquipmentBonus(squad).attack-base)*100),5);
 assert.throws(()=>forgeSquadWeapon(game,game.campaign.squads[1].id),/武器を装備/);
});
test('death of a named ally is GAME OVER even if the protagonist remains alive',()=>{
 const game=createNewGame('戦死QA',{gender:'female',faceId:0});
 ensureMajorCharacterSquads(game.campaign);
 const garan=game.campaign.squads.find(s=>s.characterId==='garan');
 game.location='map';
 const req=makeCoreBattleRequest(game,'c01-s02','training-critical-1');
 assert.ok(req.units.some(u=>u.sourceSquadId===garan.id),'Garan must actually be available for battle');
 const result=settleCoreBattle(game,req,{battleId:req.battleId,territoryId:req.territoryId,
  victory:false,casualties:[{squadId:garan.id,count:1}]});
 assert.equal(result.victory,false);
 assert.equal(result.majorCharacterDead,true);
 assert.equal(result.playerCommanderDead,false);
 assert.match(game.campaign.gameOver,/ガラン.*GAME OVER/);
 assert.equal(game.location,'gameover');
});
test('town keeps tavern contracts and gacha while exposing training hire and forging',()=>{
 const town=readFileSync(new URL('../town-hub.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/three-team-sortie-ui.css',import.meta.url),'utf8');
 for(const key of ['軍訓練所','鍛冶屋','data-training-open','data-training-hire','data-tavern-gacha',
  'data-forge-weapon','data-inn-wizard-preview','data-inn-wizard-roster-formation-page'])
  assert.ok(town.includes(key),'missing town route '+key);
 assert.match(css,/:has\(\.innWizardRosterPreview\)/);
 assert.match(css,/overflow:hidden!important/);
});
