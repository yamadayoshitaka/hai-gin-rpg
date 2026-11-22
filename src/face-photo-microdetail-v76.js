import * as THREE from 'three';
import {ensureSkinUV} from './master-heroine-skin-pbr.js';

/** Actual, bundled CC0 human skin PHOTO -> neutral photographic microrelief.
 * Source: Wikimedia Commons "Image skin texture.jpg", anonymous, 2017-03-13,
 * mirrored by v3devv/comfyui-skin-detailer (unmodified CC0 original).
 * The reference is NEVER pasted as face color: a forearm/skin photograph
 * would make a face look blotchy and misplace freckles. Only high-frequency
 * pores and roughness from the real photo are transferred to the ORIGINAL
 * donor-derived face topology, preserving skin pigment, eyebrows and age.
 * 512² maps are mobile-safe, shared and GPU-mipmapped; no remote fetches.
 */
export const FACE_PHOTO_SOURCE_V76=Object.freeze({
 path:'assets/textures/face/cc0-human-skin-reference.jpg',
 canonical:'https://commons.wikimedia.org/wiki/File:Image_skin_texture.jpg',
 license:'CC0-1.0',kind:'photographic-human-skin',
 noFaceAlbedoReplacement:true,
 maxDerivedTextureSize:512
});
const clamp=(v,lo=0,hi=255)=>Math.max(lo,Math.min(hi,v));
/** Pure deterministic postprocess: use REAL photographed local contrast,
 * NOT a random-noise skin texture. Works with a synthetic input in Node QA. */
export function derivePhotoSkinMaps(imageData){
 const {data,width,height}=imageData||{};
 if(!data||!Number.isInteger(width)||!Number.isInteger(height)||
    width<8||height<8||data.length<width*height*4)
  throw Error('A decoded skin photograph RGBA raster is required');
 const lum=new Float32Array(width*height);
 for(let i=0;i<lum.length;i++){
  const k=i*4;
  lum[i]=data[k]*.2126+data[k+1]*.7152+data[k+2]*.0722;
 }
 const sample=(x,y)=>lum[((y+height)%height)*width+((x+width)%width)];
 const bump=new Uint8Array(width*height*4),roughness=new Uint8Array(bump.length);
 const stride=Math.max(2,Math.round(Math.min(width,height)/96));
 let contrast=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,idx=i*4;
  // Remove illumination, face-wide gradients and photographed skin tone.
  const low=(sample(x-stride,y)+sample(x+stride,y)+
   sample(x,y-stride)+sample(x,y+stride)+
   sample(x-stride,y-stride)+sample(x+stride,y+stride)) / 6;
  const relief=clamp(lum[i]-low,-29,29);
  contrast+=Math.abs(relief);
  const gray=clamp(Math.round(128+relief*1.33),76,180);
  const microR=clamp(Math.round(198+relief*.17+Math.abs(relief)*.12),180,225);
  bump[idx]=bump[idx+1]=bump[idx+2]=gray;bump[idx+3]=255;
  roughness[idx]=roughness[idx+1]=roughness[idx+2]=microR;
  roughness[idx+3]=255;
 }
 return {width,height,bump,roughness,meanPhotoContrast:contrast/lum.length,
  photoBased:true,syntheticNoise:false};
}
const makeTexture=(bytes,width,height,repeatX,repeatY)=>{
 const tex=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);
 tex.colorSpace=THREE.NoColorSpace;
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.magFilter=THREE.LinearFilter;
 tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;tex.anisotropy=4;
 tex.repeat.set(repeatX,repeatY);
 tex.needsUpdate=true;
 return tex;
};
let sharedPhotoMaps=null,sharedPromise=null;
export function requestRealSkinPhotoMaps(){
 if(sharedPhotoMaps)return Promise.resolve(sharedPhotoMaps);
 if(sharedPromise)return sharedPromise;
 if(typeof document==='undefined'||typeof Image==='undefined')
  return Promise.resolve(null);
 sharedPromise=new Promise((resolve,reject)=>{
  const image=new Image();
  // A failed/offline Pages texture must not leave the UI at 読込中 forever.
  const timeout=setTimeout(()=>{
   image.onload=null;image.onerror=null;image.src='';
   reject(new Error('CC0 skin photograph timed out after 12 s'));
  },12000);
  image.onload=()=>{
   clearTimeout(timeout);
   try{
    // Crop a central square to avoid the strongest photography falloff.
    const n=512,canvas=document.createElement('canvas');
    canvas.width=canvas.height=n;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(!ctx)throw Error('Canvas2D unavailable for CC0 skin photograph');
    const size=Math.min(image.naturalWidth,image.naturalHeight)*.68;
    const sx=(image.naturalWidth-size)*.5,sy=(image.naturalHeight-size)*.5;
    ctx.drawImage(image,sx,sy,size,size,0,0,n,n);
    const derived=derivePhotoSkinMaps(ctx.getImageData(0,0,n,n));
    sharedPhotoMaps={
     bump:makeTexture(derived.bump,n,n,4,5),
     roughness:makeTexture(derived.roughness,n,n,4,5),
     provenance:FACE_PHOTO_SOURCE_V76,
     meanPhotoContrast:derived.meanPhotoContrast
    };
    resolve(sharedPhotoMaps);
   }catch(err){reject(err);}
  };
  image.onerror=()=>{
   clearTimeout(timeout);
   reject(new Error('Bundled CC0 skin photograph not available'));
  };
  image.src=new URL('../assets/textures/face/cc0-human-skin-reference.jpg',
   import.meta.url).href;
 }).catch(err=>{
   // Never block loading the face or remove the existing procedural backup.
   if(typeof console!=='undefined')console.warn('Photographic pore fallback:',err);
   sharedPromise=null;return null;
 });
 return sharedPromise;
}
export function applyRealSkinPhotoToFace(face){
 if(!face?.isMesh||!face.geometry)return {applied:false};
 if(typeof document==='undefined'||typeof Image==='undefined')
  return {applied:false,reason:'no-browser'};
 if(!ensureSkinUV(face,{inPlace:true}))return {applied:false,reason:'no-uv'};
 face.userData.v76RealSkinPhoto='loading';
 requestRealSkinPhotoMaps().then(maps=>{
  if(!maps||!face.material){
   face.userData.v76RealSkinPhoto='fallback';return;
  }
  for(const material of (Array.isArray(face.material)?
   face.material:[face.material])){
   if(!material||!('bumpMap' in material))continue;
   material.bumpMap=maps.bump;
   material.bumpScale=.000091;
   material.roughnessMap=maps.roughness;
   // Keep facial skin diffuse; gloss is now local to the real lip vertices.
   material.roughness=Math.max(.72,Math.min(.84,material.roughness??.79));
   material.needsUpdate=true;
  }
  face.userData.v76RealSkinPhoto='CC0-real-photo-microrelief';
  face.userData.v76RealSkinPhotoLicense='CC0-1.0';
  face.userData.v76PhotoDerivedMapSize=512;
 });
 return {applied:true,photoRequested:true,source:FACE_PHOTO_SOURCE_V76.path,
  sourceCC0:true,faceAlbedoPreserved:true};
}
