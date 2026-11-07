// Guard the face's genuine skin atlas against the dark shadows cast by
// extravagant raised collars, shields, hood rims and UR rarity ornaments.
// This runs on the source skinned body, not on the photo-textured outfit.
export function protectFaceSkin(characterModel){
  let protectedMeshes=0,protectedMaterials=0;
  characterModel?.traverse?.(mesh=>{
    if(!mesh?.isSkinnedMesh)return;
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const isSkin=mats.some(material=>/^mi_superhero_(male|female)$/i.test(material?.name||'')) ||
      (/^superhero_(male|female)$/i.test(mesh.name)&&
       !/brow|lash|eye|hair/i.test(mesh.name));
    if(!isSkin)return;
    mesh.receiveShadow=false;
    mesh.userData.faceSkinProtected=true;
    protectedMeshes++;
    for(const mat of mats)if(mat?.map&&mat.color)protectedMaterials++;
  });
  return {protectedMeshes,protectedMaterials,policy:'keep-genuine-skin-pbr-without-costume-shadow'};
}
