/**
 * Species-correct, offline material microstructure for the entire 50-monster
 * bestiary. These are deterministic PBR microtexture atlases (not photos).
 * Existing photographed fur/dragon scales and hand-authored specialist PBR
 * (m016/17/19, m021/22/24/25 and the gargoyle) take precedence.
 *
 * Profiles share GPU textures by material KIND, not actor or animation frame.
 * Low crowd LOD intentionally does not allocate these extra texture maps.
 */
import * as THREE from 'three';
import {MONSTER_CATALOG} from './monster-catalog.js';

export const MONSTER_ALL50_SURFACE_REVISION='all50-species-materials-v1-20261121';
export const FAMILY_MICROSTRUCTURES=Object.freeze({
 beast:'fur',feline:'shortFur',avian:'feather',reptile:'scale',
 insect:'chitin',arachnid:'bristle',undead:'necrotic',
 golem:'stone',fiend:'hide',aquatic:'cephalopod'
});
const SPECIES_OVERRIDES=Object.freeze({
 m015:'feather',m020:'scale',m023:'chitin',
 m031:'necrotic',m032:'necrotic',m033:'necrotic',m034:'necrotic',m035:'necrotic',
 m036:'stone',m037:'bronze',m038:'crystal',m039:'lava',m040:'silver',
 m041:'hide',m042:'stone',m043:'hide',m044:'hide',m045:'silver',
 m046:'gel',m047:'cephalopod',m048:'scale',m049:'cephalopod',m050:'coral'
});
export const MONSTER_ALL50_SURFACE_PROFILES=Object.freeze(
 Object.fromEntries(MONSTER_CATALOG.map(spec=>[spec.id,Object.freeze({
  family:spec.family,kind:SPECIES_OVERRIDES[spec.id]||
   FAMILY_MICROSTRUCTURES[spec.family],speciesId:spec.id
 })]))
);
const byId=MONSTER_ALL50_SURFACE_PROFILES;
const cache=new Map();
const mod=(n,m)=>((n%m)+m)%m;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const fract=v=>v-Math.floor(v);
function hash(x,y,seed){
 const n=mod(x,128)*127.1+mod(y,128)*311.7+seed*19.19;
 return fract(Math.sin(n)*43758.5453123);
}
// Periodic value noise: no obvious dark stripe where the texture repeats.
function noise(u,v,frequency,seed){
 const x=mod(u,1)*frequency,y=mod(v,1)*frequency;
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const h=(i,j)=>hash(mod(i,frequency),mod(j,frequency),seed);
 return lerp(lerp(h(ix,iy),h(ix+1,iy),sx),
   lerp(h(ix,iy+1),h(ix+1,iy+1),sx),sy);
}
const wave=(value,frequency)=>Math.cos(Math.PI*2*value*frequency);
const line=(value,width)=>Math.exp(-Math.pow(value/width,2));
function sample(kind,u,v){
 const n=noise(u,v,32,3)-.5,f=noise(u,v,64,8)-.5;
 const g=noise(u,v,8,19)-.5;
 let h=.5,rough=.7,albedo=.92,metal=0;
 if(kind==='fur'||kind==='shortFur'){
  const dense=kind==='shortFur';
  const strand=wave(u+g*.018,dense?92:68)*.18;
  h=.5+strand+.18*n+.08*f;
  rough=dense?.70:.87;albedo=.90+.12*n+.04*strand;
 }else if(kind==='feather'){
  const stem=line(Math.sin(u*Math.PI*18),.17);
  const barbs=wave(v+u*.30,63);
  h=.45+.27*stem+.13*barbs+.13*n;
  rough=.79+.06*f;albedo=.90+.09*g+.05*barbs;
 }else if(kind==='scale'){
  const row=Math.floor(v*22),sx=fract(u*29+(row%2)*.5)-.5;
  const sy=fract(v*22)-.48;
  const dome=clamp(1-Math.pow(sx*2,2)-Math.pow(sy*1.9,2));
  h=.23+.54*dome+.09*n+.04*f;
  rough=.62+.08*n;albedo=.86+.13*dome+.06*g;
 }else if(kind==='chitin'){
  const ribs=wave(v+.025*g,39);
  const pores=Math.abs(f);
  h=.48+.19*ribs+.18*n+.08*pores;
  rough=.36+.10*n;albedo=.87+.10*g+.05*ribs;metal=.08;
 }else if(kind==='bristle'){
  const follicles=line(Math.sin(u*Math.PI*56)*Math.sin(v*Math.PI*52),.20);
  const hairs=wave(u+v*.27,73);
  h=.45+.15*follicles+.13*hairs+.16*n;
  rough=.82+.06*f;albedo=.91+.11*n;
 }else if(kind==='keratin'){
  const growth=wave(v+g*.019,67),striations=wave(u+v*.11,31);
  h=.49+.21*growth+.14*striations+.10*n;
  rough=.65+.07*f;albedo=.92+.08*g-.04*growth;
 }else if(kind==='necrotic'||kind==='hide'){
  const pores=Math.abs(f);
  h=.46+.17*n+.21*pores+.12*g;
  rough=kind==='hide'?.73:.89;
  albedo=.89+.12*n-.10*pores;
 }else if(kind==='stone'||kind==='lava'){
  const fault=line(Math.sin(u*Math.PI*17+v*Math.PI*21+g*4),.22);
  h=.38+.33*n+.19*g-.22*fault;
  rough=.89+.06*n;albedo=.89+.13*g-.10*fault;
 }else if(kind==='bronze'||kind==='silver'){
  const brushed=wave(v+g*.025,85);
  const oxide=Math.abs(n);
  h=.5+.13*brushed+.16*g;
  rough=kind==='bronze'?.52+.10*oxide:.38+.08*oxide;
  albedo=.92+.09*brushed-.10*oxide;
  metal=kind==='bronze'?.66:.75;
 }else if(kind==='crystal'){
  const facets=wave(u*2+v,16);
  h=.55+.23*facets+.15*g;
  rough=.28+.10*n;albedo=.92+.08*facets;metal=.09;
 }else if(kind==='cephalopod'||kind==='gel'){
  const pores=Math.abs(noise(u,v,64,31)-.5);
  const suckers=line(Math.sin(u*Math.PI*21)*Math.sin(v*Math.PI*21),.12);
  h=.47+.15*g+.13*pores+(kind==='cephalopod'?.20*suckers:0);
  rough=kind==='gel'?.25:.48;
  albedo=.94+.06*n;metal=0;
 }else if(kind==='coral'){
  const cavities=line(noise(u,v,32,45)-.5,.17);
  h=.60-.33*cavities+.12*n;
  rough=.82+.06*g;albedo=.94-.14*cavities+.05*n;
 }
 return {height:clamp(h),albedo:clamp(albedo,.68,1),
  rough:clamp(rough,.18,1),metal};
}
const rgba=(size,fn,colorData=false)=>{
 const bytes=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const channels=fn((x+.5)/size,(y+.5)/size);
  const p=(y*size+x)*4;
  bytes[p]=Math.round(clamp(channels[0])*255);
  bytes[p+1]=Math.round(clamp(channels[1])*255);
  bytes[p+2]=Math.round(clamp(channels[2])*255);
  bytes[p+3]=255;
 }
 const tex=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.repeat.set(2,2);
 tex.colorSpace=colorData?THREE.SRGBColorSpace:THREE.NoColorSpace;
 tex.magFilter=THREE.LinearFilter;
 tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;tex.anisotropy=2;tex.needsUpdate=true;
 tex.userData.all50Surface=MONSTER_ALL50_SURFACE_REVISION;
 return tex;
};
function atlas(kind,detail){
 if(detail==='low')return null;
 const tier=detail==='source'?'source':detail==='medium'?'medium':'high';
 const key=kind+':'+tier;
 if(cache.has(key))return cache.get(key);
 const size=tier==='source'?192:tier==='medium'?96:128;
 const heights=new Float32Array(size*size);
 const albedo=rgba(size,(u,v)=>{
  const s=sample(kind,u,v);
  heights[Math.floor(v*size)*size+Math.floor(u*size)]=s.height;
  return [s.albedo,s.albedo,s.albedo];
 },true);
 const roughness=rgba(size,(u,v)=>{
  const value=sample(kind,u,v).rough;
  return [value,value,value];
 });
 const normal=rgba(size,(u,v)=>{
  const x=Math.floor(u*size),y=Math.floor(v*size);
  const left=heights[y*size+mod(x-1,size)];
  const right=heights[y*size+mod(x+1,size)];
  const up=heights[mod(y-1,size)*size+x];
  const down=heights[mod(y+1,size)*size+x];
  const dx=(right-left)*.42,dy=(down-up)*.42;
  const inv=1/Math.hypot(dx,dy,1);
  return [(.5-dx*.5*inv),(.5-dy*.5*inv),(.5+.5*inv)];
 });
 const result=Object.freeze({kind,albedo,normal,roughness,size});
 cache.set(key,result);
 return result;
}
/** Keep an authentic scanned colour/roughness image but add matching stone
 * micro-normal when its original photograph has no bundled normal texture.
 * Never overwrite a verified model normal map or use in low crowd LOD.
 */
