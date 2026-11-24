// Collision comes from the authored furniture parts before material batching.
export function solidInteriorPart(part,baseY=0){
 return /^(table_top|bench_seat|shelf|bed_frame|headboard|throne|weapon_rack|choir_rail|altar|lamp_pedestal|stair_guardrail|stair_baluster|.*wall.*|.*pillar.*|.*column.*)$/.test(part.name||'') &&
  part.y-part.height/2<baseY+1.65&&part.y+part.height/2>baseY+.15;
}
export function furnitureFootprintCells(box,cellSize=1,offset=6,padding=.26){
 const result=[];
 for(let z=Math.ceil((box.minZ-padding)/cellSize+offset);z<=Math.floor((box.maxZ+padding)/cellSize+offset);z++)
 for(let x=Math.ceil((box.minX-padding)/cellSize+offset);x<=Math.floor((box.maxX+padding)/cellSize+offset);x++)result.push({x,z});
 return result;
}
export function strategistRearIntent({home,position,threat=null,safeDistance=12}){
 const distance=threat?Math.hypot(position.x-threat.x,position.z-threat.z):Infinity;
 if(distance<safeDistance){
  let dx=position.x-threat.x,dz=position.z-threat.z;
  if(!dx&&!dz)dx=home.x-position.x||1;
  const d=Math.hypot(dx,dz);
  return {phase:'evade',goal:{x:position.x+dx/d*safeDistance,z:position.z+dz/d*safeDistance}};
 }
 return {phase:Math.hypot(position.x-home.x,position.z-home.z)>2?'return':'hold',goal:home};
}
