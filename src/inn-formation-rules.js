/**
 * Inn: choose real soldiers before seeing eligible formations.
 * This module never clones troop inventory or silently replaces the roster.
 */
import {
 ensureSortiePlan,sortieTeams,sortieTeamCount,sortiePlanningLimit,sortieLevel,
 SORTIE_FORMATIONS,SORTIE_FORMATION_CELLS
} from './three-team-sortie.js';
import {
 FORMATION_ENTRY_REQUIREMENTS,FORMATION_BATTLE_PURPOSES,formationTemplate,
 formationRarityCounts,rarityOf
} from './sortie-formation-template-rules.js';
import {FORMATION_ROLES,ROLE_JOBS,formationMinimumForRole} from './sortie-formation-logic.js';

const rank={N:0,R:1,SR:2,SSR:3,UR:4};
const freeCells=[5,6,9];
const sourcesOf=game=>game.campaign.squads.filter(s=>s.count>0);
const assigned=(team,id)=>Number(team.counts?.[String(id)]||0);
const otherAssigned=(plan,team,id)=>plan.teams.filter(t=>t!==team)
 .reduce((sum,t)=>sum+assigned(t,id),0);
const headcount=team=>Object.values(team.counts||{}).reduce((n,c)=>n+Number(c||0),0);

/** Return a role -> squad assignment without changing the player's roster. */
export function matchFormationJobs(team,sources,formation){
 const slots=(team.slots||[]).filter(id=>assigned(team,id)>0).map(String);
 const roles=FORMATION_ROLES[formation]?.slice(0,formationTemplate(formation)?.slots||0)||[];
 if(roles.length!==slots.length)return null;
 const byId=new Map(sources.map(s=>[String(s.id),s]));
 function match(roleIndex,remaining){
  if(roleIndex===roles.length)return [];
  const role=roles[roleIndex],minimum=formationMinimumForRole(role);
  for(const sid of remaining){
   const source=byId.get(sid);
   if(!source||!ROLE_JOBS[role]?.includes(source.job)||assigned(team,sid)<minimum)continue;
   const after=match(roleIndex+1,remaining.filter(v=>v!==sid));
   if(after)return [sid,...after];
  }
  return null;
 }
 return match(0,slots);
}

export function inspectInnFormation(game,teamId,formation){
 const plan=ensureSortiePlan(game),team=plan.teams.find(t=>t.id===Number(teamId));
 const spec=formationTemplate(formation),base=SORTIE_FORMATIONS[formation];
 if(!team||!spec||!base)return {eligible:false,reason:'陣形が見つかりません',assignment:null};
 const counts=formationRarityCounts(team,sourcesOf(game)),total=headcount(team);
 const req=FORMATION_ENTRY_REQUIREMENTS[formation]||{people:0,rPlus:0,srPlus:0,ssrPlus:0,ur:0};
 const rare={rPlus:counts.R+counts.SR+counts.SSR+counts.UR,
  srPlus:counts.SR+counts.SSR+counts.UR,ssrPlus:counts.SSR+counts.UR,ur:counts.UR};
 const needs=[];
 if(sortieLevel(game)<base.level)needs.push('軍師Lv.'+base.level);
 if(total<req.people)needs.push('合計'+req.people+'人以上');
 if(total>spec.maxTroops)needs.push('上限'+spec.maxTroops+'人');
 if(total>sortiePlanningLimit(game))needs.push('ステージ出撃上限');
 for(const [key,label] of [['rPlus','R以上'],['srPlus','SR以上'],['ssrPlus','SSR以上'],['ur','UR']])
  if(rare[key]<req[key])needs.push(label+req[key]+'人以上');
 for(const tier of Object.keys(counts))if(counts[tier]>spec.rarityCaps[tier])
  needs.push(tier+'上限'+spec.rarityCaps[tier]+'人');
 const assignment=matchFormationJobs(team,sourcesOf(game),formation);
 if(!assignment)needs.push('必要な職業・人数の組み合わせ');
 return {eligible:needs.length===0,reason:needs.join('／')||'条件達成',
  requirements:req,total,counts,assignment,base,purpose:FORMATION_BATTLE_PURPOSES[formation]};
}

