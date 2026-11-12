/**
 * Adapter from the 20x10 campaign to the existing 3D 50-person battle.
 * The battle remains authoritative for wins, unit casualties and monster clears.
 */
import {BUFFS,squadCommanderId,reserveTroops,gainExperience} from './story-campaign.js';
import {coreVictoryReward,verifiedBattleLoot} from './battle-victory-rewards.js';
import {allocateSortieSlots,STORY_JOB_TO_BATTLE,STORY_SPAWN_LANES} from './story-battle-bridge.js';
import {CAMPAIGN_STAGE_BY_ID} from './campaign-stage-plan.js';
import {deploymentForSquad,slotLane,slotRank} from './inn-deployment.js';
import {storyStageContext} from './story-narrative-flow.js';
import {markStageVictory,squadEquipmentBonus} from './game-core-flow.js';
export const CORE_BATTLE_PENDING_KEY='hai-gin-core-battle-pending-v1';
export const CORE_BATTLE_RESULT_KEY='hai-gin-story-result-v1';
const validStageId=id=>Boolean(CAMPAIGN_STAGE_BY_ID[id]);
export function makeCoreBattleRequest(game,stageId,battleId=String(Date.now())){
 const stage=CAMPAIGN_STAGE_BY_ID[stageId];
 if(!stage||stage.kind==='town'||game?.location!=='map')throw Error('地図上の出撃ステージを選んでください。');
 const squads=game.campaign.squads.filter(s=>s.count>0&&String(squadCommanderId(s))!=='reserve');
 const allotment=allocateSortieSlots(squads);
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
 const units=allotment.flatMap(({squad,count},i)=>{
  const slot=deploymentForSquad(squad,i,deploymentSquads);
  return Array.from({length:count},()=>({
   squadId:squad.id,commanderId:String(squadCommanderId(squad)),
   job:STORY_JOB_TO_BATTLE[squad.job]||'剣士',rarity:squad.rarity,
   equipmentBuff:squadEquipmentBonus(squad),
   spawnLane:slotLane(slot),spawnRank:slotRank(slot),deploymentSlot:slot
  }));
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
  units,commanders,totalReserves:reserveTroops(game.campaign)
 };
}
export function settleCoreBattle(game,request,result){
 if(!game||!request||!result||request.origin!=='game-core'||!validStageId(request.stageId)
 ||request.battleId!==result.battleId||request.territoryId!==result.territoryId
 ||typeof result.victory!=='boolean'||!Array.isArray(result.casualties))
  throw Error('出撃結果に不正があります。');
 if(game.lastCoreBattleId===request.battleId)throw Error('同じ戦闘結果を二重に反映できません。');
 const allowed=new Map();
 for(const unit of request.units||[])allowed.set(unit.squadId,(allowed.get(unit.squadId)||0)+1);
 const stage=CAMPAIGN_STAGE_BY_ID[request.stageId];
 if(result.victory&&(stage.kind==='explore'||stage.kind==='boss')&&result.monstersRemaining!==0)
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

 game.lastCoreBattleId=request.battleId;
 let next=null;
 if(result.victory){
  const isMonster=stage.kind==='explore'||stage.kind==='boss';
  const confirmedMonsterClear=isMonster?result.monstersRemaining===0:true;
  const objectiveCompleted=result.objectiveCompleted===true||
   (!isMonster&&result.victory===true);
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
 game.history.unshift(stage.name+'：'+(result.victory?'勝利':'敗北')+'。損害'+casualties+'人。');
 game.history=game.history.slice(0,50);
 return {victory:result.victory,casualties,stage,next,rewards:result.settledRewards||{gold:0,xp:0,loot:[]}};
}
