/**
 * One formation-aware combat intent for player and enemy units.
 * Explicit commander orders outrank doctrine. Pathfinding, collision, floor
 * navigation and attack cooldowns remain the authoritative engines.
 * This replaces the old unbounded "balanced -> idle" fallback.
 */
export const FORMATION_AI_REVISION='symmetric-formation-v1-20261124';
const ATTACK_FORMATIONS=new Set(['attack','wedge','pincer','ambush','dragon','constellation','spear','cross']);
const RANGED=new Set(['archer','mage']);
export const isHighGroundFiringJob=jobId=>RANGED.has(String(jobId||'').toLowerCase());
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
 const height=type==='highground'&&RANGED.has(job);
 return {
  order:'charge',
  advance:true,
  seekHighGround:height&&!indoors,
  role:healer?'heal':height?'highground-fire':ranged?'ranged-cover':
   ATTACK_FORMATIONS.has(type)?'assault':'advance-cover',
  // Low HP still keeps walking toward allies/cover; do not freeze without
  // an explicit guard order or a live heal/cast.
  reason:explicit==='charge'?'command-charge':type+'-auto'
 };
}
