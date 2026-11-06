// High-detail clothing for the motion preview. The 65-bone Quaternius outfit
// rig is kept separate and copies the actual character's joint pose every frame.
// This is intentionally opt-in: a tactical army of 100 should not all
// allocate the 100x-density inspection garments.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {JOBS,outfitStyle,loadPhotoMaterials,createDetailedOutfit} from '../outfit-maintenance-model.js?v=4.4.47';
import {EQUIPMENT_TYPES,equipmentForJob} from './equipment-catalog.js?v=4.4.41';
import {attachSegmentedArmor} from './segmented-armor-runtime.js?v=4.4.61';
import {attachCharacterHair} from './hair-attachment-runtime.js?v=4.4.61';
import {attachArmorHeraldry} from './armor-heraldry-runtime.js?v=4.4.61';
import {attachFittedCloth} from './fitted-cloth-runtime.js?v=4.4.43';
import {outfitSurfaceRole,cleanOutfitPhotoKind} from './outfit-surface-policy.js?v=4.4.43';
import {fitEyebrowMeshesToFace} from './eyebrow-fit-runtime.js?v=4.4.61';
import {sourceGripFromBounds} from './equipment-grip-policy.js?v=4.4.41';
import {normalizeOutfitRarity,outfitRarityFinish} from './outfit-rarity-policy.js?v=4.4.47';

const loader=new GLTFLoader(),sourceCache=new Map();
let materialPromise;
const vector=new THREE.Vector3();
const boneByName=scene=>{
  const result=new Map();scene.traverse(n=>{if(n.isBone)result.set(n.name.toLowerCase(),n)});return result;
};

// Measure actual deformed garment geometry. A successful skeleton hookup alone
// does not prove that a costume is centered on, or sized for, the body.
function skinnedBounds(object,meshStats=null,{excludeFlared=false}={}){
  const result=new THREE.Box3();
  const point=new THREE.Vector3();
  object.updateWorldMatrix(true,true);
  // updateWorldMatrix is not equivalent to updateMatrixWorld for SkinnedMesh:
  // the latter refreshes bindMatrixInverse after the costume root was scaled.
  // Without it, CPU fitting incorrectly applies the root's scale twice.
  object.updateMatrixWorld(true);
  object.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!mesh.visible||!mesh.geometry?.attributes?.position)return;
    // A royal gown or a flowing cloak is SUPPOSED to project beyond the
    // torso. Treat that silhouette separately instead of reporting it as a
    // misplaced body or shrinking the skirt until it intersects the legs.
    if(excludeFlared&&/(skirt|cape|mantle|train|robe|dress|hem)/i.test(mesh.name))return;
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
  const silhouetteBox=skinnedBounds(dressed,outfitMeshStats);
  const outfitBox=skinnedBounds(dressed,null,{excludeFlared:true});
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
    silhouetteDepthRatio:+(silhouetteBox.getSize(new THREE.Vector3()).z/Math.max(body.z,.001)).toFixed(3),
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
const sharedFaceMasks=new WeakMap();
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
      if(/^(head|neck_01|hand_[lr]|foot_[lr]|ball_[lr]|index_|middle_|ring_|pinky_|thumb_)/.test(name))exposed.add(i);
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
    let faceRecord=sharedFaceMasks.get(geometry);
    if(!faceRecord){
      const original=geometry.index.array,kept=[];
      for(let i=0;i<original.length;i+=3){const a=original[i],b=original[i+1],c=original[i+2];
        if((influence(a)>.45)+(influence(b)>.45)+(influence(c)>.45)>=2)kept.push(a,b,c);
      }
      if(kept.length<300||kept.length>=original.length*.8)return;
      const face=geometry.clone();face.setIndex(kept);
      faceRecord={face,refs:0};sharedFaceMasks.set(geometry,faceRecord);
    }
    faceRecord.refs++;
    o.geometry=faceRecord.face;restore.push({mesh:o,source:geometry,record:faceRecord});
  });
  return ()=>{for(const item of restore){
    item.mesh.geometry=item.source;
    if(!--item.record.refs){item.record.face.dispose();sharedFaceMasks.delete(item.source)}
  }};
}

