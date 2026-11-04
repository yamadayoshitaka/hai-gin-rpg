// High-detail clothing for the motion preview. The 65-bone Quaternius outfit
// rig is kept separate and copies the actual character's joint pose every frame.
// This is intentionally opt-in: a tactical army of 100 should not all
// allocate the 100x-density inspection garments.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {JOBS,outfitStyle,loadPhotoMaterials,createDetailedOutfit} from '../outfit-maintenance-model.js?v=4.0.0';
import {EQUIPMENT_TYPES,equipmentForJob} from './equipment-catalog.js?v=3.9.1';
import {attachSegmentedArmor} from './segmented-armor-runtime.js';
import {attachArmorHeraldry} from './armor-heraldry-runtime.js?v=4.0.0';
import {attachFittedCloth} from './fitted-cloth-runtime.js?v=3.9.1';

const loader=new GLTFLoader(),sourceCache=new Map();
let materialPromise;
const vector=new THREE.Vector3();
const boneByName=scene=>{
  const result=new Map();scene.traverse(n=>{if(n.isBone)result.set(n.name.toLowerCase(),n)});return result;
};

// Measure actual deformed garment geometry. A successful skeleton hookup alone
// does not prove that a costume is centered on, or sized for, the body.
function skinnedBounds(object,meshStats=null){
  const result=new THREE.Box3();
  const point=new THREE.Vector3();
  object.updateWorldMatrix(true,true);
  // updateWorldMatrix is not equivalent to updateMatrixWorld for SkinnedMesh:
  // the latter refreshes bindMatrixInverse after the costume root was scaled.
  // Without it, CPU fitting incorrectly applies the root's scale twice.
  object.updateMatrixWorld(true);
  object.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!mesh.visible||!mesh.geometry?.attributes?.position)return;
    // Do not use setFromObject(mesh): it also includes helmets, swords and
    // children attached to the bones and corrupts the clothing/body ratio.
    const count=mesh.geometry.attributes.position.count;
    const partBox=meshStats?new THREE.Box3():null;
    for(let i=0;i<count;i++){
      mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
      if(Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z)){
        result.expandByPoint(point);partBox?.expandByPoint(point);
      }
    }
    if(partBox&&!partBox.isEmpty()){
      const size=partBox.getSize(new THREE.Vector3());
      const center=partBox.getCenter(new THREE.Vector3());
      meshStats.push({name:mesh.name,parent:mesh.parent?.name,vertices:count,
        size:[size.x,size.y,size.z].map(x=>+x.toFixed(3)),
        center:[center.x,center.y,center.z].map(x=>+x.toFixed(3))});
    }
  });
  return result;
}

function bindGeometryBounds(object){
  const bounds=new THREE.Box3();
  object.updateWorldMatrix(true,true);
  object.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!mesh.visible||!mesh.geometry?.attributes?.position)return;
    const box=new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position);
    box.applyMatrix4(mesh.matrixWorld);
    bounds.union(box);
  });
  return bounds;
}

function measureOutfitFit(bodyBox,dressed,job,sex,bodyMeshStats=[],bodyBindBox=null,bodyScale=1){
  const outfitMeshStats=[];
  const outfitBox=skinnedBounds(dressed,outfitMeshStats);
  const outfitBindBox=bindGeometryBounds(dressed);
  if(bodyBox.isEmpty()||outfitBox.isEmpty())return {file:`rigged-${job}-${sex}`,sex,region:'full-body',rigged:true,verified:false,
    reason:'Skinned body or outfit geometry missing'};
  const body=bodyBox.getSize(new THREE.Vector3());
  const outfit=outfitBox.getSize(new THREE.Vector3());
  const bodyCenter=bodyBox.getCenter(new THREE.Vector3());
  const outfitCenter=outfitBox.getCenter(new THREE.Vector3());
  const heightRatio=outfit.y/Math.max(body.y,.001);
  const widthRatio=outfit.x/Math.max(body.x,.001);
  const depthRatio=outfit.z/Math.max(body.z,.001);
  const lateralOffset=Math.hypot(bodyCenter.x-outfitCenter.x,bodyCenter.z-outfitCenter.z)/Math.max(body.y,.001);
  const centerOffset=bodyCenter.distanceTo(outfitCenter)/Math.max(body.y,.001);
  const oversized=heightRatio>1.35||widthRatio>2.4||depthRatio>2.4;
  const verified=body.y>.5&&heightRatio>.7&&heightRatio<1.35&&widthRatio>.6&&widthRatio<2.4&&
    depthRatio>.6&&depthRatio<2.4&&lateralOffset<.2&&centerOffset<.3;
  return {file:`rigged-${job}-${sex}`,sex,region:'full-body',rigged:true,verified,
    offset:+lateralOffset.toFixed(3),centerOffset:+centerOffset.toFixed(3),oversized,
    heightRatio:+heightRatio.toFixed(3),widthRatio:+widthRatio.toFixed(3),depthRatio:+depthRatio.toFixed(3),
    bodyHeight:+body.y.toFixed(3),outfitHeight:+outfit.y.toFixed(3),measurement:'deformed-skinned-mesh-world-bounds',
    characterScale:+bodyScale.toFixed(4),bodyBindHeight:+(bodyBindBox?.getSize(new THREE.Vector3()).y||0).toFixed(3),
    outfitBindHeight:+outfitBindBox.getSize(new THREE.Vector3()).y.toFixed(3),
    bodyCenter:[bodyCenter.x,bodyCenter.y,bodyCenter.z].map(x=>+x.toFixed(3)),
    outfitCenter:[outfitCenter.x,outfitCenter.y,outfitCenter.z].map(x=>+x.toFixed(3)),
    largestBodyMeshes:bodyMeshStats.sort((a,b)=>b.size[1]-a.size[1]).slice(0,4),
    largestOutfitMeshes:outfitMeshStats.sort((a,b)=>b.size[1]-a.size[1]).slice(0,10)};
}

