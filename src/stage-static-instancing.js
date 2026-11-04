// Combine identical, stationary catalog meshes into sector-sized GPU batches.
// Source geometry, textures, colors, and world transforms are preserved.
// Small sectors allow normal frustum culling instead of rendering the whole map.
export function batchStaticStageDecorations(stageRoot,THREE,{sectorCells=32,cellSize=2.2,gridOffset=5.5}={}){
  const eligible=new Set(['tree_deciduous_001','flower_tree_001','wood_fence']);
  stageRoot.updateWorldMatrix(true,true);
  const rootInverse=stageRoot.matrixWorld.clone().invert();
  const groups=new Map(),removable=[];
  let originalMeshes=0;
  for(const object of [...stageRoot.children]){
    if(!eligible.has(object.userData.assetId))continue;
    object.updateWorldMatrix(true,true);
    const meshes=[];
    object.traverse(node=>{
      if(node.isMesh&&node.visible&&node.geometry&&!Array.isArray(node.material)&&node.material&&!node.isSkinnedMesh)meshes.push(node);
    });
    // Never discard an original if part of its geometry could not be batched.
    let allRenderable=0;
    object.traverse(node=>{if(node.isMesh&&node.visible)allRenderable++});
    if(!meshes.length||meshes.length!==allRenderable)continue;
    const sectorX=Math.floor((object.position.x/cellSize+gridOffset)/sectorCells);
    const sectorZ=Math.floor((object.position.z/cellSize+gridOffset)/sectorCells);
    for(const mesh of meshes){
      const key=[object.userData.assetId,mesh.geometry.uuid,mesh.material.uuid,sectorX,sectorZ,
        Number(mesh.castShadow),Number(mesh.receiveShadow)].join(':');
      let group=groups.get(key);
      if(!group){group={geometry:mesh.geometry,material:mesh.material,castShadow:mesh.castShadow,
        receiveShadow:mesh.receiveShadow,depthMaterial:mesh.customDepthMaterial||null,matrices:[]};groups.set(key,group)}
      group.matrices.push(rootInverse.clone().multiply(mesh.matrixWorld));
      originalMeshes++;
    }
    removable.push(object);
  }
  for(const object of removable)stageRoot.remove(object);
  for(const [key,group] of groups){
    const mesh=new THREE.InstancedMesh(group.geometry,group.material,group.matrices.length);
    mesh.name=`BatchedStageDecoration-${key}`;
    mesh.castShadow=group.castShadow;mesh.receiveShadow=group.receiveShadow;
    if(group.depthMaterial)mesh.customDepthMaterial=group.depthMaterial;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    group.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();mesh.frustumCulled=true;
    stageRoot.add(mesh);
  }
  return {objects:removable.length,sourceMeshes:originalMeshes,batches:groups.size};
}
