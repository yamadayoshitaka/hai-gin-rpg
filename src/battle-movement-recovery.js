/**
 * Recovery for a unit that is actively trying to move but whose immediate
 * route is occupied. This never overrides explicit 待機 / 守備 orders and
 * never moves into an unwalkable/occupied tile: callers pass legal neighbors.
 * Used in both deterministic grid simulation and the small battle runtime.
 */
export function chooseBlockedMovementDetour({
  x,z,goalX,goalZ,previousX=null,previousZ=null,neighbors=[],
  currentFlow=Infinity,maxWorsening=2
}){
  if(!Number.isFinite(goalX)||!Number.isFinite(goalZ))return null;
  const before=Math.abs(x-goalX)+Math.abs(z-goalZ);
  let best=null,bestCost=Infinity;
  for(const candidate of neighbors){
    if(!candidate||!Number.isFinite(candidate.x)||!Number.isFinite(candidate.z))continue;
    const distance=Math.abs(candidate.x-goalX)+Math.abs(candidate.z-goalZ);
    if(distance>before+maxWorsening)continue;
    const reverse=candidate.x===previousX&&candidate.z===previousZ;
    const flow=Number.isFinite(candidate.flow)?candidate.flow:Infinity;
    const flowImprovement=Number.isFinite(currentFlow)&&Number.isFinite(flow)
      ?Math.max(-2,Math.min(2,(currentFlow-flow))):0;
    const cost=distance-flowImprovement*.55+(reverse?1.8:0);
    if(cost<bestCost){bestCost=cost;best={x:candidate.x,z:candidate.z};}
  }
  return best;
}
