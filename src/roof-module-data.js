/** Native-size sloped roof shingles expressed as data. */
export const ROOF_PARTS=Object.freeze({
 slate:{size:[1,.12,1],material:'tile'},
 chapel:{size:[1,.12,1],material:'tile'},
 royal:{size:[1,.12,1],material:'royal-roof'}
});
export function createRoofTileData({id,width,depth,height,rise,side,materialId='slate'}){
 if(!id||![width,depth,height,rise].every(n=>Number.isFinite(n)&&n>0)||![-1,1].includes(side))throw Error('Invalid roof '+id);
 const module=ROOF_PARTS[materialId];if(!module)throw Error('Missing roof module '+materialId);
 const half=width/2+.5,run=Math.hypot(half,rise),angle=Math.atan2(rise,half);
 const along=Math.floor(run),across=Math.floor(depth+1);
 const output=[];
 for(let i=0;i<along;i++)for(let z=0;z<across;z++){
  const progress=(i+.5),horizontal=progress*Math.cos(angle),vertical=progress*Math.sin(angle);
  output.push({id:id+':tile:'+side+':'+i+':'+z,partId:materialId,materialId:module.material,
   size:[...module.size],position:[side*horizontal,height+rise-vertical+.08,z-(across-1)/2],
   rotationZ:side===1?-angle:angle,collision:false});
 }
 return output;
}
