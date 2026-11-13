/**
 * v50 hero-specific facial art direction. The archive GLB is unchanged.
 * Manual edits are authoritative and older NPCs keep their ages.
 */
export const YOUNG_HERO_MALE_V50=Object.freeze({
 eyeWidth:1.17,eyeHeight:1.16,irisDiameter:1.23,eyeDepth:.055,
 browThickness:.88,browWidth:1.06,jawSharpness:4.45,
 faceMorph:.13,mouthSmile:.085,beardDensity:0,beardLength:.35
});
export function youngHeroMaleControls(base={},ageBand='twenties',manual={}){
 if(!['teens','twenties'].includes(ageBand))return {...base};
 const out={...base};
 for(const [key,value] of Object.entries(YOUNG_HERO_MALE_V50)){
  if(Object.hasOwn(manual,key)){
   out[key]=Number(manual[key]);
   continue;
  }
  const previous=Number(base[key]);
  if(['eyeWidth','eyeHeight','irisDiameter','eyeDepth'].includes(key))
   out[key]=Math.max(Number.isFinite(previous)?previous:0,value);
  else out[key]=value;
 }
 return out;
}
export function isUneditedYoungMale(saved=null,manual={}){
 return !saved||(
  saved.parts?.ageBand==='twenties'&&Object.keys(manual).length===0&&
  saved.faceMode!=='custom');
}
