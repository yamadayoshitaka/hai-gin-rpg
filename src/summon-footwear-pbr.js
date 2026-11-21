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

export const SUMMON_FOOTWEAR_PBR_REVISION='seraph-matte-leather-no-chocolate-v4-20261122';
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
let seraphFallback=null;
// Offline wrinkle/pebble relief for matte boots, never a diffuse photograph.
// Online high detail swaps only its normal/roughness for real CC0 leather PBR.
function seraphMatteLeatherFallback(){
 if(seraphFallback)return seraphFallback;
 const size=128,normalBytes=new Uint8Array(size*size*4),
  roughBytes=new Uint8Array(size*size*4);
 const heights=new Float32Array(size*size);
 const height=(u,v)=>
  Math.cos(u*198+Math.sin(v*24)*2.4)*Math.sin(v*165)+
  .32*Math.sin(u*43+v*27);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)
  heights[y*size+x]=height(x/size,y/size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,k=i*4;
  const dx=(heights[y*size+(x+1)%size]-
   heights[y*size+(x+size-1)%size])*.054;
  const dy=(heights[((y+1)%size)*size+x]-
   heights[((y+size-1)%size)*size+x])*.054;
  const inv=1/Math.hypot(dx,dy,1);
  normalBytes[k]=Math.round(127.5*(1-dx*inv));
  normalBytes[k+1]=Math.round(127.5*(1-dy*inv));
  normalBytes[k+2]=Math.round(127.5*(1+inv));
  normalBytes[k+3]=255;
  const r=Math.round(255*Math.max(.72,Math.min(.94,.81+.027*heights[i])));
  roughBytes[k]=r;roughBytes[k+1]=r;roughBytes[k+2]=r;roughBytes[k+3]=255;
 }
 const tex=bytes=>{
  const t=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(2,2);t.generateMipmaps=true;
  t.magFilter=THREE.LinearFilter;
  t.minFilter=THREE.LinearMipmapLinearFilter;
  t.anisotropy=2;t.needsUpdate=true;
  return t;
 };
 seraphFallback=Object.freeze({
  normal:tex(normalBytes),roughness:tex(roughBytes)
 });
 return seraphFallback;
}

function attachLoaded(material,entry){
 if(!active.has(material)||entry.state!=='ready')return;
 // Do not overwrite the Seraph's charcoal leather with brown upholstery.
 if(entry.slot==='map'&&material.userData.seraphFootwear)return;
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
 if(material.userData.seraphFootwear){
  // The prior photo's chestnut albedo made both boots look like melted
  // chocolate. Preserve actual CC0 scanned roughness/normal maps, but
  // use neutral dyed charcoal-leather color and a much less glossy finish.
  detachMonsterPhotoMaterial(material);
  material.map=null;
  material.color.setHex(0x554b4a);
  material.metalness=0;
  material.roughness=.87;
  const fallback=seraphMatteLeatherFallback();
  material.normalMap=fallback.normal;
  material.roughnessMap=fallback.roughness;
  material.normalScale.set(.15,.15);
  material.userData.seraphMatteLeather=true;
  material.needsUpdate=true;
 }
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
