import {makeThreeTeamBattleRequest} from './three-team-core-bridge.js';
import {armyGroupFor,armyCaptain,captainBonus} from './army-groups.js';
/**
 * Adapter from the 20x10 campaign to the existing 3D 50-person battle.
 * The battle remains authoritative for wins, unit casualties and monster clears.
 */
import {BUFFS,squadCommanderId,reserveTroops,gainExperience} from './story-campaign.js';
import {coreVictoryReward,verifiedBattleLoot} from './battle-victory-rewards.js';
import {allocateSortieSlots,STORY_JOB_TO_BATTLE,STORY_SPAWN_LANES} from './story-battle-bridge.js';
import {CAMPAIGN_STAGE_BY_ID} from './campaign-stage-plan.js';
import {deploymentForSquad,slotLane,slotRank} from './inn-deployment.js';
import {commandSquadIds,resolvedCommanderDeployment} from './inn-commander-formation.js';
import {storyStageContext} from './story-narrative-flow.js';
import {markStageVictory,squadEquipmentBonus} from './game-core-flow.js';
import {verifyTavernQuestBattle,settleTavernQuestBattle} from './town-side-quests.js';
export const CORE_BATTLE_PENDING_KEY='hai-gin-core-battle-pending-v1';
export const CORE_BATTLE_RESULT_KEY='hai-gin-story-result-v1';
const validStageId=id=>Boolean(CAMPAIGN_STAGE_BY_ID[id]);
export function makeCoreBattleRequest(game,stageId,battleId=String(Date.now())){
 const stage=CAMPAIGN_STAGE_BY_ID[stageId];
 if(!stage||stage.kind==='town'||game?.location!=='map')throw Error('地図上の出撃ステージを選んでください。');
  if(game.sortiePlan?.version===1)return makeThreeTeamBattleRequest(game,stage,battleId);
 const squads=game.campaign.squads.filter(s=>s.count>0&&String(squadCommanderId(s))!=='reserve');
 const allotment=allocateSortieSlots(squads,stage.deploymentLimit??50);
 // When more than 50 soldiers exist, proportional selection can omit a
 // small strategist formation. Reserve one participant per commander so the
 // protagonist and every represented strategist are physically present.
 const represented=new Set(allotment.map(a=>String(squadCommanderId(a.squad))));
 for(const squad of squads){
  const id=String(squadCommanderId(squad));
  if(represented.has(id))continue;
  const donor=[...allotment].filter(a=>a.count>1)
   .sort((a,b)=>b.count-a.count)[0];
  if(!donor)throw Error('軍師が多すぎて出撃枠に収まりません。');
  donor.count--;
  allotment.push({squad,count:1});
  represented.add(id);
 }
 allotment.sort((a,b)=>squads.indexOf(a.squad)-squads.indexOf(b.squad));
 if(!squads.some(s=>String(squadCommanderId(s))==='player')||
    !allotment.some(a=>String(squadCommanderId(a.squad))==='player'))
  throw Error('主人公の軍師部隊を編成してから出撃してください。');
 if(!allotment.length)throw Error('編成された兵士がいません。町で軍団を編成してください。');
 const leaders=[{id:'player',...game.campaign.commander},...game.campaign.commanders];
 const ids=new Set(allotment.map(a=>String(squadCommanderId(a.squad))));
 const commanders=leaders.filter(c=>ids.has(String(c.id))).map(c=>({
  id:String(c.id),name:c.name,level:c.level,active:c.active!==false,
  rarity:c.rarity||'R',specialty:c.specialty||'assault',
  gender:c.gender==='female'?'female':'male',faceId:c.faceId||0,
  orders:BUFFS.filter(b=>b.unlock<=c.level).map(b=>({...b}))
 }));
 const deploymentSquads=allotment.map(item=>item.squad);
 const commandIds=commandSquadIds(squads);
 const commanderPositions=resolvedCommanderDeployment(game.campaign);
 const strategistIncluded=new Set();
 const tacticalTemplate=null;
 const armyGroupBySquad=Object.fromEntries([...commandIds].map(([id,sid])=>[String(sid),armyGroupFor(game.campaign,id)]));
 const groupInitialOrders=game.armyGroupOrders||{};
 const allowedOrders=new Set(['charge','defend','hold','retreat','explore']);
 const initialSquadOrders=Object.fromEntries([...commandIds.values()].map(sid=>{
  const selected=groupInitialOrders[armyGroupBySquad[String(sid)]];
  return [String(sid),allowedOrders.has(selected)?selected:'charge'];
 }));
 const units=allotment.flatMap(({squad,count},i)=>{
  const commanderId=String(squadCommanderId(squad));
  const slot=commanderPositions.get(commanderId)??deploymentForSquad(squad,i,deploymentSquads);
  const commandSquadId=commandIds.get(commanderId);
  const captain=armyCaptain(game.campaign,commanderId),bonus=captainBonus(captain),equipment=squadEquipmentBonus(squad);
  return Array.from({length:count},()=>{
   const isStrategist=!strategistIncluded.has(commanderId);
   strategistIncluded.add(commanderId);
   return {
    squadId:commandSquadId,sourceSquadId:squad.id,commanderId,
    isStrategist,isPlayerHero:isStrategist&&commanderId==='player',
    job:STORY_JOB_TO_BATTLE[squad.job]||'剣士',rarity:squad.rarity,
    equipmentBuff:{...equipment,attack:equipment.attack+bonus.attack,defense:equipment.defense+bonus.defense},
    armyGroupId:armyGroupFor(game.campaign,commanderId),captain,
    spawnLane:slotLane(slot),spawnRank:slotRank(slot),deploymentSlot:slot
   };
  });
 });
 const monsterBattle=stage.kind==='explore'||stage.kind==='boss';
 const storyContext=storyStageContext(game,stage.id);
 return {
  version:1,battleId:String(battleId),territoryId:stage.territoryId,
  territoryName:stage.name,terrain:stage.biome,stageId:stage.id,
  stagePreset:stage.scenePreset,origin:'game-core',stageKind:stage.kind,
  storyRoute:storyContext?.route||'silver',storyCooperator:storyContext?.routeName||'灰銀軍師',
  storyCoalition:storyContext?.coalition||false,storyDecision:storyContext?.decision||null,
  enemyMode:monsterBattle?'monsters':'army',
  enemyMonsterIds:monsterBattle?[...stage.monsters]:[],
  enemyName:monsterBattle?'魔物群':storyContext?.enemy||'紅炎軍',
  enemyCount:monsterBattle?Math.min(20,Math.max(4,stage.monsters.length*3)):Math.min(50,12+stage.difficulty),
  units,commanders,armyGroupBySquad,initialSquadOrders,tacticalTemplate,
  deploymentLimit:stage.deploymentLimit??50,totalReserves:reserveTroops(game.campaign)
 };
}
export function settleCoreBattle(game,request,result){
 if(!game||!request||!result||request.origin!=='game-core'||!validStageId(request.stageId)
 ||request.battleId!==result.battleId||request.territoryId!==result.territoryId
 ||typeof result.victory!=='boolean'||!Array.isArray(result.casualties))
  throw Error('出撃結果に不正があります。');
 if(game.lastCoreBattleId===request.battleId)throw Error('同じ戦闘結果を二重に反映できません。');
 const allowed=new Map();
 for(const unit of request.units||[]){
  const source=unit.sourceSquadId??unit.squadId;
  allowed.set(source,(allowed.get(source)||0)+1);
 }
 const stage=CAMPAIGN_STAGE_BY_ID[request.stageId];
 const optionalQuest=verifyTavernQuestBattle(game,request);
 // Validate battle-consumed inn items against the launch reservation before changing stock.
 const townItemDeductions=[];
 for(const [teamId,items] of Object.entries(result.townItemsSpent||{})){
  const reserved=request.townItemLoadouts?.[String(teamId)];
  if(!reserved||!items||typeof items!=='object')throw Error('持参アイテムの戦闘結果が不正です。');
  for(const [itemId,value] of Object.entries(items)){
   const used=Number(value),limit=Number(reserved[itemId]||0);
   if(!Number.isInteger(used)||used<0||used>limit||
      used>Number(game.inventory?.[itemId]||0))throw Error('持参アイテムの消費数が不正です。');
   townItemDeductions.push({teamId:Number(teamId),itemId,used});
  }
 }
 const combined=new Map();
 for(const row of townItemDeductions)combined.set(row.itemId,(combined.get(row.itemId)||0)+row.used);
 if([...combined].some(([id,n])=>n>Number(game.inventory?.[id]||0)))
  throw Error('複数隊で持参品の在庫を超過しました。');
 if(result.victory&&(optionalQuest||stage.kind==='explore'||stage.kind==='boss')&&result.monstersRemaining!==0)
  throw Error('討伐したモンスター数を確認できませんでした。');
 let casualties=0;
 const seen=new Set(),changes=[];
 for(const item of result.casualties){
  const id=item?.squadId,n=item?.count,squad=game.campaign.squads.find(s=>s.id===id);
  if(!Number.isInteger(n)||n<0||!squad||seen.has(id)||n>allowed.get(id)||n>squad.count)throw Error('戦死者数に不正があります。');
  seen.add(id);changes.push([squad,n]);casualties+=n;
 }
 for(const [squad,n] of changes)squad.count-=n;
 game.campaign.squads=game.campaign.squads.filter(x=>x.count>0);
 // Consumed supplies never reappear in town stock or a team's reserved bag.
 for(const {teamId,itemId,used} of townItemDeductions){
  if(!used)continue;
  game.inventory[itemId]-=used;
  const team=game.sortiePlan?.teams?.find(t=>Number(t.id)===teamId);
  if(team?.items){
   const left=Math.max(0,Number(team.items[itemId]||0)-used);
   if(left)team.items[itemId]=left;else delete team.items[itemId];
  }
 }

 const fallenHero=changes.find(([s,n])=>Boolean(s.criticalCharacter)&&n>0)?.[0]||null;
 const protagonistDead=result.playerCommanderDead===true||
  String(fallenHero?.characterId||'').startsWith('commander-');
 const criticalDead=Boolean(fallenHero);
 const gameOverDead=protagonistDead||criticalDead;
 const victory=Boolean(result.victory&&!gameOverDead);
 if(gameOverDead){
  if(protagonistDead)game.campaign.commander.active=false;
  game.campaign.gameOver=protagonistDead?'主人公が戦死しました。GAME OVER':
   (fallenHero.characterName||'主要人物')+'が戦死しました。GAME OVER';
  game.location='gameover';
 }
 game.lastCoreBattleId=request.battleId;
 let next=null;
 if(victory){
  const isMonster=Boolean(optionalQuest)||stage.kind==='explore'||stage.kind==='boss';
  const confirmedMonsterClear=isMonster?result.monstersRemaining===0:true;
  const objectiveCompleted=result.objectiveCompleted===true||
   (!isMonster&&result.victory===true);
  if(optionalQuest){
   // A side quest never advances the 200-stage story or receives the main-stage reward.
   // Only the actual battle's verified win can settle this pending tavern contract.
   const reward=settleTavernQuestBattle(game,request,{victory:true,monstersRemaining:result.monstersRemaining});
   gainExperience(game.campaign,reward.xp);
   const treasure=verifiedBattleLoot(result.loot);
   game.inventory??={};
   for(const item of treasure)game.inventory[item.itemId]=(Number(game.inventory[item.itemId])||0)+item.quantity;
   result.settledRewards={gold:reward.gold,xp:reward.xp,loot:treasure};
  }else{
   next=markStageVictory(game,stage.id,{
    verified:true,victory:true,
    ...(isMonster?{monstersRemaining:result.monstersRemaining}:{objectiveCompleted}),
    ...(!isMonster?{}:{objectiveCompleted:true})
   });
   if(['capture','siege'].includes(stage.kind)){
    if(!Array.isArray(game.capturedAreas))game.capturedAreas=[];
    if(!game.capturedAreas.includes(stage.id))game.capturedAreas.push(stage.id);
   }
   if(!confirmedMonsterClear)throw Error('討伐結果を確認できませんでした。');
   const reward=coreVictoryReward(stage);
   game.wallet=(Number(game.wallet)||0)+reward.gold;
   gainExperience(game.campaign,reward.xp);
   const treasure=verifiedBattleLoot(result.loot);
   game.inventory??={};
   for(const item of treasure)game.inventory[item.itemId]=(Number(game.inventory[item.itemId])||0)+item.quantity;
   result.settledRewards={...reward,loot:treasure};
  }
 }
 if(optionalQuest&&!victory)settleTavernQuestBattle(game,request,{victory:false});
 game.history.unshift((optionalQuest?optionalQuest.title:stage.name)+'：'+(protagonistDead?'主人公戦死・GAME OVER':criticalDead?'主要人物戦死・GAME OVER':victory?'勝利':'敗北')+'。損害'+casualties+'人。');
 game.history=game.history.slice(0,50);
 return {victory,playerCommanderDead:protagonistDead,majorCharacterDead:criticalDead,gameOver:game.campaign.gameOver||null,casualties,stage,next,rewards:result.settledRewards||{gold:0,xp:0,loot:[]}};
}
