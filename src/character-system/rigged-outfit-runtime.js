// High-detail clothing for the motion preview. The 65-bone Quaternius outfit
// rig is kept separate and copies the actual character's joint pose every frame.
// This is intentionally opt-in: 100 simultaneous tactical units must not all
// allocate the 100x-density inspection garments.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {JOBS,outfitStyle,loadPhotoMaterials,createDetailedOutfit} from '../outfit-maintenance-model.js';

const loader=new GLTFLoader(),sourceCache=new Map();
let materialPromise;
const vector=new THREE.Vector3();
const boneByName=scene=>{
  const result=new Map();scene.traverse(n=>{if(n.isBone)result.set(n.name.toLowerCase(),n)});return result;
};

function candidateNames(meshName){
  const n=meshName.toLowerCase();
  const side=n.startsWith('l-')?'l':n.startsWith('r-')?'r':null;
  if(/crown|hood|face-wrap/.test(n))return ['head','neck_01'];
  if(/shield/.test(n))return ['hand_l','lowerarm_l'];
  if(/hand-wrap/.test(n)&&side)return [`hand_${side}`,`lowerarm_${side}`];
  if(/sleeve|pauldron|puff/.test(n)&&side)return [`clavicle_${side}`,`upperarm_${side}`,`lowerarm_${side}`,`hand_${side}`];
  if(/skirt|hem-seam|bottom-hem/.test(n))return ['pelvis','thigh_l','thigh_r','calf_l','calf_r'];
  if(/cape|mantle/.test(n))return ['spine_03','spine_02','spine_01','pelvis'];
  if(/apron|waist|belt|pouch/.test(n))return ['pelvis','spine_01','spine_02'];
  if(/neckline|collar/.test(n))return ['spine_03','neck_01'];
  if(/quiver/.test(n))return ['spine_03','spine_02'];
  return ['pelvis','spine_01','spine_02','spine_03'];
}

/** Skin procedural garment triangles to the same skeleton as the original
 *  fitted outfit. 4-way spatial weights interpolate shoulder, waist and hem
 *  rather than gluing entire garments rigidly to a single joint. */
export function skinOutfitDetails(details,dressed){
  const skins=[];dressed.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)skins.push(o.skeleton)});
  if(!skins.length)throw Error('衣装モデルにスキン骨格がありません');
  const skeleton=skins[0],names=skeleton.bones.map(b=>b.name.toLowerCase());
  if(skeleton.bones.length<60)throw Error('衣装の骨数が不足: '+skeleton.bones.length);
  dressed.updateMatrixWorld(true);details.updateMatrixWorld(true);
  const reference=skeleton.bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
  let weightedVertices=0,skinnedPieces=0;
  // Copy the list before replacing meshes within the same group.
  const ordinary=[];details.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)ordinary.push(o)});
  for(const mesh of ordinary){
    const geometry=mesh.geometry;
    const positions=geometry.getAttribute('position');if(!positions)continue;
    const indices=new Uint16Array(positions.count*4),weights=new Float32Array(positions.count*4);
    const choices=candidateNames(mesh.name).map(name=>names.indexOf(name)).filter(i=>i>=0);
    if(!choices.length)throw Error('衣装の割当先骨が不明: '+mesh.name);
    for(let i=0;i<positions.count;i++){
      vector.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
      const nearest=choices.map(index=>({index,d:Math.max(0.0004,reference[index].distanceToSquared(vector))})).sort((a,b)=>a.d-b.d).slice(0,4);
      const sum=nearest.reduce((v,p)=>v+1/(p.d+.003),0);
      for(let j=0;j<nearest.length;j++){indices[i*4+j]=nearest[j].index;weights[i*4+j]=1/(nearest[j].d+.003)/sum}
    }
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const skinned=new THREE.SkinnedMesh(geometry,mesh.material);
    skinned.name=mesh.name;skinned.position.copy(mesh.position);skinned.quaternion.copy(mesh.quaternion);skinned.scale.copy(mesh.scale);
    skinned.castShadow=mesh.castShadow;skinned.receiveShadow=mesh.receiveShadow;skinned.frustumCulled=false;
    const parent=mesh.parent;parent.add(skinned);parent.remove(mesh);
    skinned.updateMatrixWorld(true);skinned.bind(skeleton,skinned.matrixWorld.clone());
    weightedVertices+=positions.count;skinnedPieces++;
  }
  details.userData.skinning={skinnedPieces,weightedVertices,boneCount:skeleton.bones.length};
  return details.userData.skinning;
}

function loadSource(sex,base){
  const path=`./assets/characters/quaternius-outfits/${sex==='female'?'Female':'Male'}_${base}.gltf`;
  if(!sourceCache.has(path))sourceCache.set(path,loader.loadAsync(path).catch(e=>{sourceCache.delete(path);throw e}));
  return sourceCache.get(path);
}

export async function buildRiggedJobOutfit({characterModel,parent,job,sex='male'}={}){
  if(!characterModel||!parent)throw Error('人物モデルと配置先が必要です');
  const jobId=JOBS.find(item=>item[0]===job||item[1]===job)?.[0];
  if(!jobId)throw Error('衣装未登録: '+job);
  const style=outfitStyle(jobId),base=style.base==='ranger'?'Ranger':'Peasant';
  materialPromise??=loadPhotoMaterials().catch(e=>{materialPromise=null;throw e});
  const [resource,textures]=await Promise.all([loadSource(sex,base),materialPromise]);
  const dressed=clone(resource.scene),targetBones=boneByName(characterModel),outfitBones=boneByName(dressed);
  const linked=[];for(const [name,bone] of outfitBones){const target=targetBones.get(name);if(target)linked.push([bone,target])}
  if(linked.length<60)throw Error('関節名の一致が不足: '+linked.length+'/65');
  dressed.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;
    const mats=Array.isArray(o.material)?o.material:[o.material];const made=mats.map(m=>{
      const copy=m.clone();if(/Peasant|Ranger/i.test(copy.name))copy.color.multiply(new THREE.Color(style.tint));return copy;
    });o.material=Array.isArray(o.material)?made:made[0];
  });
  const highpoly=createDetailedOutfit(jobId,sex,dressed,textures);dressed.add(highpoly);
  const result=skinOutfitDetails(highpoly,dressed);
  const root=new THREE.Group();root.name=`rigged-outfit-${jobId}`;root.add(dressed);parent.add(root);
  let disposed=false;
  function sync(){
    if(disposed)return;
    root.position.copy(characterModel.position);root.quaternion.copy(characterModel.quaternion);root.scale.copy(characterModel.scale);
    for(const [piece,person] of linked){piece.quaternion.copy(person.quaternion);piece.scale.copy(person.scale);
      if(piece.name==='root'||piece.name==='pelvis')piece.position.copy(person.position);
    }
    dressed.updateMatrixWorld(true);
  }
  sync();
  function dispose(){
    if(disposed)return;disposed=true;root.parent?.remove(root);
    highpoly.traverse(o=>{if(o.isMesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose()}});
    dressed.traverse(o=>{if(o.isMesh&&!highpoly.getObjectById(o.id)){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose()}});
  }
  return {root,sync,dispose,diagnostics:{job:jobId,sex,matchingBones:linked.length,...result,triangles:highpoly.userData.triangles}};
}
