import * as THREE from 'three';

/**
 * Adult heroine anatomy study: deterministic UV-space skin microtexture.
 * Color, micro-normal and roughness are real PBR texture maps sampled on
 * the actual source-derived polygons. This is *not* a photo-scanned skin atlas
 * and is not a substitute for a licensed 4K/8K anatomical UV texture.
 *
 * Skin is applied only to genuine head/body skin surfaces. Eyes and hair
 * deliberately keep their source meshes and separate materials.
 */
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const fract=n=>n-Math.floor(n);
const hash=(x,y)=>{
 const n=((x*374761393+y*668265263+1442695041)|0);
 const k=Math.imul(n^(n>>>13),1274126177);
 return ((k^(k>>>16))>>>0)/4294967295;
};
const smooth=(a,b,t)=>{const f=t*t*(3-2*t);return a*(1-f)+b*f};
function noise(x,y){
 const ax=Math.floor(x),ay=Math.floor(y),fx=fract(x),fy=fract(y);
 return smooth(smooth(hash(ax,ay),hash(ax+1,ay),fx),
               smooth(hash(ax,ay+1),hash(ax+1,ay+1),fx),fy);
}
function canvasTex(width,height,source,color=false){
 const cvs=document.createElement('canvas');cvs.width=width;cvs.height=height;
 const ctx=cvs.getContext('2d',{alpha:false,willReadFrequently:false});
 if(!ctx)throw Error('Canvas 2D is required for PBR skin bake');
 const image=ctx.createImageData(width,height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const o=(y*width+x)*4;
  const u=x/width,v=y/height;
  const low=noise(u*13.3,v*13.3)-.5;
  const medium=noise(u*71.2,v*71.2)-.5;
  const pore=noise(u*299.7,v*299.7)-.5;
  const speck=hash(x+41,y+139)-.5;
  const m=low*.067+medium*.042+pore*.018+speck*.009;
  if(source==='albedo'){
   // Near-neutral microvariation, multiplied by authored skin color.
   image.data[o]=clamp(246+m*105,0,255);
   image.data[o+1]=clamp(235+m*92,0,255);
   image.data[o+2]=clamp(230+m*85,0,255);
  }else if(source==='normal'){
   const left=noise((u-.001)*299.7,v*299.7);
   const right=noise((u+.001)*299.7,v*299.7);
   const up=noise(u*299.7,(v-.001)*299.7);
   const down=noise(u*299.7,(v+.001)*299.7);
   image.data[o]=clamp(127+(left-right)*25,0,255);
   image.data[o+1]=clamp(127+(up-down)*25,0,255);
   image.data[o+2]=252;
  }else{
   const r=clamp(.71+low*.08+medium*.13+pore*.08,.54,.83)*255;
   image.data[o]=r;image.data[o+1]=r;image.data[o+2]=r;
  }
  image.data[o+3]=255;
 }
 ctx.putImageData(image,0,0);
 const texture=new THREE.CanvasTexture(cvs);
 if(color)texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
 texture.anisotropy=4;
 texture.needsUpdate=true;
 return texture;
}
let maps=null;
/** Instantiate once per active 3D studio page; textures are shared. */
export function getHeroinePBRTextures(){
 if(!maps){
  maps={
   color:canvasTex(1024,1024,'albedo',true),
   normal:canvasTex(1024,1024,'normal'),
   roughness:canvasTex(1024,1024,'roughness')
  };
 }
 return maps;
}
export function ensureSkinUV(mesh,{inPlace=false}={}){
 const geometry=mesh.geometry;
 if(!geometry?.getAttribute('position'))return false;
 if(geometry.getAttribute('uv'))return true;
 // Geometry without UVs: derive an object-space vertical planar mapping.
 // Keep original GLB and its topology intact by replacing only a clone.
 const clone=inPlace?geometry:geometry.clone();
 clone.computeBoundingBox();
 const box=clone.boundingBox,dim=box.getSize(new THREE.Vector3());
 const p=clone.getAttribute('position'),uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){
  uv[i*2]=(p.getX(i)-box.min.x)/Math.max(.001,dim.x)*2;
  uv[i*2+1]=(p.getY(i)-box.min.y)/Math.max(.001,dim.y)*4;
 }
 clone.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 mesh.geometry=clone;
 return true;
}
export function applyHeroineSkinPBR(mesh,{face=false}={}){
 if(!mesh?.isMesh)return false;
 if(!ensureSkinUV(mesh,{inPlace:face}))return false;
 const texture=getHeroinePBRTextures();
 const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 let assigned=0;
 for(const mat of mats){
  if(!mat||!('roughness' in mat))continue;
  mat.map=texture.color;
  mat.normalMap=texture.normal;
  mat.normalScale=new THREE.Vector2(face?.15:.22,face?.15:.22);
  mat.roughnessMap=texture.roughness;
  mat.roughness=face?.67:.74;
  mat.metalness=0;
  if('clearcoat' in mat)mat.clearcoat=face?.035:.015;
  mat.needsUpdate=true;
  assigned++;
 }
 return assigned>0;
}
export const HEROINE_SKIN_TEXTURE_INFO=Object.freeze({
 version:'adult-heroine-skin-study-1',
 material:'procedural-micropore-pbr',
 photoScanned:false,sourceUVPreferred:true,
 colorMap:true,normalMap:true,roughnessMap:true,
 size:1024,eyeSourcePreserved:true,gameplayApproved:false
});
