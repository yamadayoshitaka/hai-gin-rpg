/**
 * Outfit-only and face-only screens share a versioned, local, artist-edited
 * heroine preset. This is local browser storage, not a cloud or game save.
 */
export const HEROINE_FACE_STUDIO_KEY='hai-gin-heroine-face-studio-v40';
const allowed=new Set(['parts','controls','hairStyleId','hairColor','hairDensity','contactColor','makeupType','manualOverrides','faceMode']);
export function loadHeroineFacePreset(storage=globalThis?.localStorage){
 try{
  const text=storage?.getItem(HEROINE_FACE_STUDIO_KEY);
  if(!text)return null;
  const data=JSON.parse(text);
  if(!data||data.version!==40||typeof data.parts!=='object'||
   typeof data.controls!=='object')return null;
  // v59 stored 'thin' for the old very narrow silhouette. The new v60
  // 'thin' is fuller; migrate once without altering face, makeup, or hair.
  if(data.bodyPresetVersion!==60&&data.parts.bodyType==='thin')
   return {...data,parts:{...data.parts,bodyType:'ultraThin'}};
  return data;
 }catch{return null}
}
export function saveHeroineFacePreset(data,storage=globalThis?.localStorage){
 const content={version:40,bodyPresetVersion:60};
 for(const [name,value] of Object.entries(data||{})){
  if(allowed.has(name))content[name]=value;
 }
 if(!content.parts||!content.controls)return false;
 try{
  storage?.setItem(HEROINE_FACE_STUDIO_KEY,JSON.stringify(content));
  return Boolean(storage);
 }catch{return false}
}