function candidateNames(meshName){
  const n=meshName.toLowerCase();
  const side=n.startsWith('l-')?'l':n.startsWith('r-')?'r':null;
  if(/trouser-thigh/.test(n)&&side)return [`thigh_${side}`,`calf_${side}`,'pelvis'];
  if(/cuirass-thigh-tasset-([lr])/.test(n)){
    const s=n.match(/cuirass-thigh-tasset-([lr])/)[1];
    return [`thigh_${s}`,'pelvis',`calf_${s}`];
  }
  if(/trouser-calf/.test(n)&&side)return [`calf_${side}`,`foot_${side}`,`thigh_${side}`];
  if(/crown|hood|face-wrap/.test(n))return ['head','neck_01'];
  if(/shield/.test(n))return ['hand_l','lowerarm_l'];
  if(/command-epaulette-([lr])/.test(n)){
    const s=n.match(/command-epaulette-([lr])/)[1];
    return [`clavicle_${s}`,`upperarm_${s}`,'spine_03'];
  }
  if(/hand-wrap/.test(n)&&side)return [`hand_${side}`,`lowerarm_${side}`];
  if(/sleeve|pauldron|puff/.test(n)&&side)return [`clavicle_${side}`,`upperarm_${side}`,`lowerarm_${side}`,`hand_${side}`];
  if(/tunic-pleat-(l|r)/.test(n)){
    const s=n.match(/tunic-pleat-(l|r)/)[1];
    return ['pelvis',`thigh_${s}`,'spine_01'];
  }
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
  const add=(name,geometry,mat,pos)=>{const m=new THREE.Mesh(geometry,mat);m.name=name;m.position.set(...pos);m.castShadow=true;group.add(m);return m};
  if(kind==='command-baton'){
    // A field commander's gunbai-inspired staff, not a mage's jewel-topped
    // rod or a monarch's scepter. The fan is thin in Z and faces the enemy.
    const shaft=.86;
    add('photo-leather-wrapped-command-grip',new THREE.CylinderGeometry(.013,.018,shaft,
      battle?8:20,battle?1:6),wood,[0,shaft*.5,0]);
    const fanShape=new THREE.Shape();
    fanShape.moveTo(-.055,.77);
    fanShape.bezierCurveTo(-.23,.86,-.20,1.13,0,1.20);
    fanShape.bezierCurveTo(.20,1.13,.23,.86,.055,.77);
    fanShape.closePath();
    const fanFabric=new THREE.MeshStandardMaterial({map:textures.damask,
      bumpMap:textures.damask,bumpScale:.001,color:0x536c88,roughness:.67,
      metalness:.08,side:THREE.DoubleSide});
    group.userData.ownedMaterials.push(fanFabric);
    add('embroidered-command-fan',new THREE.ExtrudeGeometry(fanShape,{
      depth:.014,steps:1,bevelEnabled:true,bevelSize:.004,
      bevelThickness:.002,bevelSegments:battle?1:2,curveSegments:battle?6:14
    }),fanFabric,[0,0,0]);
    const edge=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.055,.77,.018),new THREE.Vector3(-.17,.88,.018),
      new THREE.Vector3(-.16,1.06,.018),new THREE.Vector3(0,1.20,.018),
      new THREE.Vector3(.16,1.06,.018),new THREE.Vector3(.17,.88,.018),
      new THREE.Vector3(.055,.77,.018)
    ]);
    add('command-fan-gold-rim',new THREE.TubeGeometry(edge,battle?16:48,
      .005,battle?5:8,false),brass,[0,0,0]);
    add('command-compass-north',new THREE.ConeGeometry(.026,.115,battle?6:12),
      brass,[0,1.065,.024]);
    for(const level of [.10,.16,.73])add('command-baton-brass-ferrule',
      new THREE.CylinderGeometry(.021,.021,.012,battle?8:16),brass,[0,level,0]);
  } else if(kind==='staff'||kind==='scepter'){
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
      const edged=kind==='sword'||kind==='dagger';
      m.bumpScale=kind==='shield'?.0011:edged?.00042:.0009;
      m.roughness=edged?Math.max(.28,Math.min(.43,m.roughness)):
        Math.max(.30,Math.min(.72,m.roughness));
      // Imported PBR props can have metalness=1 without an environment map:
      // that looks like a black silhouette in our mobile-lit scene. Retain
      // the original albedo/normal/ORM maps, but let direct light reveal the
      // photographed steel surface and sharpen the bevel highlights.
      if(kind!=='shield')m.metalness=Math.min(edged?.64:.76,Math.max(.38,m.metalness));
      m.needsUpdate=true;return m;
    };
    o.material=Array.isArray(o.material)?source.map(make):make(source[0]);
  });
}
// The only bundled sword is a bronze-atlas prop. Its guard and leather grip
// can remain authored, but the huge dark-brown blade looked wooden. A slim,
// beveled polished-steel face fits over the measured blade without replacing
// the GLB, weapon bounds, or hand-contact coordinate system.
function addPolishedSwordEdge(object,textures,quality){
  const bladeShape=new THREE.Shape();
  bladeShape.moveTo(-.043,.238);
  bladeShape.lineTo(.043,.238);
  bladeShape.lineTo(.033,.66);
  bladeShape.lineTo(.024,.795);
  bladeShape.lineTo(0,.921);
  bladeShape.lineTo(-.024,.795);
  bladeShape.lineTo(-.033,.66);
  bladeShape.closePath();
  const material=new THREE.MeshPhysicalMaterial({color:0xd9e7f2,
    bumpMap:textures.steel,bumpScale:.00045,metalness:.31,roughness:.28,
    clearcoat:quality==='battle'?0:.18,side:THREE.DoubleSide});
  const blade=new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape,{
    depth:.007,steps:1,bevelEnabled:true,bevelSegments:quality==='battle'?1:3,
    bevelThickness:.002,bevelSize:.002
  }),material);
  blade.name='fitted-polished-steel-blade-face';
  blade.position.z=.030;
  blade.castShadow=true;blade.receiveShadow=true;
  object.add(blade);
  object.userData.polishedBlade=true;
}
async function attachGear(dressed,outfitBones,profile,textures,quality){
  const items=[];
  async function attach(kind,boneName,offset,rotation,scale){
    const definition=EQUIPMENT_TYPES[kind];
    if(!definition)throw Error('未登録の装備種類です: '+kind);
    const resource=definition.asset?await loadGltf(`./assets/props/fantasy-megakit/${definition.asset}.gltf`):null;
    const bone=outfitBones.get(definition.mount?.bone||boneName);
    if(!bone)throw Error('装備を保持する関節がありません: '+boneName);
    const object=resource?clone(resource.scene):makePrimitiveGear(kind,textures,quality);
    if(resource)applyPhotoFinishToGear(object,kind,textures);
    if(resource&&(kind==='sword'||kind==='dagger'))addPolishedSwordEdge(object,textures,quality);
    // Source-space bounds must be measured BEFORE mounting, tilting or scaling.
    const sourceBounds=new THREE.Box3().setFromObject(object);
    object.name=`equipment-${definition.kind}-${kind}-${boneName}`;
    object.position.set(...offset);object.rotation.set(...rotation);object.scale.setScalar(scale);
    if(kind==='shield'){
      // The downloaded shield lies in XY, with its painted face on +Z.
      // Old [PI/2,0,PI/2] swung its normal to +X: edge-on to the enemy.
      // Mount it on the forearm, calibrating once in the bind pose to face
      // the same world +Z as the actual chest plate and heraldic crest.
      dressed.updateMatrixWorld(true);
      const mount=definition.mount,elbow=new THREE.Vector3(),hand=new THREE.Vector3();
      bone.getWorldPosition(elbow);
      const handBone=outfitBones.get('hand_l');
      if(!handBone)throw Error('盾の左手骨が見つかりません');
      handBone.getWorldPosition(hand);
      const center=elbow.lerp(hand,mount.forearmBlend);
      center.z+=mount.forwardOffset;
      object.position.copy(bone.worldToLocal(center));
      const base=new THREE.Quaternion();
      object.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(base));
      object.scale.setScalar(mount.scale);
    }else{
      // The supplied weapon GLTFs are offset around their modeling origins.
      // Anchor the real grip (hilt or shaft) to the hand bone's palm, after
      // applying the weapon's scale and orientation. No disconnected pommels.
      if(sourceBounds.isEmpty())throw Error('握り位置の計測に失敗: '+kind);
      const measured=sourceGripFromBounds(kind,sourceBounds.min,sourceBounds.max);
      const rotated=new THREE.Vector3(measured.x,measured.y,measured.z)
        .multiplyScalar(scale).applyQuaternion(object.quaternion);
      // The hand bone starts at the wrist. A fixed 35 mm offset left the
      // hilt behind the knuckles, visually passing through the gauntlet.
      // Fit the palm to each actual 65-bone hand's index/pinky bases.
      dressed.updateMatrixWorld(true);
      const side=bone.name.toLowerCase().endsWith('_l')?'l':'r';
      const index=outfitBones.get(`index_01_${side}`),pinky=outfitBones.get(`pinky_01_${side}`);
      const palm=new THREE.Vector3(0,.07,0);
      if(index&&pinky){
        const knuckleCenter=index.getWorldPosition(new THREE.Vector3())
          .add(pinky.getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
        palm.copy(bone.worldToLocal(knuckleCenter).multiplyScalar(.66));
      }
      const palmAnchor=palm.toArray();
      object.position.copy(palm.sub(rotated));
      object.userData.gripAnchor={kind,source:measured,palm:palmAnchor};
      object.userData.bladeTipSourceY=sourceBounds.max.y;
    }
    object.userData={...object.userData,equipmentClass:definition.kind,equipmentSlot:bone.name.toLowerCase(),
      equipmentKind:kind,equipmentLabel:definition.label};
    object.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
    bone.add(object);items.push(object);
  }
  for(const [kind,bone] of [[profile.main,'hand_r'],[profile.offhand,'hand_l']]){
    if(!kind)continue;
    if(kind==='shield')await attach(kind,bone,[0,0,0],[0,0,0],.74);
    else if(kind==='sword')await attach(kind,bone,[0,-.09,0],[0,0,Math.PI],.72);
    else if(kind==='dagger')await attach(kind,bone,[0,-.08,0],[0,0,Math.PI],.36);
    else if(kind==='axe')await attach(kind,bone,[0,-.13,0],[0,0,0],.72);
    else if(kind==='bow')await attach(kind,bone,[0,-.25,0],[0,0,0],.83);
    else if(kind==='spear')await attach(kind,bone,[0,-.24,0],[0,0,0],.95);
    else if(kind==='command-baton')await attach(kind,bone,[0,-.19,0],[0,0,0],.88);
    else await attach(kind,bone,[0,-.19,0],[0,0,0],kind==='scepter'?.78:.85);
  }
  return items;
}

