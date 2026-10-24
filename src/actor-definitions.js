// Data-driven actor identity, model assets, stats and equipment.
// No Three.js imports: definitions can be validated before scene construction.
export const ACTOR_TEMPLATES=Object.freeze({
 hero:{model:'knight',entityType:'character',controller:'player',role:'hero',job:'swordsman',stats:{level:1,hp:100,mp:100,stamina:100,speed:5.5},equipment:{weapon:'wood',armor:'cloth'}},
 civilian:{model:'villager',entityType:'character',controller:'ai',role:'civilian',job:'civilian',stats:{level:1,hp:100,mp:0,stamina:100,speed:1.4},equipment:{weapon:null,armor:'cloth'}}
});
export const MODEL_CATALOG=Object.freeze({
 knight:{path:'assets/characters/Knight.glb',scaleHeight:2.35},
 mage:{path:'assets/characters/Mage.glb',scaleHeight:2.35},
 rogue:{path:'assets/characters/Rogue.glb',scaleHeight:2.35},
 hooded:{path:'assets/characters/Rogue_Hooded.glb',scaleHeight:2.35},
 barbarian:{path:'assets/characters/Barbarian.glb',scaleHeight:2.35},
 villager:{path:'assets/characters/Mage.glb',scaleHeight:2.35}
});
export function createActorDefinition({id,template='civilian',model,stats={},equipment={},position=[0,0,0],behavior={},job,role,controller,entityType}={}){
 const base=ACTOR_TEMPLATES[template];
 if(!base)throw Error('Unknown actor template: '+template);
 const modelId=model??base.model;
 if(!MODEL_CATALOG[modelId])throw Error('Unknown model key: '+modelId);
 const control=controller??base.controller;
 if(!['player','ai','scripted','none'].includes(control))throw Error('Invalid character controller: '+control);
 return {id:id??template,template,entityType:entityType??base.entityType,controller:control,modelId,model:MODEL_CATALOG[modelId],job:job??base.job,role:role??base.role,position:[...position],stats:{...base.stats,...stats},equipment:{...base.equipment,...equipment},behavior:{...behavior}};
}
export class ActorRegistry {
 constructor(){this.definitions=new Map();this.instances=new Map();}
 register(definition){if(!definition?.id)throw Error('Actor id required');this.definitions.set(definition.id,definition);return definition;}
 bind(id,instance){if(!this.definitions.has(id))throw Error('Unknown actor: '+id);this.instances.set(id,instance);return instance;}
 get(id){return {definition:this.definitions.get(id)??null,instance:this.instances.get(id)??null};}
 update(id,patch){const definition=this.definitions.get(id);if(!definition)throw Error('Unknown actor: '+id);if(patch.stats)Object.assign(definition.stats,patch.stats);if(patch.equipment)Object.assign(definition.equipment,patch.equipment);if(patch.controller){if(!['player','ai','scripted','none'].includes(patch.controller))throw Error('Invalid character controller');definition.controller=patch.controller;}return definition;}
}
