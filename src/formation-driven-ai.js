/**
 * One formation-aware combat intent for player and enemy units.
 * Explicit commander orders outrank doctrine. Pathfinding, collision, floor
 * navigation and attack cooldowns remain the authoritative engines.
 * This replaces the old unbounded "balanced -> idle" fallback.
 */
export const FORMATION_AI_REVISION='symmetric-formation-v6-20261125';
const ATTACK_FORMATIONS=new Set(['attack','wedge','pincer','ambush','dragon','constellation','spear','cross']);
const RANGED=new Set(['archer','mage']);
export const isHighGroundFiringJob=jobId=>RANGED.has(String(jobId||'').toLowerCase())||String(jobId||'').toLowerCase()==='summoner';
export function formationCombatIntent({
 formation='balanced',jobId='',command=null,hasEnemies=true,
 enemyDistance=Infinity,attackRange=2,healthRatio=1,indoors=false
}={}){
 const type=String(formation||'balanced'),job=String(jobId||'').toLowerCase();
 const explicit=['charge','defend','hold','retreat'].includes(command)?command:null;
 if(explicit==='retreat')return {order:'retreat',advance:false,seekHighGround:false,reason:'command-retreat'};
 if(explicit==='hold')return {order:'hold',advance:false,seekHighGround:false,reason:'command-hold'};
 const enemy=Boolean(hasEnemies),distance=Number.isFinite(enemyDistance)?Math.max(0,enemyDistance):Infinity;
 const range=Math.max(1,Number(attackRange)||2);
 // A selected defend/hold order is never silently erased by an auto tactic.
 // Defence may counter a threat within its perimeter but is not an assault.
 if(explicit==='defend')return {
  order:'defend',advance:enemy&&distance<=Math.max(12,range*2),
  seekHighGround:false,reason:'command-defend'
 };
 // Preserve the assault's one-way march to its last shared rally front.
 // The battle director ends on victory; the grid still settles at a stable
 // BFS goal rather than stopping arbitrarily or wandering between cells.
 if(!enemy)return {order:explicit==='charge'?'charge':'charge',advance:true,
  seekHighGround:false,reason:'frontline-rally'};
 const ranged=RANGED.has(job)||job==='summoner';
 const healer=job==='priest';
 const height=type==='highground'&&isHighGroundFiringJob(job);
 return {
  order:'charge',
  advance:true,
  seekHighGround:height&&!indoors,
  role:healer?'heal':height?(job==='summoner'?'highground-summon':'highground-fire'):ranged?'ranged-cover':
   ATTACK_FORMATIONS.has(type)?'assault':'advance-cover',
  // Low HP still keeps walking toward allies/cover; do not freeze without
  // an explicit guard order or a live heal/cast.
  reason:explicit==='charge'?'command-charge':type+'-auto'
 };
}

/** Ground-level shield bait, driven by the actual firing position. Distances
 * are in grid cells. Never start baiting before an upper-floor ally arrives. */
export function highGroundShieldIntent({ready=false,assigned=false,anchorDistance=Infinity,enemyDistance=Infinity,enemyAnchorDistance=Infinity,healthRatio=1,luring=false,holding=false,contact=true}={}){
 if(!assigned)return {phase:'fallback',luring:false};
 if(luring||holding)return {phase:anchorDistance>5?'return':'guard',luring:anchorDistance>5};
 if(!ready||healthRatio<.35)return {phase:anchorDistance>5?'return':'guard',luring:false};
 if(contact&&enemyDistance<=6){
  return {phase:anchorDistance>5?'return':'guard',luring:anchorDistance>5};
 }
 if(enemyAnchorDistance<=6)return {phase:anchorDistance>5?'return':'guard',luring:false};
 if(!Number.isFinite(enemyDistance))return {phase:anchorDistance>5?'return':'guard',luring:false};
 return {phase:'approach',luring:false};
}

/** Three-job story formations use physical subdivision ids for commands,
 * but their coordinated doctrine must be keyed by the actual army group. */
export function highGroundGroupKey(unit){
 return String(unit.team)+':'+String(unit.armyGroupId??unit.squadId);
}
export function highGroundRoofGoal(building,hasRoof){
 const floors=building?.floors?.length??0;
 return floors>1?floors+(hasRoof?1:0):0;
}

export function highGroundBaitActive({alive=true,ground=true,enemy=true,distance=Infinity,now=0,until=0,order=null,maxDistance=32}={}){
 return alive&&ground&&enemy&&distance<=maxDistance&&now<until&&!['hold','retreat','move','mission','explore'].includes(order);
}
