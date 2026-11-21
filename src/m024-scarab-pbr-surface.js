/**
 * Dedicated, offline PBR surface atlas for m024 Purple Venom Scarab.
 *
 * Unlike the old generic dragon-scale photograph, the atlas resolves the
 * actual insect materials: iridescent cuticle, laminated toxic crystals,
 * veined wing membrane, faceted compound eyes and ivory mandibles.
 * Deterministic THREE.DataTextures render in WebGL AND Node regression QA.
 * Atlases are shared by all instances; no GPU allocation occurs per frame.
 */
import * as THREE from 'three';

export const M024_PBR_REVISION='four-beetles-concept-pbr-v5-20261121';
export const SCARAB_PBR_SPECIES=Object.freeze(['m021','m022','m024','m025']);
export const isScarabPBRSpecies=id=>SCARAB_PBR_SPECIES.includes(id);
const kinds=new Set(['chitin','crystal','wing','eye','enamel']);
const atlases=new Map();
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const sq=x=>x*x;
const gaussian=(x,spread)=>Math.exp(-sq(x/spread));
const byte=v=>Math.round(clamp(v)*255);
const phase=(u,v)=>Math.sin(35*u+11*Math.cos(7*v))*.5+
 Math.sin(79*v-18*u)*.24+Math.sin(153*u+91*v)*.12;

function hexFacet(u,v){
 const row=Math.floor(v*30),shift=(row%2)*.5;
 const col=u*37-shift,dx=col-Math.floor(col)-.5;
 const dy=v*30-row-.5;
 return clamp(Math.sqrt(sq(dx*1.6)+sq(dy*1.4)));
}

function wingVeins(u,v){
 const main=gaussian(u-(.50+.08*Math.sin(v*3)),.023);
 const branching=Math.sin(v*41+Math.sin(u*13)*.6);
 const lateral=gaussian(branching,.12)*(.22+.78*Math.sin(Math.PI*u)**2);
 const faint=gaussian(Math.sin(u*25-v*22),.10)*.23;
 return clamp(main*.9+lateral*.53+faint);
}
function crystalStrata(u,v){
 const seam=gaussian(Math.sin(u*39+v*14+Math.sin(v*8)),.19);
 const thread=gaussian(Math.sin(u*116-v*34),.08);
 return clamp(.68*seam+.22*thread);
}
function height(kind,u,v){
 const grain=phase(u,v);
 if(kind==='chitin'){
  const longGrain=Math.sin(u*61+Math.sin(v*9)*1.2);
  return .29*grain+.16*longGrain+.16*Math.sin(v*53);
 }
 if(kind==='crystal')return crystalStrata(u,v)*.28+Math.sin(u*17+v*3)*.16;
 if(kind==='wing')return wingVeins(u,v)*.29+.025*grain;
 if(kind==='eye')return (1-hexFacet(u,v))*.24+.025*grain;
 return .12*Math.sin(u*109+v*8)+.07*grain;
}

function palette(kind,u,v){
 const g=phase(u,v),h=height(kind,u,v);
 if(kind==='chitin'){
  // Fine cuticle striations, cool iridescent bands and darker plate seams.
  const shimmer=.5+.5*Math.sin(7*u+11*v+g*.5);
  return [clamp(.82+.10*g-.065*shimmer),
   clamp(.79+.055*g+.032*shimmer),
   clamp(.85+.075*g+.045*shimmer)];
 }
 if(kind==='crystal'){
  const layers=crystalStrata(u,v),core=.5+.5*Math.sin(v*11+u*8);
  return [clamp(.81+.16*layers),
   clamp(.87+.12*layers+.04*core),
   clamp(.70+.17*layers+.045*core)];
 }
 if(kind==='wing'){
  // Interference and physical venation, not a uniform opaque purple fin.
  const lines=wingVeins(u,v),interference=Math.sin(u*30-v*19);
  return [clamp(.83-.18*lines+.07*interference),
   clamp(.81-.14*lines-.04*interference),
   clamp(.93-.055*lines+.025*interference)];
 }
 if(kind==='eye'){
  const facets=hexFacet(u,v),glitter=.5+.5*Math.sin(u*28+v*9);
  return [clamp(.43+.10*glitter-.16*facets),
   clamp(.37+.06*glitter-.11*facets),
   clamp(.54+.13*glitter-.19*facets)];
 }
 const enamel=.5+.5*Math.sin(u*97+v*5);
 return [clamp(.95-.06*enamel),clamp(.93-.07*enamel),clamp(.85-.10*enamel)];
}

