/**
 * Reference-quality surface relief for earlier non-humanoid sculptures.
 * Reference: m049 Kraken (continuous muscle skin / suckers) and m024
 * beetle lineage (chitin / layered micro surfaces). These remain unchanged.
 * This supplements authentic bundled/photo textures, never overwrites them.
 *
 * A single species-and-family keyed GPU normal map is reused by every body
 * part, rather than creating a texture or material during animation.
 */
import * as THREE from 'three';
export const MONSTER_REFERENCE_FINISH_REVISION='kraken-beetle-surface-parity-v1-20261121';
export const APPROVED_REFERENCE_IDS=Object.freeze([
 'm021','m022','m024','m025','m026','m027','m028','m029','m030','m046','m047','m049'
]);
const approved=new Set(APPROVED_REFERENCE_IDS);
const families=Object.freeze({
 beast:Object.freeze({relief:'follicle',amplitude:.19,repeat:4}),
 feline:Object.freeze({relief:'follicle',amplitude:.15,repeat:4}),
 avian:Object.freeze({relief:'feather',amplitude:.19,repeat:3}),
 reptile:Object.freeze({relief:'scales',amplitude:.24,repeat:3}),
 insect:Object.freeze({relief:'chitin',amplitude:.24,repeat:4}),
 aquatic:Object.freeze({relief:'flow',amplitude:.16,repeat:3})
});
export const MONSTER_REFERENCE_FINISH_TARGETS=Object.freeze(
 ['beast','feline','avian','reptile','insect','aquatic']
);
const cache=new Map();
const fract=x=>x-Math.floor(x);
const hash=(x,y,seed)=>fract(Math.sin(x*127.1+y*311.7+seed*19.19)*43758.5453123);
const mix=(a,b,t)=>a+(b-a)*t;
function noise(x,y,seed){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 return mix(mix(hash(ix,iy,seed),hash(ix+1,iy,seed),u),
   mix(hash(ix,iy+1,seed),hash(ix+1,iy+1,seed),u),v);
}
const seedFor=id=>String(id).split('').reduce((p,c)=>p*33+c.charCodeAt(0),7)%991;
function reliefAt(x,y,seed,profile){
 const grain=noise(x*22,y*22,seed)*.20;
 if(profile.relief==='follicle'){
  // Elongated directional strands, not round coarse gravel.
  const fibers=Math.cos((x+.026*noise(x*8,y*8,seed))*Math.PI*115);
  return .25*fibers+.35*noise(x*10,y*26,seed)+grain;
 }
 if(profile.relief==='feather'){
  const vane=Math.cos((x+.035*Math.sin(y*18))*Math.PI*91);
  return .36*vane+.32*noise(x*17,y*11,seed)+grain;
 }
 if(profile.relief==='scales'){
  const band=Math.floor(y*27),offset=band%2*.5;
  const radiusX=Math.abs(fract(x*32+offset)-.5)*2;
  const radiusY=Math.abs(fract(y*27)-.5)*2;
  const edge=Math.max(radiusX,radiusY*.77);
  return .75*(1-Math.pow(edge,3))+.17*noise(x*19,y*19,seed);
 }
 if(profile.relief==='chitin'){
  const groove=Math.cos(y*Math.PI*69+.4*Math.sin(x*12));
  return .34*groove+.38*noise(x*17,y*18,seed)+grain;
 }
 const flow=Math.sin((x+y*.34)*Math.PI*39+.6*Math.sin(y*11));
 return .25*flow+.32*noise(x*9,y*25,seed)+grain;
}
export function referenceFinishProfile(spec,detail='high'){
 if(!spec||spec.id==='m015'||approved.has(spec.id)||detail==='low')return null;
 if(!['source','high','medium'].includes(detail))return null;
 const p=families[spec.family];
 if(!p)return null;
 return Object.freeze({...p,species:spec.id,detail});
}
export function getMonsterReferenceNormalMap(spec,detail='high'){
 const profile=referenceFinishProfile(spec,detail);
 if(!profile)return null;
 const key=spec.id+':'+detail;
 if(cache.has(key))return cache.get(key);
 const size=detail==='source'?192:detail==='medium'?96:128;
 const relief=new Float32Array(size*size),buf=new Uint8Array(size*size*4);
 const seed=seedFor(spec.id);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  relief[y*size+x]=reliefAt(x/size,y/size,seed,profile);
 }
 const strength=profile.amplitude*.5;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const k=y*size+x;
  // Periodic derivatives avoid visible tile seams.
  const dx=relief[y*size+(x+1)%size]-relief[y*size+(x+size-1)%size];
  const dy=relief[((y+1)%size)*size+x]-relief[((y+size-1)%size)*size+x];
  const inv=1/Math.hypot(dx*strength,dy*strength,1);
  const i=k*4;
  buf[i]=Math.round((1-dx*strength*inv)*127.5);
  buf[i+1]=Math.round((1-dy*strength*inv)*127.5);
  buf[i+2]=Math.round((1*inv+1)*127.5);
  buf[i+3]=255;
 }
 const texture=new THREE.DataTexture(buf,size,size,THREE.RGBAFormat);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.repeat.set(profile.repeat,profile.repeat);
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;
 texture.anisotropy=2;
 texture.needsUpdate=true;
 texture.userData.monsterReferenceFinish=MONSTER_REFERENCE_FINISH_REVISION;
 texture.userData.species=spec.id;
 texture.userData.relief=profile.relief;
 cache.set(key,texture);
 return texture;
}
/** Never replace existing high-quality normals or special water/stone skins. */
export function enhanceMonsterReferenceMaterial(material,{spec,detail='high',role='skin'}={}){
 if(!material||!spec||!['skin','light','tailScale','seaDragonSkin'].includes(role))return false;
 if(material.normalMap||material.bumpMap||material.userData?.m019VolcanicPBR||
   material.userData?.salamanderLineagePBR)return false;
 const profile=referenceFinishProfile(spec,detail);
 if(!profile)return false;
 const map=getMonsterReferenceNormalMap(spec,detail);
 if(!map)return false;
 material.normalMap=map;
 const amplitude=profile.relief==='follicle'?.18:profile.relief==='feather'?.26:.30;
 material.normalScale=new THREE.Vector2(amplitude,amplitude);
 if(profile.relief==='chitin')material.roughness=Math.min(material.roughness,.67);
 if(profile.relief==='flow'){
  material.roughness=Math.min(material.roughness,.43);
  if('clearcoat' in material)material.clearcoat=Math.max(material.clearcoat,.45);
 }
 material.userData.monsterReferenceFinish=MONSTER_REFERENCE_FINISH_REVISION;
 material.userData.referenceRelief=profile.relief;
 material.needsUpdate=true;
 return true;
}
/**
 * Optional additive microrelief for the 16 GLB-rigged humanoid MONSTER
 * costumes. Never edits donor head, naked skin, eyes, hair, skeleton or native
 * shader materials; this only touches freshly created, instance-owned
 * stone/cloth/metal/bone costume materials. Approved gargoyle bump stays first.
 */
