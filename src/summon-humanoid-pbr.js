/**
 * Physical material microtextures for three original humanoid summons.
 * Each near-LOD material gets texture-specific normal and roughness instead
 * of inappropriate linen photographs on wings or smooth solid-color armour.
 * Source GLB face meshes and approved normal maps are never overwritten.
 */
import * as THREE from 'three';
export const SUMMON_HUMANOID_PBR_REVISION='summons-wing-leaf-scale-pbr-v1-20261121';
const KIND_BY_ID=Object.freeze({
 seraph_guardian:Object.freeze({
  seraphWing:'feather',feather:'feather',ivoryCloth:'silk',
  velvet:'silk',cloth:'silk',gold:'brushedGold'}),
 forest_archer:Object.freeze({
  leaf:'leaf',forestMint:'leaf',forestDeep:'leaf',
  cloth:'wovenLeaf',ivoryCloth:'wovenLeaf'}),
 dragon_lord:Object.freeze({
  dragonScale:'scale',dragonRim:'scale',membrane:'membrane',
  horn:'keratin',metal:'brushedGold'})
});
const atlas=new Map();
const fract=x=>x-Math.floor(x);
const fractHash=(x,y)=>fract(Math.sin(x*172.4+y*119.1)*43758.5453);
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const height=(kind,u,v)=>{
 const grain=fractHash(Math.floor(u*75),Math.floor(v*75))-.5;
 if(kind==='feather'){
  const shaft=Math.exp(-Math.pow(Math.sin(u*Math.PI*19)/.13,2));
  const barbs=Math.sin((v+u*.3)*Math.PI*102);
  return .36+.33*shaft+.13*barbs+.07*grain;
 }
 if(kind==='leaf'||kind==='wovenLeaf'){
  const veins=Math.exp(-Math.pow(Math.sin(u*Math.PI*13+v*2)/.16,2));
  const weave=Math.cos(u*Math.PI*78)*Math.cos(v*Math.PI*79);
  return .42+.30*veins+.13*weave+.10*grain;
 }
 if(kind==='scale'){
  const row=Math.floor(v*19),x=fract(u*25+(row%2)*.5)-.5,y=fract(v*19)-.5;
  return .30+.44*clamp(1-x*x*3-y*y*3)+.08*grain;
 }
 if(kind==='membrane')return .50+.08*Math.sin(u*Math.PI*19)+.07*grain;
 if(kind==='keratin')return .53+.18*Math.sin(v*Math.PI*75+u*10)+.08*grain;
 if(kind==='brushedGold')return .50+.15*Math.sin(v*Math.PI*160)+.08*grain;
 return .45+.15*Math.sin(u*Math.PI*78)*Math.sin(v*Math.PI*51)+.09*grain;
};
const roughness=kind=>({
 feather:.80,silk:.86,leaf:.77,wovenLeaf:.84,scale:.58,
 membrane:.70,keratin:.65,brushedGold:.42
})[kind]??.78;
function texture(size,callback,srgb=false){
 const data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const pixels=callback((x+.5)/size,(y+.5)/size,x,y);
  const i=(y*size+x)*4;
  data[i]=Math.round(clamp(pixels[0])*255);
  data[i+1]=Math.round(clamp(pixels[1])*255);
  data[i+2]=Math.round(clamp(pixels[2])*255);data[i+3]=255;
 }
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.repeat.set(2,2);
 t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
 t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;
 t.generateMipmaps=true;t.anisotropy=2;t.needsUpdate=true;
 return t;
}
function maps(kind,detail){
 if(detail==='low')return null;
 const size=detail==='source'?192:detail==='medium'?96:128;
 const key=kind+':'+size;
 if(atlas.has(key))return atlas.get(key);
 const heights=new Float32Array(size*size);
 const albedo=texture(size,(u,v,x,y)=>{
  heights[y*size+x]=height(kind,u,v);
  const p=clamp(.93+.14*(heights[y*size+x]-.5),.77,1);
  return [p,p,p];
 },true);
 const normal=texture(size,(u,v,x,y)=>{
  const L=heights[y*size+(x+size-1)%size];
  const R=heights[y*size+(x+1)%size];
  const U=heights[(y+size-1)%size*size+x];
  const D=heights[(y+1)%size*size+x];
  const dx=(R-L)*.45,dy=(D-U)*.45,mag=Math.hypot(dx,dy,1);
  return [.5-dx/(2*mag),.5-dy/(2*mag),.5+1/(2*mag)];
 });
 const roughnessMap=texture(size,(u,v)=>{
  const r=clamp(roughness(kind)+.06*(height(kind,u,v)-.5));
  return [r,r,r];
 });
 const result=Object.freeze({albedo,normal,roughnessMap,kind,size});
 atlas.set(key,result);return result;
}
export function applySummonHumanoidPBR(material,{id='',role='',detail='high'}={}){
 if(!material||detail==='low'||material.normalMap||material.bumpMap||
    material.map||material.roughnessMap)return false;
 const kind=KIND_BY_ID[id]?.[role];
 if(!kind)return false;
 const m=maps(kind,detail);
 if(!m)return false;
 material.map=m.albedo;material.normalMap=m.normal;
 material.roughnessMap=m.roughnessMap;
 material.normalScale=new THREE.Vector2(.18,.18);
 material.roughness=1;material.metalness=kind==='brushedGold'?.7:
   kind==='scale'?.12:0;
 material.userData.summonPbrRevision=SUMMON_HUMANOID_PBR_REVISION;
 material.userData.summonSurfaceKind=kind;
 material.needsUpdate=true;
 return true;
}
export function summonHumanoidPBRStats(){
 return Object.freeze({species:Object.keys(KIND_BY_ID).length,
  cachedAtlases:atlas.size});
}
