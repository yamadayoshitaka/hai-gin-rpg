/**
 * Eight-direction battle navigation. The diagonal footprint is valid only
 * when BOTH adjacent orthogonal cells are free. This applies to bridges,
 * doors, stairs, terrain, and soldiers; no cutting across collision corners.
 */
export const MASS_GRID_DIRECTIONS=Object.freeze([
  [1,0],[-1,0],[0,1],[0,-1],
  [1,1],[1,-1],[-1,1],[-1,-1]
]);

export function massDiagonalClear(x,z,dx,dz,width,passable,occupied=null){
  if(!dx||!dz)return true;
  const a=z*width+x+dx,b=(z+dz)*width+x;
  if(a<0||b<0||a>=passable.length||b>=passable.length)return false;
  if(!passable[a]||!passable[b])return false;
  return !occupied||(occupied[a]===-1&&occupied[b]===-1);
}

export function massStepDuration(speed,dx,dz,{scale=.88,command=1,formation=1,mounted=1}={}){
  const distance=Math.hypot(dx,dz);
  const velocity=speed*scale*command*formation*mounted;
  return velocity>0&&distance>0?distance/velocity:Infinity;
}
