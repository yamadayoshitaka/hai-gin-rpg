/**
 * Entity key -> visual/object definition -> composable roles.
 * Roles express capabilities independently of physical shape or controller.
 * No rendering/runtime dependency.
 */
export const ROLE_CATALOG=Object.freeze({
 npc:{capabilities:['dialogue'],controller:'ai'},
 player:{capabilities:['move','interact','inventory'],controller:'player'},
 merchant:{capabilities:['shop','dialogue']},
 guard:{capabilities:['dialogue','defend']},
 civilian:{capabilities:['dialogue']},
 combatant:{capabilities:['combat']},
 shop:{capabilities:['shop']},
 inn:{capabilities:['inn']},
 dialogue:{capabilities:['dialogue']},
 openable:{capabilities:['toggle'],actions:{toggle:{updates:{open:{op:'toggle'}},effects:[{type:'state-changed',params:{property:'open'}}]}}},
 lockable:{capabilities:['unlock'],state:{locked:false}},
 transition:{capabilities:['transition']},
 lootable:{capabilities:['loot']},
 light:{capabilities:['light'],actions:{light:{updates:{enabled:{op:'toggle'}},effects:[{type:'lighting-changed'}]}}},
 inspectable:{capabilities:['inspect'],actions:{inspect:{effects:[{type:'show-description'}]}}}
});
export const DEFAULT_ROLES=Object.freeze({
 actor:['npc'],door:['openable'],light:['light'],building:[],furniture:['inspectable'],
 chest:['openable','lootable'],object:[]
});
/** Returns a fresh DTO and never mutates the definition or role catalog. */
export function resolveEntityRoles(definition,{catalog=ROLE_CATALOG}={}){
 if(!definition||typeof definition!=='object')throw Error('Entity definition required');
 const roles=[...new Set([...(definition.roles??DEFAULT_ROLES[definition.type]??[]),...(definition.role?[definition.role]:[])])];
 const capabilities=new Set(definition.capabilities??[]);
 const actions={};
 const state={};
 let controller=definition.controller??null;
 for(const role of roles){
  const spec=catalog[role];
  if(!spec)throw Error('Unknown role key: '+role);
  for(const cap of spec.capabilities??[])capabilities.add(cap);
  Object.assign(state,structuredClone(spec.state??{}));
  Object.assign(actions,structuredClone(spec.actions??{}));
  if(!controller&&spec.controller)controller=spec.controller;
 }
 Object.assign(state,structuredClone(definition.state??{}));
 Object.assign(actions,structuredClone(definition.actions??{}));
 return {...structuredClone(definition),roles,capabilities:[...capabilities],state,actions,controller};
}
