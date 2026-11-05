/**
 * Pure three-layer interior graph:
 *  1. Floor area (each floor independently addressable)
 *  2. Layout/room
 *  3. Objects including actors and portal objects
 * Portals only hold destination IDs. Geometry is a separate adapter.
 */
export function createInteriorAreaGraph(buildings,getLayouts){
 const areas={};
 const portals={};
 for(const b of buildings){
  const layouts=getLayouts(b);
  const floorCount=b.floors??Math.max(2,...layouts.map(layout=>layout.floor??1));
  if(!Number.isInteger(floorCount)||floorCount<1)throw Error('Invalid floor count for '+b.id);
  for(let floor=1;floor<=floorCount;floor++){
   const id=b.id+':floor:'+floor;
   if(areas[id])throw Error('Duplicate area '+id);
   const roomLayouts=layouts.filter(l=>l.floor===floor).map(l=>structuredClone(l));
   const objects=roomLayouts.flatMap(l=>(l.objects??[]).map(o=>({...structuredClone(o),layoutId:l.id})));
   const links=[];
   if(floor===1)links.push({id:b.id+':entrance',type:'portal',role:'exit',direction:'out',destinationAreaId:'town',targetObjectId:'town:'+b.id+':entrance'});
   if(floor<floorCount)links.push({id:b.id+':upstairs'+(floor===1?'':':'+floor),type:'portal',role:'stairs',direction:'up',destinationAreaId:b.id+':floor:'+(floor+1),targetObjectId:b.id+':downstairs'+(floor+1===2?'':':'+(floor+1))});
   if(floor>1)links.push({id:b.id+':downstairs'+(floor===2?'':':'+floor),type:'portal',role:'stairs',direction:'down',destinationAreaId:b.id+':floor:'+(floor-1),targetObjectId:b.id+':upstairs'+(floor-1===1?'':':'+(floor-1))});
   areas[id]={id,buildingId:b.id,floor,layouts:roomLayouts,objects:[...objects,...links],portals:links};
   for(const link of links)portals[link.id]=link;
  }
 }
 return {areas,portals};
}
export class AreaPortalSystem {
 execute({graph,currentAreaId,portalId}){
  const area=graph?.areas?.[currentAreaId];
  if(!area)throw Error('Unknown current area: '+currentAreaId);
  const portal=area.portals.find(p=>p.id===portalId);
  if(!portal)throw Error('Portal not present in area: '+portalId);
  if(portal.destinationAreaId!=='town'&&!graph.areas[portal.destinationAreaId])throw Error('Broken portal destination: '+portal.destinationAreaId);
  if(portal.role==='stairs'){
   const target=graph.areas[portal.destinationAreaId]?.portals.find(p=>p.id===portal.targetObjectId);
   if(!target||target.destinationAreaId!==currentAreaId)throw Error('Broken reciprocal staircase: '+portal.id);
  }
  return {from:currentAreaId,to:portal.destinationAreaId,portalId,direction:portal.direction,targetObjectId:portal.targetObjectId};
 }
}