/** Suppress the nude torso/legs of the underlying Superhero mesh while an
 * outfit is worn, but preserve the real skinned face, ears, neck and hands. Without
 * this, a second naked body rendered through the fitted clothes and produced
 * the ripped-leg/shoulder look even when garment meshes were watertight. */
export function maskBodyBelowNeck(characterModel){
  const restore=[];
  characterModel.traverse(o=>{
    if(!o.isSkinnedMesh||!o.skeleton||!o.geometry?.index)return;
    const geometry=o.geometry,positions=geometry.getAttribute('position');
    if(!positions||positions.count<4000)return;
    const bones=o.skeleton.bones.map(b=>b.name.toLowerCase());
    const head=bones.indexOf('head');
    const exposed=new Set();
    bones.forEach((name,i)=>{
      if(/^(head|neck_01|hand_[lr]|index_|middle_|ring_|pinky_|thumb_)/.test(name))exposed.add(i);
    });
    const joints=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
    if(head<0||!joints||!weights)return;
    const influence=i=>{
      let sum=0;for(let k=0;k<4;k++){
        const joint=joints.getComponent(i,k);
        if(exposed.has(joint))sum+=weights.getComponent(i,k);
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
function makePrimitiveGear(kind,textures,quality){
  const battle=quality==='battle';
  const group=new THREE.Group();group.name=`job-specific-${kind}`;
  const wood=new THREE.MeshStandardMaterial({map:textures.leather,bumpMap:textures.leather,bumpScale:.0015,
    color:0xb5a28a,roughness:.81});
  const metal=new THREE.MeshPhysicalMaterial({map:textures.steel,bumpMap:textures.steel,bumpScale:.0012,
    color:0xc7d4e4,metalness:.48,roughness:.31,clearcoat:battle?0:.25});
  const brass=new THREE.MeshStandardMaterial({map:textures['gold-brocade'],bumpMap:textures['gold-brocade'],
    bumpScale:.0009,color:0xe4d5aa,metalness:.64,roughness:.36});
  const crystal=new THREE.MeshPhysicalMaterial({color:kind==='staff'?0x7e9cd8:0xe2bc6f,metalness:.14,
    roughness:.11,transmission:battle?0:.18,thickness:.04,clearcoat:battle?0:.8});
  group.userData.ownedMaterials=[wood,metal,brass,crystal];
  const add=(name,geometry,mat,pos)=>{const m=new THREE.Mesh(geometry,mat);m.name=name;m.position.set(...pos);m.castShadow=true;group.add(m)};
  if(kind==='staff'||kind==='scepter'){
    const length=kind==='staff'?1.42:.78;
    add('photo-wrapped-carved-shaft',new THREE.CylinderGeometry(.014,.021,length,battle?8:20,battle?1:6),kind==='staff'?wood:metal,[0,length*.50,0]);
    add('prismatic-gemstone',new THREE.IcosahedronGeometry(kind==='staff'?.070:.055,battle?0:2),crystal,[0,length+.05,0]);
    for(let k=0;k<3;k++)add('hand-engraved-gold-mount',new THREE.TorusGeometry(.025,.006,battle?5:10,battle?12:32),brass,[0,length-(k*.055),0]);
    if(!battle)for(let k=0;k<5;k++){
      const t=.15+k*.19;
      add('shaft-leather-binding',new THREE.TorusGeometry(.019,.0025,8,24),wood,[0,length*t,0]);
    }
  } else if(kind==='spear'){
    add('photo-ash-wood-spear-shaft',new THREE.CylinderGeometry(.012,.016,1.65,battle?8:16,battle?1:4),wood,[0,.68,0]);
    add('forged-photo-steel-spearhead',new THREE.ConeGeometry(.055,.28,battle?8:16),metal,[0,1.645,0]);
    add('spearhead-collar',new THREE.CylinderGeometry(.029,.024,.07,battle?8:12),brass,[0,1.49,0]);
    for(let k=0;k<2;k++)add('spear-grip-binding',new THREE.TorusGeometry(.016,.003,6,battle?10:24),wood,[0,.35+k*.09,0]);
  } else if(kind==='bow'){
    const pts=[];for(let i=0;i<=24;i++){const u=i/24;pts.push(new THREE.Vector3(.19*Math.sin(u*Math.PI),u*.98,0))}
    const curve=new THREE.CatmullRomCurve3(pts);
    add('photo-laminated-bow-limb',new THREE.TubeGeometry(curve,battle?24:64,.015,battle?5:10,false),wood,[0,0,0]);
    add('silk-bowstring',new THREE.CylinderGeometry(.0025,.0025,.98,battle?3:6),brass,[0,.49,0]);
    add('stitched-bow-grip',new THREE.CylinderGeometry(.021,.021,.12,battle?6:12),wood,[.19,.49,0]);
  }
  return group;
}
function applyPhotoFinishToGear(object,kind,textures){
  object.traverse(o=>{
    if(!o.isMesh)return;
    const source=Array.isArray(o.material)?o.material:[o.material];
    const make=material=>{
      if(!material?.isMeshStandardMaterial)return material;
      const m=material.clone();
      // Preserve the imported asset's PBR albedo/normal/ORM texture. The
      // photographed grain is a subtle additional relief layer, not a flat
      // material replacement that erases the original blade/woodwork.
      m.bumpMap=kind==='shield'?textures.leather:textures.steel;
      m.bumpScale=kind==='shield'?.0011:.0009;
      m.roughness=Math.max(.30,Math.min(.72,m.roughness));
      if(kind!=='shield')m.metalness=Math.max(.38,m.metalness);
      m.needsUpdate=true;return m;
    };
    o.material=Array.isArray(o.material)?source.map(make):make(source[0]);
  });
}
async function attachGear(outfitBones,profile,textures,quality){
  const items=[];
  async function attach(kind,boneName,offset,rotation,scale){
    const definition=EQUIPMENT_TYPES[kind];
    if(!definition)throw Error('未登録の装備種類です: '+kind);
    const resource=definition.asset?await loadGltf(`./assets/props/fantasy-megakit/${definition.asset}.gltf`):null;
    const bone=outfitBones.get(boneName);
    if(!bone)throw Error('装備を保持する関節がありません: '+boneName);
    const object=resource?clone(resource.scene):makePrimitiveGear(kind,textures,quality);
    if(resource)applyPhotoFinishToGear(object,kind,textures);
    object.name=`equipment-${definition.kind}-${kind}-${boneName}`;
    object.position.set(...offset);object.rotation.set(...rotation);object.scale.setScalar(scale);
    object.userData={...object.userData,equipmentClass:definition.kind,equipmentSlot:boneName,
      equipmentKind:kind,equipmentLabel:definition.label};
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
    else if(kind==='spear')await attach(kind,bone,[0,-.24,0],[0,0,0],.95);
    else await attach(kind,bone,[0,-.19,0],[0,0,0],kind==='scepter'?.78:.85);
  }
  return items;
}

export async function buildRiggedJobOutfit({characterModel,parent,job,sex='male',quality='preview',weaponOverride=null,preserveBody=false}={}){
  if(!characterModel||!parent)throw Error('人物モデルと配置先が必要です');
  const jobId=JOBS.find(item=>item[0]===job||item[1]===job)?.[0];
  if(!jobId)throw Error('衣装未登録: '+job);
  if(quality!=='preview'&&quality!=='battle')throw Error('未対応の衣装品質: '+quality);
  // Tactical battles render multiple actors at once. Reuse the same rigged source
  // garments, photo materials, armor and gear, but omit inspection-only detail.
  const lowDetail=quality==='battle';
  const style=outfitStyle(jobId),preset=equipmentForJob(jobId);
  if(weaponOverride&&!EQUIPMENT_TYPES[weaponOverride])throw Error('未登録の装備種類です: '+weaponOverride);
  const profile=weaponOverride?{...preset,main:weaponOverride}:preset;
  const base=style.base==='ranger'?'Ranger':'Peasant';
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
      const copy=m.clone();if(/Peasant|Ranger/i.test(copy.name))copy.color.lerp(new THREE.Color(style.tint),lowDetail?.62:.28);return copy;
    });o.material=Array.isArray(o.material)?made:made[0];
  });
  // Even the instanced battle source retains the job's identifying stitched
  // seams, harness and crest; only tessellation/inspection micro-details vary.
  const detail=createDetailedOutfit(jobId,sex,dressed,textures,{quality});
  dressed.add(detail);
  const result=skinOutfitDetails(detail,dressed);
  const root=new THREE.Group();root.name=`rigged-outfit-${jobId}`;root.add(dressed);parent.add(root);
  // Segment joints use one rigid, separately addressable fabric/armor object
  // per bone. This replaces the torn skin-weighted v3 sleeves and trousers.
  let cloth=null,armor=null,gear=[];
  const extraRigs=[];
  try{
    cloth=attachFittedCloth({dressed,style,textures,
      radialSegments:lowDetail?16:96,heightSegments:lowDetail?3:32});
    armor=profile.armor==='plate'?await attachSegmentedArmor({root,dressed,sex,textures}):null;
    if(armor)attachArmorHeraldry({root,armor,job:jobId,textures,quality});
    if(style.hood&&base==='Peasant'){
      const prefix=sex==='female'?'Female':'Male';
      const part=await loadGltf(`./assets/characters/quaternius-modular/parts/${prefix}_Ranger_Head_Hood.gltf`);
      const hood=clone(part.scene),hoodBones=boneByName(hood);
      const links=[];for(const [name,bone] of hoodBones){const main=outfitBones.get(name);if(main)links.push([bone,main])}
      if(links.length<60)throw Error('フードの骨格が一致しません: '+links.length);
      hood.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
      root.add(hood);extraRigs.push({scene:hood,links});
    }
    gear=await attachGear(outfitBones,profile,textures,quality);
  }catch(e){
    root.parent?.remove(root);// A failed attachment must never leave ghost suits in the scene.
    detail.traverse(o=>{if(o.isMesh){o.geometry.dispose()}});
    if(cloth){for(const piece of cloth.objects)piece.geometry.dispose();for(const mat of cloth.materials)mat.dispose()}
    if(armor){for(const piece of armor.objects)piece.geometry.dispose();for(const mat of armor.materials)mat.dispose()}
    throw e;
  }
  // The tactical game needs a complete human beneath the costume. Until each
  // garment has a verified coverage mask, deleting the naked torso/legs causes
  // visible holes and detached-looking hands, feet, armor, and weapons.
  // Keep the complete source body as the fitting reference before the display
  // mask removes covered body triangles. Preview-only: this per-vertex scan is
  // intentionally skipped for 50v50 / 1000v1000 combat renderers.
  const bodyMeshStats=[];
  const bodyFitBox=lowDetail?null:skinnedBounds(characterModel,bodyMeshStats);
  const bodyBindBox=lowDetail?null:bindGeometryBounds(characterModel);
  let restoreFaceMask=preserveBody?()=>{}:maskBodyBelowNeck(characterModel),bodyMasked=!preserveBody;
  function setBodyOcclusion(enabled){
    if(preserveBody)return;
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
  const fitReport=bodyFitBox?measureOutfitFit(bodyFitBox,dressed,jobId,sex,bodyMeshStats,
    bodyBindBox,characterModel.scale.x):null;
  function dispose(){
    if(disposed)return;disposed=true;root.parent?.remove(root);
    if(bodyMasked)restoreFaceMask();
    detail.traverse(o=>{if(o.isMesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose()}});
    for(const piece of cloth.objects)piece.geometry.dispose();
    for(const mat of cloth.materials)mat.dispose();
    if(armor){for(const piece of armor.objects)piece.geometry.dispose();for(const mat of armor.materials)mat.dispose()}
    dressed.traverse(o=>{if(o.isMesh&&!detail.getObjectById(o.id)){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose()}});
  }
  return {root,sync,dispose,setBodyOcclusion,fitReport,diagnostics:{job:jobId,sex,matchingBones:linked.length,...result,
    quality,triangles:detail.userData.triangles,detailMotif:detail.userData.motif,
    gear:gear.length,weaponKinds:gear.map(g=>g.userData.equipmentKind),
    clothPieces:cloth.objects.length,armorPieces:armor?.objects.length||0,armorScale:armor?.diagnostics.armorScale||0,concept:style.concept}};
}
