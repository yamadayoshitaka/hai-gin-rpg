/** Carpet assembly data: native one-metre fabric tiles, no furniture-size stretching. */
export const CARPET_TILE_PART=Object.freeze({id:'rug-tile',size:[1,.026,1],material:'royal'});
export function createCarpetTileData({id,width,depth,position=[0,0,0],color}){
 if(!id||![width,depth].every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid carpet '+id);
 const columns=Math.floor(width),rows=Math.floor(depth),tiles=[];
 for(let z=0;z<rows;z++)for(let x=0;x<columns;x++)tiles.push({
  id:id+':'+x+':'+z,partId:CARPET_TILE_PART.id,
  position:[position[0]+(x-(columns-1)/2),position[1]+.052,position[2]+(z-(rows-1)/2)],
  size:[...CARPET_TILE_PART.size],materialId:'royal',color:color??0x87364d,collision:false
 });
 return tiles;
}
