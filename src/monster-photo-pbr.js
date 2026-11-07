/**
 * Offline-first, shared photo-surface PBR library for monster inspection.
 *
 * The files below are already bundled in this repository. No runtime
 * third-party downloads, API keys or license assumptions are required.
 * Each source is deliberately named: fabric is not misrepresented as skin,
 * and aquatic creatures use clearcoat/translucency until water scans exist.
 */
import * as THREE from 'three';

export const CREATURE_SURFACE_SOURCES=Object.freeze({
  fur:Object.freeze({
    albedo:'../assets/creatures/wolf-fur-albedo-v1.webp',
    normal:'../assets/creatures/wolf-fur-normal-v1.webp',
    label:'既存の狼毛皮テクスチャ',
    kind:'coat',
  }),
  scales:Object.freeze({
    albedo:'../assets/creatures/dragon-scales-albedo-v1.webp',
    normal:'../assets/creatures/dragon-scales-normal-v1.webp',
    label:'既存の竜鱗テクスチャ',
    kind:'scales',
  }),
  linen:Object.freeze({
    albedo:'../assets/textures/outfits/linen.jpg',normal:null,
    label:'既存の麻布写真素材',kind:'cloth',
  }),
  leather:Object.freeze({
    albedo:'../assets/textures/outfits/leather.jpg',normal:null,
    label:'既存の革写真素材',kind:'leather',
  }),
  steel:Object.freeze({
    albedo:'../assets/textures/outfits/steel.jpg',normal:null,
    label:'既存の鋼鉄写真素材',kind:'metal',
  }),
  velvet:Object.freeze({
    albedo:'../assets/textures/outfits/velvet.jpg',normal:null,
    label:'既存の布写真素材',kind:'cloth',
  }),
});
export const CREATURE_FAMILY_SURFACE=Object.freeze({
  beast:'fur', feline:'fur', avian:'linen', reptile:'scales',
  insect:'scales', arachnid:'scales', undead:'linen', golem:'steel',
  fiend:'leather', aquatic:null,
});

// Each texture is uploaded to the GPU at most once regardless of monster
// variants, materials or the number of times the bestiary selection changes.
const textureCache=new Map();
const loader=typeof document==='undefined'?null:new THREE.TextureLoader();
function texture(file,colorData){
 if(!loader||!file)return null;
 const key=file+':'+(colorData?'srgb':'linear');
 if(textureCache.has(key))return textureCache.get(key);
 const url=new URL(file,import.meta.url).href;
 const tex=loader.load(url,undefined,undefined,()=>{
   // Missing texture must not become a white/black creature or block loading.
   for(const m of tex.userData.materialUsers||[]){
     if(m.map===tex)m.map=null;
     if(m.normalMap===tex)m.normalMap=null;
     m.needsUpdate=true;
   }
   tex.userData.failed=true;
 });
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.repeat.set(2,2);
 tex.anisotropy=4;
 if(colorData)tex.colorSpace=THREE.SRGBColorSpace;
 tex.userData.materialUsers=new Set();
 tex.userData.licenseReview='Bundled repository asset: verify provenance before redistribution';
 textureCache.set(key,tex);
 return tex;
}
function attachUser(tex,m){
 if(!tex||tex.userData.failed)return null;
 tex.userData.materialUsers.add(m);
 return tex;
}
export function decorateMonsterPhotoMaterial(material,{family,role,detail='high',metal=0,glow=false,translucent=false}={}){
 if(!material||glow||role==='eye'||role==='bone'||role==='accent'||translucent){
   return material;
 }
 const surfaceId=CREATURE_FAMILY_SURFACE[family];
 if(!surfaceId)return material;
 const src=CREATURE_SURFACE_SOURCES[surfaceId];
 if(!src)return material;
 const albedo=texture(src.albedo,true),normal=texture(src.normal,false);
 if(albedo)material.map=attachUser(albedo,material);
 if(normal&&detail!=='low'){
   material.normalMap=attachUser(normal,material);
   material.normalScale=new THREE.Vector2(.23,.23);
 }
 // The source texture supplies microdetail; the specimen's phenotype tint
 // remains in material.color. Roughness & metalness are physically distinct.
 material.roughness=src.kind==='metal'?.38:src.kind==='coat'?.86:
   src.kind==='scales'?.53:src.kind==='leather'?.72:.9;
 material.metalness=src.kind==='metal'?.66:src.kind==='scales'?.11:
   src.kind==='leather'?.035:Math.min(metal,.05);
 material.userData.photoSurface=surfaceId;
 material.userData.photoSource=src.albedo;
 material.needsUpdate=true;
 return material;
}
export function detachMonsterPhotoMaterial(material){
 if(!material)return;
 if(material.map?.userData?.materialUsers)material.map.userData.materialUsers.delete(material);
 if(material.normalMap?.userData?.materialUsers)material.normalMap.userData.materialUsers.delete(material);
}
export function monsterPhotoCacheStats(){
 return Object.freeze({
   textures:textureCache.size,
   sources:Object.keys(CREATURE_SURFACE_SOURCES).length,
 });
}
