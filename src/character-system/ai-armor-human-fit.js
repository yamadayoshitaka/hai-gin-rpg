/**
 * Fitting an unrigged imported full-armor GLB over the GAME'S real humanoid.
 * Never shrink/scale the human (its 7-head proportions and skeleton are the
 * authority). This is a reversible static quality-preview, not skinning.
 */
import * as THREE from 'three';

const bounds=root=>{
 root.updateWorldMatrix(true,true);
 return new THREE.Box3().setFromObject(root,true);
};
export function fitImportedArmorOverHuman(human,armor,{heightFraction=1,depthCorrection=0}={}){
 if(!human||!armor||human===armor)throw Error('実際の素体と独立した鎧GLBが必要です');
 const humanBounds=bounds(human),armorBounds=bounds(armor);
 if(humanBounds.isEmpty()||armorBounds.isEmpty())throw Error('素体または鎧の立体サイズが取得できません');
 const h=humanBounds.getSize(new THREE.Vector3()),g=armorBounds.getSize(new THREE.Vector3());
 if(h.y<0.1||g.y<0.001)throw Error('モデルの高さが不正です');
 if(!(heightFraction>=.25&&heightFraction<=1.2))throw Error('高さの設定範囲が不正です');
 // A full suit is measured from helmet to boots. A partial piece must be
 // explicitly marked and needs region-level fitting rather than a whole-body
 // automatic assumption.
 const ratio=h.y*heightFraction/g.y;
 if(!Number.isFinite(ratio)||ratio<.08||ratio>20)throw Error('鎧の単位系が異常です: '+ratio);
 const oldScale=armor.scale.clone(),oldPosition=armor.position.clone(),oldRotation=armor.quaternion.clone();
 armor.scale.multiplyScalar(ratio);armor.updateMatrixWorld(true);
 const afterScale=bounds(armor);
 const bodyCenter=humanBounds.getCenter(new THREE.Vector3());
 const gearCenter=afterScale.getCenter(new THREE.Vector3());
 const localDiff=bodyCenter.sub(gearCenter);
 // The two assets are sibling roots in the quality scene. Their parent may be
 // rotated in the game, so convert world delta to the armor parent's local XYZ.
 const worldToParent=new THREE.Quaternion();
 armor.parent?.getWorldQuaternion(worldToParent);
 localDiff.applyQuaternion(worldToParent.invert());
 armor.position.add(localDiff);
 // For a full suit align the actual feet, not the bounding-box middle; it
 // prevents a fixed helmet offset from floating the boots above the ground.
 armor.updateMatrixWorld(true);
 const aligned=bounds(armor);
 if(heightFraction>=.90){
  const floorOffset=humanBounds.min.y-aligned.min.y;
  armor.position.y+=floorOffset;
 }
 armor.position.z+=depthCorrection;
 armor.updateMatrixWorld(true);
 const final=bounds(armor),size=final.getSize(new THREE.Vector3());
 const humanCenter=humanBounds.getCenter(new THREE.Vector3());
 const gearFinal=final.getCenter(new THREE.Vector3());
 let skinned=0,bones=0,armorParts=0;
 human.traverse(o=>{if(o.isBone)bones++;if(o.isSkinnedMesh)skinned++});
 armor.traverse(o=>{if(o.isMesh)armorParts++});
 return {
  sourceBodyHeight:+h.y.toFixed(4),sourceArmorHeight:+g.y.toFixed(4),
  scale:+ratio.toFixed(4),worldHeight:+size.y.toFixed(4),
  centerError:+humanCenter.distanceTo(gearFinal).toFixed(4),
  floorError:+Math.abs(final.min.y-humanBounds.min.y).toFixed(4),
  bodyBones:bones,bodySkinnedMeshes:skinned,armorParts,
  rigReady:false,fitMethod:'unrigged-full-suit-height-and-ground',
  warning:'胴・腕・脚の分割リギングは未実施。面の貫通と指の位置は目視確認が必要。',
  baseline:{position:armor.position.clone(),scale:armor.scale.clone(),quaternion:armor.quaternion.clone()},
  restore(){armor.position.copy(oldPosition);armor.scale.copy(oldScale);armor.quaternion.copy(oldRotation);armor.updateMatrixWorld(true)}
 };
}
