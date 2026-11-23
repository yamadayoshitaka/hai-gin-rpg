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
