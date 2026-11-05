/**
 * Share the immutable, baked masonry/facade shells of repeated buildings.
 * Roofs, upper decks, stairs, loot, door metadata and collision ownership stay
 * in each building's own scene node, so opening a building remains independent.
 */
export function batchStaticBuildingShells(buildings, stageRoot, THREE, {sectorCells=64, cellSize=1}={}) {
  stageRoot.updateWorldMatrix(true,true);
  const rootInverse=stageRoot.matrixWorld.clone().invert();
  const groups=new Map();
  const layerNames=['walls','open_upper_floor_windows','architectural_details'];
  for(const building of buildings){
    const model=building.model;
    const id=model.userData.catalogId;
    if(!id)continue;
    model.updateWorldMatrix(true,true);
    const sx=Math.floor(building.data.x/sectorCells),sz=Math.floor(building.data.z/sectorCells);
    for(const name of layerNames){
      const layer=model.getObjectByName(name);
      if(!layer||!layer.visible)continue;
      layer.traverse(node=>{
        if(!node.isMesh||node.isSkinnedMesh||!node.visible||!node.geometry||!node.material)return;
        const materials=Array.isArray(node.material)?node.material:[node.material];
        if(materials.some(mat=>mat.transparent))return;
        const key=[id,name,node.geometry.uuid,materials.map(mat=>mat.uuid).join('/'),sx,sz,
          Number(node.castShadow),Number(node.receiveShadow)].join(':');
        if(!groups.has(key))groups.set(key,{geometry:node.geometry,material:node.material,
          castShadow:node.castShadow,receiveShadow:node.receiveShadow,items:[]});
        groups.get(key).items.push({mesh:node,matrix:rootInverse.clone().multiply(node.matrixWorld)});
      });
    }
  }
  let sourceMeshes=0,batches=0,instances=0;
  for(const group of groups.values()){
    // A single building has nothing to gain from another scene object.
    if(group.items.length<2)continue;
    const mesh=new THREE.InstancedMesh(group.geometry,group.material,group.items.length);
    mesh.name='BatchedTownBuildingShell';
    mesh.castShadow=group.castShadow;mesh.receiveShadow=group.receiveShadow;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    group.items.forEach(({matrix},index)=>mesh.setMatrixAt(index,matrix));
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();mesh.frustumCulled=true;
    stageRoot.add(mesh);
    for(const {mesh:source} of group.items)source.parent.remove(source);
    sourceMeshes+=group.items.length;instances+=group.items.length;batches++;
  }
  return {sourceMeshes,batches,instances};
}
