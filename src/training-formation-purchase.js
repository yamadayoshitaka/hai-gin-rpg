/**
 * Training ground: use unassigned soldiers first, then hire only the N-rank
 * deficit from the player's wallet. A preview never spends gold or moves troops.
 */
import {ensureSortiePlan,sortieTeams,sortieLevel,sortiePlanningLimit,
 SORTIE_FORMATIONS} from './three-team-sortie.js?v=formation-job-20261123';
import {FORMATION_ENTRY_REQUIREMENTS,formationTemplate} from './sortie-formation-template-rules.js';
import {FORMATION_ROLES,ROLE_JOBS,formationMinimumForRole} from './sortie-formation-logic.js?v=formation-job-20261123';
import {JOBS} from './story-campaign.js';
import {trainingHireCapacity,hireTownSoldiers} from './game-core-flow.js';
import {chooseInnFormation,inspectInnFormation} from './inn-formation-rules.js?v=formation-job-20261123';

const grade={N:0,R:1,SR:2,SSR:3,UR:4};
const asCount=n=>Math.max(0,Math.trunc(Number(n)||0));
const assigned=(team,id)=>asCount(team.counts?.[String(id)]);
const active=s=>String(s.commanderId??'player')==='player';
const canonical=s=>active(s)&&s.rarity==='N'&&s.purpose==='前線'&&asCount(s.faceId)===0;
const emptyPreview=(reason,more={})=>({possible:false,reason,cost:0,hireCount:0,allocations:[],...more});

/** Units not assigned to *any* of the three teams are genuinely in stock. */
export function trainingSoldierStock(game,teamId=1){
 const teams=sortieTeams(game),team=teams.find(t=>t.id===Number(teamId))||teams[0];
 const byJob=new Map(),rows=[];
 let unassigned=0,reserve=0,assignedTotal=0,teamCount=0;
 for(const squad of game.campaign.squads){
  const owned=asCount(squad.count);
  const used=teams.reduce((n,t)=>n+assigned(t,squad.id),0);
  const current=assigned(team,squad.id);
  const free=Math.max(0,owned-used);
  const waiting=active(squad)?free:owned;
  const key=squad.job+'|'+(squad.rarity||'N');
  const entry=byJob.get(key)||{job:squad.job,rarity:squad.rarity||'N',available:0,reserve:0,assigned:0};
  if(active(squad)){entry.available+=free;entry.assigned+=used;unassigned+=free;}
  else{entry.reserve+=waiting;reserve+=waiting;}
  byJob.set(key,entry);
  assignedTotal+=used;teamCount+=current;
  rows.push({id:squad.id,job:squad.job,rarity:squad.rarity||'N',available:free,
   inTeam:current,inOther:used-current,reserve:!active(squad),critical:!!squad.criticalCharacter});
 }
 return {unassigned,reserve,assigned:assignedTotal,teamCount,byJob:[...byJob.values()],
  rows,wallet:asCount(game.wallet),capacity:trainingHireCapacity(game,'N','player')};
}

