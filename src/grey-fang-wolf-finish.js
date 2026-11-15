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
 m001:Object.freeze({name:'Grey Fang Wolf King',coat:0.83,eye:0xffa14d,eyeGlow:0.13}),
 summon_m001:Object.freeze({name:'Summoned Grey Fang Wolf King',coat:0.93,eye:0x9fd6ee,eyeGlow:0.19}),
 wolf:Object.freeze({name:'Summon Wolf',coat:0.97,eye:0x9ecadf,eyeGlow:0.08})
});
const nameKey=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const badWolfShell=/^object_?(?:74|76)(?:_\d+)?$/i;
export function applyGreyFangWolfFinish(handle,{creatureId='m001'}={}){
 const root=handle?.root,config=VARIANTS[creatureId];
 if(!root||!config||root.userData?.greyFangWolfFinish)return handle;
 const materialCopies=new Map();
 let originalMeshes=0,hiddenOutline=0,coated=0,eyes=0;
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
   if(materialCopies.has(mat))return materialCopies.get(mat);
   if(!mat.color)return mat;
   const copy=mat.clone();
   const ocular=/eye|iris|pupil/.test(label);
   const body=/skin|body|fur|coat|wolf|object_?9/.test(label);
   // NEVER replace a source bitmap with generated flat/opaque triangles.
   // Tint only the original map-bearing coat, not fangs, nose, or mouth.
   if(ocular){
    if(copy.emissive?.setHex){
     copy.emissive.setHex(config.eye);
     copy.emissiveIntensity=config.eyeGlow;
    }
    eyes++;
   }else if(copy.map&&(body||!/(?:teeth|tongue|mouth|nose|claw|tooth)/.test(label))){
    copy.color.multiplyScalar(config.coat);
    coated++;
   }
   materialCopies.set(mat,copy);
   return copy;
  }
  node.material=Array.isArray(node.material)?
   node.material.map(finish):finish(node.material);
 });
 root.userData.greyFangWolfFinish={
  creatureId,kind:config.name,baseSource:'r-wolf',
  mode:'shader-only-v2',originalMeshes,hiddenOutline,
  coatedMaterials:coated,eyeMaterials:eyes,addedMeshes:0,
  originalSkeletonPreserved:true,nativeAnimationsPreserved:true,
  originalTexturePreserved:true,
  previousDetachedHairGeometryDisabled:true
 };
 return handle;
}
