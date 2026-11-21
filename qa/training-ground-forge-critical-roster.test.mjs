import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNewGame,forgeSquadWeapon,squadEquipmentBonus,trainingHireCapacity,hireTownSoldiers} from '../src/game-core-flow.js';
import {ensureMajorCharacterSquads,recruit} from '../src/story-campaign.js';
import {renderInnFormationWizard} from '../src/inn-formation-wizard.js';
import {ensureSortiePlan} from '../src/three-team-sortie.js';
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
 assert.match(html,/陣形一覧/);
 assert.match(html,/innWizardRosterPreview/);
 assert.match(html,/trainingFormationList|trainingFormationEmpty/);
 const cost=recruit(game.campaign,{job:'忍者',rarity:'N',count:2,purpose:'前線',commanderId:'player',faceId:0});
 assert.equal(cost,20);
 assert.ok(game.campaign.squads.some(s=>s.job==='忍者'&&s.count===2));
});
test('training hires spend wallet (not treasury) and show precise money and army limits',()=>{
 const game=createNewGame('Wallet QA');
 const treasury=game.campaign.treasury;
 const cap=trainingHireCapacity(game);
 assert.equal(cap.unitCost,10);
 assert.equal(cap.wallet,300);
 assert.equal(cap.affordable,30);
 assert.equal(cap.commanderSpace,60);
 assert.equal(cap.max,30);
 assert.throws(()=>hireTownSoldiers(game,{job:'忍者',count:31}),/最大30人/);
 const hire=hireTownSoldiers(game,{job:'忍者',count:7});
 assert.equal(hire.cost,70);
 assert.equal(hire.wallet,230);
 assert.equal(game.wallet,230);
 assert.equal(game.campaign.treasury,treasury);
 assert.ok(game.campaign.squads.some(s=>s.job==='忍者'&&s.count===7));
 assert.equal(trainingHireCapacity(game).max,23);
 game.wallet=10000;
 assert.equal(trainingHireCapacity(game).max,53,'commander capacity is a separate limit');
 const html=renderInnFormationWizard({game,view:'hire',hireCount:53});
 assert.match(html,/補充できる人数：最大 53人/);
 assert.match(html,/所持金：10000G/);
 assert.match(html,/軍師隊.*残り53人/);
 assert.match(html,/data-training-hire-input/);
 assert.match(html,/最大 53人/);
 game.wallet=0;
 assert.equal(trainingHireCapacity(game).max,0);
 assert.match(renderInnFormationWizard({game,view:'hire'}),/補充できる人数：最大 0人/);
});
test('formation selection shows all presets, remaining headcount and missing rarity or job rules',()=>{
 const game=createNewGame('陣形不足QA');
 ensureSortiePlan(game);
 const team=game.sortiePlan.teams[0];
 team.slots=[null,null,null];team.counts={};team.divisions={};team.grid=Array(16).fill(null);team.formation='free';
 const preview=renderInnFormationWizard({game,view:'roster',teamId:1,rosterFormationPage:2,rosterPreviewId:'dragon'});
 assert.match(preview,/陣形一覧/);
 assert.match(preview,/龍牙陣形/);
 assert.match(preview,/trainingLocked/);
 assert.match(preview,/あと\d+人/);
 assert.match(preview,/不足：/);
 assert.match(preview,/R以上|必要な職業|軍師Lv/);
 assert.match(preview,/signaturePreview/);
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