export function complementAll50PhotoNormal(material,{
 speciesId='',detail='high'
}={}){
 const profile=byId[speciesId];
 if(!profile||detail==='low'||material.normalMap||!material.map)
  return false;
 // Only photoscanned golem stone; approved reptile photos already have normals.
 if(profile.kind!=='stone')return false;
 const maps=atlas('stone',detail);
 material.normalMap=maps.normal;
 material.normalScale=new THREE.Vector2(.21,.21);
 material.userData.all50PhotoNormal='stone-micro-relief';
 material.needsUpdate=true;
 return true;
}

/** A safe, family-wide surface pass for missing non-photo materials. */
export function decorateAll50MonsterSurface(material,{
 speciesId='',family='',role='skin',detail='high',glow=false,
 translucent=false,preserveExisting=true
}={}){
 const profile=byId[speciesId];
 if(!profile||family&&profile.family!==family||detail==='low'||
   glow||translucent||!['skin','light','shadow','tailScale',
     'seaDragonSkin','bone','mortalSkin','constructBase','constructFacet',
     'constructDark','constructTrim','membrane','feather',
     'dragonScale','dragonRim'].includes(role))return false;
 if(preserveExisting&&(material.map||material.normalMap||material.bumpMap||
   material.roughnessMap))return false;
 const kind=role==='bone'?'keratin':profile.kind;
 const maps=atlas(kind,detail);
 if(!maps)return false;
 material.map=maps.albedo;
 material.normalMap=maps.normal;
 material.roughnessMap=maps.roughness;
 material.normalScale=new THREE.Vector2(.19,.19);
 material.roughness=1;
 const m=sample(profile.kind,.31,.47).metal;
 material.metalness=Math.max(0,Math.min(.78,m));
 material.userData.all50Surface=MONSTER_ALL50_SURFACE_REVISION;
 material.userData.all50SurfaceSpecies=speciesId;
 material.userData.all50SurfaceKind=kind;
 material.needsUpdate=true;
 return true;
}
export function monsterAll50SurfaceStats(){
 return Object.freeze({profiles:Object.keys(byId).length,atlasVariants:cache.size,
  surfaceKinds:new Set(Object.values(byId).map(profile=>profile.kind)).size});
}
