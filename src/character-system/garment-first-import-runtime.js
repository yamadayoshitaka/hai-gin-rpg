// Garment-first fitting of independently imported GLB scenes.
// Preview-stage geometry is non-destructive: the garment is the reference frame.
import * as THREE from 'three';
import {clipBodyToGarment} from './garment-coverage-runtime.js?v=4.4.93';

const point=new THREE.Vector3();
const normalizeBone=name=>String(name||'').toLowerCase()
  .replace(/^mixamorig[:_]?/,'').replace(/[^a-z0-9]/g,'');
const isHip=name=>/^(hips|hip|pelvis)$/.test(normalizeBone(name));
const isHead=name=>/^(head)$/.test(normalizeBone(name));
const bounds=root=>{
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(root,true);
};
const anchor=(root,matcher)=>{
  let bone=null;
  root.traverse(o=>{if(!bone&&o.isBone&&matcher(o.name))bone=o});
  return bone?bone.getWorldPosition(new THREE.Vector3()):null;
};
export function assessImportedRig(body,garment){
  const named=root=>{
    const names=new Set();
    let skinned=0,meshes=0;
    root.traverse(o=>{
      if(o.isBone)names.add(normalizeBone(o.name));
      if(o.isMesh)meshes++;
      if(o.isSkinnedMesh)skinned++;
    });
    return {names,skinned,meshes};
  };
  const b=named(body),g=named(garment);
  const common=[...g.names].filter(n=>b.names.has(n));
  const overlap=g.names.size?common.length/g.names.size:0;
  return {bodyBones:b.names.size,garmentBones:g.names.size,sharedBones:common.length,
    garmentRigMatch:+overlap.toFixed(3),bodySkinnedMeshes:b.skinned,
    garmentSkinnedMeshes:g.skinned,bodyMeshes:b.meshes,garmentMeshes:g.meshes,
    animatedOutfitReady:g.skinned>0&&overlap>=0.8&&common.length>=12};
}
export function autoFitNudeToGarment(body,garment){
  if(!body||!garment)throw Error('素体と衣装の両方が必要です');
  const nakedBox=bounds(body),garmentBox=bounds(garment);
  if(nakedBox.isEmpty()||garmentBox.isEmpty())throw Error('メッシュの寸法を取得できません');
  const bodyHeight=nakedBox.getSize(new THREE.Vector3()).y;
  const garmentHeight=garmentBox.getSize(new THREE.Vector3()).y;
  if(bodyHeight<=0.0001||garmentHeight<=0.0001)throw Error('高さゼロのモデルはフィットできません');
  const hipB=anchor(body,isHip),headB=anchor(body,isHead);
  const hipG=anchor(garment,isHip),headG=anchor(garment,isHead);
  const matchingRig=hipB&&hipG&&headB&&headG;
  const ratio=matchingRig
    ?headG.distanceTo(hipG)/Math.max(0.0001,headB.distanceTo(hipB))
    :garmentHeight/bodyHeight;
  // A jacket-only GLB is not a full-body height reference. Never scale
  // a whole person down to jacket height or deform the outfit to fit skin.
  const fullLength=matchingRig||(ratio>=0.72&&ratio<=1.4);
  const scale=fullLength?Math.min(1.35,Math.max(0.7,ratio)):1;
  body.scale.multiplyScalar(scale);
  let aligned=bounds(body),offset=new THREE.Vector3(),method;
  if(hipB&&hipG){
    offset.copy(hipG).sub(anchor(body,isHip));
    method='共通骨格の骨盤基準';
  }else{
    const centerBody=aligned.getCenter(new THREE.Vector3());
    const centerGarment=garmentBox.getCenter(new THREE.Vector3());
    offset.set(centerGarment.x-centerBody.x,
      fullLength?garmentBox.min.y-aligned.min.y:centerGarment.y-centerBody.y,
      centerGarment.z-centerBody.z);
    method=fullLength?'衣装の足元と中心基準':'衣装の中心基準（部分衣装・要確認）';
  }
  body.position.add(offset);
  aligned=bounds(body);
  const bodyCenter=aligned.getCenter(new THREE.Vector3());
  const clothCenter=garmentBox.getCenter(new THREE.Vector3());
  return {method,scale:+scale.toFixed(4),fullLength,bodyHeight:+bodyHeight.toFixed(4),
    garmentHeight:+garmentHeight.toFixed(4),
    centerError:+bodyCenter.distanceTo(clothCenter).toFixed(4),
    offset:offset.toArray().map(n=>+n.toFixed(4)),
    rig:assessImportedRig(body,garment)};
}
// A safety-first vocabulary. Unknown AI meshes never authorize a blind cut.
function coveredRegions(name){
  const n=String(name||'').toLowerCase();
  if(/skin|flesh|nude|naked|body_mesh|eyeball|hair|beard|weapon|blade|sword|staff/.test(n))return [];
  const zones=new Set();
  if(/breastplate|chestplate|cuirass|torso|shirt|tunic|jacket|vest|coat|corset|bodice/.test(n))zones.add('torso');
  if(/sleeve|pauldron|shoulder|upper.?arm/.test(n))zones.add('upperarm');
  if(/long.?sleeve|bracer|vambrace|forearm/.test(n))zones.add('lowerarm');
  if(/pants|trouser|leggings|thigh|greave_upper/.test(n))zones.add('thigh');
  if(/pants|trouser|leggings|shin|calf|greave/.test(n))zones.add('calf');
  if(/boot|shoe|sabatons/.test(n))zones.add('foot');
  return [...zones];
}
export function inferImportedGarmentCoverage(garment){
  const regions=new Set(),surfaceMeshes=[];
  garment.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible||!mesh.geometry?.attributes?.position)return;
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    const materialNames=materials.map(m=>m?.name||'').join(' ');
    const zones=coveredRegions(mesh.name+' '+materialNames);
    if(!zones.length)return;
    for(const zone of zones)regions.add(zone);
    surfaceMeshes.push({mesh,regions:zones});
  });
  const list=[...regions].sort();
  return {regions:list,surfaceMeshes,signature:list.join('|')||'uncovered',
    recognizedMeshes:surfaceMeshes.length};
}
export function maskImportedNude(body,garment){
  const coverage=inferImportedGarmentCoverage(garment);
  if(!coverage.regions.length)return {restore(){},
    diagnostics:{removedTriangles:0,reason:'衣装パーツ名を識別できないため安全にカットを省略'},coverage};
  const mask=clipBodyToGarment(body,coverage,{surfaceCheck:true});
  return {...mask,coverage};
}