export async function buildRiggedJobOutfit({characterModel,parent,job,sex='male',quality='preview',rarity='N',weaponOverride=null,preserveBody=false,hairStyle=null,hairColor=null}={}){
  if(!characterModel||!parent)throw Error('人物モデルと配置先が必要です');
  // Different preview and battle entry points share the same head-surface
  // correction. The calibrated mesh is cached for all copies of each sex.
  fitEyebrowMeshesToFace(characterModel);
  const jobId=JOBS.find(item=>item[0]===job||item[1]===job)?.[0];
  if(!jobId)throw Error('衣装未登録: '+job);
  if(quality!=='preview'&&quality!=='battle')throw Error('未対応の衣装品質: '+quality);
  // Tactical battles render multiple actors at once. Reuse the same rigged source
  // garments, photo materials, armor and gear, but omit inspection-only detail.
  const lowDetail=quality==='battle';
  const style=outfitStyle(jobId),preset=equipmentForJob(jobId);
  const rank=normalizeOutfitRarity(rarity),finish=outfitRarityFinish(rank);
  const appearanceTint=new THREE.Color(style.tint).lerp(new THREE.Color(finish.fabricHue),finish.fabricMix);
  const dressedStyle={...style,tint:appearanceTint.getHex()};
  if(weaponOverride&&!EQUIPMENT_TYPES[weaponOverride])throw Error('未登録の装備種類です: '+weaponOverride);
  const profile=weaponOverride?{...preset,main:weaponOverride}:preset;
  const base=style.base==='ranger'?'Ranger':'Peasant';
  materialPromise??=loadPhotoMaterials().catch(e=>{materialPromise=null;throw e});
  const [resource,textures]=await Promise.all([loadSource(sex,base),materialPromise]);
  const dressed=clone(resource.scene),targetBones=boneByName(characterModel),outfitBones=boneByName(dressed);
  const linked=[];for(const [name,bone] of outfitBones){const target=targetBones.get(name);if(target)linked.push([bone,target])}
  if(linked.length<60)throw Error('関節名の一致が不足: '+linked.length+'/65');
  let gambesonMeshes=0,commanderUniformMeshes=0,thiefSourceBeltsHidden=0;
  let correctedLimbMeshes=0,preservedSkinMaterials=0;
  dressed.traverse(o=>{if(!o.isMesh)return;
    // Combined Ranger GLTF contains the hood and pauldron for every Ranger.
    // Their visibility must follow the selected occupation, not the base mesh.
    const n=o.name.toLowerCase();
    if(n.includes('head_hood')&&!style.hood)o.visible=false;
    if(n.includes('acc_pauldron'))o.visible=false;// Genuine fitted plate model replaces the ranger prop.
    if(jobId==='job06'&&/ranger_body_belt_[12]/.test(n)){
      // Ranger's original doubled, oversized waist hoops remained visible
      // outside the handcrafted leather tabs. The custom fitted belt and
      // buckle now replace them instead of adding a third floating hoop.
      o.visible=false;thiefSourceBeltsHidden++;
    }
    o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;
    const mats=Array.isArray(o.material)?o.material:[o.material];const made=mats.map(m=>{
      // Preserve source PBR normal/ORM maps. Light tint retains material detail.
      const copy=m.clone();
      const role=outfitSurfaceRole(n,m.name);
      // Battle LOD may reduce triangle density, but NOT change the fabric
      // colour/finish. The old .62 crowd tint was visibly different from
      // the preview's .28 and made every class look like a downgraded skin.
      if(/Peasant|Ranger/i.test(copy.name))copy.color.lerp(appearanceTint,style.armor?.68:.28);
      const photoKind=cleanOutfitPhotoKind({role,partName:n,style,jobId});
      if(photoKind){
        // The old rule replaced both Ranger arm materials, including the
        // skin atlas (hands!), while leaving the original green leggings
        // poking through the cylinders as black-green blotches.
        const map=textures[photoKind]||textures.linen;
        copy.map=map;
        copy.bumpMap=map;
        copy.bumpScale=.00055;
        copy.color.setHex(jobId==='strategist'?new THREE.Color(0x91a5c1).lerp(appearanceTint,finish.fabricMix).getHex():
          style.armor?new THREE.Color(0x74869d).lerp(appearanceTint,finish.fabricMix).getHex():dressedStyle.tint);
        copy.metalness=0;
        copy.roughness=style.armor?.86:.82;
        copy.needsUpdate=true;
        if(style.armor)gambesonMeshes++;
        if(jobId==='strategist')commanderUniformMeshes++;
        if(role==='arms'||role==='legs')correctedLimbMeshes++;
      }else if(role==='skin')preservedSkinMaterials++;
      return copy;
    });o.material=Array.isArray(o.material)?made:made[0];
  });
  // Even the instanced battle source retains the job's identifying stitched
  // seams, harness and crest; only tessellation/inspection micro-details vary.
  const detail=createDetailedOutfit(jobId,sex,dressed,textures,{quality,rarity:rank});
  dressed.add(detail);
  const result=skinOutfitDetails(detail,dressed);
  const root=new THREE.Group();root.name=`rigged-outfit-${jobId}`;root.add(dressed);parent.add(root);
  // Segment joints use one rigid, separately addressable fabric/armor object
  // per bone. This replaces the torn skin-weighted v3 sleeves and trousers.
  let cloth=null,armor=null,gear=[],hair=null,hairError=null;
  const extraRigs=[];
  try{
    // The old battle shortcut skipped limb-envelope measurement. Fixed-size
    // sleeves/trousers then cut into the imported body when a pose bent its
    // knees or elbows. Fit once at load time even for the economical battle
    // mesh; this costs no extra per-frame CPU work or draw calls.
    cloth=attachFittedCloth({dressed,style:dressedStyle,textures,adaptiveFit:true,
      // Mobile: keep normal photographed materials and a smooth enough
      // sleeve/knee envelope without the preview studio's 96x32 mesh.
      radialSegments:lowDetail?40:96,heightSegments:lowDetail?10:32});
    armor=profile.armor==='plate'?await attachSegmentedArmor({root,dressed,sex,textures,characterModel,rarity:rank}):null;
    if(armor)attachArmorHeraldry({root,armor,job:jobId,textures,quality,rarity:rank});
    if(style.hood&&base==='Peasant'){
      const prefix=sex==='female'?'Female':'Male';
      const part=await loadGltf(`./assets/characters/quaternius-modular/parts/${prefix}_Ranger_Head_Hood.gltf`);
      const hood=clone(part.scene),hoodBones=boneByName(hood);
      const links=[];for(const [name,bone] of hoodBones){const main=outfitBones.get(name);if(main)links.push([bone,main])}
      if(links.length<60)throw Error('フードの骨格が一致しません: '+links.length);
      hood.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
      root.add(hood);extraRigs.push({scene:hood,links});
    }
    gear=await attachGear(dressed,outfitBones,profile,textures,quality);
    try{
      hair=await attachCharacterHair({model:characterModel,job:jobId,sex,style:hairStyle,
        color:hairColor,quality,headwear:style.hood?'hood':armor?'helmet':null});
    }catch(error){
      // A missing cosmetic asset must not strip a soldier of armor and weapons.
      hairError=String(error?.message||error);
      console.warn('Hair attachment unavailable:',jobId,sex,hairError);
    }
  }catch(e){
    hair?.dispose();
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
  // A hilt that merely intersects the palm is not a grasp: the original
  // Quaternius T pose leaves four fingers straight. Keep each equipped hand
  // in an articulated fist, using the mirrored local flexion axis of the
  // real left/right finger rig. Store the final quaternion once per outfit.
  const graspPose=new Map(),restFingerPose=new Map(),flexionAxis=new THREE.Vector3(0,0,1);
  for(const side of [...new Set(gear.filter(item=>item.userData.gripAnchor)
    .map(item=>item.userData.equipmentSlot.endsWith('_l')?'l':'r'))]){
    const mirror=side==='r'?1:-1;
    for(const finger of ['index','middle','ring','pinky'])for(let segment=1;segment<=3;segment++){
      const bone=targetBones.get(`${finger}_0${segment}_${side}`);
      if(!bone)continue;
      const radians=[0,.68,.83,.48][segment]*mirror;
      const rest=bone.quaternion.clone();restFingerPose.set(bone,rest);
      graspPose.set(bone,rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(flexionAxis,radians)));
    }
    // A four-finger fist with a straight thumb still looks like a hand
    // resting beside a sword, not a grasp. Oppose the thumb toward the index
    // across its three actual bones; it is skinned, not a painted-on glove.
    for(let segment=1;segment<=3;segment++){
      const bone=targetBones.get(`thumb_0${segment}_${side}`);
      if(!bone)continue;
      const radians=[0,.53,.61,.32][segment]*mirror;
      const rest=bone.quaternion.clone();restFingerPose.set(bone,rest);
      graspPose.set(bone,rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(flexionAxis,radians)));
    }
  }
  const shieldFront=new THREE.Quaternion();
  const shieldTarget=new THREE.Quaternion(),shieldParent=new THREE.Quaternion();
  const gripWorld=new THREE.Vector3(),palmWorld=new THREE.Vector3(),gripParent=new THREE.Vector3();
  const fingerWorld=new THREE.Vector3(),handWorld=new THREE.Vector3();
  const gripAxis=new THREE.Vector3(0,1,0),handInverse=new THREE.Quaternion();
  const raisedAxis=new THREE.Vector3(),bodyUp=new THREE.Vector3(),bodyForward=new THREE.Vector3();
  const bodyOutward=new THREE.Vector3(),bodyQuaternion=new THREE.Quaternion();
  const thumbTarget=new THREE.Vector3(),thumbJoint=new THREE.Vector3(),thumbTip=new THREE.Vector3();
  const thumbFrom=new THREE.Vector3(),thumbTo=new THREE.Vector3(),thumbShaft=new THREE.Vector3();
  const thumbDelta=new THREE.Quaternion(),thumbParent=new THREE.Quaternion();
  let thumbGripCalibrated=false;
  function alignHeldEquipment(){
    for(const item of gear){
      const anchor=item.userData.gripAnchor;
      if(!anchor||!item.parent)continue;
      const hand=targetBones.get(item.userData.equipmentSlot);
      if(!hand)continue;
      // Keep the hilt inside the curled fingers, but aim the blade in the
      // character's UP/FORWARD frame. In the source T pose the index-to-pinky
      // knuckle line lies almost horizontally, so mapping the whole blade
      // to that line makes swords edge-on (and often invisible) from front.
      // Calibrate once in the bind pose; the weapon subsequently follows the
      // animated hand with no per-frame global-axis locking.
      if(!item.userData.anatomicalGripAxis){
        const side=item.userData.equipmentSlot.endsWith('_l')?'l':'r';
        const index=targetBones.get(`index_01_${side}`);
        const pinky=targetBones.get(`pinky_01_${side}`);
        if(index&&pinky){
          index.getWorldPosition(fingerWorld);
          pinky.getWorldPosition(handWorld);
          if(fingerWorld.sub(handWorld).lengthSq()>.000004){
            fingerWorld.normalize();
            dressed.getWorldQuaternion(bodyQuaternion);
            bodyUp.set(0,1,0).applyQuaternion(bodyQuaternion);
            bodyForward.set(0,0,1).applyQuaternion(bodyQuaternion);
            bodyOutward.set(side==='r'?1:-1,0,0).applyQuaternion(bodyQuaternion);
            const kind=item.userData.equipmentKind;
            const forwardBias=kind==='dagger'?.45:kind==='sword'||kind==='axe'?.32:.18;
            raisedAxis.copy(bodyUp).addScaledVector(bodyForward,forwardBias)
              .addScaledVector(bodyOutward,kind==='sword'||kind==='dagger'?.18:.08).normalize();
            item.parent.getWorldQuaternion(handInverse).invert();
            raisedAxis.applyQuaternion(handInverse);
            item.quaternion.setFromUnitVectors(gripAxis,raisedAxis);
            item.userData.gripCalibratedAxis='raised-in-palm';
          }
        }
        item.userData.anatomicalGripAxis=true;
      }
      // The costume rig and the playable rig are distinct skeletons. The
      // original local (0,.035,0) test passed even when their hands were far
      // apart. Recompute the weapon hilt in WORLD coordinates and close the
      // real XYZ error every time the pose changes.
      item.updateWorldMatrix(true,true);
      gripWorld.set(anchor.source.x,anchor.source.y,anchor.source.z);
      item.localToWorld(gripWorld);
      palmWorld.set(...anchor.palm);hand.localToWorld(palmWorld);
      gripParent.copy(gripWorld);item.parent.worldToLocal(gripParent);
      item.parent.worldToLocal(palmWorld);
      item.position.add(palmWorld.sub(gripParent));
      item.updateWorldMatrix(true,true);
    }
  }
  function refineThumbGrip(){
    // Close the actual opposing fingertip onto the hilt rather than merely
    // rotating three joints by fixed angles. A bounded CCD solve runs once
    // when the outfit is equipped; subsequent action frames reuse the final
    // local quaternions, so even a large army pays no per-frame IK cost.
    for(const item of gear.filter(piece=>piece.userData.gripAnchor)){
      const side=item.userData.equipmentSlot.endsWith('_l')?'l':'r';
      const chain=[1,2,3].map(n=>targetBones.get(`thumb_0${n}_${side}`));
      const tipBone=targetBones.get(`thumb_04_leaf_${side}`);
      if(chain.some(b=>!b)||!tipBone)continue;
      const anchor=item.userData.gripAnchor;
      const contact=item.localToWorld(new THREE.Vector3(anchor.source.x,anchor.source.y,anchor.source.z));
      const shaft=new THREE.Vector3(0,1,0).applyQuaternion(item.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const root=chain[0].getWorldPosition(new THREE.Vector3());
      const along=THREE.MathUtils.clamp(root.clone().sub(contact).dot(shaft),-.048,.048);
      thumbShaft.copy(contact).addScaledVector(shaft,along);
      const radial=root.clone().sub(thumbShaft).addScaledVector(shaft,-root.clone().sub(thumbShaft).dot(shaft));
      if(radial.lengthSq()<.000001)radial.set(0,0,1);
      thumbTarget.copy(thumbShaft).addScaledVector(radial.normalize(),.020);
      const before=tipBone.getWorldPosition(new THREE.Vector3()).distanceTo(thumbTarget);
      const original=chain.map(b=>b.quaternion.clone());
      for(let iteration=0;iteration<9;iteration++){
        for(let i=2;i>=0;i--){
          const joint=chain[i];
          joint.getWorldPosition(thumbJoint);tipBone.getWorldPosition(thumbTip);
          thumbFrom.subVectors(thumbTip,thumbJoint);
          thumbTo.subVectors(thumbTarget,thumbJoint);
          if(thumbFrom.lengthSq()<.000001||thumbTo.lengthSq()<.000001)continue;
          thumbDelta.setFromUnitVectors(thumbFrom.normalize(),thumbTo.normalize());
          thumbDelta.rotateTowards(new THREE.Quaternion(),Math.max(0,thumbDelta.angleTo(new THREE.Quaternion())-.29));
          joint.parent.getWorldQuaternion(thumbParent);
          const inverse=thumbParent.clone().invert();
          joint.quaternion.premultiply(inverse.multiply(thumbDelta).multiply(thumbParent));
          characterModel.updateMatrixWorld(true);
        }
        if(tipBone.getWorldPosition(thumbTip).distanceTo(thumbTarget)<.012)break;
      }
      const after=tipBone.getWorldPosition(thumbTip).distanceTo(thumbTarget);
      if(after>=before-.004){chain.forEach((bone,i)=>bone.quaternion.copy(original[i]))}
      else for(const bone of chain)graspPose.set(bone,bone.quaternion.clone());
      characterModel.updateMatrixWorld(true);
      // The four opposing fingertips used to be rotated through identical
      // angles regardless of the handle diameter and actual hand dimensions.
      // Aim each distal joint at its own contact around the measured shaft.
      // Like the thumb solve this runs ONCE, never inside the animation loop.
      for(const finger of ['index','middle','ring','pinky']){
        const curl=[1,2,3].map(n=>targetBones.get(`${finger}_0${n}_${side}`));
        const distal=targetBones.get(`${finger}_04_leaf_${side}`);
        if(curl.some(b=>!b)||!distal)continue;
        const knuckle=curl[0].getWorldPosition(new THREE.Vector3());
        const shift=THREE.MathUtils.clamp(knuckle.clone().sub(contact).dot(shaft),-.048,.048);
        thumbShaft.copy(contact).addScaledVector(shaft,shift);
        const away=knuckle.clone().sub(thumbShaft).projectOnPlane(shaft);
        if(away.lengthSq()<.000001)away.set(0,0,1);
        // The polished swords have a slim, wrapped hilt. Earlier 16 mm
        // targets could leave the little finger visibly open by 25 mm even
        // though the palm contact test was exactly zero. Bring the final
        // finger pads around the handle, with a few extra bounded iterations.
        thumbTarget.copy(thumbShaft).addScaledVector(away.normalize(),.014);
        const initial=distal.getWorldPosition(new THREE.Vector3()).distanceTo(thumbTarget);
        const originalQuaternions=curl.map(b=>b.quaternion.clone());
        for(let iteration=0;iteration<15;iteration++){
          for(let i=2;i>=0;i--){
            const joint=curl[i];joint.getWorldPosition(thumbJoint);
            distal.getWorldPosition(thumbTip);
            thumbFrom.subVectors(thumbTip,thumbJoint);
            thumbTo.subVectors(thumbTarget,thumbJoint);
            if(thumbFrom.lengthSq()<.000001||thumbTo.lengthSq()<.000001)continue;
            thumbDelta.setFromUnitVectors(thumbFrom.normalize(),thumbTo.normalize());
            thumbDelta.rotateTowards(new THREE.Quaternion(),Math.max(0,thumbDelta.angleTo(new THREE.Quaternion())-.29));
            joint.parent.getWorldQuaternion(thumbParent);
            const inverse=thumbParent.clone().invert();
            joint.quaternion.premultiply(inverse.multiply(thumbDelta).multiply(thumbParent));
            characterModel.updateMatrixWorld(true);
          }
          if(distal.getWorldPosition(thumbTip).distanceTo(thumbTarget)<.010)break;
        }
        const finalGap=distal.getWorldPosition(thumbTip).distanceTo(thumbTarget);
        if(finalGap>=initial-.003){curl.forEach((bone,i)=>bone.quaternion.copy(originalQuaternions[i]))}
        else for(const bone of curl)graspPose.set(bone,bone.quaternion.clone());
        characterModel.updateMatrixWorld(true);
      }
    }
  }
  function sync(){
    if(disposed)return;
    // Pose action clips may animate the hand. Restore a consistent closed
    // grip before retargeting the costume and aligning the hilt in world XYZ.
    for(const [bone,curl] of graspPose)bone.quaternion.copy(curl);
    characterModel.updateMatrixWorld(true);
    root.position.copy(characterModel.position);root.quaternion.copy(characterModel.quaternion);root.scale.copy(characterModel.scale);
    // Every joint translation matters: copied rotations with the outfit's old
    // wrist/elbow/head offsets produced floating weapons and torn sleeves.
    for(const [piece,person] of linked){piece.position.copy(person.position);
      piece.quaternion.copy(person.quaternion);piece.scale.copy(person.scale)}
    dressed.updateMatrixWorld(true);
    alignHeldEquipment();
    if(!thumbGripCalibrated){
      thumbGripCalibrated=true;
      refineThumbGrip();
      for(const [piece,person] of linked){piece.position.copy(person.position);
        piece.quaternion.copy(person.quaternion);piece.scale.copy(person.scale)}
      dressed.updateMatrixWorld(true);
      alignHeldEquipment();
    }
    // Left forearm flexion must move the shield with the soldier, but must
    // never rotate the shield's painted/front face sideways or behind him.
    // The authored face is +Z; the soldier's forward direction is local +Z.
    // Compensate the current forearm roll *after* each retargeted pose update.
    for(const item of gear){
      if(item.userData.equipmentKind!=='shield')continue;
      dressed.getWorldQuaternion(shieldTarget).multiply(shieldFront);
      item.parent.getWorldQuaternion(shieldParent).invert();
      item.quaternion.copy(shieldParent.multiply(shieldTarget));
    }
    dressed.updateMatrixWorld(true);
    for(const extra of extraRigs){for(const [piece,source] of extra.links){piece.position.copy(source.position);
      piece.quaternion.copy(source.quaternion);piece.scale.copy(source.scale)}extra.scene.updateMatrixWorld(true)}
  }
  sync();
  const fitReport=bodyFitBox?measureOutfitFit(bodyFitBox,dressed,jobId,sex,bodyMeshStats,
    bodyBindBox,characterModel.scale.x):null;
  function dispose(){
    if(disposed)return;disposed=true;root.parent?.remove(root);hair?.dispose();
    for(const [bone,rest] of restFingerPose)bone.quaternion.copy(rest);
    if(bodyMasked)restoreFaceMask();
    detail.traverse(o=>{if(o.isMesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose()}});
    for(const piece of cloth.objects)piece.geometry.dispose();
    for(const mat of cloth.materials)mat.dispose();
    if(armor){for(const piece of armor.objects)piece.geometry.dispose();for(const mat of armor.materials)mat.dispose()}
    dressed.traverse(o=>{if(o.isMesh&&!detail.getObjectById(o.id)){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats)m?.dispose()}});
  }
  function setHelmetVisible(enabled){
    const show=Boolean(enabled)&&!!armor;
    for(const piece of armor?.objects||[])if(['helmet','helmet-ornament'].includes(piece.userData.equipmentSlot))piece.visible=show;
    // Headwear no longer makes the character bald. The visible strands are
    // clipped to its opening/rim, while the actual hood/helmet stays intact.
    hair?.setHeadwear(style.hood?'hood':show?'helmet':null);
  }
  function setHairVisible(enabled){hair?.setVisible(Boolean(enabled))}
  function presentation(){
    const helm=(armor?.objects||[]).filter(piece=>piece.userData.equipmentSlot==='helmet');
    const shield=gear.find(piece=>piece.userData.equipmentKind==='shield');
    let shieldFrontDot=null;
    if(shield){
      shield.updateWorldMatrix(true,true);
      const normal=new THREE.Vector3(0,0,1).applyQuaternion(shield.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const forward=new THREE.Vector3(0,0,1).applyQuaternion(dressed.getWorldQuaternion(new THREE.Quaternion())).normalize();
      shieldFrontDot=+normal.dot(forward).toFixed(4);
    }
    const gearContacts=gear.filter(item=>item.userData.gripAnchor).map(item=>{
      const anchor=item.userData.gripAnchor;
      const hand=targetBones.get(item.userData.equipmentSlot);
      if(!hand)return {kind:anchor.kind,error:Infinity,reason:'target hand missing'};
      const contact=item.localToWorld(new THREE.Vector3(anchor.source.x,anchor.source.y,anchor.source.z));
      const palm=hand.localToWorld(new THREE.Vector3(...anchor.palm));
      const side=item.userData.equipmentSlot.endsWith('_l')?'l':'r';
      const index=targetBones.get(`index_01_${side}`);
      const pinky=targetBones.get(`pinky_01_${side}`);
      const finger=targetBones.get(`middle_01_${side}`);
      const blade=new THREE.Vector3(0,1,0).applyQuaternion(item.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const across=index&&pinky?index.getWorldPosition(new THREE.Vector3()).sub(
        pinky.getWorldPosition(new THREE.Vector3())).normalize():null;
      const fingerAxis=finger?finger.getWorldPosition(new THREE.Vector3()).sub(hand.getWorldPosition(new THREE.Vector3())).normalize():null;
      const thumb=targetBones.get(`thumb_04_leaf_${side}`);
      const thumbGap=thumb?thumb.getWorldPosition(new THREE.Vector3()).sub(palm)
        .projectOnPlane(blade).length():null;
      const fingerGaps=Object.fromEntries(['index','middle','ring','pinky'].map(finger=>{
        const distal=targetBones.get(`${finger}_04_leaf_${side}`);
        const distance=distal?distal.getWorldPosition(new THREE.Vector3()).sub(contact)
          .projectOnPlane(blade).length():null;
        return [finger,distance===null?null:+distance.toFixed(4)];
      }));
      const dressedRotation=dressed.getWorldQuaternion(new THREE.Quaternion());
      const up=new THREE.Vector3(0,1,0).applyQuaternion(dressedRotation);
      const forward=new THREE.Vector3(0,0,1).applyQuaternion(dressedRotation);
      const tip=item.localToWorld(new THREE.Vector3(anchor.source.x,item.userData.bladeTipSourceY,anchor.source.z));
      return {kind:anchor.kind,hand:hand.name,error:+contact.distanceTo(palm).toFixed(5),
        axisDot:across?+Math.abs(blade.dot(across)).toFixed(4):null,
        fingerDot:fingerAxis?+blade.dot(fingerAxis).toFixed(4):null,
        bladeUpDot:+blade.dot(up).toFixed(4),bladeForwardDot:+blade.dot(forward).toFixed(4),
        tipAbovePalm:+tip.clone().sub(palm).dot(up).toFixed(4),
        thumbToHandle:thumbGap===null?null:+thumbGap.toFixed(4),
        fingerToHandle:fingerGaps,
        gripCalibratedAxis:item.userData.gripCalibratedAxis||'fallback',
        contactXYZ:contact.toArray().map(n=>+n.toFixed(4)),palmXYZ:palm.toArray().map(n=>+n.toFixed(4))};
    });
    // Exact XYZ world-coordinate regression, including wrists, knees and head.
    const boneOffsets=linked.map(([piece,person])=>({bone:piece.name,
      xyzError:piece.getWorldPosition(new THREE.Vector3()).distanceTo(person.getWorldPosition(new THREE.Vector3()))}));
    boneOffsets.sort((a,b)=>b.xyzError-a.xyzError);
    return {rarity:rank,rarityOrnaments:detail.userData.rarityOrnaments,
      hairVisible:!!hair?.object.visible,hairStyle:hair?.style||null,
      hairCoverage:hair?.diagnostics.headwearMode||'none',
      headwearSourceTriangles:hair?.diagnostics.headwearSourceTriangles||0,
      headwearKeptTriangles:hair?.diagnostics.headwearKeptTriangles||0,
      helmetVisible:helm.length>0&&helm.every(piece=>piece.visible),
      helmetPieces:helm.length,shieldFrontDot,bodyMasked,
      scalpUnderlay:!!hair?.diagnostics.scalpUnderlay,hairFit:hair?.diagnostics.fittingScale||null,
      scalpTriangles:hair?.diagnostics.scalpTriangles||0,
      rootFiberTriangles:hair?.diagnostics.rootFiberTriangles||0,
      scalpMethod:hair?.diagnostics.scalpMethod||null,
      closedFingerJoints:graspPose.size,
      maxJointXYZError:+(boneOffsets[0]?.xyzError||0).toFixed(5),
      worstJointOffsets:boneOffsets.slice(0,4).map(entry=>({bone:entry.bone,error:+entry.xyzError.toFixed(5)})),
      gearContacts};
  }
  return {root,sync,dispose,setBodyOcclusion,setHelmetVisible,setHairVisible,presentation,fitReport,diagnostics:{job:jobId,sex,matchingBones:linked.length,...result,
    quality,rarity:rank,rarityOrnaments:detail.userData.rarityOrnaments,
    triangles:detail.userData.triangles,detailMotif:detail.userData.motif,
    commanderPieces:jobId==='strategist'?detail.children.filter(o=>
      /^(command-|military-standing-collar|strategist-seal)/.test(o.name)).length:0,
    tunicPanels:detail.userData.tunicPanels,gambesonMeshes,commanderUniformMeshes,thiefSourceBeltsHidden,
    correctedLimbMeshes,preservedSkinMaterials,
    gear:gear.length,weaponKinds:gear.map(g=>g.userData.equipmentKind),
    clothPieces:cloth.objects.length,clothFit:cloth.diagnostics.fittedRadii,
    armorPieces:armor?.objects.length||0,armorScale:armor?.diagnostics.armorScale||0,
    hairStyle:hair?.style||null,hairAttached:!!hair,hairError,concept:style.concept}};
}
