// Combine identical, stationary catalog meshes into sector-sized GPU batches.
// Source geometry, textures, colors, and world transforms are preserved.
// Small sectors allow normal frustum culling instead of rendering the whole map.
export function batchStaticStageDecorations(stageRoot,THREE,{sectorCells=32,cellSize=2.2,gridOffset=5.5}={}){
  const eligible=new Set(['tree_deciduous_001','flower_tree_001','wood_fence',
    'town_crate_001','town_bench_001','town_planter_001','town_trash_bin_001',
    'town_fence_001','stone_fence_001','cottage_barrel_001','street_lamp_001',
    'stone_column_001','stone_steps_001','town_handcart_001','town_notice_001',
    'town_well_001','inn_sign_001','stone_archway_001','haystack_001']);
  stageRoot.updateWorldMatrix(true,true);
  const rootInverse=stageRoot.matrixWorld.clone().invert();
  const groups=new Map(),removable=[],instanceLocations=new Map(),originalByLocation=new Map();
  const keyOf=(id,x,z)=>id+':'+x+':'+z;
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
      if(!group){group={geometry:mesh.geometry,material:mesh.material,
        foliage:!!(mesh.material.transparent||mesh.material.alphaTest>0),castShadow:mesh.castShadow,
        receiveShadow:mesh.receiveShadow,depthMaterial:mesh.customDepthMaterial||null,matrices:[]};groups.set(key,group)}
      const positionKey=object.userData.assetId+':'+Math.round(object.position.x/cellSize+gridOffset)+':'+Math.round(object.position.z/cellSize+gridOffset);
      const list=instanceLocations.get(positionKey)||[];
      list.push({group,index:group.matrices.length});instanceLocations.set(positionKey,list);
      group.matrices.push(rootInverse.clone().multiply(mesh.matrixWorld));
      originalMeshes++;
    }
    removable.push(object);
    const cellX=Math.round(object.position.x/cellSize+gridOffset);
    const cellZ=Math.round(object.position.z/cellSize+gridOffset);
    originalByLocation.set(keyOf(object.userData.assetId,cellX,cellZ),object);
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
    group.mesh=mesh;
    stageRoot.add(mesh);
  }
  const hidden=new Set(),occluded=new Map(),zero=new THREE.Matrix4().makeScale(0,0,0);
  const sourceState=new WeakMap(),ghostMaterialCache=new WeakMap();
  const ghostMaterial=material=>{
    if(!material?.clone)return material;
    if(!ghostMaterialCache.has(material)){
      const ghost=material.clone();
      ghost.transparent=true;ghost.opacity=(material.opacity??1)*.18;
      ghost.depthWrite=false;ghost.alphaTest=0;
      ghostMaterialCache.set(material,ghost);
    }
    return ghostMaterialCache.get(material);
  };
  const ghostObject=(object,enabled,foliageOnly)=>object.traverse(node=>{
    if(!node.isMesh)return;
    if(!sourceState.has(node))sourceState.set(node,{
      material:node.material,visible:node.visible,castShadow:node.castShadow,receiveShadow:node.receiveShadow
    });
    const source=sourceState.get(node);
    const fade=!!(source.material?.transparent||source.material?.alphaTest>0);
    node.visible=enabled&&foliageOnly&&!fade?false:source.visible;
    node.material=enabled&&(!foliageOnly||fade)?ghostMaterial(source.material):source.material;
    node.castShadow=enabled?false:source.castShadow;
    node.receiveShadow=enabled?false:source.receiveShadow;
  });
  const setInstanceMatrices=(key,remove,foliageOnly=false)=>{
    const touched=new Set();
    for(const {group,index} of instanceLocations.get(key)||[]){
      if(foliageOnly&&!group.foliage)continue;
      group.mesh.setMatrixAt(index,remove?zero:group.matrices[index]);
      touched.add(group.mesh);
    }
    for(const mesh of touched)mesh.instanceMatrix.needsUpdate=true;
  };
  const occlusionCandidates=[];
  const treeFoliageOnly=new Map();
  for(const [key,object] of originalByLocation){
    if(!object.userData.assetId.includes('tree'))continue;
    const hasFoliage=(instanceLocations.get(key)||[]).some(({group})=>group.foliage);
    treeFoliageOnly.set(key,hasFoliage);
    const [id,x,z]=key.split(':');
    occlusionCandidates.push({key,id,x:Number(x),z:Number(z),
      bounds:{minX:object.position.x-5.6,maxX:object.position.x+5.6,
        minY:object.position.y-.5,maxY:object.position.y+10.5,
        minZ:object.position.z-5.6,maxZ:object.position.z+5.6}});
  }
  return {objects:removable.length,sourceMeshes:originalMeshes,batches:groups.size,
    occlusionCandidates,
    hasDecorationAt(id,x,z){return instanceLocations.has(keyOf(id,x,z))&&!hidden.has(keyOf(id,x,z));},
    setDecorationOccludedAt(id,x,z,enabled,{hide=false}={}){
      const key=keyOf(id,x,z),object=originalByLocation.get(key);
      const mode=enabled?(hide?'hide':'ghost'):null;
      if(!object||hidden.has(key)||(enabled?occluded.get(key)===mode:!occluded.has(key)))return false;
      const foliageOnly=treeFoliageOnly.get(key)??false;
      if(enabled){
        if(hide){
          // Near the ground, foliage-only blending leaves opaque trunks and
          // branches covering the screen. Hide just this obstructing tree.
          stageRoot.remove(object);ghostObject(object,false,foliageOnly);
          setInstanceMatrices(key,true);
        }else{
          // Switching back from a close cutaway restores solid branches and
          // leaves only the original canopy translucent in the scene graph.
          setInstanceMatrices(key,false);
          ghostObject(object,true,foliageOnly);stageRoot.add(object);
          setInstanceMatrices(key,true,foliageOnly);
        }
        occluded.set(key,mode);
      }else{
        stageRoot.remove(object);ghostObject(object,false,foliageOnly);
        setInstanceMatrices(key,false);
        occluded.delete(key);
      }
      return true;
    },
    hideDecorationAt(id,x,z){
      const key=keyOf(id,x,z),list=instanceLocations.get(key);
      if(!list||hidden.has(key))return false;
      if(occluded.has(key)){
        const object=originalByLocation.get(key);
        stageRoot.remove(object);ghostObject(object,false,treeFoliageOnly.get(key)??false);occluded.delete(key);
      }
      setInstanceMatrices(key,true);
      hidden.add(key);return true;
    }};
}
