/** Immutable original-size wall units. Never scale any one of these meshes. */
export const WALL_MODULES=Object.freeze({
  wall_2:{length:2,height:5.85,thickness:.32},
  wall_1:{length:1,height:5.85,thickness:.32},
  wall_050:{length:.5,height:5.85,thickness:.32},
  wall_025:{length:.25,height:5.85,thickness:.32},
  wall_010:{length:.1,height:5.85,thickness:.32},
  wall_005:{length:.05,height:5.85,thickness:.32}
});
export const WALL_UNIT_KEYS=Object.keys(WALL_MODULES);
export function originalWallUnit(id){const item=WALL_MODULES[id];if(!item)throw Error('Unknown wall module: '+id);return item;}
