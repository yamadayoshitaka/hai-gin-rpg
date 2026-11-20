/**
 * Three-team auto-sortie builder. Campaign inventory is authoritative:
 * troops are allocated, never cloned or consumed by a formation preset.
 */
import {ensureSortiePlan,sortiePlanningLimit,SORTIE_FORMATIONS,SORTIE_FORMATION_CELLS} from './three-team-sortie.js';
import {FORMATION_ROLES,ROLE_JOBS,formationMinimumForRole} from './sortie-formation-logic.js';
import {rarityOf} from './sortie-formation-template-rules.js';

export const THREE_TEAM_AUTO_MODES=Object.freeze({
 strongest:Object.freeze({name:'最強',formations:['dragon','balanced','arrow','attack','support','wall','ambush'],ratio:1}),
 balanced:Object.freeze({name:'バランス',formations:['balanced','support','attack','wall','ambush','dragon'],ratio:1}),
 economy:Object.freeze({name:'節約',formations:['wall','attack','support','ambush','balanced'],ratio:.6})
});
const rank=Object.freeze({N:0,R:1,SR:2,SSR:3,UR:4});
const sourceKey=s=>String(s.id);
const countTeam=team=>Object.values(team.counts).reduce((n,c)=>n+Number(c||0),0);
const contribution=(s,mode)=>mode==='economy'?-rank[rarityOf(s)]:rank[rarityOf(s)];
/** Select 2-3 distinct jobs per formation, saving unavailable jobs as reserve. */
export function autoComposeThreeTeams(game,mode='balanced'){
 const policy=THREE_TEAM_AUTO_MODES[mode];
 if(!policy)throw Error('自動編成は最強・バランス・節約から選択してください。');
 ensureSortiePlan(game);
 const sources=(game.campaign?.squads||[]).filter(s=>Number(s.count)>0&&String(s.commanderId??'player')!=='reserve');
 const teams=game.sortiePlan.teams;
 const remaining=new Map(sources.map(s=>[sourceKey(s),Math.max(0,Math.trunc(Number(s.count)))]));
 const stageCap=sortiePlanningLimit(game);
 const target=Math.min(stageCap,Math.max(0,Math.floor(stageCap*policy.ratio)),
  sources.reduce((n,s)=>n+Number(s.count||0),0));
 // Manual changes are replaced only when the user explicitly taps an auto-mode.
 for(const team of teams){
  team.formation='balanced';team.slots=Array(3).fill(null);
  team.grid=Array(16).fill(null);team.counts={};team.divisions={};team.captainId=null;team.tactics=[];
 }
 const eligible=(formation)=>{
  const spec=SORTIE_FORMATIONS[formation];
  if(!spec||spec.level>Number(game.sortieTestLevel??game.campaign?.commander?.level??1))return null;
  const picked=[],claimed=new Set(),claimedJobs=new Set(),tierUsed={N:0,R:0,SR:0,SSR:0,UR:0};
  for(let i=0;i<spec.slots;i++){
   const role=FORMATION_ROLES[formation]?.[i],min=formationMinimumForRole(role);
   const candidates=sources.filter(s=>ROLE_JOBS[role]?.includes(s.job)&&!claimed.has(sourceKey(s))&&
    !claimedJobs.has(s.job)&&(remaining.get(sourceKey(s))||0)>=min &&
    tierUsed[rarityOf(s)]+min<=spec.rarityCaps[rarityOf(s)]);
   candidates.sort((a,b)=>contribution(b,mode)-contribution(a,mode)||
    (remaining.get(sourceKey(b))||0)-(remaining.get(sourceKey(a))||0)||
    sourceKey(a).localeCompare(sourceKey(b)));
   if(!candidates.length)return null;
   const s=candidates[0],sid=sourceKey(s),tier=rarityOf(s);
   picked.push({sid,source:s,count:min,role});
   claimed.add(sid);claimedJobs.add(s.job);tierUsed[tier]+=min;
  }
  return picked;
 };
 for(const team of teams){
  if([...remaining.values()].reduce((n,x)=>n+x,0)<4)break;
  let chosen=null,formation=null;
  for(const id of policy.formations){
   const attempt=eligible(id);
   if(attempt){formation=id;chosen=attempt;break;}
  }
  if(!chosen)break;
  team.formation=formation;
  chosen.forEach((item,i)=>{
   team.slots[i]=item.sid;
   team.grid[SORTIE_FORMATION_CELLS[formation][i]]=item.sid;
   team.counts[item.sid]=item.count;team.divisions[item.sid]=1;
   remaining.set(item.sid,(remaining.get(item.sid)||0)-item.count);
  });
  team.captainId=chosen.slice().sort((a,b)=>rank[rarityOf(b.source)]-rank[rarityOf(a.source)])[0]?.source.id??null;
 }
 let planned=teams.reduce((n,t)=>n+countTeam(t),0);
 // Distribute surplus soldiers without breaking per-formation rarity or troop caps.
 // Every mode uses the same actual inventory and stage deployment ceiling.
 while(planned<target){
  const possibilities=[];
  for(const team of teams){
   const spec=SORTIE_FORMATIONS[team.formation];
   if(!Object.keys(team.counts).length||countTeam(team)>=spec.maxTroops)continue;
   for(const sid of team.slots.filter(Boolean)){
    if(!(remaining.get(sid)>0))continue;
    const source=sources.find(s=>sourceKey(s)===sid),tier=rarityOf(source);
    const inTier=Object.entries(team.counts).reduce((n,[id,c])=>
     n+(rarityOf(sources.find(s=>sourceKey(s)===id))===tier?Number(c):0),0);
    if(inTier>=spec.rarityCaps[tier])continue;
    const strength=contribution(source,mode);
    const balancePenalty=countTeam(team);
    possibilities.push({team,sid,score:mode==='balanced'?
     -balancePenalty*100+strength*10:strength*100-(mode==='strongest'?team.id*3:balancePenalty)});
   }
  }
  if(!possibilities.length)break;
  possibilities.sort((a,b)=>b.score-a.score||a.team.id-b.team.id||a.sid.localeCompare(b.sid));
  const {team,sid}=possibilities[0];
  team.counts[sid]++;remaining.set(sid,remaining.get(sid)-1);planned++;
 }
 game.sortieAutoMode=mode;
 ensureSortiePlan(game);
 return {mode,planned:game.sortiePlan.teams.reduce((n,t)=>n+countTeam(t),0),
  activeTeams:game.sortiePlan.teams.filter(t=>countTeam(t)>0).length};
}
