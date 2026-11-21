/**
 * Pearl-white ceremonial fabrics, fine brocade and antique gold, isolated
 * from the monster/bandage photo albedo pipeline. The old imported linen
 * albedo was brown and scaled into huge coarse burlap checks on the angel.
 *
 * Uses shared, mobile-safe physical normal/roughness atlases with optional
 * CC0 Poly Haven crepe-satin scan overrides (normal/roughness only; no
 * yellow diffuse tint). All texture maps are shared between outfit pieces.
 */
import * as THREE from 'three';

export const SERAPH_CEREMONIAL_MATERIAL_REVISION=
 'seraph-pearl-satin-gold-pbr-v3-20261122';
export const SERAPH_CLOTH_CC0_SOURCE=Object.freeze({
 page:'https://polyhaven.com/a/crepe_satin',
 license:'CC0',
 // Real scanned texture detail, NEVER multiply golden diffuse over the
 // angel's white costume. If CORS/download fails local PBR still renders.
 normal:'https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/crepe_satin/crepe_satin_nor_gl_1k.png',
 roughness:'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/crepe_satin/crepe_satin_rough_1k.jpg'
});
const ROLES=Object.freeze({
 seraphSatin:{color:0xf4f0e7,rough:.49,metal:0,normal:.14,kind:'silk'},
 seraphBrocade:{color:0xf1e9d7,rough:.61,metal:0,normal:.15,kind:'brocade'},
 seraphGoldTrim:{color:0xc2a26d,rough:.31,metal:.78,normal:0,kind:'gold'},
 seraphLeatherInset:{color:0x332e2d,rough:.83,metal:0,normal:.13,kind:'leather'},
 seraphCapeLining:{color:0x39373d,rough:.83,metal:0,normal:.07,kind:'silk'}
});
const cache=new Map();
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const h=(kind,u,v)=>{
 const weave=Math.cos(u*157.08)*Math.cos(v*125.66)*.17;
 if(kind==='silk')return .52+.21*weave+.042*Math.sin(u*37+v*4);
 if(kind==='brocade'){
  // A small decorative jacquard weave rather than burlap ropes.
  const vine=Math.cos(u*30+1.8*Math.sin(v*17))*
   Math.cos(v*27+2*Math.sin(u*13));
  return .53+.12*weave+.074*vine;
 }
 const grain=Math.cos(u*96+Math.sin(v*19))*Math.cos(v*109);
 const fold=Math.sin(u*12+v*21);
 return .51+.11*grain+.08*fold;
};
function dataTexture(size,colour){
 const t=new THREE.DataTexture(new Uint8Array(size*size*4),
  size,size,THREE.RGBAFormat);
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.repeat.set(2.0,3.0);
 t.generateMipmaps=true;
 t.minFilter=THREE.LinearMipmapLinearFilter;
 t.magFilter=THREE.LinearFilter;
 t.anisotropy=2;
 if(colour)t.colorSpace=THREE.SRGBColorSpace;
 return t;
}
function localMaps(kind,detail){
 const size=detail==='low'?64:detail==='source'?192:128;
 const key=kind+':'+size;
 if(cache.has(key))return cache.get(key);
 const heights=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)
  heights[y*size+x]=h(kind,(x+.5)/size,(y+.5)/size);
 const normal=dataTexture(size,false),rough=dataTexture(size,false);
 const n=normal.image.data,r=rough.image.data;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,idx=i*4;
  const dx=(heights[y*size+(x+1)%size]-
    heights[y*size+(x+size-1)%size])*.42;
  const dy=(heights[((y+1)%size)*size+x]-
    heights[((y+size-1)%size)*size+x])*.42;
  const inv=1/Math.hypot(dx,dy,1);
  n[idx]=Math.round(255*clamp(.5-dx*inv*.5));
  n[idx+1]=Math.round(255*clamp(.5-dy*inv*.5));
  n[idx+2]=Math.round(255*clamp(.5+inv*.5));n[idx+3]=255;
  const base=kind==='silk'?.5:kind==='brocade'?.63:.81;
  const rr=Math.round(255*clamp(base+(heights[i]-.5)*.16));
  r[idx]=rr;r[idx+1]=rr;r[idx+2]=rr;r[idx+3]=255;
 }
 normal.needsUpdate=true;rough.needsUpdate=true;
 const maps=Object.freeze({normal,rough});
 cache.set(key,maps);return maps;
}
const loader=typeof document==='undefined'?null:new THREE.TextureLoader();
const live=new Set();
const remote=new Map();
function tryRemote(key,url,isNormal){
 if(!loader||remote.has(key))return;
 const entry={state:'loading',texture:null,key};
 remote.set(key,entry);
 entry.texture=loader.load(url,()=>{
  entry.state='ready';
  for(const m of live){
   if(!m.userData.seraphCeremonialKind||
       m.userData.seraphCeremonialKind==='leather')continue;
   if(isNormal)m.normalMap=entry.texture;
   else m.roughnessMap=entry.texture;
   m.needsUpdate=true;
  }
 },undefined,()=>{entry.state='failed';});
 const t=entry.texture;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.repeat.set(2,3);t.anisotropy=2;
 t.minFilter=THREE.LinearMipmapLinearFilter;
 t.magFilter=THREE.LinearFilter;
 t.userData.seraphClothCC0=true;
}
export function applySeraphCeremonialMaterial(material,{role='',detail='high'}={}){
 const spec=ROLES[role];
 if(!material||!spec)return false;
 material.map=null;
 material.color.setHex(spec.color);
 material.roughness=spec.rough;
 material.metalness=spec.metal;
 material.userData.seraphCeremonialRole=role;
 material.userData.seraphCeremonialKind=spec.kind;
 material.userData.seraphCeremonialRevision=SERAPH_CEREMONIAL_MATERIAL_REVISION;
 if(spec.normal>0){
  const maps=localMaps(spec.kind,detail);
  material.normalMap=maps.normal;
  material.roughnessMap=maps.rough;
  material.normalScale=new THREE.Vector2(spec.normal,spec.normal);
  if(detail!=='low'&&spec.kind!=='leather'&&loader){
   live.add(material);
   tryRemote('clothNormal',SERAPH_CLOTH_CC0_SOURCE.normal,true);
   tryRemote('clothRough',SERAPH_CLOTH_CC0_SOURCE.roughness,false);
   for(const [key,entry] of remote){
    if(entry.state==='ready'){
     if(key==='clothNormal')material.normalMap=entry.texture;
     if(key==='clothRough')material.roughnessMap=entry.texture;
    }
   }
  }
 }
 material.needsUpdate=true;
 return true;
}
export function detachSeraphCeremonialMaterial(material){
 live.delete(material);
}
export const seraphCeremonialMaterialStats=()=>Object.freeze({
 sharedLocalAtlases:cache.size,remoteMaps:remote.size,
 activeMaterials:live.size,
 readyRemoteMaps:[...remote.values()].filter(x=>x.state==='ready').length
});
