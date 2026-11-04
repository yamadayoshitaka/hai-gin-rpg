// High-detail clothing for the motion preview. The 65-bone Quaternius outfit
// rig is kept separate and copies the actual character's joint pose every frame.
// This is intentionally opt-in: 100 simultaneous tactical units must not all
// allocate the 100x-density inspection garments.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {JOBS,outfitStyle,loadPhotoMaterials,createDetailedOutfit} from '../outfit-maintenance-model.js';
import {EQUIPMENT_TYPES,equipmentForJob} from './equipment-catalog.js';
import {attachSegmentedArmor} from './segmented-armor-runtime.js';
import {attachFittedCloth} from './fitted-cloth-runtime.js';

const loader=new GLTFLoader(),sourceCache=new Map();
let materialPromise;
const vector=new THREE.Vector3();
const boneByName=scene=>{
  const result=new Map();scene.traverse(n=>{if(n.isBone)result.set(n.name.toLowerCase(),n)});return result;
};

/** Suppress the nude torso/legs of the underlying Superhero mesh while an
 * outfit is worn, but preserve the real skinned face, ears and neck. Without
 * this, a second naked body rendered through the fitted clothes and produced
 * the ripped-leg/shoulder look even when garment meshes were watertight. */
export function maskBodyBelowNeck(characterModel){
  const restore=[];
  characterModel.traverse(o=>{
    if(!o.isSkinnedMesh||!o.skeleton||!o.geometry?.index)return;
    const geometry=o.geometry,positions=geometry.getAttribute('position');
    if(!positions||positions.count<4000)return;
    const bones=o.skeleton.bones.map(b=>b.name.toLowerCase());
    const head=bones.indexOf('head'),neck=bones.indexOf('neck_01');
    const joints=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
    if(head<0||!joints||!weights)return;
    const influence=i=>{
      let sum=0;for(let k=0;k<4;k++){
        const joint=joints.getComponent(i,k);
        if(joint===head||joint===neck)sum+=weights.getComponent(i,k);
      }
      return sum;
    };
    const original=geometry.index.array,kept=[];
    for(let i=0;i<original.length;i+=3){const a=original[i],b=original[i+1],c=original[i+2];
      if((influence(a)>.45)+(influence(b)>.45)+(influence(c)>.45)>=2)kept.push(a,b,c);
    }
    if(kept.length<300||kept.length>=original.length*.8)return;
    const face=geometry.clone();face.setIndex(kept);
    o.geometry=face;restore.push({mesh:o,source:geometry,face});
  });
  return ()=>{for(const item of restore){item.mesh.geometry=item.source;item.face.dispose()}};
}