function roughness(kind,u,v){
 const g=phase(u,v),h=height(kind,u,v);
 switch(kind){
  case 'chitin':return clamp(.32+.12*g+.07*Math.abs(h),.18,.66);
  case 'crystal':return clamp(.14+.10*h,.06,.38);
  case 'wing':return clamp(.27+.15*wingVeins(u,v),.19,.55);
  case 'eye':return clamp(.09+.14*hexFacet(u,v),.05,.30);
  default:return clamp(.26+.11*g,.14,.48);
 }
}
function alphaWing(u,v){
 // Extremely thin tips and trailing edges with a largely translucent span.
 const edge=Math.sin(Math.PI*clamp(u))**2;
 const tip=Math.sin(Math.PI*clamp(v))**2;
 return clamp(.30+.55*edge*.58+.18*tip,.28,.86);
}
function makeDataTexture(size,sample,colorData=false){
 const pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size,v=(y+.5)/size;
  const [r,g,b,a=1]=sample(u,v,size);
  const i=(y*size+x)*4;
  pixels[i]=byte(r);pixels[i+1]=byte(g);pixels[i+2]=byte(b);pixels[i+3]=byte(a);
 }
 const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);
 texture.colorSpace=colorData?THREE.SRGBColorSpace:THREE.NoColorSpace;
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.magFilter=THREE.LinearFilter;
 texture.minFilter=THREE.LinearMipmapLinearFilter;
 texture.generateMipmaps=true;
 texture.anisotropy=4;
 texture.needsUpdate=true;
 return texture;
}

function surfaceAtlas(kind,detail){
 if(!kinds.has(kind))throw Error('Unknown m024 surface: '+kind);
 const low=detail==='low';
 const key=kind+':'+(low?'low':'high');
 const existing=atlases.get(key);
 if(existing)return existing;
 const size=low?64:256;
 const albedo=makeDataTexture(size,(u,v)=>palette(kind,u,v),true);
 const rough=makeDataTexture(size,(u,v)=>{
  const t=roughness(kind,u,v);
  return [t,t,t];
 });
 const normal=low?null:makeDataTexture(size,(u,v)=>{
  const delta=1/size;
  const dx=height(kind,u+delta,v)-height(kind,u-delta,v);
  const dy=height(kind,u,v+delta)-height(kind,u,v-delta);
  const sx=clamp(-dx*2,-.6,.6),sy=clamp(-dy*2,-.6,.6);
  const length=Math.hypot(sx,sy,1);
  return [sx/length*.5+.5,sy/length*.5+.5,1/length*.5+.5];
 });
 const alpha=kind==='wing'?makeDataTexture(size,(u,v)=>{
  const value=alphaWing(u,v);
  return [value,value,value];
 }):null;
 const emit=kind==='crystal'&&!low?makeDataTexture(size,(u,v)=>{
  const strata=crystalStrata(u,v),core=gaussian(u-.5,.28);
  const intensity=clamp(.06+.58*strata+.20*core);
  return [intensity,intensity,intensity];
 }):null;
 const bundle=Object.freeze({size,albedo,rough,normal,alpha,emit,kind});
 atlases.set(key,bundle);
 return bundle;
}

/**
 * Called only from the shared material cache for explicitly tagged
 * m024 meshes. The material remains cache-owned; no clones or leaks.
 */
