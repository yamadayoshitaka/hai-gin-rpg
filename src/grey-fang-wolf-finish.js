/**
 * Photo-real Wolf animated finish: deliberately shader-only.
 *
 * The previous bone.attach() cosmetic cylinders were rendered as huge white
 * triangles on mobile because the GLB's skinned hierarchy has source-scale
 * bone transforms. Never attach or generate decorative geometry until rig
 * anchors are verified against the original skinned wolf.
 *
 * Source geometry, skin weights, original PBR texture and animation tracks
 * remain untouched. This mode is safe for 1000-v-1000 battles and rollback.
 */
const VARIANTS=Object.freeze({
 m001:Object.freeze({name:'Grey Fang Wolf King',coat:0.68,eye:0xff813d,eyeGlow:0.31,magic:0x592519,skinGlow:.015,roughness:.93}),
 summon_m001:Object.freeze({name:'Summoned Grey Fang Wolf King',coat:0.83,eye:0x8bceef,eyeGlow:0.43,magic:0x527baa,skinGlow:.055,roughness:.86}),
 wolf:Object.freeze({name:'Summon Wolf',coat:0.94,eye:0x91c8dc,eyeGlow:0.17,magic:0x496981,skinGlow:.023,roughness:.90})
});
const nameKey=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const badWolfShell=/^object_?(?:74|76)(?:_\d+)?$/i;
export function applyGreyFangWolfFinish(handle,{creatureId='m001'}={}){
 const root=handle?.root,config=VARIANTS[creatureId];
 if(!root||!config||root.userData?.greyFangWolfFinish)return handle;
 const materialCopies=new WeakMap();
 let originalMeshes=0,hiddenOutline=0,coated=0,eyes=0,fangMaterials=0;
 root.traverse(node=>{
  if(!node.isMesh)return;
  originalMeshes++;
  const key=nameKey(node.name);
  // Original GLB has a white duplicate outline (Object_74) and a second
  // overlapping textured shell (Object_76). Keep the base skin (Object_9).
  // Hide duplicates only when the exact known names are found. Do not delete.
  if(badWolfShell.test(node.name)){
   node.visible=false;hiddenOutline++;return;
  }
  function finish(mat){
   if(!mat||!mat.isMaterial)return mat;
   const label=nameKey((mat.name||'')+' '+(node.name||''));
   if(!mat.color)return mat;
   const ocular=/eye|iris|pupil/.test(label);
   const fang=/fang|tooth|teeth|claw/.test(label);
   const role=ocular?'eye':fang?'fang':'coat';
   const variants=materialCopies.get(mat)||new Map();
   if(variants.has(role))return variants.get(role);
   const copy=mat.clone();
   const body=/skin|body|fur|coat|wolf|object_?9/.test(label);
   // NEVER replace a source bitmap with generated flat/opaque triangles.
   // Tint only the original map-bearing coat, not fangs, nose, or mouth.
   if(ocular){
    if(copy.emissive?.setHex){
     copy.emissive.setHex(config.eye);
     copy.emissiveIntensity=config.eyeGlow;
     copy.userData={...copy.userData,greyFangWolfEye:true};
    }
    eyes++;
   }else if(fang){
    // Sharpen the visual contrast of existing teeth and claws only.
    // Do not add real or floating fang geometry to a skinned source.
    copy.color.multiplyScalar(creatureId==='m001'?.85:.94);
    copy.roughness=Math.min(copy.roughness??.7,.55);
    copy.metalness=Math.min(.06,copy.metalness||0);
    copy.userData={...copy.userData,greyFangWolfFang:true};
    fangMaterials++;
   }else if(copy.map&&(body||!/(?:teeth|tongue|mouth|nose|claw|tooth)/.test(label))){
    copy.color.multiplyScalar(config.coat);
    copy.roughness=Math.max(config.roughness,copy.roughness||.7);
    copy.metalness=Math.min(.03,copy.metalness||0);
    if(copy.emissive?.setHex){
     copy.emissive.setHex(config.magic);
     copy.emissiveIntensity=config.skinGlow;
    }
    copy.userData={...copy.userData,greyFangWolfCoat:true,
     greyFangWolfBaseGlow:config.skinGlow};
    coated++;
   }
   variants.set(role,copy);
   materialCopies.set(mat,variants);
   return copy;
  }
  node.material=Array.isArray(node.material)?
   node.material.map(finish):finish(node.material);
 });
 root.userData.greyFangWolfFinish={
  creatureId,kind:config.name,baseSource:'r-wolf',
  mode:'shader-only-v3',originalMeshes,hiddenOutline,
  coatedMaterials:coated,eyeMaterials:eyes,fangMaterials,addedMeshes:0,
  originalSkeletonPreserved:true,nativeAnimationsPreserved:true,
  originalTexturePreserved:true,
  variantAppearance:'darkened-photo-coat/roughness/eye-glow/soft-magic-emission',
  previousDetachedHairGeometryDisabled:true
 };
 return handle;
}
