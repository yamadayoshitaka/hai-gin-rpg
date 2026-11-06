/** Shared data-only definitions for buildings and bridge combat durability. */
export const STRUCTURE_DURABILITY=Object.freeze({
  castle:1200,manor_noble:500,manor_merchant:460,manor_garden:440,
  church:600,weapon:330,inn:300,shop:280,house:260,hut:240,
  stone_bridge:720,timber_bridge:260
});

// Fire burns slowly through wood and interiors; masonry resists it. These
// values are damage per second, not an unconditional collapse countdown.
export const STRUCTURE_BURN_RATE=Object.freeze({
  castle:2,manor_noble:8,manor_merchant:9,manor_garden:10,
  church:5,weapon:10,inn:12,shop:12,house:13,hut:15,
  stone_bridge:1,timber_bridge:18
});
export const STRUCTURE_BURN_SECONDS=Object.freeze({
  castle:28,manor_noble:32,manor_merchant:32,manor_garden:32,
  church:28,weapon:35,inn:35,shop:35,house:36,hut:36,
  stone_bridge:16,timber_bridge:32
});

const fireProfile=kind=>({fireDamagePerSecond:STRUCTURE_BURN_RATE[kind]??10,
  burnSeconds:STRUCTURE_BURN_SECONDS[kind]??30});

/** All bounds are map-cell coordinates, including the complete bridge stairs. */
export function describeDestructibleWorld(town,bridges,huts=[]){
  const objects=[];
  for(let i=0;i<town.length;i++){
    const b=town[i].data??town[i];
    const w=b.w/2,d=b.d/2;
    objects.push({id:`world-building-${i}`,type:'building',x:Math.round(b.x),z:Math.round(b.z),
      hp:STRUCTURE_DURABILITY[b.kind]??260,...fireProfile(b.kind),blocking:false,walkableWhenOpened:false,
      bounds:{minX:b.x-w,maxX:b.x+w,minZ:b.z-d,maxZ:b.z+d},source:town[i]});
  }
  for(let i=0;i<bridges.length;i++){
    const b=bridges[i],cells=[...b.cells].map(key=>key.split(',').map(Number));
    if(!cells.length)continue;
    const xs=cells.map(v=>v[0]),zs=cells.map(v=>v[1]);
    objects.push({id:`world-bridge-${i}`,type:'bridge',x:Math.round((Math.min(...xs)+Math.max(...xs))/2),
      z:b.row,hp:STRUCTURE_DURABILITY[`${b.type}_bridge`]??260,
      ...fireProfile(`${b.type}_bridge`),
      blocking:false,walkableWhenOpened:false,
      bounds:{minX:Math.min(...xs)-.3,maxX:Math.max(...xs)+.3,
        minZ:Math.min(...zs)-.3,maxZ:Math.max(...zs)+.3},source:b});
  }
  for(let i=0;i<huts.length;i++){
    const h=huts[i];
    objects.push({id:`world-hut-${i}`,type:'building',x:Math.round((h.bounds.minX+h.bounds.maxX)/2),
      z:Math.round((h.bounds.minZ+h.bounds.maxZ)/2),hp:STRUCTURE_DURABILITY.hut,
      ...fireProfile('hut'),
      blocking:false,walkableWhenOpened:false,bounds:{...h.bounds},source:h});
  }
  return objects;
}
