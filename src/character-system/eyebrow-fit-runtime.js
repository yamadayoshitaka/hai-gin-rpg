import {compactEyebrowBand,conformEyebrowsToFace} from './eyebrow-surface-policy.js?v=4.4.55';

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
      const tailored=compactEyebrowBand(xyz(source.attributes.position));
      const fit=conformEyebrowsToFace(tailored,xyz(skin.geometry.attributes.position));
      const geometry=source.clone(),positions=geometry.attributes.position;
      for(let i=0;i<positions.count;i++)positions.setXYZ(i,fit.positions[i*3],fit.positions[i*3+1],fit.positions[i*3+2]);
      positions.needsUpdate=true;
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      cached={geometry,diagnostics:fit};geometryCache.set(source,cached);
    }
    brow.geometry=cached.geometry;
    // Source eyebrow atlas is a pale, high-contrast hair photograph: its
    // white wedges and dark under-triangles resembled spikes on the eyelids.
    // Eyebrows should be thin matte hair, not reflective visor decorations.
    const finish=material=>{
      const m=material.clone();m.map=null;m.normalMap=null;m.bumpMap=null;
      m.color.setHex(0x4b3930);m.metalness=0;m.roughness=.94;
      m.needsUpdate=true;return m;
    };
    brow.material=Array.isArray(brow.material)?brow.material.map(finish):finish(brow.material);
    brow.userData={...brow.userData,eyebrowSurfaceFitted:true};
    corrected+=cached.diagnostics.corrected;
  }
  return {meshes:brows.length,corrected};
}
