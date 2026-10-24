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


/**
 * Universal declarative entity processor.
 *
 * INPUT: plain JSON-compatible definitions, state and commands.
 * OUTPUT: next immutable state plus declarative effects; the caller decides
 * whether to render, persist, play sound or change scenes.
 *
 * No renderer, DOM, Three.js, clock or global mutable state is involved.
 * The same rules apply to actors, buildings, rooms and ordinary objects.
 */
export class EntityDataSystem {
 execute({definitions={},state={},commands=[]}={}){
  const catalog=definitions instanceof Map?Object.fromEntries(definitions):definitions;
  if(!catalog||typeof catalog!=='object'||Array.isArray(catalog))throw Error('Invalid entity catalog');
  const next=structuredClone(state);
  const effects=[];
  for(const command of commands){
   if(!command||typeof command!=='object')throw Error('Invalid command');
   const {entityId,action,payload={}}=command;
   if(typeof entityId!=='string'||!Object.hasOwn(catalog,entityId))throw Error('Unknown entity: '+entityId);
   const definition=catalog[entityId];
   const actions=definition?.actions??{};
   const spec=actions[action];
   if(!spec)throw Error('Unsupported action: '+action+' for '+entityId);
   if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('Invalid action payload');
   const previous=next[entityId]??{};
   const required=spec.requires??[];
   for(const field of required)if(!Object.hasOwn(payload,field))throw Error('Missing action input: '+field);
   const changes={};
   for(const [field,rule] of Object.entries(spec.updates??{})){
    if(!rule||typeof rule!=='object')throw Error('Invalid update rule: '+field);
    const current=previous[field]??definition.state?.[field]??0;
    const input=rule.from==null?rule.value:payload[rule.from];
    if(input===undefined)throw Error('Missing update value: '+rule.from);
    let value;
    switch(rule.op??'set'){
     case 'set': value=input;break;
     case 'add': if(typeof current!=='number'||typeof input!=='number')throw Error('Add requires numbers');value=current+input;break;
     case 'subtract': if(typeof current!=='number'||typeof input!=='number')throw Error('Subtract requires numbers');value=current-input;break;
     case 'toggle': value=!Boolean(current);break;
     default:throw Error('Unsupported update operator: '+rule.op);
    }
    if(typeof value==='number'&&Number.isFinite(rule.min))value=Math.max(rule.min,value);
    if(typeof value==='number'&&Number.isFinite(rule.max))value=Math.min(rule.max,value);
    changes[field]=value;
   }
   next[entityId]={...structuredClone(definition.state??{}),...previous,...changes};
   for(const effect of spec.effects??[]){
    effects.push({entityId,action,type:effect.type,params:structuredClone(effect.params??{}),payload:structuredClone(payload)});
   }
  }
  return {state:next,effects};
 }
}