export function decorateM024PBRMaterial(material,{
 surface,detail='high',speciesId='m024',finish=null
}={}){
 if(!isScarabPBRSpecies(speciesId))
  throw Error('Only registered scarab species may inherit the m024 PBR atlas');
 const maps=surfaceAtlas(surface,detail);
 material.map=maps.albedo;
 material.roughnessMap=maps.rough;
 material.normalMap=maps.normal;
 if(maps.normal)material.normalScale=new THREE.Vector2(
  surface==='wing'?.18:surface==='eye'?.11:.28,
  surface==='wing'?.18:surface==='eye'?.11:.28);
 material.roughness=surface==='chitin'?.65:surface==='enamel'?.57:.46;
 material.metalness=surface==='chitin'?.20:surface==='eye'?.085:0;
 if(surface==='wing'){
  material.transparent=true;
  material.opacity=.79;
  material.depthWrite=false;
  material.alphaMap=maps.alpha;
  material.alphaTest=.035;
 }else if(surface==='crystal'){
  // The donor's green poison emission is never carried into steel beetles.
  // Fire gets ember orange, divine gets warm gold and m024 stays green.
  material.emissive=new THREE.Color(speciesId==='m022'?'#da6420':
   speciesId==='m025'?'#e6c64f':'#4b9229');
  material.emissiveMap=speciesId==='m021'?null:maps.emit;
  material.emissiveIntensity=speciesId==='m021'?0:
   maps.emit?(speciesId==='m025'?.38:.28):0;
 }
 if(material.isMeshPhysicalMaterial){
  material.clearcoat=surface==='wing'?.31:
   surface==='crystal'?.94:surface==='eye'?1:surface==='enamel'?.55:.46;
  material.clearcoatRoughness=surface==='eye'?.055:
   surface==='crystal'?.09:surface==='wing'?.18:.22;
  material.ior=surface==='wing'?1.35:surface==='crystal'?1.49:1.46;
  if(surface==='crystal')material.thickness=.36;
 }
 // m022's giant forehead horn previously used the same rough, strongly
 // bump-mapped material as the tiny joint spikes. Its rings looked like
 // stacked wood rather than polished cuticle next to glossy elytra.
 // Reuse the SAME real PBR maps as the shell, but reduce the normal amplitude
 // and put a bright, continuous clearcoat over the smooth hero geometry.
 // Do not mutate the shared texture or other beetle materials.
 if(finish==='polishedHorn'||finish==='ironHorn'||
    finish==='toxicHorn'||finish==='divineHorn'){
  if(surface!=='chitin')
   throw Error('Hero beetle horns must use chitin surface maps');
  material.roughness=.70;
  material.metalness=finish==='ironHorn'?.40:.24;
  material.clearcoat=.93;
  material.clearcoatRoughness=.105;
  material.ior=1.48;
  if(material.normalScale)material.normalScale.set(.095,.095);
  material.userData.polishedBeetleHorn=true;
 }
 if(finish==='ironPlate'&&surface==='chitin'){
  material.roughness=.40;
  material.metalness=.76;
  material.clearcoat=.59;
  material.clearcoatRoughness=.18;
  if(material.normalScale)material.normalScale.multiplyScalar(.55);
 }
 if(finish==='divineGold'&&surface==='chitin'){
  material.roughness=.34;
  material.metalness=.63;
  material.clearcoat=.79;
  material.clearcoatRoughness=.12;
  if(material.normalScale)material.normalScale.multiplyScalar(.60);
 }
 if((finish==='crimsonLacquer'||finish==='toxicLacquer')&&surface==='chitin'){
  material.roughness=.48;
  material.metalness=.21;
  material.clearcoat=.94;
  material.clearcoatRoughness=.085;
  if(material.normalScale)material.normalScale.multiplyScalar(.55);
 }
 if(finish==='toxicGlass'&&surface==='crystal'){
  material.roughness=.23;
  material.metalness=0;
  material.clearcoat=1;
  material.clearcoatRoughness=.055;
  material.emissive=new THREE.Color('#69e91c');
  material.emissiveMap=maps.emit;
  material.emissiveIntensity=detail==='low'?.22:.52;
  if(material.normalScale)material.normalScale.multiplyScalar(.3);
 }
 if(finish==='rubyGem'&&surface==='crystal'){
  material.roughness=.26;
  material.metalness=.05;
  material.clearcoat=.97;
  material.clearcoatRoughness=.075;
  material.emissive=new THREE.Color('#9a0926');
  material.emissiveMap=null;
  material.emissiveIntensity=.10;
 }
 material.userData.m024PBR=surface;
 material.userData.scarabPBRDonorId='m024';
 material.userData.scarabPBRSpeciesId=speciesId;
 material.userData.m024SurfaceRevision=M024_PBR_REVISION;
 material.userData.m024TextureResolution=maps.size;
 material.userData.m024TextureOrigin='bundled-deterministic-DataTexture';
 material.needsUpdate=true;
 return material;
}

export function m024PBRTextureStats(){
 return Object.freeze({
  atlasCount:atlases.size,
  textureCount:[...atlases.values()].reduce((n,a)=>n+
   [a.albedo,a.rough,a.normal,a.alpha,a.emit].filter(Boolean).length,0),
  sizes:Object.freeze([...new Set([...atlases.values()].map(a=>a.size))]),
 });
}
