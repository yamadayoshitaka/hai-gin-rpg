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


/**
 * The free-knight comparison GLB contains ten non-skinned glove meshes that
 * were exported meters away from the fingers. Match their negative/positive
 * source sides to the actual hands after the character has taken the game
 * idle pose. Only named, independent glove meshes are moved. No changes are
 * made to the human anatomy or to other classes of unknown AI-generated GLB.
 */
export function alignLooseGauntletsToRealHands(human,armor){
 const hands=[];
 human.updateWorldMatrix(true,true);armor.updateWorldMatrix(true,true);
 human.traverse(node=>{
  if(node.isBone&&/^hand_[lr]$/i.test(node.name)){
   hands.push({name:node.name,world:node.getWorldPosition(new THREE.Vector3())});
  }
 });
 if(hands.length!==2)return {movedMeshes:0,reason:'手の骨が見つからない'};
 const sides=new Map();
 armor.traverse(mesh=>{
  if(!mesh.isMesh||!/gauntlets__/i.test(mesh.name))return;
  const match=mesh.name.match(/(?:_| )(-1|1)$/);
  if(!match)return;
  const sign=Number(match[1]);
  if(!sides.has(sign))sides.set(sign,[]);
  sides.get(sign).push(mesh);
 });
 if(!sides.has(-1)||!sides.has(1)||sides.get(-1).length<2||sides.get(1).length<2)
  return {movedMeshes:0,reason:'左右の独立した手甲パーツが見つからない'};
 const ordered=[...sides].map(([id,meshes])=>{
  const box=new THREE.Box3();
  for(const mesh of meshes)box.expandByObject(mesh,true);
  return {id,meshes,center:box.getCenter(new THREE.Vector3())};
 }).sort((a,b)=>a.center.x-b.center.x);
 hands.sort((a,b)=>a.world.x-b.world.x);
 const edits=[];
 for(let j=0;j<ordered.length;j++){
  const side=ordered[j],hand=hands[j],delta=hand.world.clone().sub(side.center);
  // Distance sanity: only reposition obviously detached gauntlets. Keep
  // original authored placement when already correctly fitted.
  const dist=delta.length();
  if(dist<.025)continue;
  if(dist>2.5)continue;
  for(const mesh of side.meshes){
   const before=mesh.position.clone();
   const parent=mesh.parent;
   const localDelta=parent.worldToLocal(side.center.clone().add(delta))
    .sub(parent.worldToLocal(side.center.clone()));
   mesh.position.add(localDelta);
   edits.push({mesh,before});
  }
 }
 armor.updateWorldMatrix(true,true);
 return {
  movedMeshes:edits.length,handBones:hands.map(x=>x.name),
  reason:edits.length?'左右の手甲を本物の手の骨に合わせました':'手甲の補正なし',
  restore(){for(const {mesh,before} of edits)mesh.position.copy(before);
   armor.updateWorldMatrix(true,true)}
 };
}
