/**
 * Shared, tile-authoritative exclusion area for ground mounts.
 * A rider can walk through a doorway; a horse/wolf stays on outdoor cells.
 * Called once when the authored stage loads (never in the render loop).
 */
const INDOOR_KINDS=new Set([
 'house','home','old','artisan','stone_hut','inn','tavern','church',
 'weapon','shop','warehouse','farmhouse','manor','store'
]);
export function createMountInteriorMask(width,height,buildings=[],extraRooms=[]){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)
  throw RangeError('Invalid stage size');
 const cells=new Uint8Array(width*height);
 const mark=(minX,maxX,minZ,maxZ)=>{
  if(![minX,maxX,minZ,maxZ].every(Number.isFinite))return;
  const left=Math.max(0,Math.ceil(minX)),right=Math.min(width-1,Math.floor(maxX));
  const top=Math.max(0,Math.ceil(minZ)),bottom=Math.min(height-1,Math.floor(maxZ));
  for(let z=top;z<=bottom;z++)for(let x=left;x<=right;x++)cells[z*width+x]=1;
 };
 for(const entry of buildings){
  const b=entry?.data??entry;
  if(!INDOOR_KINDS.has(b?.kind)||!(b.w>0)||!(b.d>0))continue;
  // Wall thickness, entrance porch and external courtyard are not an indoor cell.
  mark(b.x-b.w/2+.7,b.x+b.w/2-.7,b.z-b.d/2+.7,b.z+b.d/2-.7);
 }
 for(const b of extraRooms){
  if(!b)continue;
  mark(b.minX+.7,b.maxX-.7,b.minZ+.7,b.maxZ-.7);
 }
 return cells;
}
export function isMountInteriorCell(cells,width,x,z){
 return Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&
  x<width&&z<cells.length/width&&cells[z*width+x]===1;
}
