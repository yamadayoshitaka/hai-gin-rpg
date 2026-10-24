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
    if((rule.op??'set')!=='toggle'&&input===undefined)throw Error('Missing update value: '+(rule.from??field));
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


/** Stateless purchase and rest transaction. Data in, validated state + effects out. */
export class CommerceSystem {
 execute({state,service,item}={}){
  if(!state||!service||!item||typeof item.id!=='string'||!Number.isFinite(item.price)||item.price<0)throw Error('Invalid commerce input');
  if(!['weapons','armor','inn'].includes(service))throw Error('Unknown service: '+service);
  const old=structuredClone(state);
  if(!Number.isFinite(old.gold)||old.gold<0)throw Error('Invalid balance');
  const ownedKey=service==='weapons'?'ownedWeapons':'ownedArmor';
  const alreadyOwned=service!=='inn'&&(old[ownedKey]??[]).includes(item.id);
  const charge=alreadyOwned?0:item.price;
  if(old.gold<charge)return {permitted:false,reason:'insufficient-gold',state:old,effects:[]};
  const next={...old,gold:old.gold-charge};
  const effects=[];
  if(service==='inn')effects.push({type:'restore-resources',resources:['hp','mp','stamina','guardPosture']});
  else{
   next[ownedKey]=[...new Set([...(old[ownedKey]??[]),item.id])];
   next[service==='weapons'?'weapon':'armor']=item.id;
   effects.push({type:'equip',slot:service==='weapons'?'weapon':'armor',itemId:item.id});
  }
  effects.push({type:'save-game'});
  return {permitted:true,reason:null,state:next,effects,charged:charge};
 }
}

/** Pure gameplay systems: each class takes an input object and returns an output object. */
export class CombatRecoverySystem {
 execute({combat,dt,rules}={}){
  if(!combat||!rules||!Number.isFinite(dt))throw Error('Combat recovery input required');
  const elapsed=Math.max(0,dt);
  return {playerStamina:Math.min(combat.maxStamina,combat.playerStamina+elapsed*(combat.engagementTimer>0?rules.staminaRegen.active:rules.staminaRegen.idle)),
   playerMp:Math.min(combat.maxMp,combat.playerMp+elapsed*rules.mpRegen),
   guardPosture:combat.guardHeld||combat.guardBroken>0?combat.guardPosture:Math.min(combat.maxGuardPosture,combat.guardPosture+elapsed*rules.guardPostureRegen)};
 }
}
export class AlignmentDecisionSystem {
 execute({value=0,delta=0,rules}={}){
  if(!rules||!Number.isFinite(value)||!Number.isFinite(delta))throw Error('Alignment input invalid');
  const next=Math.max(rules.minimum,Math.min(rules.maximum,value+delta));
  return {alignment:next,branch:next<=-rules.branchThreshold?'abyss':next>=rules.branchThreshold?'dawn':'neutral',
   storyStage:Math.abs(next)>=rules.endingThreshold?2:Math.abs(next)>=rules.branchThreshold?1:0};
 }
}
export class ExperienceRuleSystem {
 execute({level=1,rules}={}){
  if(!rules||!Number.isInteger(level)||level<1)throw Error('Invalid progression level');
  return {threshold:rules.xp.base+Math.floor(level*level*rules.xp.quadratic),
   skillTier:Math.min(Math.floor(level/rules.job.skillLevelInterval),rules.job.maxSkillTiers-1)};
 }
}

/** Pure spatial AI: desired location only. Collision and rendering are adapters. */
export class NpcChaseSystem {
 execute({position,target,dt,rules}={}){
  if(!position||!target||!rules||!Number.isFinite(dt))throw Error('NPC chase input required');
  const dx=target.x-position.x,dz=target.z-position.z;
  const distance=Math.hypot(dx,dz);
  const yaw=Math.atan2(dx,dz);
  if(distance<=rules.chaseDistance||dt<=0)return {x:position.x,z:position.z,yaw,moving:false};
  const step=Math.min(rules.maxChaseStep??Infinity,Math.max(0,dt)*rules.chaseSpeed);
  return {x:position.x+Math.sin(yaw)*step,z:position.z+Math.cos(yaw)*step,yaw,moving:true};
 }
}
