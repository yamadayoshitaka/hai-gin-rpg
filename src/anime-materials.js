/** Lightweight anime surface system: cached cel ramps and textures, preserving native GLB UV skins. */
const RAMPS=new WeakMap();
const MATERIALS=new WeakMap();
export function createAnimeMaterialFactory(THREE){
 let gradient=RAMPS.get(THREE);
 if(!gradient){
  const data=new Uint8Array([65,65,65,140,140,140,218,218,218,255,255,255]);
  gradient=new THREE.DataTexture(data,4,1,THREE.RGBFormat);
  gradient.minFilter=THREE.NearestFilter;gradient.magFilter=THREE.NearestFilter;
  gradient.generateMipmaps=false;gradient.needsUpdate=true;RAMPS.set(THREE,gradient);
 }
 let cache=MATERIALS.get(THREE);
 if(!cache){cache=new WeakMap();MATERIALS.set(THREE,cache);}
 return old=>{
  if(!old)return new THREE.MeshToonMaterial({color:0xe2c3a6,gradientMap:gradient});
  if(cache.has(old))return cache.get(old);
  const mat=new THREE.MeshToonMaterial({
   color:old.color?.clone?.()??new THREE.Color(0xffffff),
   map:old.map??null,gradientMap:gradient,
   transparent:Boolean(old.transparent),opacity:old.opacity??1,
   side:old.side??THREE.FrontSide,
   alphaTest:old.alphaTest??0,skinning:old.skinning,
   emissive:old.emissive?.clone?.()??new THREE.Color(0x000000),
   emissiveIntensity:old.emissiveIntensity??0
  });
  if(old.normalMap)mat.normalMap=old.normalMap;
  mat.name='anime:'+String(old.name??'fabric');
  cache.set(old,mat);return mat;
 };
}
