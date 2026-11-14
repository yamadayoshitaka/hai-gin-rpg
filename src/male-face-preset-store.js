/**
 * Male protagonist face presets are deliberately isolated from the heroine.
 * v42: no shared storage key, hairstyle, hair color or makeup settings.
 */
export const MALE_FACE_STUDIO_KEY='hai-gin-hero-male-face-studio-v42';
const keys=new Set(['parts','controls','hairStyleId','hairColor','hairDensity','contactColor','manualOverrides','faceMode']);
export function loadMaleFacePreset(storage=globalThis?.localStorage){
 try{
  const value=storage?.getItem(MALE_FACE_STUDIO_KEY);
  if(!value)return null;
  const data=JSON.parse(value);
  if(data?.version!==42||!data?.parts||!data?.controls)return null;
  if(data.bodyPresetVersion!==60&&data.parts.bodyType==='thin')
   return {...data,parts:{...data.parts,bodyType:'ultraThin'}};
  return data;
 }catch{return null;}
}
export function saveMaleFacePreset(data,storage=globalThis?.localStorage){
 if(!storage||!data?.parts||!data?.controls)return false;
 const content={version:42,bodyPresetVersion:60};
 for(const [key,value] of Object.entries(data)){
  if(keys.has(key))content[key]=value;
 }
 try{storage.setItem(MALE_FACE_STUDIO_KEY,JSON.stringify(content));return true;}
 catch{return false;}
}
