import {BUFFS,reserveTroops} from './story-campaign.js';
import {STORY_JOB_TO_BATTLE} from './story-battle-bridge.js';
import {slotLane,slotRank} from './inn-deployment.js';
import {formationJobMinimums,FORMATION_ROLES,formationMinimumForRole} from './sortie-formation-logic.js';
import {inspectInnFormation} from './inn-formation-rules.js';
import {FORMATION_ENTRY_REQUIREMENTS,FORMATION_BATTLE_PURPOSES} from './sortie-formation-template-rules.js';
import {captainBonus} from './army-groups.js';
import {squadEquipmentBonus} from './game-core-flow.js';
import {storyStageContext} from './story-narrative-flow.js';
import {recommendBattlePlans,battleStageContext} from './battle-plan-recommendations.js';
import {allocateThreeTeamSortie,availableSortieOrders,sortieDebuffTypes,sortieFormationBuff,sortieLevel,sortieTeamCount,sortieTeams,SORTIE_FORMATION_CELLS,SORTIE_FORMATIONS} from './three-team-sortie.js';

/** Battle-compatible adaptation of the three user-defined sortie teams.
 * Strategists are never assigned a deployment cell: the protagonist is carried
 * by the first active team, while the selected captain buffs that entire team.
 */
export function makeThreeTeamBattleRequest(game,stage,battleId){
 const chosen=allocateThreeTeamSortie(game,stage);
 const teams=sortieTeams(game).filter(t=>sortieTeamCount(t)>0);
 if(teams.length>3)throw Error('出撃できる隊は最大3隊です。');
 const formationIntegrity=Object.fromEntries(teams.map(team=>{
  const deployed=chosen.filter(item=>item.teamId===team.id),
   requiredSources=team.slots.filter(Boolean).map(String),
   livingSourceIds=new Set(deployed.map(item=>String(item.squad.id))),
   initialCount=deployed.reduce((sum,item)=>sum+item.count,0);
  const valid=sortieFormationBuff(game,team.id);
  const requirements=team.formation==='free'?[]:formationJobMinimums(team,
   game.campaign.squads,SORTIE_FORMATION_CELLS,SORTIE_FORMATIONS[team.formation]?.slots);
  const minBySource=Object.fromEntries(requirements.filter(x=>x.sourceId)
   .map(x=>[x.sourceId,x.min]));
  const complete=requiredSources.length>0&&requirements.length===requiredSources.length&&
   requirements.every(x=>x.valid&&deployed.some(a=>String(a.squad.id)===x.sourceId&&a.count>=x.min))&&
   requiredSources.every(id=>livingSourceIds.has(id))&&
   (valid.attack!==0||valid.defense!==0||valid.mobility!==0||valid.healing!==0);
  return [String(team.id),{
   active:complete,requiredSources,minBySource,initialCount,
   minSurvivors:Math.ceil(initialCount/2),
   formation:complete?team.formation:'free',
   bonus:complete?valid:{attack:0,defense:0,mobility:0,magic:0,healing:0}
  }];
 }));
 const captainById=new Map(chosen.map(a=>[a.teamId,a.captain]));
 const mainSourceByTeam=new Map(teams.map(team=>{
  const group=chosen.filter(x=>x.teamId===team.id);
  const preferred=group.find(x=>String(x.squad.id)===String(team.captainId))||group[0];
  return [team.id,String(preferred.squad.id)];
 }));
 const orders={},allowed={},armyGroupBySquad={},subdivisionMap={};
 const heroTeamId=teams[0]?.id;
 let heroIncluded=false;
 const units=chosen.flatMap(({teamId,squad,count,deploymentSlot,formation,formationCell,divisionCount})=>{
  const captain=captainById.get(teamId),bonus=captainBonus(captain),formationBonus=formationIntegrity[String(teamId)].bonus,
   equipment=squadEquipmentBonus(squad),parts=Math.max(1,Math.min(divisionCount||1,count)),
   sourceId=String(squad.id),group=String(teamId);
  const splits=Array.from({length:parts},(_,i)=>Math.floor(count/parts)+(i<count%parts?1:0));
  const mainSource=String(squad.id)===mainSourceByTeam.get(teamId);
  return splits.flatMap((size,part)=>{
   // Stable unique physical squad ID: every job cell can be commanded
   // independently; all its parts still inherit the parent's group buffs.
   const squadId=teamId*1000+Math.max(0,formationCell)*4+part+1;
   const key=String(squadId);
   // The initial order selection screen is retired: every team starts
   // automatically, and only the central battle panel issues tactics.
   orders[key]='hold';
   // Incomplete formations lose their buffs and special orders, but basic battle
   // tactics must stay selectable; otherwise the command screen is a dead end.
   allowed[key]=formationIntegrity[String(teamId)].active?availableSortieOrders(game,teamId):['charge','defend','hold','retreat'];
   armyGroupBySquad[key]=teamId;
   subdivisionMap[key]={parentGroup:teamId,sourceSquadId:squad.id,part:part+1,parts,formationCell,leaderHeldInMain:mainSource&&part===0};
   return Array.from({length:size},()=>{
    const isStrategist=!heroIncluded&&teamId===heroTeamId&&mainSource&&part===0;
    if(isStrategist)heroIncluded=true;
    return {
     squadId,sourceSquadId:squad.id,commanderId:'player',
     isStrategist,isPlayerHero:isStrategist,
     job:STORY_JOB_TO_BATTLE[squad.job]||'剣士',rarity:squad.rarity,
     equipmentBuff:{...equipment,attack:(equipment.attack||0)+bonus.attack+formationBonus.attack,
      defense:(equipment.defense||0)+bonus.defense+formationBonus.defense},
     formationBuff:{...formationBonus},
     armyGroupId:teamId,teamMainLeader:mainSource&&part===0,
     captain:captain?{id:captain.id,name:captain.characterName||captain.name||captain.job+'代表',
      rarity:captain.rarity,job:captain.job}:null,
     formationType:formationIntegrity[String(teamId)].formation,formationCell,divisionPart:part+1,divisionParts:parts,
     spawnLane:slotLane(deploymentSlot),spawnRank:slotRank(deploymentSlot),deploymentSlot
    };
   });
  });
 });
 if(!heroIncluded)throw Error('主人公を出撃させる隊がありません。');
 const protagonist=game.campaign.commander,level=sortieLevel(game);
 const commanders=[{
  id:'player',name:protagonist.name,level,active:protagonist.active!==false,
  rarity:protagonist.rarity||'R',specialty:protagonist.specialty||'assault',
  gender:protagonist.gender==='female'?'female':'male',faceId:protagonist.faceId||0,
  orders:BUFFS.filter(b=>b.unlock<=level).map(b=>({...b}))
 }];
 // Battle can change a formation without inventing or exchanging soldiers.
 // Precompute valid role/source mappings from the inn's exact roster.
 const formationBattleOptions=Object.fromEntries(teams.map(team=>[String(team.id),
  Object.entries(SORTIE_FORMATIONS).map(([id,formation])=>{
   const assessment=inspectInnFormation(game,team.id,id);
   const assignment=assessment.assignment||[];
   const required=FORMATION_ENTRY_REQUIREMENTS[id];
   const roleMinimums=Object.fromEntries(assignment.map((sid,i)=>
    [String(sid),formationMinimumForRole(FORMATION_ROLES[id][i])]));
   return {id,name:formation.name,purpose:FORMATION_BATTLE_PURPOSES[id]?.purpose||'',
    movement:FORMATION_BATTLE_PURPOSES[id]?.movement||'',
    eligible:assessment.eligible,reason:assessment.reason,
    assignment,roleMinimums,cells:SORTIE_FORMATION_CELLS[id].slice(0,formation.slots),requirements:required,
    bonus:{attack:formation.attack||0,defense:formation.defense||0,
     mobility:formation.mobility||0,magic:formation.magic||0,healing:formation.healing||0}};
  })]));
 const monsterBattle=stage.kind==='explore'||stage.kind==='boss';
 const storyContext=storyStageContext(game,stage.id);
 return {
  version:1,battleId:String(battleId),territoryId:stage.territoryId,
  territoryName:stage.name,terrain:stage.biome,stageId:stage.id,
  winCondition:stage.winCondition||'',
  stagePreset:stage.scenePreset,origin:'game-core',stageKind:stage.kind,
  storyRoute:storyContext?.route||'silver',storyCooperator:storyContext?.routeName||'灰銀軍師',
  storyCoalition:storyContext?.coalition||false,storyDecision:storyContext?.decision||null,
  enemyMode:monsterBattle?'monsters':'army',
  enemyMonsterIds:monsterBattle?[...stage.monsters]:[],
  enemyName:monsterBattle?'魔物群':storyContext?.enemy||'紅炎軍',
  enemyCount:monsterBattle?Math.min(20,Math.max(4,stage.monsters.length*3)):Math.min(50,12+stage.difficulty),
  units,commanders,armyGroupBySquad,initialSquadOrders:orders,
  deploymentLimit:stage.deploymentLimit??50,formationIntegrity,formationBattleOptions,
  availableSquadOrders:allowed,subdivisionMap,sortieLevel:level,
  formationBonuses:Object.fromEntries(teams.map(t=>[String(t.id),formationIntegrity[String(t.id)].bonus])),
  squadDebuffProfiles:Object.fromEntries(teams.map(t=>[String(t.id),formationIntegrity[String(t.id)].active?sortieDebuffTypes(game,t.id):[]])),
  // Old inn strategies remain in saved data for compatibility, but must not
  // be silently applied. Every team's battle plan is chosen on the radar.
  sortieTacticTemplate:Object.fromEntries(teams.map(t=>[String(t.id),[]])),
  initialTeamPlans:Object.fromEntries(teams.map(t=>[String(t.id),{
   order:t.initialOrder||'charge',formation:formationIntegrity[String(t.id)].formation,
   captain:(()=>{const captain=captainById.get(t.id);return captain?{
    id:captain.id,name:captain.characterName||captain.name||captain.job+'代表',
    job:captain.job,rarity:captain.rarity}:null;})(),
   formationActive:formationIntegrity[String(t.id)].active,tactics:t.tactics||[]
  }])),
  battlePlanStage:battleStageContext(stage),
  battlePlanRecommendations:Object.fromEntries(teams.map(t=>[String(t.id),recommendBattlePlans(game,stage,t.id,{limit:7})])),
  battlePlanSelected:Object.fromEntries(teams.map(t=>[String(t.id),null])),
  tacticalTemplate:null,
  totalReserves:reserveTroops(game.campaign),sortieTeamCount:teams.length
 };
}
