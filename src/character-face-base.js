/** Shared anatomical face preset for every playable character and NPC.
 * Facial meshes remain skinned to the donor head; no floating primitive face.
 */
export const FACE_BASE=Object.freeze({
 head:{scale:1},eyes:{size:1,spacing:1,color:'#49382d'},
 nose:{width:1,height:1},mouth:{width:1},ears:{size:1},
 jaw:{width:1},skin:{color:'#c99a78'}
});
const PRESETS=Object.freeze({
 civilian:{eyes:{size:1},nose:{width:1},mouth:{width:1}},
 ranger:{eyes:{size:.94},nose:{width:1.04},mouth:{width:.94}}
});
export function createCharacterFaceBase({occupationId='civilian',sex='male',overrides={}}={}){
 const preset=PRESETS[occupationId]||{};
 const parts={};
 for(const [key,defaults] of Object.entries(FACE_BASE)){
  parts[key]={...defaults,...(preset[key]||{}),...(overrides[key]||{})};
 }
 return {id:'face-base-v1',occupationId,sex,parts};
}
export function attachCharacterFaceBase(host,definition){
 host.userData.faceBase=definition;
 host.userData.faceParts=definition.parts;
 return definition;
}
