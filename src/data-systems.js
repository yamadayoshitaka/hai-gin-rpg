/**
 * Stateless data transformation systems: Input DTO -> Output DTO.
 * Runtime adapters consume results. No Three.js, DOM or shared mutable globals.
 */
export class WorldCompositionSystem {
 execute({area,actorDefinitions=[]}={}){
  if(!area?.id)throw Error('Area id required');
  const nodes=[];
  const emit=(id,type,parentId,definition)=>nodes.push({id:String(id),type,parentId:parentId==null?null:String(parentId),definition});
  emit('area:'+area.id,'area',null,{id:area.id,origin:area.origin??[0,0,0]});
  for(const b of area.buildings??[]){
   const bid='building:'+b.id;
   emit(bid,'building','area:'+area.id,{kind:b.kind,position:b.position,size:b.size,attributes:b.attributes});
   for(const floor of b.floors??[]){
    const fid='floor:'+b.id+':'+floor.index;
    emit(fid,'floor',bid,{index:floor.index});
    for(const [type,entries] of [['object',floor.objects],['actor',floor.actors]]){
     (entries??[]).forEach((item,i)=>emit(type+':'+b.id+':'+floor.index+':'+(item.id??i),type,fid,item));
    }
   }
   if(b.stair)emit('stair:'+b.id,'staircase',bid,b.stair);
  }
  (area.objects??[]).forEach((o,i)=>emit('area:object:'+(o.id??i),'object','area:'+area.id,o));
  (area.actors??[]).forEach((a,i)=>emit('area:actor:'+(a.id??i),'actor','area:'+area.id,a));
  for(const actor of actorDefinitions){
   if(!actor.id)throw Error('Actor id required');
   emit('actor-definition:'+actor.id,'actor-definition',null,actor);
  }
  const ids=new Set();
  for(const node of nodes){if(ids.has(node.id))throw Error('Duplicate definition id: '+node.id);ids.add(node.id);}
  return {areaId:area.id,nodes,count:nodes.length};
 }
}
export class ActorStateSystem {
 execute({definition,state={},equipment={}}={}){
  if(!definition?.id)throw Error('Actor definition required');
  return {id:definition.id,modelId:definition.modelId,role:definition.role,controller:definition.controller,
   stats:{...definition.stats,...state},equipment:{...definition.equipment,...equipment}};
 }
}
export class BuildingCapabilitySystem {
 execute({building,action}={}){
  if(!building?.id)throw Error('Building definition required');
  const capabilities=building.attributes?.capabilities??[];
  const category=building.attributes?.shopCategory??null;
  const permitted=action==='shop'?capabilities.includes('shop'):action==='inn'?capabilities.includes('inn'):capabilities.includes(action);
  return {buildingId:building.id,action,permitted,category};
 }
}
export class StairGeometrySystem {
 execute({stair,floorY=0}={}){
  if(!stair||!Number.isFinite(stair.steps)||stair.steps<2||stair.run<=0||stair.rise<=0)throw Error('Invalid stair definition');
  const depth=stair.run/stair.steps,rise=stair.rise/stair.steps;
  const steps=Array.from({length:stair.steps},(_,i)=>({
   x:stair.x??0,z:(stair.z??0)+stair.run/2-(i+.5)*depth,
   top:floorY+(i+1)*rise,width:stair.width??3,depth,height:(i+1)*rise
  }));
  return {steps,opening:{x:stair.x??0,z:stair.z??0,width:(stair.width??3)+.8,depth:stair.run+1.4},height:stair.rise};
 }
}
