/** One authoritative bridge footprint for catalog meshes and battle navigation. */
export const BATTLE_BRIDGE_WIDTH_CELLS=9;
export const BATTLE_BRIDGE_HALF_WIDTH_CELLS=(BATTLE_BRIDGE_WIDTH_CELLS-1)/2;
export const BATTLE_BRIDGE_LANE_OFFSETS=Object.freeze([0,-2,2,-4,4,-1,1,-3,3]);

/** Ground-plane clearance, in tiles; independent of decorative moving heads/tails. */
export function monsterGroundRadiusCells(spec){
 if(!spec)return .45;
 if(spec.id==='m018')return 2.1; // multi-headed hydra
 if(spec.id==='m020')return 2.7; // oversized sea beast
 if(spec.id==='m048')return 2.4;
 return ['reptile','aquatic','beast'].includes(spec.family)?1.65:1.35;
}

/** Keep separate large enemies from rendering in the same space.
 * Humans retain close-quarters melee access, while one-tile grid occupancy
 * remains authoritative for each individual soldier. */
export function monsterHasClearance(x,z,spec,actors,self=null){
 if(!spec)return true;
 const own=monsterGroundRadiusCells(spec);
 for(const other of actors??[]){
  if(other===self||!other?.monsterSpec||other.defeated||other.hp<=0)continue;
  const cell=other.nextCell??other.cell??other;
  if(!Number.isFinite(cell?.x)||!Number.isFinite(cell?.z))continue;
  const gap=own+monsterGroundRadiusCells(other.monsterSpec)+.25;
  if(Math.hypot(x-cell.x,z-cell.z)<gap)return false;
 }
 return true;
}
