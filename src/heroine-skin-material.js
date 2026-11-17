import * as THREE from 'three';

// Subtle procedural micro-bump on the EXISTING sculpted face, no second face
// mesh, stickers, artificial eye protrusion, or additional paid assets.
// One shared tiny texture avoids leaking VRAM on repeated mobile edits.
let poreTexture=null;
export function getHeroineMicroSkinTexture(){
 if(poreTexture)return poreTexture;
 // v66: pore-height field, not harsh per-pixel television static.
 // Deterministic clustered pores plus two skin-scale frequencies avoid
 // checkerboard freckles and preserve the appearance under mobile mipmaps.
 const width=256,data=new Uint8Array(width*width*4),cell=12;
 const hash=(x,y)=>{
  let h=Math.imul(x+13,374761393)^Math.imul(y+43,668265263);
  h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;
 };
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  let depression=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const cx=Math.floor(x/cell)+dx,cy=Math.floor(y/cell)+dy;
   const h=hash(cx,cy);
   const px=cx*cell+1+(h%600)/100;
   const py=cy*cell+1+((h>>>10)%600)/100;
   const dist2=(x-px)*(x-px)+(y-py)*(y-py);
   depression+=Math.exp(-dist2/(1.1+((h>>>20)%80)/100))*21;
  }
  const mid=3.2*Math.sin(x*.255+y*.094)+
   2.1*Math.sin(y*.205-x*.112)+1.2*Math.cos(y*.55+x*.44);
  const luminance=Math.round(148+mid-Math.min(28,depression));
  const i=(y*width+x)*4;
  const v=Math.max(0,Math.min(255,luminance));
  data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
 }
 const tex=new THREE.DataTexture(data,width,width,THREE.RGBAFormat);
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.colorSpace=THREE.NoColorSpace;
 tex.magFilter=THREE.LinearFilter;
 tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;tex.repeat.set(5,6);tex.anisotropy=4;tex.needsUpdate=true;
 poreTexture=tex;return poreTexture;
}
export function applyHeroineSkinMaterial(face){
 if(!face?.isMesh||!face.material)return {applied:false};
 if(face.userData.studioHeroineFaceSurface)return {applied:true,reused:true};
 const source=Array.isArray(face.material)?face.material[0]:face.material;
 if(!source)return {applied:false};
 const material=new THREE.MeshPhysicalMaterial({
  color:source.color?.clone()||new THREE.Color(0xf0d9cb),
  map:source.map||null,normalMap:source.normalMap||null,
  roughnessMap:source.roughnessMap||null,aoMap:source.aoMap||null,
  vertexColors:!!source.vertexColors,
  side:source.side,transparent:source.transparent,opacity:source.opacity,
  roughness:.74,metalness:0,clearcoat:.035,clearcoatRoughness:.82,
   ior:1.43,specularIntensity:.43,specularColor:new THREE.Color(0xffe0d0),
  sheen:.075,sheenRoughness:.86,sheenColor:new THREE.Color(0xc98978),
  bumpMap:source.bumpMap||(face.geometry?.getAttribute('uv')?getHeroineMicroSkinTexture():null),
  bumpScale:source.bumpMap?source.bumpScale:.00010
 });
 material.name='heroine-natural-skin-v70';
 // Retain low-amplitude physical highlights; reduce mannequin-like clearcoat.
 face.userData.v67SoftSkinSpecular=true;
 face.userData.v66MultiScalePoreTexture=true;
 face.userData.v66PoreTextureResolution=256;
 face.userData.v70NaturalSkinOptics=true;
 face.material=material;
 face.userData.studioHeroineFaceSurface=true;
 return {applied:true,roughness:material.roughness,clearcoat:material.clearcoat,
  sheen:material.sheen,vertexColors:material.vertexColors,
  skinMicroRelief:!!material.bumpMap,poreBumpScale:material.bumpScale,
  originalFaceGeometryPreserved:true};
}
