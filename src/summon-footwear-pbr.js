/**
 * CC0 photogrammetric leather for articulated summon boots.
 * Source: Poly Haven "Fabric Leather 01" by Rob Tuytel:
 * https://polyhaven.com/a/fabric_leather_01 (CC0).
 *
 * The already-bundled local leather photograph is attached by
 * decorateMonsterPhotoMaterial BEFORE this function runs. The optional
 * online 1K diffuse/GL-normal/roughness maps replace that fallback only
 * after successful loads, so offline mobile/PWA use stays functional.
 * Shared maps and a single loader avoid one GPU upload per summon.
 */
import * as THREE from 'three';
import {detachMonsterPhotoMaterial} from './monster-photo-pbr.js';

export const SUMMON_FOOTWEAR_PBR_REVISION='summon-cc0-leather-boots-v2-20261122';
export const SUMMON_FOOTWEAR_SOURCE=Object.freeze({
 name:'Poly Haven Fabric Leather 01',license:'CC0',
 page:'https://polyhaven.com/a/fabric_leather_01',
 diffuse:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_leather_01/fabric_leather_01_diff_1k.jpg',
 normal:'https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/fabric_leather_01/fabric_leather_01_nor_gl_1k.png',
 roughness:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/fabric_leather_01/fabric_leather_01_rough_1k.jpg'
});
const loader=typeof document!=='undefined'?new THREE.TextureLoader():null;
const active=new Set();
const entries=new Map();
const slots=Object.freeze([
 ['map','diffuse',true],['normalMap','normal',false],
 ['roughnessMap','roughness',false]
]);

function attachLoaded(material,entry){
 if(!active.has(material)||entry.state!=='ready')return;
 // The bundled leather texture is a shared reference. Release its user
 // reference before swapping; never dispose a global atlas here.
 if(entry.slot==='map'&&material.map!==entry.texture){
  detachMonsterPhotoMaterial(material);
 }
 material[entry.slot]=entry.texture;
 material.userData.summonBootPhotoSource=SUMMON_FOOTWEAR_SOURCE.page;
 material.userData.summonBootPhotoMaps=slots
  .filter(([slot])=>material[slot]?.userData?.summonBootCC0)
  .map(([slot])=>slot);
 material.needsUpdate=true;
}
function acquire(slot,source,srgb){
 if(!loader)return null;
 if(entries.has(slot))return entries.get(slot);
 const entry={slot,state:'loading',texture:null};
 entries.set(slot,entry);
 // Never set an unloaded image over the local fallback photograph.
 entry.texture=loader.load(SUMMON_FOOTWEAR_SOURCE[source],()=>{
  entry.state='ready';
  for(const material of active)attachLoaded(material,entry);
 },undefined,()=>{
  entry.state='failed';
  // A missing remote texture does not prevent the photographically textured
  // local model from rendering, even when the user is offline.
 });
 const t=entry.texture;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.repeat.set(1.5,1.5);
 t.anisotropy=4;
 t.minFilter=THREE.LinearMipmapLinearFilter;
 t.magFilter=THREE.LinearFilter;
 if(srgb)t.colorSpace=THREE.SRGBColorSpace;
 t.userData.summonBootCC0=true;
 t.userData.source=SUMMON_FOOTWEAR_SOURCE.page;
 return entry;
}
export function applySummonFootwearPBR(material,{role='',detail='high'}={}){
 if(!material||role!=='summonBootLeather')return false;
 material.roughness=.82;
 material.metalness=.015;
 material.normalScale=new THREE.Vector2(.20,.20);
 material.userData.summonFootwearPbrRevision=SUMMON_FOOTWEAR_PBR_REVISION;
 material.userData.summonBootPhotoFallback=
  '../assets/textures/outfits/leather.jpg';
 material.needsUpdate=true;
 // The distant LOD uses the bundled local photograph. No 1K downloads
 // for crowds, only for the high-quality near-camera gallery/battle actor.
 if(!loader||detail==='low')return true;
 active.add(material);
 for(const [slot,source,srgb] of slots){
  const entry=acquire(slot,source,srgb);
  if(entry)attachLoaded(material,entry);
 }
 return true;
}
export function detachSummonFootwearPBR(material){
 active.delete(material);
}
export function summonFootwearPBRStats(){
 return Object.freeze({activeMaterials:active.size,sharedMaps:entries.size,
  loaded:[...entries.values()].filter(e=>e.state==='ready').length,
  failed:[...entries.values()].filter(e=>e.state==='failed').length});
}