export function enhanceMonsterHumanoidCostumeMaterial(material,{
 profile,role,detail='high'
}={}){
 if(!profile?.id||!material||detail==='low'||material.normalMap||
   material.bumpMap||!/^m0(15|3[1-9]|4[0-5])$/.test(profile.id))return false;
 let family=null,normalScale=.12;
 if(role.startsWith('construct')){
  if(role==='constructCore')return false;
  family='insect';normalScale=.23;
 }else if(['metal','gold','edge','dragonScale','dragonRim'].includes(role)){
  family='insect';normalScale=.13;
 }else if(['bandage','velvet','lining','linen','ivoryCloth','cloth',
   'membrane','leaf','forestMint','forestDeep'].includes(role)){
  family='avian';normalScale=.095;
 }else if(['bone','ivory','gargoyleHorn','gargoyleClaw'].includes(role)){
  family='reptile';normalScale=.13;
 }
 if(!family)return false;
 const key='costume-'+profile.id+'-'+role;
 const texture=getMonsterReferenceNormalMap({id:key,family},detail);
 if(!texture)return false;
 material.normalMap=texture;
 material.normalScale=new THREE.Vector2(normalScale,normalScale);
 material.userData.monsterCostumeMicrorelief=true;
 material.userData.monsterCostumeMicroreliefRole=role;
 material.needsUpdate=true;
 return true;
}
export const monsterReferenceFinishCacheStats=()=>Object.freeze({normalMaps:cache.size});
