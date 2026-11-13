import * as THREE from 'three';

// Subtle procedural micro-bump on the EXISTING sculpted face, no second face
// mesh, stickers, artificial eye protrusion, or additional paid assets.
// One shared tiny texture avoids leaking VRAM on repeated mobile edits.
let poreTexture=null;
export function getHeroineMicroSkinTexture(){
 if(poreTexture)return poreTexture;
 const width=96,data=new Uint8Array(width*width*4);
 for(let y=0;y<width;y++)for(let x=0;x<width;x++){
  const hash=((x*374761393+y*668265263)^(x*y*1597334677))>>>0;
  const mixed=((hash^(hash>>>13))*1274126177)>>>0;
  const luminance=Math.max(0,Math.min(255,142+((mixed>>>16)%37)-18));
  const i=(y*width+x)*4;
  data[i]=data[i+1]=data[i+2]=luminance;data[i+3]=255;
 }
 const tex=new THREE.DataTexture(data,width,width,THREE.RGBAFormat);
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.magFilter=THREE.LinearFilter;
 tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;tex.repeat.set(6,7);tex.needsUpdate=true;
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
  roughness:.70,metalness:0,clearcoat:.055,clearcoatRoughness:.75,
  sheen:.11,sheenRoughness:.85,sheenColor:new THREE.Color(0xc98978),
  bumpMap:source.bumpMap||(face.geometry?.getAttribute('uv')?getHeroineMicroSkinTexture():null),
  bumpScale:source.bumpMap?source.bumpScale:.000085
 });
 material.name='heroine-natural-skin-v41';
 face.material=material;
 face.userData.studioHeroineFaceSurface=true;
 return {applied:true,roughness:material.roughness,clearcoat:material.clearcoat,
  sheen:material.sheen,vertexColors:material.vertexColors,
  skinMicroRelief:!!material.bumpMap,poreBumpScale:material.bumpScale,
  originalFaceGeometryPreserved:true};
}
