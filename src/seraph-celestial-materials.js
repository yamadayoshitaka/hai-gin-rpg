/**
 * Physically separated Seraph material roles.
 * The former "ivoryCloth => bandage" mapping painted a dark coarse
 * linen photograph over the entire gown. Here, pale silk remains pale.
 * The repository's existing damask textile PHOTO contributes only very
 * low-amplitude relief on embroidered panels (never its brown diffuse).
 * Fine-woven silk normal/roughness atlases stay local/offline and shared.
 */
import * as THREE from 'three';
export const SERAPH_TAILORED_MATERIAL_REVISION='seraph-pearl-silk-brocade-v3-20261122';
const roles=Object.freeze({
 seraphSatin:{roughness:.52,metalness:0,sheen:.67,kind:'satin'},
 seraphBrocade:{roughness:.62,metalness:0,sheen:.38,kind:'brocade'},
 seraphOrganza:{roughness:.67,metalness:0,sheen:.26,kind:'organza'},
 seraphLining:{roughness:.74,metalness:0,sheen:.23,kind:'linen'},
 seraphGold:{roughness:.31,metalness:.76,sheen:0,kind:'gold'},
 seraphEmbroidery:{roughness:.42,metalness:.52,sheen:.07,kind:'thread'},
});
export const isSeraphTailoredRole=role=>Object.hasOwn(roles,role);
const weaveAtlas=new Map();
const clamp=x=>Math.max(0,Math.min(1,x));
function texture(data,size,color=false){
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 t.wrapS=t.wrapT=THREE.RepeatWrapping;
 t.repeat.set(1.5,2);
 t.generateMipmaps=true;
 t.magFilter=THREE.LinearFilter;
 t.minFilter=THREE.LinearMipmapLinearFilter;
 t.anisotropy=2;
 t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
 t.needsUpdate=true;
 return t;
}
function makeWeave(kind,detail){
 if(detail==='low')return null;
 const size=detail==='source'?192:128;
 const key=kind+':'+size;
 if(weaveAtlas.has(key))return weaveAtlas.get(key);
 const a=new Uint8Array(size*size*4),n=new Uint8Array(size*size*4),
  r=new Uint8Array(size*size*4);
 const satin=kind==='satin',b=kind==='brocade',org=kind==='organza';
 const rough=satin?.83:b?.92:org?.89:.94;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,i=(y*size+x)*4;
  const warp=Math.sin(u*Math.PI*2*63+Math.sin(v*Math.PI*8)*.12);
  const weft=Math.sin(v*Math.PI*2*76);
  // Small real silk thread crossings rather than photograph-sized burlap.
  const h=warp*.62+weft*.38;
  const pearl=clamp(.955+h*.011+(satin?.016:0));
  a[i]=Math.round(pearl*255);
  a[i+1]=Math.round(pearl*255);
  a[i+2]=Math.round(pearl*255);
  a[i+3]=255;
  const du=Math.cos(u*Math.PI*2*63)*.085;
  const dv=Math.cos(v*Math.PI*2*76)*.074;
  n[i]=Math.round(clamp(.5-du)*255);
  n[i+1]=Math.round(clamp(.5-dv)*255);
  n[i+2]=254;n[i+3]=255;
  const rv=clamp(rough+.035*warp*.25+.027*weft*.25);
  r[i]=r[i+1]=r[i+2]=Math.round(rv*255);
  r[i+3]=255;
 }
 const result=Object.freeze({
  albedo:texture(a,size,true),normal:texture(n,size),
  roughness:texture(r,size)});
 weaveAtlas.set(key,result);
 return result;
}
const photoLoader=typeof document==='undefined'?null:new THREE.TextureLoader();
let damask=null;
function photographicBrocadeRelief(){
 if(!photoLoader)return null;
 if(damask)return damask;
 // Bundled image is a textile reference, never the gown's diffuse colour.
 damask=photoLoader.load(new URL(
  '../assets/textures/outfits/damask.jpg',import.meta.url).href,
  undefined,undefined,()=>{damask.userData.failed=true;});
 damask.wrapS=damask.wrapT=THREE.RepeatWrapping;
 damask.repeat.set(2,2);
 damask.anisotropy=2;
 damask.userData.seraphBrocadePhotoRelief=true;
 return damask;
}
export function applySeraphTailoredMaterial(material,{role='',detail='high'}={}){
 const cfg=roles[role];
 if(!cfg||!material)return false;
 material.roughness=cfg.roughness;
 material.metalness=cfg.metalness;
 if('sheen' in material){
  material.sheen=cfg.sheen;
  material.sheenColor=new THREE.Color(role==='seraphSatin'?'#fff9ee':'#f3e7ce');
  material.sheenRoughness=.47;
 }
 if('clearcoat' in material){
  material.clearcoat=role==='seraphGold'?.18:role==='seraphSatin'?.07:0;
  material.clearcoatRoughness=.37;
 }
 if(cfg.kind!=='gold'&&cfg.kind!=='thread'){
  const atlas=makeWeave(cfg.kind,detail);
  if(atlas){
   material.map=atlas.albedo;
   material.roughnessMap=atlas.roughness;
   if(role==='seraphBrocade'){
    // Real source-photo relief without the source's brown/dark albedo.
    const photo=photographicBrocadeRelief();
    if(photo){material.bumpMap=photo;material.bumpScale=.005;}
    else{material.normalMap=atlas.normal;material.normalScale=new THREE.Vector2(.065,.065);}
   }else{
    material.normalMap=atlas.normal;
    material.normalScale=new THREE.Vector2(.05,.05);
   }
  }
 }
 material.userData.seraphTailoredSurface=cfg.kind;
 material.userData.seraphTailoredRevision=SERAPH_TAILORED_MATERIAL_REVISION;
 material.userData.noBurlapDiffuse=true;
 material.needsUpdate=true;
 return true;
}
export function seraphTailoredMaterialStats(){
 return Object.freeze({weaveAtlases:weaveAtlas.size,photoDamaskLoaded:!!damask});
}
