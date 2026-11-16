/**
 * Lossless close-range battle culling for small rigid outfit/weapon meshes.
 *
 * Three.js normally frustum-culls each Mesh using its actual local geometry
 * bounding sphere, transformed through all parent/bone matrices. The full
 * outfit builder disables this for every rigid piece. At a near camera angle,
 * even fully offscreen sleeves, plates, swords and hair were still submitted
 * to GPU and again to the shadow depth pass.
 *
 * This enables exact, built-in frustum testing for rigid opaque geometry ONLY.
 * It does not touch meshes, textures, materials, vertex data, bones, clips,
 * VFX, skinned/morphed meshes, lighting or shadow quality. Skinning/deforming
 * surfaces continue using their original unrestricted rendering.
 */
export function enableBattleRigidFrustumCulling(root){
 const stats={eligible:0,enabled:0,alreadyEnabled:0,unchanged:0};
 if(!root||typeof root.traverse!=='function')return stats;
 root.traverse(mesh=>{
  // Facial microgeometry and authored hair can move through shape/shader
  // offsets that do not enlarge the static bind-pose bounds. Keep them fully
  // visible, including at the edge of the camera view.
  if(/(?:hair|lash|brow|iris|pupil|eyeball|eyelid|teeth|tongue|face|lip)(?:[-_ ]|$)/i.test(mesh?.name||'')){
   stats.unchanged++;return;
  }
  if(!mesh?.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||
     mesh.isBatchedMesh||mesh.userData?.forceFrustumVisible){
   stats.unchanged++;return;
  }
  const geo=mesh.geometry;
  if(!geo?.getAttribute?.('position')||geo.getAttribute('position').count<3||
     Object.keys(geo.morphAttributes||{}).length||
     mesh.morphTargetInfluences?.length){
   stats.unchanged++;return;
  }
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(mats.some(m=>m?.displacementMap||m?.userData?.shaderDeformsBounds)){
   stats.unchanged++;return;
  }
  // Built-in Three.js frustum culling uses the same exact geometry/material.
  // Cached glTF geometries need no reallocation, cloning or retessellation.
  if(!geo.boundingSphere&&typeof geo.computeBoundingSphere==='function')
   geo.computeBoundingSphere();
  const bound=geo.boundingSphere;
  if(!bound||!Number.isFinite(bound.radius)||bound.radius<=0){
   stats.unchanged++;return;
  }
  stats.eligible++;
  if(mesh.frustumCulled){stats.alreadyEnabled++;return;}
  mesh.frustumCulled=true;
  stats.enabled++;
 });
 return stats;
}

export function countBattleRigCulling(actors=[]){
 const result={eligible:0,enabled:0,alreadyEnabled:0,unchanged:0,rigs:0};
 for(const actor of actors){
  const stats=actor?.rigidCullStats;
  if(!stats)continue;
  result.rigs++;
  for(const k of ['eligible','enabled','alreadyEnabled','unchanged'])
   result[k]+=(stats[k]||0);
 }
 return result;
}
