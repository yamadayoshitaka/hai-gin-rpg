/** Canonical proportion contract between exterior building and authored interior.
 * World house grid units are visually larger than player-model metres.
 */
export const BUILDING_WORLD_SCALE=3;
export function buildingInteriorFootprint(building){
 const [,,w,d]=building.grid;
 if(!(w>0&&d>0))throw Error('Invalid exterior footprint '+building.id);
 return [w*BUILDING_WORLD_SCALE,d*BUILDING_WORLD_SCALE];
}
export function fitInteriorLayouts(layouts,size,{sourceSize=[42,39]}={}){
 const [width,depth]=size;
 const sx=(width-5)/(sourceSize[0]-5),sz=(depth-5)/(sourceSize[1]-5);
 return layouts.map(layout=>({...layout,bounds:{center:[0,0,0],size:[width,0,depth]},
 objects:(layout.objects??[]).map(o=>({...o,position:[Math.max(-width/2+2.2,Math.min(width/2-2.2,o.position[0]*sx)),o.position[1],Math.max(-depth/2+2.2,Math.min(depth/2-2.2,o.position[2]*sz))]}))}));
}
