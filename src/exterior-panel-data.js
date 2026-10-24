/** Fixed-size outdoor facade panel BOM compiler.
 * All returned instances have an unscaled catalog geometry and material key.
 */
export const FACADE_PARTS=Object.freeze({
 'panel-1':Object.freeze({size:[1,1,.24],material:'plaster'}),
 'panel-050':Object.freeze({size:[1,.5,.24],material:'plaster'}),
 'panel-020':Object.freeze({size:[1,.2,.24],material:'plaster'}),
 'panel-010':Object.freeze({size:[1,.1,.24],material:'plaster'})
});
export function createFacadePanelData({id,width,depth,height,material='plaster'}){
 if(!id||![width,depth,height].every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid exterior panel footprint: '+id);
 const layers=[];let y=0,remaining=Math.round(height*10);
 for(const [key,ticks] of [['panel-1',10],['panel-050',5],['panel-020',2],['panel-010',1]]){
  while(remaining>=ticks){layers.push({partId:key,y:y+ticks/20});y+=ticks/10;remaining-=ticks;}
 }
 const placements=[];let index=0;
 for(const layer of layers){
  const size=FACADE_PARTS[layer.partId].size;
  const faces=[
   {name:'front',count:Math.floor(width),place:i=>[(i-(Math.floor(width)-1)/2),layer.y,depth/2],rotationY:0},
   {name:'back',count:Math.floor(width),place:i=>[(i-(Math.floor(width)-1)/2),layer.y,-depth/2],rotationY:Math.PI},
   {name:'left',count:Math.floor(depth),place:i=>[-width/2,layer.y,(i-(Math.floor(depth)-1)/2)],rotationY:Math.PI/2},
   {name:'right',count:Math.floor(depth),place:i=>[width/2,layer.y,(i-(Math.floor(depth)-1)/2)],rotationY:Math.PI/2}
  ];
  for(const face of faces)for(let i=0;i<face.count;i++){
   placements.push({id:id+':facade:'+index++,partId:layer.partId,materialId:material,position:face.place(i),rotationY:face.rotationY,size:[...size],face:face.name});
  }
 }
 return placements;
}