function availablePools(game,team){
 const plan=ensureSortiePlan(game),sources=game.campaign.squads;
 const pool=[],canonicalJobs=new Set();
 for(const job of JOBS){
  const main=sources.find(s=>s.job===job&&canonical(s));
  if(main)canonicalJobs.add(String(main.id));
  const other=main?plan.teams.filter(t=>t.id!==team.id).reduce((n,t)=>n+assigned(t,main.id),0):0;
  pool.push({key:'hire:'+job,id:main?.id??null,job,rarity:'N',
   free:main?Math.max(0,asCount(main.count)-other):0,canHire:true});
 }
 for(const s of sources){
  if(!active(s)||canonicalJobs.has(String(s.id)))continue;
  const other=plan.teams.filter(t=>t.id!==team.id).reduce((n,t)=>n+assigned(t,s.id),0);
  const free=Math.max(0,asCount(s.count)-other);
  if(free>0)pool.push({key:'stock:'+s.id,id:s.id,job:s.job,rarity:s.rarity||'N',
   free,canHire:false});
 }
 return pool;
}
function considerCombo(selected,roles,req,spec,formationLimit){
 const parts=selected.map((p,i)=>({...p,count:formationMinimumForRole(roles[i])}));
 const rarity={N:0,R:0,SR:0,SSR:0,UR:0};
 const count=()=>parts.reduce((n,p)=>n+p.count,0);
 for(const p of parts){
  if(p.count>p.free&&!p.canHire)return null;
  rarity[p.rarity]+=p.count;
 }
 if(Object.entries(rarity).some(([key,n])=>n>spec.rarityCaps[key]))return null;
 if(count()>spec.maxTroops||count()>formationLimit)return null;
 const room=p=>Math.min(spec.maxTroops-count(),
   spec.rarityCaps[p.rarity]-rarity[p.rarity],
   (p.canHire?spec.maxTroops:p.free)-p.count);
 const add=(p,n)=>{p.count+=n;rarity[p.rarity]+=n;};
 // Satisfy elite quotas using existing stock, never pretending that R/SSR/UR
 // soldiers can be purchased as ordinary N recruits.
 for(const [key,minRank] of [['ur',4],['ssrPlus',3],['srPlus',2],['rPlus',1]]){
  let deficit=asCount(req[key])-parts.filter(p=>grade[p.rarity]>=minRank)
   .reduce((n,p)=>n+p.count,0);
  if(!deficit)continue;
  for(const p of [...parts].filter(x=>grade[x.rarity]>=minRank)
   .sort((a,b)=>grade[b.rarity]-grade[a.rarity])){
   const n=Math.max(0,Math.min(deficit,p.free-p.count,room(p)));
   if(n){add(p,n);deficit-=n;}
   if(!deficit)break;
  }
  if(deficit)return null;
 }
 let missing=Math.max(0,asCount(req.people)-count());
 // Reserve already-owned soldiers before considering additional hires.
 for(const p of [...parts].sort((a,b)=>(b.free-b.count)-(a.free-a.count))){
  const n=Math.max(0,Math.min(missing,p.free-p.count,room(p)));
  if(n){add(p,n);missing-=n;}
  if(!missing)break;
 }
 if(missing)for(const p of parts.filter(x=>x.canHire)){
  const n=Math.max(0,Math.min(missing,room(p)));
  if(n){add(p,n);missing-=n;}
  if(!missing)break;
 }
 if(missing)return null;
 const allocations=parts.map(p=>({...p,hire:p.canHire?Math.max(0,p.count-p.free):0}));
 const hireCount=allocations.reduce((n,p)=>n+p.hire,0);
 const cost=hireCount*10;
 const stockUsed=allocations.reduce((n,p)=>n+Math.min(p.free,p.count),0);
 return {possible:true,reason:'必要な兵数と職業を配置できます',allocations,hireCount,cost,stockUsed,
  total:count(),formationLimit};
}

