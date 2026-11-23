/**
 * Stable exit target from a real walkable room. Search the existing collision
 * bitmap, not a guessed south door. Run only on first exit/repath per actor.
 * The ordinary incremental path planner then owns occupancy and travel.
 */
export function reachableRoomExit(start,bounds,walkable,{limit=3000}={}){
 if(!start||!bounds||typeof walkable!=='function')return null;
 const x0=Math.round(start.x),z0=Math.round(start.z);
 if(!Number.isFinite(x0)||!Number.isFinite(z0)||!walkable(x0,z0))return null;
 const inside=(x,z)=>x>bounds.minX&&x<bounds.maxX&&z>bounds.minZ&&z<bounds.maxZ;
 if(!inside(x0,z0))return {x:x0,z:z0};
 const queue=[{x:x0,z:z0}],visited=new Set([x0+','+z0]);
 const directions=[[0,1],[1,0],[-1,0],[0,-1]];
 for(let i=0;i<queue.length&&i<Math.max(16,Math.floor(limit));i++){
  const cell=queue[i];
  for(const [dx,dz] of directions){
   const x=cell.x+dx,z=cell.z+dz,key=x+','+z;
   if(visited.has(key)||!walkable(x,z))continue;
   if(!inside(x,z))return {x,z};
   visited.add(key);queue.push({x,z});
  }
 }
 return null;
}


/**
 * Find an actually connected formation waypoint, not just a traversable cell
 * on the other side of a castle wall. One cardinal flood fill from the
 * squad's current tile uses the same walkability rules as live movement.
 * Work is bounded and only performed on an issued formation order.
 */
export function reachableFormationWaypoint(start,desired,walkable,{
 maxExpanded=55000,maxOffset=9
}={}){
 if(!start||!desired||typeof walkable!=='function')return null;
 const x0=Math.round(start.x),z0=Math.round(start.z);
 const gx=Math.round(desired.x),gz=Math.round(desired.z);
 if(![x0,z0,gx,gz].every(Number.isFinite)||!walkable(x0,z0))return null;
 const queue=[{x:x0,z:z0}],visited=new Set([x0+','+z0]);
 const dirs=[[1,0],[0,1],[-1,0],[0,-1]];
 let best=null,bestScore=Infinity;
 const limit=Math.max(1,Math.floor(maxExpanded)),offset=Math.max(0,Math.floor(maxOffset));
 for(let i=0;i<queue.length&&i<limit;i++){
  const cell=queue[i],dx=cell.x-gx,dz=cell.z-gz;
  if(Math.max(Math.abs(dx),Math.abs(dz))<=offset){
   const score=dx*dx+dz*dz;
   if(score<bestScore){best=cell;bestScore=score;}
   if(score===0)return {x:cell.x,z:cell.z};
  }
  for(const [mx,mz] of dirs){
   const x=cell.x+mx,z=cell.z+mz,key=x+','+z;
   if(visited.has(key)||!walkable(x,z))continue;
   visited.add(key);queue.push({x,z});
  }
 }
 return best?{x:best.x,z:best.z}:null;
}
