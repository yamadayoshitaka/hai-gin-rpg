/**
 * Inn plan: one strategy owns one reusable three-team formation template.
 * Slots are references to real sortie teams; never clone campaign soldiers.
 */
import {
 ensureSortiePlan,sortieTeams,sortieLevel,SORTIE_FORMATIONS,
 setSortieFormation,sortieTeamSquads,availableSortieOrders
} from './three-team-sortie.js';
import {STRATEGY_METHODS,STORY_JOB_TO_STRATEGY_JOB} from './three-step-strategy-catalog.js';

export const THREE_TEAM_STRATEGY_TYPES=Object.freeze({
 attack:Object.freeze({name:'殲滅',description:'前衛中心に敵戦力を削る',
  recommended:[['attack','balanced'],['wedge','attack','balanced'],['arrow','support','balanced']],
  order:'charge',methods:['melee_focus','ranged_focus','melee_split','attack_object']}),
 defense:Object.freeze({name:'守備',description:'前線を維持し味方を守る',
  recommended:[['wall','balanced'],['fortress','support','balanced'],['circle','balanced','support']],
  order:'defend',methods:['block_passage','block_advance','hold_line','heal_wounded']}),
 balanced:Object.freeze({name:'バランス',description:'攻撃・守備・支援を組み合わせる',
  recommended:[['balanced','attack'],['support','balanced'],['attack','balanced','support']],
  order:'hold',methods:['hold_line','melee_focus','heal_wounded','boost_defense']}),
 explore:Object.freeze({name:'探索',description:'偵察しながら障害物や建物に対応する',
  recommended:[['ambush','balanced'],['arrow','attack','balanced'],['support','balanced']],
  order:'hold',methods:['scout_walk','explore_building','scout_summon','hold_line']})
});
const validType=type=>Object.hasOwn(THREE_TEAM_STRATEGY_TYPES,type);
const unlocked=(game,id)=>Boolean(SORTIE_FORMATIONS[id]&&SORTIE_FORMATIONS[id].level<=sortieLevel(game));
const fallback=(game,type,index)=>THREE_TEAM_STRATEGY_TYPES[type].recommended[index].find(id=>unlocked(game,id))||'balanced';
export const savedThreeTeamStrategy=(game,type)=>game?.sortieFormationPresets?.[type]||null;
export const selectedThreeTeamStrategy=game=>validType(game?.sortieStrategyFamily)?game.sortieStrategyFamily:'balanced';
export function suggestedThreeTeamFormations(game,type){
 if(!validType(type))throw Error('作戦を選択してください。');
 return [0,1,2].map(index=>fallback(game,type,index));
}
export function orderedThreeTeamFormations(game,type){
 if(!validType(type))throw Error('作戦を選択してください。');
 const suggested=suggestedThreeTeamFormations(game,type);
 const priority=[...new Set([...suggested,...THREE_TEAM_STRATEGY_TYPES[type].recommended.flat()])];
 return [...Object.keys(SORTIE_FORMATIONS)].sort((a,b)=>
  (priority.indexOf(a)<0?99:priority.indexOf(a))-(priority.indexOf(b)<0?99:priority.indexOf(b)));
}
function synchronizeTeamTactics(game,team,type,savedTeam){
 const rule=THREE_TEAM_STRATEGY_TYPES[type],allowed=availableSortieOrders(game,team.id);
 const jobs=new Set(sortieTeamSquads(game,team.id).map(s=>STORY_JOB_TO_STRATEGY_JOB[s.job]).filter(Boolean));
 const eligible=id=>{
  const method=STRATEGY_METHODS[id];
  return method&&allowed.includes(method.mode)&&
   (!method.jobs.length||method.jobs.some(job=>jobs.has(job)));
 };
 const candidates=[...(savedTeam?.tactics||[]),...rule.methods];
 const first=candidates.find(eligible);
 team.tactics=first?[first]:[];
 const desired=savedTeam?.initialOrder||rule.order;
 team.initialOrder=allowed.includes(desired)?desired:
  allowed.includes(rule.order)?rule.order:allowed.includes('hold')?'hold':allowed[0]||'hold';
}
/** Apply saved or recommended formations. Formation and troop constraints stay authoritative. */
export function selectThreeTeamStrategy(game,type){
 if(!validType(type))throw Error('作戦を選択してください。');
 ensureSortiePlan(game);
 const saved=savedThreeTeamStrategy(game,type);
 const defaults=suggestedThreeTeamFormations(game,type);
 const desired=defaults.map((id,index)=>{
  const stored=saved?.teams?.[index]?.formation;
  return unlocked(game,stored)?stored:id;
 });
 game.sortieStrategyFamily=type;
 for(let index=0;index<3;index++)setSortieFormation(game,index+1,desired[index]);
 sortieTeams(game).forEach((team,index)=>synchronizeTeamTactics(game,team,type,saved?.teams?.[index]));
 return {type,formations:desired,restored:Boolean(saved)};
}
/** One choice changes only the selected team's formation and default tactics. */
export function chooseThreeTeamFormation(game,type,teamId,formation){
 if(!validType(type)||!Number.isInteger(Number(teamId))||Number(teamId)<1||Number(teamId)>3)
  throw Error('作戦と第1〜3隊を選択してください。');
 if(!unlocked(game,formation))throw Error('この陣形はまだ解放されていません。');
 ensureSortiePlan(game);
 game.sortieStrategyFamily=type;
 const team=setSortieFormation(game,Number(teamId),formation);
 synchronizeTeamTactics(game,team,type,null);
 return team;
}
/** Persist exactly the three currently deployed formations under the chosen strategy. */
export function saveThreeTeamStrategy(game,type){
 if(!validType(type))throw Error('作戦を選択してください。');
 const teams=sortieTeams(game);
 if(teams.length!==3)throw Error('第1〜3隊の編成を確認してください。');
 const template={
  strategy:type,teams:teams.map(team=>({
   formation:team.formation,initialOrder:team.initialOrder,
   tactics:[...(team.tactics||[])]
  }))
 };
 game.sortieFormationPresets={...(game.sortieFormationPresets||{}),[type]:template};
 game.sortieStrategyFamily=type;
 return template;
}
