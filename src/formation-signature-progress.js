/**
 * Decide whether the actual formation team has reached its waypoint.
 *
 * A timeout is a terminal abort, NOT permission to head to the next
 * waypoint: changing direction while still en route makes platoons circle.
 * Distances use radar grid cells and elapsed battle time (not wall time).
 */
export const SIGNATURE_ARRIVAL_RADIUS=5.5;
export const SIGNATURE_STALL_SECONDS=10;
export const SIGNATURE_MAX_PHASE_SECONDS=22;
export const SIGNATURE_PROGRESS_CELLS=.6;

export function formationSignatureProgress(plan,center,elapsed){
 const goal=plan?.points?.[plan?.phase];
 if(!goal||!Number.isFinite(center?.x)||!Number.isFinite(center?.z)||
  !Number.isFinite(goal.x)||!Number.isFinite(goal.z)||!Number.isFinite(elapsed))
  return {action:'abort',reason:'invalid',plan};
 const distance=Math.hypot(center.x-goal.x,center.z-goal.z);
 if(distance<=SIGNATURE_ARRIVAL_RADIUS)
  return {action:plan.phase===0?'next':'finish',distance,plan};
 const started=Number.isFinite(plan.issuedAt)?plan.issuedAt:elapsed;
 const previous=Number.isFinite(plan.closestDistance)?plan.closestDistance:distance;
 const progressed=distance<=previous-SIGNATURE_PROGRESS_CELLS;
 const lastProgressAt=progressed?elapsed:
  Number.isFinite(plan.lastProgressAt)?plan.lastProgressAt:started;
 const updated={...plan,closestDistance:Math.min(distance,previous),lastProgressAt};
 if(elapsed-started>=SIGNATURE_MAX_PHASE_SECONDS||
    elapsed-lastProgressAt>=SIGNATURE_STALL_SECONDS)
  return {action:'abort',reason:'stalled',distance,plan:updated};
 return {action:'wait',distance,plan:updated};
}