function candidateNames(meshName){
  const n=meshName.toLowerCase();
  const side=n.startsWith('l-')?'l':n.startsWith('r-')?'r':null;
  if(/trouser-thigh/.test(n)&&side)return [`thigh_${side}`,`calf_${side}`,'pelvis'];
  if(/trouser-calf/.test(n)&&side)return [`calf_${side}`,`foot_${side}`,`thigh_${side}`];
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

function loadGltf(path){
  if(!sourceCache.has(path))sourceCache.set(path,loader.loadAsync(path).catch(e=>{sourceCache.delete(path);throw e}));
  return sourceCache.get(path);
}
function loadSource(sex,base){
  return loadGltf(`./assets/characters/quaternius-outfits/${sex==='female'?'Female':'Male'}_${base}.gltf`);
}
function makePrimitiveGear(kind){
  const group=new THREE.Group();group.name=`job-specific-${kind}`;
  const wood=new THREE.MeshStandardMaterial({color:0x59432d,roughness:.73});
  const metal=new THREE.MeshStandardMaterial({color:0xb3a7a1,metalness:.84,roughness:.24});
  const crystal=new THREE.MeshPhysicalMaterial({color:kind==='staff'?0x7e9cd8:0xe2bc6f,metalness:.28,roughness:.17});
  const add=(name,geometry,mat,pos)=>{const m=new THREE.Mesh(geometry,mat);m.name=name;m.position.set(...pos);m.castShadow=true;group.add(m)};
  if(kind==='staff'||kind==='scepter'){
    const length=kind==='staff'?1.42:.78;
    add('carved-wooden-shaft',new THREE.CylinderGeometry(.014,.020,length,24,12),kind==='staff'?wood:metal,[0,length*.50,0]);
    add('prismatic-gemstone',new THREE.IcosahedronGeometry(kind==='staff'?.070:.055,2),crystal,[0,length+.05,0]);
    for(let k=0;k<3;k++)add('shaft-gold-mount',new THREE.TorusGeometry(.025,.007,12,40),metal,[0,length-(k*.055),0]);
  } else if(kind==='bow'){
    const pts=[];for(let i=0;i<=48;i++){const u=i/48;pts.push(new THREE.Vector3(.19*Math.sin(u*Math.PI),u*.98,0))}
    const curve=new THREE.CatmullRomCurve3(pts);
    add('laminated-bow-limb',new THREE.TubeGeometry(curve,80,.015,12,false),wood,[0,0,0]);
    add('bowstring',new THREE.CylinderGeometry(.0025,.0025,.98,8),metal,[0,.49,0]);
  }
  return group;
}
async function attachGear(outfitBones,profile){
  const items=[];
  async function attach(kind,boneName,offset,rotation,scale){
    const definition=EQUIPMENT_TYPES[kind];
    if(!definition)throw Error('未登録の装備種類です: '+kind);
    const resource=definition.asset?await loadGltf(`./assets/props/fantasy-megakit/${definition.asset}.gltf`):null;
    const bone=outfitBones.get(boneName);
    if(!bone)throw Error('装備を保持する関節がありません: '+boneName);
    const object=resource?clone(resource.scene):makePrimitiveGear(kind);
    object.name=`equipment-${definition.kind}-${kind}-${boneName}`;
    object.position.set(...offset);object.rotation.set(...rotation);object.scale.setScalar(scale);
    object.userData={equipmentClass:definition.kind,equipmentSlot:boneName,equipmentKind:kind,equipmentLabel:definition.label};
    object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
    bone.add(object);items.push(object);
  }
  for(const [kind,bone] of [[profile.main,'hand_r'],[profile.offhand,'hand_l']]){
    if(!kind)continue;
    if(kind==='shield')await attach(kind,bone,[0,-.12,-.10],[Math.PI/2,0,Math.PI/2],.68);
    else if(kind==='sword')await attach(kind,bone,[0,-.09,0],[0,0,Math.PI],.72);
    else if(kind==='dagger')await attach(kind,bone,[0,-.08,0],[0,0,Math.PI],.36);
    else if(kind==='axe')await attach(kind,bone,[0,-.13,0],[0,0,0],.72);
    else if(kind==='bow')await attach(kind,bone,[0,-.25,0],[0,0,0],.83);
    else await attach(kind,bone,[0,-.19,0],[0,0,0],kind==='scepter'?.78:.85);
  }
  return items;
}

export async function buildRiggedJobOutfit({characterModel,parent,job,sex='male'}={}){
  if(!characterModel||!parent)throw Error('人物モデルと配置先が必要です');
  const jobId=JOBS.find(item=>item[0]===job||item[1]===job)?.[0];
  if(!jobId)throw Error('衣装未登録: '+job);
  const style=outfitStyle(jobId),profile=equipmentForJob(jobId),base=style.base==='ranger'?'Ranger':'Peasant';
  materialPromise??=loadPhotoMaterials().catch(e=>{materialPromise=null;throw e});
  const [resource,textures]=await Promise.all([loadSource(sex,base),materialPromise]);
  const dressed=clone(resource.scene),targetBones=boneByName(characterModel),outfitBones=boneByName(dressed);
  const linked=[];for(const [name,bone] of outfitBones){const target=targetBones.get(name);if(target)linked.push([bone,target])}
  if(linked.length<60)throw Error('関節名の一致が不足: '+linked.length+'/65');
  dressed.traverse(o=>{if(!o.isMesh)return;
    // Combined Ranger GLTF contains the hood and pauldron for every Ranger.
    // Their visibility must follow the selected occupation, not the base mesh.
    const n=o.name.toLowerCase();
    if(n.includes('head_hood')&&!style.hood)o.visible=false;
    if(n.includes('acc_pauldron'))o.visible=false;// Genuine fitted plate model replaces the ranger prop.
    o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;
    const mats=Array.isArray(o.material)?o.material:[o.material];const made=mats.map(m=>{
      // Preserve source PBR normal/ORM maps. Light tint retains material detail.
      const copy=m.clone();if(/Peasant|Ranger/i.test(copy.name))copy.color.lerp(new THREE.Color(style.tint),.28);return copy;
    });o.material=Array.isArray(o.material)?made:made[0];
  });
  const highpoly=createDetailedOutfit(jobId,sex,dressed,textures);dressed.add(highpoly);
  const result=skinOutfitDetails(highpoly,dressed);
  const root=new THREE.Group();root.name=`rigged-outfit-${jobId}`;root.add(dressed);parent.add(root);
  // Segment joints use one rigid, separately addressable fabric/armor object
  // per bone. This replaces the torn skin-weighted v3 sleeves and trousers.
  let cloth=null,armor=null,gear=[];
  const extraRigs=[];
  try{
    cloth=attachFittedCloth({dressed,style,textures});
    armor=profile.armor==='plate'?await attachSegmentedArmor({root,dressed,sex,textures}):null;
    if(style.hood&&base==='Peasant'){
      const prefix=sex==='female'?'Female':'Male';
      const part=await loadGltf(`./assets/characters/quaternius-modular/parts/${prefix}_Ranger_Head_Hood.gltf`);
      const hood=clone(part.scene),hoodBones=boneByName(hood);
      const links=[];for(const [name,bone] of hoodBones){const main=outfitBones.get(name);if(main)links.push([bone,main])}
      if(links.length<60)throw Error('フードの骨格が一致しません: '+links.length);
      hood.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
      root.add(hood);extraRigs.push({scene:hood,links});
    }
    gear=await attachGear(outfitBones,profile);
  }catch(e){
    root.parent?.remove(root);// A failed attachment must never leave ghost suits in the scene.
    highpoly.traverse(o=>{if(o.isMesh){o.geometry.dispose()}});
    if(cloth){for(const piece of cloth.objects)piece.geometry.dispose();for(const mat of cloth.materials)mat.dispose()}
    if(armor){for(const piece of armor.objects)piece.geometry.dispose();for(const mat of armor.materials)mat.dispose()}
    throw e;
  }
  let restoreFaceMask=maskBodyBelowNeck(characterModel),bodyMasked=true;
  function setBodyOcclusion(enabled){
    if(enabled&&!bodyMasked){restoreFaceMask=maskBodyBelowNeck(characterModel);bodyMasked=true}
    else if(!enabled&&bodyMasked){restoreFaceMask();bodyMasked=false}
  }
  let disposed=false;
  function sync(){
    if(disposed)return;
    root.position.copy(characterModel.position);root.quaternion.copy(characterModel.quaternion);root.scale.copy(characterModel.scale);
    for(const [piece,person] of linked){piece.quaternion.copy(person.quaternion);piece.scale.copy(person.scale);
      if(piece.name==='root'||piece.name==='pelvis')piece.position.copy(person.position);
    }
    dressed.updateMatrixWorld(true);
    for(const extra of extraRigs){for(const [piece,source] of extra.links){piece.quaternion.copy(source.quaternion);piece.scale.copy(source.scale);
      if(piece.name==='root'||piece.name==='pelvis')piece.position.copy(source.position)}extra.scene.updateMatrixWorld(true)}
  }
  sync();
  function dispose(){
    if(disposed)return;disposed=true;root.parent?.remove(root);
    if(bodyMasked)restoreFaceMask();
    highpoly.traverse(o=>{if(o.isMesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose()}});
    for(const piece of cloth.objects)piece.geometry.dispose();
    for(const mat of cloth.materials)mat.dispose();
    if(armor){for(const piece of armor.objects)piece.geometry.dispose();for(const mat of armor.materials)mat.dispose()}
    dressed.traverse(o=>{if(o.isMesh&&!highpoly.getObjectById(o.id)){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose()}});
  }
  return {root,sync,dispose,setBodyOcclusion,diagnostics:{job:jobId,sex,matchingBones:linked.length,...result,
    triangles:highpoly.userData.triangles,gear:gear.length,weaponKinds:gear.map(g=>g.userData.equipmentKind),
    clothPieces:cloth.objects.length,armorPieces:armor?.objects.length||0,armorScale:armor?.diagnostics.armorScale||0,concept:style.concept}};
}
