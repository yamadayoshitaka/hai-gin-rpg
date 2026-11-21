import * as THREE from 'three';
/** Fine optical maps in the geometry's actual POLAR UV coordinates:
 * U=iris angle, V=radial distance, not an ordinary photographed planar iris.
 * Neutral luminance intentionally preserves selectable blue/brown eye colors,
 * separate black pupil, the curved cornea, and eye expressions.
 * These supplementary details are deterministic, license-free generated
 * maps; the separately bundled skin microrelief is an authentic CC0 photo. */
export function deriveIrisPolarDetail(width=512,height=128){
 if(width<16||height<16)throw Error('Iris map too small');
 const data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const r=(y+.5)/height,u=(x+.5)/width;
  const theta=u*Math.PI*2;
  const fiber=.064*Math.sin(theta*132+r*38)+
   .046*Math.sin(theta*83-r*74)+
   .027*Math.sin(theta*211+r*93);
  const crypt=.040*Math.sin(theta*31+r*68)*
   Math.exp(-Math.pow((r-.57)/.23,2));
  const collarette=.074*Math.exp(-Math.pow((r-.48)/.072,2));
  const limbus=-.15*THREE.MathUtils.smoothstep(r,.78,.99);
  const central=-.10*(1-THREE.MathUtils.smoothstep(r,.18,.39));
  const tone=THREE.MathUtils.clamp(.91+fiber+crypt+collarette+
   limbus+central,.62,1.06);
  const i=(y*width+x)*4,g=Math.round(tone*235);
  data[i]=g;data[i+1]=Math.round(g*.986);
  data[i+2]=Math.round(g*.97);data[i+3]=255;
 }
 return {width,height,data,polarUV:true,limbalRing:true,crypts:true};
}
let iris=null,lip=null;
export function getFaceIrisStromaTexture(){
 if(iris)return iris;
 const {width,height,data}=deriveIrisPolarDetail();
 iris=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);
 iris.colorSpace=THREE.SRGBColorSpace;
 iris.wrapS=THREE.RepeatWrapping;iris.wrapT=THREE.ClampToEdgeWrapping;
 iris.magFilter=THREE.LinearFilter;iris.minFilter=THREE.LinearMipmapLinearFilter;
 iris.generateMipmaps=true;iris.anisotropy=4;iris.needsUpdate=true;
 return iris;
}
/** A subtle vermilion normal: longitudinal ridges along the real lip
 * volumes, with zero extra meshes and no fake solid-color lipstick plate. */
export function getLipVermilionNormalTexture(){
 if(lip)return lip;
 const size=128,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size;
  const ridge=Math.sin(u*Math.PI*2*26+Math.sin(v*11)*.34);
  const fine=Math.sin(u*Math.PI*2*59-v*9)*.22;
  const xNormal=ridge*11+fine*7;
  const yNormal=Math.sin(v*Math.PI*2*3+u*35)*2.2;
  const k=(y*size+x)*4;
  data[k]=Math.round(127+xNormal);
  data[k+1]=Math.round(127+yNormal);
  data[k+2]=252;data[k+3]=255;
 }
 lip=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 lip.colorSpace=THREE.NoColorSpace;
 lip.wrapS=lip.wrapT=THREE.RepeatWrapping;
 lip.repeat.set(1.5,1);
 lip.minFilter=THREE.LinearMipmapLinearFilter;
 lip.magFilter=THREE.LinearFilter;lip.generateMipmaps=true;
 lip.needsUpdate=true;
 return lip;
}
export const FACE_OPTICS_V76=Object.freeze({
 irisTexture:'polar-stroma-crypt-limbal-512x128',
 lipNormal:'fine-vermilion-microfold-128x128',
 sclera:'natural-wet-lid-shadow',eyeGeometry:'face-conforming-corneal-dome',
 lipstickAsGeometry:true,photoIrisClaim:false
});
