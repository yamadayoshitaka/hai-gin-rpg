/**
 * Tactical (50v50) locomotion contract. Ordinary combat travel, pursuit,
 * doorway approach, upper-floor repositioning and loot runs are DASHES.
 * Only an explicitly authored slow action (stairs / stealth) can WALK.
 * Never change the physics speed or path tiles just to change this pose.
 */
export function skirmishTravelMotion(requested,{floorPhase=null,stealth=false}={}){
 if(requested!=='walk')return requested;
 return floorPhase==='climb'||stealth?'walk':'run';
}

/** Lightweight on-demand QA: count the actual CLOSE-UP clip during motion,
 * rather than inferring run from an AI command or unit's speed statistic.
 */
export function measureSkirmishDashCoverage(actors,states,time){
 const active=(actors||[]).filter(actor=>
  actor&&!actor.defeated&&actor.hp>0&&!actor.mountId&&
  (actor.nextCell||actor.floorTravel?.phase==='climb'&&actor.poseMoving||
   actor.lastMovedAt!=null&&time-actor.lastMovedAt<.24));
 let dash=0,walk=0,other=0;
 const exceptions=[];
 for(const actor of active){
  const motion=states?.get?.(actor.id)||'none';
  const actual=actor.character?.diagnostics?.()?.state||motion;
  if(actual==='run')dash++;
  else if(actual==='walk')walk++;
  else {other++;if(exceptions.length<12)exceptions.push({id:actor.id,job:actor.job?.name,state:actual});}
 }
 return {moving:active.length,dash,walk,other,
  dashPercent:active.length?Math.round(dash/active.length*100):0,
  exceptions};
}
