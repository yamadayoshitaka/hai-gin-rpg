/** Shared data-only definitions for buildings and bridge combat durability. */
export const STRUCTURE_DURABILITY=Object.freeze({
  castle:560,manor_noble:260,manor_merchant:240,manor_garden:220,
  church:210,weapon:160,inn:145,shop:135,house:110,hut:125,
  stone_bridge:220,timber_bridge:115
});

/** All bounds are map-cell coordinates, including the complete bridge stairs. */
export function describeDestructibleWorld(town,bridges,huts=[]){
  const objects=[];
  for(let i=0;i<town.length;i++){
    const b=town[i].data??town[i];
    const w=b.w/2,d=b.d/2;
    objects.push({id:`world-building-${i}`,type:'building',x:Math.round(b.x),z:Math.round(b.z),
      hp:STRUCTURE_DURABILITY[b.kind]??120,blocking:false,walkableWhenOpened:false,
      bounds:{minX:b.x-w,maxX:b.x+w,minZ:b.z-d,maxZ:b.z+d},source:town[i]});
  }
  for(let i=0;i<bridges.length;i++){
    const b=bridges[i],cells=[...b.cells].map(key=>key.split(',').map(Number));
    if(!cells.length)continue;
    const xs=cells.map(v=>v[0]),zs=cells.map(v=>v[1]);
    objects.push({id:`world-bridge-${i}`,type:'bridge',x:Math.round((Math.min(...xs)+Math.max(...xs))/2),
      z:b.row,hp:STRUCTURE_DURABILITY[`${b.type}_bridge`]??115,
      blocking:false,walkableWhenOpened:false,
      bounds:{minX:Math.min(...xs)-.3,maxX:Math.max(...xs)+.3,
        minZ:Math.min(...zs)-.3,maxZ:Math.max(...zs)+.3},source:b});
  }
  for(let i=0;i<huts.length;i++){
    const h=huts[i];
    objects.push({id:`world-hut-${i}`,type:'building',x:Math.round((h.bounds.minX+h.bounds.maxX)/2),
      z:Math.round((h.bounds.minZ+h.bounds.maxZ)/2),hp:STRUCTURE_DURABILITY.hut,
      blocking:false,walkableWhenOpened:false,bounds:{...h.bounds},source:h});
  }
  return objects;
}
