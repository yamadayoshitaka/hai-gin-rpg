/**
 * Battle-only facial proportion fit for the real animated 65-bone rig.
 *
 * The head source is a Blender GLB with a nested mesh transform: its mesh
 * carries a 0.9 scale and a -0.207 y translation. Its geometry box also
 * contains a lower cervical/bust skirt. A head fit using the raw geometry
 * bounds shrinks the cranium, then shifts it down into the armor collar.
 *
 * Measure the true face-mesh bounds in faceRoot coordinates and use the
 * upper cranial region for height/centering. Scale the complete hierarchy
 * (scalp, eyes, lids, hair anchors) as ONE unit without changing bones,
 * donor clothing, camera zoom or the source geometry.
 */
import * as THREE from 'three';

export const BATTLE_FACE_PROPORTION_VERSION='true-transform-cranial-head-v1';
export const BATTLE_CRANIAL_HEIGHT_FRACTION=0.78;

export function fitBattleArtistFaceToHead({
 faceRoot,faceMesh,headBounds,cranialFraction=BATTLE_CRANIAL_HEIGHT_FRACTION
}={}){
 if(!faceRoot?.isObject3D||!faceMesh?.isMesh||
    !Array.isArray(headBounds?.min)||!Array.isArray(headBounds?.max)||
    !faceRoot.parent?.isBone)
  throw Error('Real battle face, animated head bone and donor head bounds required');
 if(!(cranialFraction>=.7&&cranialFraction<=.85))
  throw Error('Invalid cranial head fraction');
 faceMesh.geometry.computeBoundingBox();
 const sourceGeometry=faceMesh.geometry.boundingBox;
 if(!sourceGeometry||sourceGeometry.isEmpty())throw Error('Real face has no geometry bounds');
 // Relative transform is independent of the existing faceRoot scale or offset.
 // Updating every descendant is essential after attaching the face to Head.
 faceRoot.updateWorldMatrix(true,true);
 const toRoot=new THREE.Matrix4().copy(faceRoot.matrixWorld).invert()
  .multiply(faceMesh.matrixWorld);
 const source=sourceGeometry.clone().applyMatrix4(toRoot);
 const target=new THREE.Box3(new THREE.Vector3(...headBounds.min),
  new THREE.Vector3(...headBounds.max));
 const a=source.getSize(new THREE.Vector3());
 const b=target.getSize(new THREE.Vector3());
 if([a.x,a.y,a.z,b.x,b.y,b.z].some(x=>!Number.isFinite(x)||x<=.01))
  throw Error('Invalid battle source/donor cranial bounds');
 // The source bottom is a neck/bust skirt. The skull itself occupies the
 // upper ~78% of source head height. Using the whole 100% artificially
 // constrains the scale through the (unrelated) cervical region.
 const cranialHeight=a.y*cranialFraction;
 const srcCenter=source.getCenter(new THREE.Vector3());
 const cranialCenter=new THREE.Vector3(
  srcCenter.x,source.max.y-cranialHeight*.5,srcCenter.z);
 const dstCenter=target.getCenter(new THREE.Vector3());
 const widthFit=b.x/a.x;
 const heightFit=b.y/cranialHeight;
 // A real human head can be moderately wider than the older Quaternius
 // donor. Preserve natural proportions; never make the face a giant mask.
 const scale=Math.min(widthFit*1.14,heightFit*1.10);
 if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid battle face scale');
 const before=faceRoot.scale.x;
 const lift=b.y*.035;
 const forward=b.z*.035;
 faceRoot.scale.setScalar(scale);
 faceRoot.position.set(
  dstCenter.x-cranialCenter.x*scale,
  dstCenter.y+lift-cranialCenter.y*scale,
  dstCenter.z+forward-cranialCenter.z*scale
 );
 faceRoot.rotation.set(0,0,0);
 faceRoot.updateWorldMatrix(true,true);
 const result=Object.freeze({
  version:BATTLE_FACE_PROPORTION_VERSION,
  attachedToRealHeadBone:true,
  sourceMeshTransformApplied:true,
  cervicalSkirtExcludedFromHeightFit:true,
  cranialFraction,scale,previousScale:before,
  widthRatio:+((a.x*scale)/b.x).toFixed(4),
  cranialHeightRatio:+((cranialHeight*scale)/b.y).toFixed(4),
  sourceSize:a.toArray(),targetSize:b.toArray(),
  sourceCranialCenter:cranialCenter.toArray(),
  targetCenter:dstCenter.toArray(),
  lift,forward,
  fittedCranialCenter:[
   cranialCenter.x*scale+faceRoot.position.x,
   cranialCenter.y*scale+faceRoot.position.y,
   cranialCenter.z*scale+faceRoot.position.z
  ]
 });
 faceRoot.userData.battleHeadScale=scale;
 faceRoot.userData.battleCranialFit=result;
 return result;
}