/** Edit just one of the three roster slots; return to free layout until a valid preset is chosen. */
export function selectInnRosterJob(game,teamId,slotIndex,squadId){
 const plan=ensureSortiePlan(game),team=plan.teams.find(t=>t.id===Number(teamId));
 const index=Number(slotIndex),sid=squadId==null||squadId===''?null:String(squadId);
 if(!team||!Number.isInteger(index)||index<0||index>=3)throw Error('隊員枠は1～3です。');
 const sources=sourcesOf(game),source=sources.find(s=>String(s.id)===sid);
 if(sid&&!source)throw Error('保有していないジョブです。');
 const previous=team.slots[index]||null;
 if(previous===sid)return team;
 if(sid&&team.slots.some((id,i)=>i!==index&&String(id)===sid))
  throw Error('同じジョブは別の枠で使用しています。');
 const replacing=previous?assigned(team,previous):0;
 const inUse=plan.teams.reduce((n,t)=>n+headcount(t),0);
 const free=source?source.count-otherAssigned(plan,team,sid):0;
 const budget=sortiePlanningLimit(game)-inUse+replacing;
 const spec=formationTemplate('free');
 const inGroup=headcount(team)-replacing;
 const rarity=rarityOf(source),rarities=formationRarityCounts(team,sources);
 const previousSource=sources.find(s=>String(s.id)===String(previous));
 const tierRoom=spec.rarityCaps[rarity]-rarities[rarity]+(previous&&rarityOf(previousSource)===rarity?replacing:0);
 const count=sid?Math.min(5,free,Math.max(0,budget),spec.maxTroops-inGroup,tierRoom):0;
 if(sid&&count<1)throw Error('空き兵員がありません。他の隊の人数を調整してください。');
 team.formation='free';
 if(previous){
  delete team.counts[String(previous)];delete team.divisions[String(previous)];
 }
 team.slots[index]=sid;
 if(sid){team.counts[sid]=count;team.divisions[sid]=1;}
 team.grid=Array(16).fill(null);
 team.slots.forEach((id,i)=>{if(id&&assigned(team,id)>0)team.grid[freeCells[i]]=String(id);});
 if(!team.slots.some(id=>String(id)===String(team.captainId)))
  team.captainId=team.slots.find(Boolean)?Number(team.slots.find(Boolean)):null;
 return team;
}

export function setInnRosterCount(game,teamId,squadId,delta){
 const plan=ensureSortiePlan(game),team=plan.teams.find(t=>t.id===Number(teamId));
 const sid=String(squadId),old=assigned(team,sid),source=sourcesOf(game).find(s=>String(s.id)===sid);
 if(!team||!source||!old)throw Error('先にジョブを選択してください。');
 const wanted=old+Number(delta);
 if(!Number.isInteger(wanted)||wanted<1)throw Error('人数は1人以上です。0人にする場合はジョブを外してください。');
 // Old formation cannot constrain roster editing: choose composition first.
 team.formation='free';
 team.grid=Array(16).fill(null);
 team.slots.forEach((id,i)=>{if(id&&assigned(team,id)>0)team.grid[freeCells[i]]=String(id);});
 const others=otherAssigned(plan,team,sid);
 const freeSpec=formationTemplate('free');
 const rarities=formationRarityCounts(team,sourcesOf(game)),tier=rarityOf(source);
 const limit=Math.min(source.count-others,freeSpec.maxTroops-headcount(team)+old,
  freeSpec.rarityCaps[tier]-rarities[tier]+old,
  sortiePlanningLimit(game)-plan.teams.reduce((n,t)=>n+headcount(t),0)+old);
 if(wanted>limit)throw Error('増員可能な人数は'+Math.max(0,limit)+'人までです。');
 team.counts[sid]=wanted;
 return team;
}

/** Apply the role matching to a 4x4 grid while keeping soldier counts and captain fixed. */
export function chooseInnFormation(game,teamId,formation){
 const result=inspectInnFormation(game,teamId,formation);
 if(!result.eligible)throw Error('陣形条件未達：'+result.reason);
 const team=game.sortiePlan.teams.find(t=>t.id===Number(teamId));
 const beforeCount=headcount(team),captain=team.captainId;
 team.formation=formation;
 team.slots=[...result.assignment,...Array(3-result.assignment.length).fill(null)];
 team.grid=Array(16).fill(null);
 result.assignment.forEach((sid,i)=>{team.grid[SORTIE_FORMATION_CELLS[formation][i]]=sid;});
 if(beforeCount!==headcount(team)||captain!==team.captainId)
  throw Error('陣形変更によって兵員か隊長が変化しました。');
 return team;
}
