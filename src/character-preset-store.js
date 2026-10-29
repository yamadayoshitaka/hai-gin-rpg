/** Shared, validated character presets. Editor and game use the same storage namespace. */
export const CHARACTER_PRESET_KEY='hai-gin-character-presets-v1';
const fields={sex:['male','female'],body:['adult','slim','tall','sturdy','child'],face:['calm','stern','youthful','noble'],hair:['short','layered','long','bob','swept','bald'],outfit:['traveler','villager','guard','noble','merchant','mage','bandit'],equipment:['none','sword','guard','staff','dagger','bow','katana','fists','shield','book','mace','hammer','pouch','lute','coins']};
export const CHARACTER_EDIT_FIELDS=fields;
export function sanitizeCharacterPreset(input={}){
 const out={};
 for(const [key,valid] of Object.entries(fields))if(valid.includes(input[key]))out[key]=input[key];
 if(typeof input.modelId==='string'&&['Male_Peasant','Female_Peasant','Male_Ranger','Female_Ranger'].includes(input.modelId))out.modelId=input.modelId;
 if(typeof input.jobId==='string'&&/^[a-z]{2,24}$/.test(input.jobId))out.jobId=input.jobId;
 return out;
}
export function readCharacterPresets(){
 try{const saved=JSON.parse(localStorage.getItem(CHARACTER_PRESET_KEY)||'{}');if(!saved||typeof saved!=='object')return {};return Object.fromEntries(Object.entries(saved).filter(([id])=>/^(hero|companion-[0-2])$/.test(id)).map(([id,p])=>[id,sanitizeCharacterPreset(p)]));}catch{return {}}
}
export function saveCharacterPreset(actorId,preset){
 if(!/^(hero|companion-[0-2])$/.test(actorId))throw Error('Unknown actor preset '+actorId);
 const all=readCharacterPresets();all[actorId]=sanitizeCharacterPreset(preset);
 localStorage.setItem(CHARACTER_PRESET_KEY,JSON.stringify(all));return all[actorId];
}
export function applyCharacterPreset(actorId,base){return {...base,...(readCharacterPresets()[actorId]||{})};}
