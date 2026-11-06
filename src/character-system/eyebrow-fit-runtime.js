import {conformEyebrowsToFace} from './eyebrow-surface-policy.js?v=4.4.45';

const geometryCache=new WeakMap();

function xyz(attribute){
  const result=new Float32Array(attribute.count*3);
  for(let i=0;i<attribute.count;i++){
    result[i*3]=attribute.getX(i);
    result[i*3+1]=attribute.getY(i);
    result[i*3+2]=attribute.getZ(i);
  }
  return result;
}

export function fitEyebrowMeshesToFace(model){
  const brows=[],skins=[];
  model.traverse(o=>{
    if(!o.isSkinnedMesh||!o.geometry?.attributes?.position)return;
    if(/eyebrow|brow/i.test(o.name))brows.push(o);
    else if(!/eye|lash|hair/i.test(o.name))skins.push(o);
  });
  const skin=skins.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count)[0];
  if(!skin||!brows.length)return {meshes:0,corrected:0};
  let corrected=0;
  for(const brow of brows){
    if(brow.userData?.eyebrowSurfaceFitted)continue;
    const source=brow.geometry;
    let cached=geometryCache.get(source);
    if(!cached){
      const fit=conformEyebrowsToFace(xyz(source.attributes.position),xyz(skin.geometry.attributes.position));
      const geometry=source.clone(),positions=geometry.attributes.position;
      for(let i=0;i<positions.count;i++)positions.setXYZ(i,fit.positions[i*3],fit.positions[i*3+1],fit.positions[i*3+2]);
      positions.needsUpdate=true;
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      cached={geometry,diagnostics:fit};geometryCache.set(source,cached);
    }
    brow.geometry=cached.geometry;
    brow.userData={...brow.userData,eyebrowSurfaceFitted:true};
    corrected+=cached.diagnostics.corrected;
  }
  return {meshes:brows.length,corrected};
}