/** Preview the cheapest valid roster; explain why a one-tap purchase is blocked. */
export function inspectTrainingFormationPurchase(game,teamId,formation){
 const plan=ensureSortiePlan(game),team=plan.teams.find(t=>t.id===Number(teamId));
 const base=SORTIE_FORMATIONS[formation],spec=formationTemplate(formation);
 if(!team||!base||!spec)return emptyPreview('陣形が見つかりません');
 if(game.location!=='town'||game.campaign.gameOver)return emptyPreview('軍訓練所でのみ編成できます');
 if(sortieLevel(game)<base.level)return emptyPreview('軍師Lv.'+base.level+'が必要です');
 const already=inspectInnFormation(game,team.id,formation);
 if(already.eligible)return {possible:true,already:true,cost:0,hireCount:0,
  stockUsed:0,total:already.total,allocations:[],reason:'現在の隊員で使用可能'};
 const other=plan.teams.filter(t=>t!==team)
  .reduce((n,t)=>n+Object.values(t.counts||{}).reduce((a,b)=>a+asCount(b),0),0);
 const limit=Math.min(spec.maxTroops,sortiePlanningLimit(game)-other);
 const req=FORMATION_ENTRY_REQUIREMENTS[formation];
 const roles=FORMATION_ROLES[formation]?.slice(0,spec.slots)||[];
 const minimum=roles.reduce((n,role)=>n+formationMinimumForRole(role),0);
 if(limit<Math.max(minimum,asCount(req.people)))
  return emptyPreview('出撃可能人数が不足：他の隊の配置を減らしてください');
 const pools=availablePools(game,team);
 const options=roles.map(role=>pools.filter(p=>ROLE_JOBS[role]?.includes(p.job)&&
  (p.canHire||p.free>=formationMinimumForRole(role))));
 if(options.some(a=>!a.length))return emptyPreview('必要な職業の在庫兵が不足しています');
 let cheapest=null;
 const walk=(index,chosen,usedJobs)=>{
  if(index===roles.length){
   const candidate=considerCombo(chosen,roles,req,spec,limit);
   if(candidate&&(!cheapest||candidate.cost<cheapest.cost||
    (candidate.cost===cheapest.cost&&candidate.stockUsed>cheapest.stockUsed)))
    cheapest=candidate;
   return;
  }
  for(const p of options[index]){
   if(usedJobs.has(p.job))continue;
   usedJobs.add(p.job);chosen.push(p);walk(index+1,chosen,usedJobs);
   chosen.pop();usedJobs.delete(p.job);
  }
 };
 walk(0,[],new Set());
 if(!cheapest)return emptyPreview('必要な職業・レアリティ兵が不足しています');
 const wallet=asCount(game.wallet),cap=trainingHireCapacity(game,'N','player');
 if(cheapest.cost>wallet)return {...cheapest,possible:false,
  reason:'所持金が'+(cheapest.cost-wallet)+'G不足しています',missingGold:cheapest.cost-wallet};
 if(cheapest.hireCount>Math.min(cap.commanderSpace,cap.armySpace))
  return {...cheapest,possible:false,reason:'軍師隊または全軍の雇用上限を超えています'};
 return cheapest;
}

/** Re-validate on click and roll back all changes if a mutation fails. */
export function purchaseAndArrangeTrainingFormation(game,teamId,formation){
 const proposal=inspectTrainingFormationPurchase(game,teamId,formation);
 if(!proposal.possible)throw Error(proposal.reason);
 if(proposal.already){chooseInnFormation(game,teamId,formation);return proposal;}
 const previous={campaign:JSON.parse(JSON.stringify(game.campaign)),
  sortiePlan:JSON.parse(JSON.stringify(game.sortiePlan)),wallet:game.wallet};
 try{
  const chosen=[];
  for(const part of proposal.allocations){
   let sid=part.id;
   if(part.hire){
    const before=new Map(game.campaign.squads.map(s=>[String(s.id),s.count]));
    hireTownSoldiers(game,{job:part.job,rarity:'N',count:part.hire,commanderId:'player',faceId:0});
    const changed=game.campaign.squads.find(s=>s.job===part.job&&canonical(s)&&
     asCount(s.count)>(before.get(String(s.id))||0));
    if(!changed)throw Error('雇用した兵士が編成在庫に反映されませんでした');
    sid=changed.id;
   }
   if(sid==null)throw Error('配置対象の兵士を取得できません');
   chosen.push({...part,id:sid});
  }
  const team=game.sortiePlan.teams.find(t=>t.id===Number(teamId));
  team.formation='free';team.slots=chosen.map(p=>String(p.id));
  team.counts=Object.fromEntries(chosen.map(p=>[String(p.id),p.count]));
  team.divisions=Object.fromEntries(chosen.map(p=>[String(p.id),1]));
  team.grid=Array(16).fill(null);
  if(!chosen.some(p=>String(p.id)===String(team.captainId)))
   team.captainId=chosen[0].id;
  chooseInnFormation(game,teamId,formation);
  return proposal;
 }catch(error){
  game.campaign=previous.campaign;game.sortiePlan=previous.sortiePlan;game.wallet=previous.wallet;
  throw error;
 }
}
