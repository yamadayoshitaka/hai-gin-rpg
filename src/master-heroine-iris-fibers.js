import * as THREE from 'three';

/**
 * Neutral radial iris fiber map for the 3D source eye, independent from
 * the black pupil and editable iris diameter. A deterministic color
 * multiplier, not a photographed iris, imported game asset or fake eye.
 */
let sharedIrisTexture=null;
export function getHeroineIrisFiberTexture(){
 if(typeof document==='undefined')return null;
 if(sharedIrisTexture)return sharedIrisTexture;
 const size=256,c=document.createElement('canvas');
 c.width=c.height=size;
 const ctx=c.getContext('2d',{alpha:false});
 if(!ctx)return null;
 const image=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5-size*.5)/(size*.5);
  const v=(y+.5-size*.5)/(size*.5);
  const radius=Math.min(1,Math.sqrt(u*u+v*v));
  const angle=Math.atan2(v,u);
  const fiber=Math.sin(angle*79+radius*51)*.12+
   Math.sin(angle*143-radius*70)*.065+
   Math.sin(angle*29+radius*112)*.07;
  const radial=Math.sin(radius*39+angle*12)*.05;
  const limbus=1-.29*Math.pow(Math.max(0,(radius-.82)/.18),1.4);
  const collarette=1+.12*Math.exp(-Math.pow((radius-.48)/.115,2));
  const value=THREE.MathUtils.clamp((.84+fiber+radial)*limbus*collarette,.36,1.14);
  const k=(y*size+x)*4;
  image.data[k]=Math.min(255,Math.round(255*value));
  image.data[k+1]=Math.min(255,Math.round(255*value*.97));
  image.data[k+2]=Math.min(255,Math.round(255*value*.94));
  image.data[k+3]=255;
 }
 ctx.putImageData(image,0,0);
 sharedIrisTexture=new THREE.CanvasTexture(c);
 sharedIrisTexture.colorSpace=THREE.SRGBColorSpace;
 sharedIrisTexture.anisotropy=4;
 sharedIrisTexture.needsUpdate=true;
 return sharedIrisTexture;
}
export const HEROINE_OCULAR_MATERIAL_GUIDE=Object.freeze({
 source:'procedural-neutral-iris-radial-fibers',
 blackPupilSeparate:true,
 irisAndPupilIndependent:true,
 noThirdPartyTexture:true,
 defaultDepthMode:'sclera-surface-following'
});
