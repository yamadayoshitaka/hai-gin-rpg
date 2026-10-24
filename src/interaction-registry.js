/** Area-scoped IDs are the only identity contract for conversation/interaction. */
export function createInteractionRegistry({town,interiors,getResidents}){
 const entities=new Map();
 const put=(entity)=>{
  if(!entity.id||entities.has(entity.id))throw Error('Missing/duplicate entity ID: '+entity.id);
  if(!entity.areaId)throw Error('Entity without area ID: '+entity.id);
  entities.set(entity.id,Object.freeze(entity));
 };
 for(const npc of town.citizens){
  put({id:npc.id,areaId:'town',type:'npc',name:npc.name,dialogueId:'dialogue:'+npc.id,dialogue:{text:npc.line??'こんにちは。'},role:npc.role??'civilian'});
 }
 for(const building of interiors){
  for(const npc of getResidents(building)){
   put({id:npc.id,areaId:building.id+':floor:'+(npc.floor??1),type:'npc',name:npc.name,
    role:npc.roleKey??'civilian',dialogueId:'dialogue:'+npc.id,dialogue:{text:npc.line??'こんにちは。'}});
  }
 }
 return entities;
}
export function resolveDialogueById(registry,{areaId,entityId}){
 const entity=registry.get(entityId);
 if(!entity)throw Error('Unknown entity ID: '+entityId);
 if(entity.areaId!==areaId)throw Error('Entity is in a different area: '+entityId);
 if(!entity.dialogue?.text)throw Error('Missing dialogue data: '+entityId);
 return {entityId,dialogueId:entity.dialogueId,name:entity.name,text:entity.dialogue.text};
}
