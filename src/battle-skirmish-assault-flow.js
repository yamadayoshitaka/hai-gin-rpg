/**
 * Shared, obstacle-aware pursuit for the small (non-Worker) three-team battle.
 * One field per army/terrain profile replaces dozens of competing long A* searches
 * when a fence, town perimeter, or castle obscures the closest enemy.
 *
 * The field contains only physical, traversable terrain; troop occupancy is
 * checked when committing the next step, so queued soldiers never phase through
 * one another or cut a diagonal corner.
 */
export const ASSAULT_FLOW_UNREACHABLE = 0x3fffffff;
const DIRECTIONS = Object.freeze([
  [1,0],[-1,0],[0,1],[0,-1],
  [1,1],[1,-1],[-1,1],[-1,-1]
]);

const inside=(x,z,w,h)=>x>=0&&z>=0&&x<w&&z<h;

function diagonalClear(x,z,dx,dz,width,passable) {
  return !dx||!dz||(passable[z*width+x+dx]&&passable[(z+dz)*width+x]);
}

/**
 * Multi-source BFS starts on real ground NEXT TO surviving enemies, never
 * inside an occupied enemy cell or on the wrong side of a solid wall.
 * Multiple enemies are equally valid: a soldier follows a reachable opponent
 * instead of fixating on the closest but inaccessible one.
 */
export function buildSkirmishAssaultFlow(width,height,passable,enemies=[]) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
     !(passable instanceof Uint8Array)||passable.length!==width*height) return null;
  const distances=new Int32Array(width*height);
  distances.fill(ASSAULT_FLOW_UNREACHABLE);
  const queue=new Int32Array(width*height);
  let head=0,tail=0;
  for(const enemy of enemies) {
    const ex=Math.round(enemy?.x),ez=Math.round(enemy?.z);
    if(!Number.isFinite(ex)||!Number.isFinite(ez)||!inside(ex,ez,width,height))continue;
    for(const [dx,dz] of DIRECTIONS) {
      const x=ex+dx,z=ez+dz;
      if(!inside(x,z,width,height)||!passable[z*width+x]||
         !diagonalClear(ex,ez,dx,dz,width,passable))continue;
      const index=z*width+x;
      if(distances[index]===0)continue;
      distances[index]=0;queue[tail++]=index;
    }
  }
  if(!tail)return null;
  while(head<tail) {
    const index=queue[head++],x=index%width,z=Math.floor(index/width);
    const distance=distances[index]+1;
    for(const [dx,dz] of DIRECTIONS) {
      const nx=x+dx,nz=z+dz;
      if(!inside(nx,nz,width,height)||!passable[nz*width+nx]||
         !diagonalClear(x,z,dx,dz,width,passable))continue;
      const next=nz*width+nx;
      if(distances[next]<=distance)continue;
      distances[next]=distance;queue[tail++]=next;
    }
  }
  return distances;
}

/**
 * Only strictly decreasing field steps are legal. Never yield backwards into
 * a fence or oscillate between tiles just because the next one is occupied.
 * The caller checks live reservations with the ordinary availableCell().
 */
export function nextSkirmishAssaultStep(cell,field,width,height,passable,available) {
  if(!cell||!field||typeof available!=='function'||
     !Number.isInteger(width)||!Number.isInteger(height))return null;
  const x=Math.round(cell.x),z=Math.round(cell.z);
  if(!inside(x,z,width,height))return null;
  const current=field[z*width+x];
  if(current===0||current>=ASSAULT_FLOW_UNREACHABLE)return null;
  let selected=null,best=current;
  for(const [dx,dz] of DIRECTIONS) {
    const nx=x+dx,nz=z+dz;
    if(!inside(nx,nz,width,height)||!passable[nz*width+nx]||
       !diagonalClear(x,z,dx,dz,width,passable)||
       (dx&&dz&&(!available(x+dx,z)||!available(x,z+dz)))||
       !available(nx,nz))continue;
    const score=field[nz*width+nx];
    if(score<best){best=score;selected={x:nx,z:nz};}
  }
  return selected;
}
