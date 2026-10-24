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
  for(const floor of [1,2]){
   const id=b.id+':floor:'+floor;
   if(areas[id])throw Error('Duplicate area '+id);
   const roomLayouts=layouts.filter(l=>l.floor===floor).map(l=>structuredClone(l));
   const objects=roomLayouts.flatMap(l=>(l.objects??[]).map(o=>({...structuredClone(o),layoutId:l.id})));
   const exitArea=floor===1?'town':b.id+':floor:1';
   const arrival=floor===1?b.id+':floor:2':b.id+':floor:1';
   const links=floor===1?
    [{id:b.id+':entrance',type:'portal',role:'exit',direction:'out',destinationAreaId:'town',targetObjectId:'town:'+b.id+':entrance'},
     {id:b.id+':upstairs',type:'portal',role:'stairs',direction:'up',destinationAreaId:arrival,targetObjectId:b.id+':downstairs'}]:
    [{id:b.id+':downstairs',type:'portal',role:'stairs',direction:'down',destinationAreaId:exitArea,targetObjectId:b.id+':upstairs'}];
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
