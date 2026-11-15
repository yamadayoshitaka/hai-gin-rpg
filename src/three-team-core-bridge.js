import {BUFFS,reserveTroops} from './story-campaign.js';
import {STORY_JOB_TO_BATTLE} from './story-battle-bridge.js';
import {slotLane,slotRank} from './inn-deployment.js';
import {captainBonus} from './army-groups.js';
import {squadEquipmentBonus} from './game-core-flow.js';
import {storyStageContext} from './story-narrative-flow.js';
import {allocateThreeTeamSortie,sortieTeamCount,sortieTeams} from './three-team-sortie.js';

/** Battle-compatible adaptation of the three user-defined sortie teams.
 * Strategists are never assigned a deployment cell: the protagonist is carried
 * by the first active team, while the selected captain buffs that entire team.
 */
export function makeThreeTeamBattleRequest(game,stage,battleId){
 const chosen=allocateThreeTeamSortie(game,stage);
 const teams=sortieTeams(game).filter(t=>sortieTeamCount(t)>0);
 if(teams.length>3)throw Error('出撃できる隊は最大3隊です。');
 const captainById=new Map(chosen.map(a=>[a.teamId,a.captain]));
 const orders=Object.fromEntries(teams.map(t=>[
  String(t.id),chosen.find(a=>a.teamId===t.id)?.initialOrder||'hold'
 ]));
 const armyGroupBySquad=Object.fromEntries(teams.map(t=>[String(t.id),t.id]));
 const heroTeamId=teams[0]?.id;
 let heroIncluded=false;
 const units=chosen.flatMap(({teamId,squad,count,deploymentSlot,formation})=>{
  const captain=captainById.get(teamId),bonus=captainBonus(captain),
   equipment=squadEquipmentBonus(squad);
  return Array.from({length:count},()=>{
   const isStrategist=!heroIncluded&&teamId===heroTeamId;
   if(isStrategist)heroIncluded=true;
   return {
    squadId:teamId,sourceSquadId:squad.id,commanderId:'player',
    isStrategist,isPlayerHero:isStrategist,
    job:STORY_JOB_TO_BATTLE[squad.job]||'剣士',rarity:squad.rarity,
    equipmentBuff:{...equipment,attack:equipment.attack+bonus.attack,defense:equipment.defense+bonus.defense},
    armyGroupId:teamId,captain:captain?{
     id:captain.id,name:captain.characterName||captain.name||captain.job+'代表',
     rarity:captain.rarity,job:captain.job
    }:null,
    formationType:formation,
    spawnLane:slotLane(deploymentSlot),spawnRank:slotRank(deploymentSlot),deploymentSlot
   };
  });
 });
 if(!heroIncluded)throw Error('主人公を出撃させる隊がありません。');
 const protagonist=game.campaign.commander;
 const commanders=[{
  id:'player',name:protagonist.name,level:protagonist.level,active:protagonist.active!==false,
  rarity:protagonist.rarity||'R',specialty:protagonist.specialty||'assault',
  gender:protagonist.gender==='female'?'female':'male',faceId:protagonist.faceId||0,
  orders:BUFFS.filter(b=>b.unlock<=protagonist.level).map(b=>({...b}))
 }];
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
  units,commanders,armyGroupBySquad,initialSquadOrders:orders,tacticalTemplate:null,
  totalReserves:reserveTroops(game.campaign),sortieTeamCount:teams.length
 };
}
