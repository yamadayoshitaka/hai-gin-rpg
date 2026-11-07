// Real modular platemail GLBs, fitted once to the reference 65-bone skeleton.
// Every metal piece is a separate object rigidly attached to the appropriate
// joint: there is no vertex-weight stretching, barrel-shaped torso, or torn
// cloth mesh where elbows and knees bend.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {measureHeadLocalBounds} from './hair-attachment-runtime.js';
import {helmetFitForHead} from './helmet-fit-policy.js?v=4.4.37';
import {helmetFaceguardPolicy,shortenedGuardZ} from './helmet-faceguard-policy.js?v=4.4.92';
import {normalizeOutfitRarity,outfitRarityFinish} from './outfit-rarity-policy.js';
import {classifyArmorMesh,isPlateSourceTrouserLeg,nearestArmorLegSide} from './armor-mesh-classification.js?v=4.5.2';

const loader=new GLTFLoader();
const cache=new Map();
const MODEL_ORIGIN_PELVIS=4.10;
const MODEL_ORIGIN_HEAD=7.64;
// The previous default fit placed the helmet 50 mm behind the visually
// approved side/front placement. Bake the user's measured +0.050 preview
// correction into the skeletal fit, leaving the slider at zero by default.
export const HELMET_BASE_FORWARD_OFFSET=0.050;
const parts=['head','chest','hands','legs','feet'];
// Clearance is measured from each anatomical slice, not a giant uniform
// character scale. A few percent of radial relief prevents deep penetration
// while keeping seams, joint anchors and armor proportions intact.
export const ARMOR_CLEARANCE=Object.freeze({
 helmet:[1.04,1.055,1.045],chest:[1.005,.985,1.025],
 shoulder:[1.035,1.025,1.035],gauntlet:[.80,.90,.80],
 hip:[1.06,1.025,1.07],thigh:[1.065,1.015,1.065],
 knee:[1.08,1.05,1.09],shin:[1.07,1.015,1.075],
 'boot-upper':[1.06,1.02,1.065],'boot-foot':[1.045,1.02,1.045]
});

export function segmentedArmorAssetPaths(sex){
  return parts.map(part=>`./assets/characters/seven-head-equipment-candidates/plate_${part}-${sex}.glb`);
}

function loadArmor(path){
  if(!cache.has(path))cache.set(path,loader.loadAsync(path).catch(e=>{cache.delete(path);throw e}));
  return cache.get(path);
}

function boneMap(root){const result=new Map();root.traverse(o=>{if(o.isBone)result.set(o.name.toLowerCase(),o)});return result}
function bonePos(bones,name){const b=bones.get(name);if(!b)throw Error('鎧の取付先骨が見つかりません: '+name);return b.getWorldPosition(new THREE.Vector3())}
function mean(a,b){return a.clone().add(b).multiplyScalar(.5)}
function desiredAnchor(slot,side,bones){
  const suffix=side?`_${side}`:'';
  switch(slot){
    case 'helmet':return bonePos(bones,'head').add(new THREE.Vector3(0,.046,0));
    case 'chest':return bonePos(bones,'spine_03').add(new THREE.Vector3(0,-.060,0));
    case 'shoulder':return bonePos(bones,`upperarm${suffix}`);
    // Align the metal cuff behind the actual knuckles. The former palm-
    // centered bucket concealed every curling finger and left a black hole
    // around the sword hilt despite passing the fingertip XYZ tests.
    case 'gauntlet':return bonePos(bones,`hand${suffix}`).lerp(bonePos(bones,`lowerarm${suffix}`),.29);
    case 'hip':return bonePos(bones,'pelvis');
    case 'thigh':return mean(bonePos(bones,`thigh${suffix}`),bonePos(bones,`calf${suffix}`));
    case 'knee':return bonePos(bones,`calf${suffix}`);
    case 'shin':return mean(bonePos(bones,`calf${suffix}`),bonePos(bones,`foot${suffix}`));
    case 'boot-upper':return mean(bonePos(bones,`calf${suffix}`),bonePos(bones,`foot${suffix}`));
    case 'boot-foot':return bonePos(bones,`foot${suffix}`);
    default:throw Error('Unknown armor slot: '+slot);
  }
}
function attachBoneName(slot,side){
  if(slot==='helmet')return 'head';
  if(slot==='chest')return 'spine_03';
  if(slot==='hip')return 'pelvis';
  const segment={shoulder:'upperarm',gauntlet:'hand',thigh:'thigh',knee:'calf',shin:'calf','boot-upper':'calf','boot-foot':'foot'}[slot];
  if(!segment||!side)throw Error('鎧パーツの関節分類が不正: '+slot+'/'+side);
  return `${segment}_${side}`;
}

function textureGeometry(geometry){
  if(geometry.attributes.uv)return geometry;
  // The external plate GLBs have positions, normals and vertex colors but no
  // UVs. Derive planar fabric/metal grain in the source asset coordinates.
  const g=geometry.clone(),position=g.getAttribute('position');
  const uv=new Float32Array(position.count*2);
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    uv[i*2]=(x*.80+y*.12);uv[i*2+1]=(z*.82+y*.14);
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  return g;
}

// Adds independent helmet, cuirass, pauldron, gauntlet, thigh, knee, greave
// and boot objects. They can be individually hidden/replaced by equipment slot.
export async function attachSegmentedArmor({root,dressed,sex,textures,characterModel=null,rarity='N',loadModel=loadArmor}){
  if(!root||!dressed)throw Error('鎧の人物ルートと骨格が必要です');
  const bones=boneMap(dressed),pelvis=bonePos(bones,'pelvis'),head=bonePos(bones,'head');
  // The stage is a child of root, so both its origin and scale must use
  // root-local units. A world-space pelvis reference double-scaled/shifted
  // armor when the actor was rotated or resized in battle.
  root.updateMatrixWorld(true);
  const pelvisLocal=root.worldToLocal(pelvis.clone()),headLocal=root.worldToLocal(head.clone());
  const scale=(headLocal.y-pelvisLocal.y)/(MODEL_ORIGIN_HEAD-MODEL_ORIGIN_PELVIS);
  if(!(scale>.12&&scale<.4))throw Error('鎧フィット率が異常: '+scale.toFixed(4));
  const stage=new THREE.Group();stage.name='plate-armor-coordinate-fit';
  stage.position.set(pelvisLocal.x,pelvisLocal.y-MODEL_ORIGIN_PELVIS*scale,pelvisLocal.z);
  // The plate source is Z-up with its visor and breastplate at source -Y.
  // The GLB's own -90 degree X rotation maps those surfaces to world +Z,
  // exactly where the Superhero's face points. A second 180 degree Y turn
  // wrongly placed the entire cuirass/visor on the wearer's back.
  stage.scale.setScalar(scale);
  root.add(stage);
  const resources=await Promise.all(segmentedArmorAssetPaths(sex).map(loadModel));
  resources.forEach((resource,i)=>stage.add(resource.scene.clone(true)));
  root.updateMatrixWorld(true);
  // Resolve the HEAD and SUIT source axes separately. GLBs may have different
  // Blender export rotations; translating them together cannot correct yaw.
  // The authored front direction is local -Y (Z-up source), while the
  // 65-bone actor faces its own +Z. Work in stage-local coordinates so this
  // also works when the actor/root is rotated in the battle scene.
  const partAxes={};
  for(let i=0;i<parts.length;i++){
    const source=stage.children[i];
    let firstMesh=null;
    source.traverse(node=>{if(!firstMesh&&node.isMesh)firstMesh=node});
    if(!firstMesh)continue;
    const worldToStage=stage.getWorldQuaternion(new THREE.Quaternion()).invert();
    const sourceFront=new THREE.Vector3(0,-1,0)
      .transformDirection(firstMesh.matrixWorld).applyQuaternion(worldToStage);
    const actorFront=new THREE.Vector3(0,0,1)
      .applyQuaternion(dressed.getWorldQuaternion(new THREE.Quaternion())).applyQuaternion(worldToStage);
    sourceFront.y=0;actorFront.y=0;
    if(sourceFront.lengthSq()<.04||actorFront.lengthSq()<.04){
      partAxes[parts[i]]={aligned:false,reason:'source axis not horizontal'};continue;
    }
    sourceFront.normalize();actorFront.normalize();
    const yaw=Math.atan2(sourceFront.z*actorFront.x-sourceFront.x*actorFront.z,
      sourceFront.dot(actorFront));
    // Rotate each GLB in the STAGE frame, not around its own Blender-Z-up axis.
    // No rotation is introduced when the two measured forward axes already agree.
    if(Math.abs(yaw)>.001){
      source.quaternion.premultiply(new THREE.Quaternion()
        .setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));
      root.updateMatrixWorld(true);
    }
    const correctedFront=new THREE.Vector3(0,-1,0)
      .transformDirection(firstMesh.matrixWorld).applyQuaternion(worldToStage);
    correctedFront.y=0;correctedFront.normalize();
    partAxes[parts[i]]={aligned:true,sourceYawCorrection:+yaw.toFixed(5),
      sourceForwardDot:+sourceFront.dot(actorFront).toFixed(5),
      forwardDot:+correctedFront.dot(actorFront).toFixed(5)};
  }
  // The head GLB was authored against a generic reference head. Fit its
  // true width/depth to the wearer's sampled scalp, retaining visor depth.
  const helmetSize=new THREE.Box3().setFromObject(stage.children[0]).getSize(new THREE.Vector3());
  const scalp=characterModel?measureHeadLocalBounds(characterModel):null;
  // Skin measurements are in HEAD-BONE local coordinates. The armor geometry
  // above is measured in world coordinates. Mixing those spaces made the
  // fitted helmet tiny for certain scaled seven-head bodies.
  const headWorldScale=bones.get('head').getWorldScale(new THREE.Vector3());
  const headWorldSize=scalp?scalp.dimensions.clone().multiply(headWorldScale):null;
  // Measure the *actual scalp centre*, not just the head bone pivot. On the
  // seven-head rig that pivot is not guaranteed to sit at the middle of the
  // cranium: an offset helmet exposed a bare crown even after size fitting.
  const scalpCenterWorld=scalp?bones.get('head').localToWorld(
    scalp.bounds.getCenter(new THREE.Vector3())):null;
  const helmetFit=headWorldSize?helmetFitForHead(headWorldSize,helmetSize):[1.32,1.17,1.34];

  const descriptors=[];
  let sourceTrouserLegMeshesSkipped=0,sourceBootShaftsSkipped=0;
  const boxes=new THREE.Box3(),center=new THREE.Vector3();
  // Cache actual 3D reference positions before classifying mesh sides.
  const thighLeft=bonePos(bones,'thigh_l'),thighRight=bonePos(bones,'thigh_r');
  for(let i=0;i<parts.length;i++){
    const part=parts[i],source=stage.children[i];
    source.traverse(o=>{
      if(!o.isMesh)return;
      const slot=classifyArmorMesh(part,o.name);
      if(slot==='skip'){
        if(part==='legs'&&isPlateSourceTrouserLeg(o.name))sourceTrouserLegMeshesSkipped++;
        if(part==='feet'&&/boot[_ -]+upper/i.test(o.name)&&!/folded|ridge|cuff/i.test(o.name))sourceBootShaftsSkipped++;
        return;
      }
      if(slot==='helmet'&&!helmetFaceguardPolicy(o.name).keep)return;
      boxes.setFromObject(o);boxes.getCenter(center);
      const side=['shoulder','gauntlet','thigh','knee','shin','boot-upper','boot-foot'].includes(slot)?
        nearestArmorLegSide(center,thighLeft,thighRight):null;
      descriptors.push({source:o,part,slot,side,center:center.clone(),matrix:o.matrixWorld.clone()});
    });
  }

  // Verify that each original leg has a corresponding plate / boot. Counts
  // alone previously passed even when BOTH source legs mapped to the left bone.
  const legSideCounts=Object.fromEntries(['thigh','knee','shin','boot-foot'].map(slot=>
    [slot,Object.fromEntries(['l','r'].map(side=>
      [side,descriptors.filter(d=>d.slot===slot&&d.side===side).length]))]));
  for(const [slot,counts] of Object.entries(legSideCounts)){
    if(!counts.l||!counts.r)throw Error('鎧の左右割当が不正: '+slot+' 左'+counts.l+' 右'+counts.r);
  }
  // Find the center of each original joint-sized assembly and move it, without
  // changing mesh dimensions, onto the corresponding skeleton landmark.
  const centers=new Map();
  for(const d of descriptors){const key=`${d.slot}/${d.side||''}`;let c=centers.get(key);
    if(!c)centers.set(key,c={sum:new THREE.Vector3(),n:0});
    c.sum.add(d.center);c.n++;
  }
  const offsetByKey=new Map();
  const bodyForward=new THREE.Vector3(0,0,1)
    .applyQuaternion(dressed.getWorldQuaternion(new THREE.Quaternion())).normalize();
  for(const [key,c] of centers){const [slot,side]=key.split('/');
    // Chest/hip source is already anatomically aligned to the pelvis; keep
    // its longitudinal relief rather than centering each separate ridge.
    const desired=slot==='helmet'&&scalpCenterWorld?
      scalpCenterWorld.clone().add(new THREE.Vector3(0,.028,0)).addScaledVector(bodyForward,.012):
      desiredAnchor(slot,side||null,bones);
    // Align all helmet metal to the measured facial-forward placement,
    // independently of the chest and regardless of actor yaw/scale.
    if(slot==='helmet')desired.addScaledVector(bodyForward,HELMET_BASE_FORWARD_OFFSET);
    const delta=desired.sub(c.sum.multiplyScalar(1/c.n));
    // Preserve the authored front/back depth. Centering the metal surfaces on
    // the bone Z-coordinate buried the breastplate, knee guards and visor
    // *inside* the body instead of sitting above its skin.
    // The source breastplate already protrudes in front of the tunic. An
    // extra 8%-wide expansion and zero Z recess made it look like a shield
    // floating over the swordsman's chest (user's v4.2.4 side screenshot).
    // The helmet alone follows the measured head depth as well as its X/Y
    // centre. Discarding its Z correction placed its nape and visor off the
    // head whenever a rig's skull sat forward of the chest axis.
    if(slot==='chest'){
      // Adjust along the actor's FORWARD direction, not world Z. This also
      // works if the whole actor faces sideways or backwards in battle.
      // Preserve 7.5 cm of source breastplate relief in front of the spine.
      const spine=bonePos(bones,'spine_03');
      const target=spine.addScaledVector(bodyForward,.075);
      const correction=THREE.MathUtils.clamp(
        target.sub(c.sum).dot(bodyForward)*.45,-.035,.035);
      delta.addScaledVector(bodyForward,correction-delta.dot(bodyForward));
    }else if(['thigh','knee','shin','boot-upper','boot-foot'].includes(slot)){
      // The old implementation erased ALL Z corrections for legs/boots.
      // In sideways poses that left the finished boots behind the fabric leg.
      // Place each piece on its genuine 3D joint, preserving at most a tiny
      // authored forward relief so the plate remains outside its underlayer.
      const relief=slot==='boot-foot'?.018:.012;
      // Apply the complete fore/aft correction. A fixed clamp in GLB source
      // units was smaller than the real offset and left the boot behind.
      delta.addScaledVector(bodyForward,relief);
    }else if(slot!=='helmet'){
      // Keep shoulder and hip original fore/aft relief (unchanged).
      delta.addScaledVector(bodyForward,-delta.dot(bodyForward));
    }
    offsetByKey.set(key,delta);
  }

  const created=[],materials=[];
  // Tonally lifted photographic steel is both albedo and grain; the original
  // darker steel remains the bump source. This avoids the earlier extremes of
  // matte black and smooth white plastic across fitted plate parts.
  const matMetal=new THREE.MeshPhysicalMaterial({map:textures.steel,
    bumpMap:textures['steel-grain']||textures.steel,bumpScale:.0014,
    color:0xd2dce5,metalness:.25,roughness:.45,clearcoat:.15,clearcoatRoughness:.40,side:THREE.DoubleSide});
  const matTrim=new THREE.MeshStandardMaterial({map:textures['gold-brocade'],bumpMap:textures['gold-brocade'],bumpScale:.001,
    color:0xf3dfb7,metalness:.64,roughness:.33,side:THREE.DoubleSide});
  const rank=normalizeOutfitRarity(rarity),finish=outfitRarityFinish(rank);
  const helmMetal=matMetal.clone();
  helmMetal.color.setHex(rank==='UR'?0xc9b5df:rank==='R'?0xb2d7ee:0xd2dce5);
  helmMetal.metalness=rank==='UR'?.53:rank==='R'?.43:.25;
  helmMetal.roughness=rank==='UR'?.25:rank==='R'?.33:.45;
  // Tint only the real rim meshes; no added visor bars or dangling pendants.
  const helmTrim=helmMetal.clone();
  helmTrim.color.setHex(finish.ornaments?finish.trim:0xc8d2df);
  materials.push(matMetal,matTrim,helmMetal,helmTrim);
  const inverseRoot=root.matrixWorld.clone().invert();
  const pivot=new THREE.Vector3(),expandMatrix=new THREE.Matrix4();
  const forward=new THREE.Matrix4(),backward=new THREE.Matrix4(),stretch=new THREE.Matrix4();
  for(const d of descriptors){
    const localMatrix=d.matrix.clone(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    const key=`${d.slot}/${d.side||''}`,offset=offsetByKey.get(key);
    localMatrix.setPosition(localMatrix.elements[12]+offset.x,localMatrix.elements[13]+offset.y,localMatrix.elements[14]+offset.z);
    pivot.copy(centers.get(key).sum).add(offset);
    const base=ARMOR_CLEARANCE[d.slot]||[1,1,1];
    const extra=d.slot==='helmet'?helmetFit:[1,1,1];
    forward.makeTranslation(pivot.x,pivot.y,pivot.z);
    backward.makeTranslation(-pivot.x,-pivot.y,-pivot.z);
    stretch.makeScale(base[0]*extra[0],base[1]*extra[1],base[2]*extra[2]);
    expandMatrix.copy(forward).multiply(stretch).multiply(backward);
    localMatrix.premultiply(expandMatrix);
    localMatrix.premultiply(inverseRoot);localMatrix.decompose(p,q,s);
    const geometry=textureGeometry(d.source.geometry),name=`armor-${d.slot}-${d.source.name}`;
    if(d.slot==='helmet'){
      const faceguard=helmetFaceguardPolicy(d.source.name);
      if(faceguard.verticalScale<1){
        const positions=geometry.getAttribute('position');
        const maxZ=new THREE.Box3().setFromBufferAttribute(positions).max.z;
        for(let i=0;i<positions.count;i++)positions.setZ(i,
          shortenedGuardZ(positions.getZ(i),maxZ,faceguard.verticalScale));
        positions.needsUpdate=true;
        geometry.computeVertexNormals();
      }
    }
    const originalMaterial=Array.isArray(d.source.material)?d.source.material[0]:d.source.material;
    const trim=/edge|binding|ridge|fastening|seam|facing|sole|welt/.test(d.source.name.toLowerCase())||/edge/.test(originalMaterial?.name||'');
    // The original brocade photograph looked like thick wooden strips on the
    // enlarged visor. Helmet fittings now share the polished steel finish;
    // the rank-specific metallic crest is created separately on the head bone.
    const mesh=new THREE.Mesh(geometry,d.slot==='helmet'?(trim?helmTrim:helmMetal):trim?matTrim:matMetal);
    mesh.name=name;mesh.position.copy(p);mesh.quaternion.copy(q);mesh.scale.copy(s);
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    mesh.userData={equipmentClass:'armor',equipmentSlot:d.slot,equipmentMaterial:trim?'metal-trim':'plate-steel',equipmentModel:d.part,ownsGeometry:geometry!==d.source.geometry};
    root.add(mesh);root.updateMatrixWorld(true);
    const anchor=bones.get(attachBoneName(d.slot,d.side));
    if(!anchor)throw Error('鎧の骨への取付に失敗: '+d.slot);
    anchor.attach(mesh);created.push(mesh);
  }
  root.remove(stage);
  // Independent non-destructive offsets. The heraldry appended later shares
  // the chest offset: it must not float away from the breastplate. All offsets
  // are applied in each attachment bone's local coordinates and follow motion.
  const depthOffsets={helmet:0,chest:0};
  const fitBases=new WeakMap();
  const fitForward=new THREE.Vector3(0,0,1).applyQuaternion(
    dressed.getWorldQuaternion(new THREE.Quaternion())).normalize();
  function setDepthOffsets(next={}){
    depthOffsets.helmet=THREE.MathUtils.clamp(Number(next.helmet)||0,-.12,.12);
    depthOffsets.chest=THREE.MathUtils.clamp(Number(next.chest)||0,-.12,.12);
    for(const piece of created){
      const slot=piece.userData?.equipmentSlot;
      const category=slot==='helmet'?'helmet':(['chest','chest-heraldry'].includes(slot)?'chest':null);
      if(!category||!piece.parent?.isBone)continue;
      if(!fitBases.has(piece)){
        // Convert one WORLD metre of actor-forward displacement into the
        // attachment bone's local space. Quaternion-only conversion ignored
        // parent/root scales (e.g. a 0.92x soldier moved just 4.6 mm when
        // the preview requested 5 mm).
        const parentOrigin=piece.parent.getWorldPosition(new THREE.Vector3());
        const forwardLocal=piece.parent.worldToLocal(parentOrigin.clone().add(fitForward))
          .sub(piece.parent.worldToLocal(parentOrigin.clone()));
        fitBases.set(piece,{position:piece.position.clone(),forwardLocal});
      }
      const base=fitBases.get(piece);
      piece.position.copy(base.position).addScaledVector(base.forwardLocal,depthOffsets[category]);
    }
    root.updateMatrixWorld(true);
    return {...depthOffsets};
  }
  root.userData.armor={variant:'plate',pieceCount:created.length,sourceTrouserLegMeshesSkipped,sourceBootShaftsSkipped,scale,slots:[...centers.keys()],helmetFit,partAxes,legSideCounts};
  return {objects:created,materials,setDepthOffsets,depthOffsets,
    diagnostics:{armorPieces:created.length,sourceTrouserLegMeshesSkipped,sourceBootShaftsSkipped,armorScale:scale,armorSlots:[...centers.keys()],helmetFit,legSideCounts,
      partAxes,alignmentDepth:Object.fromEntries([...offsetByKey].map(([key,value])=>[key,+value.z.toFixed(5)])),
      headWorldSize:headWorldSize?.toArray(),helmetSourceSize:helmetSize.toArray(),
      helmetTarget:scalpCenterWorld?.toArray(),helmetBaseForwardOffset:HELMET_BASE_FORWARD_OFFSET,
      clearanceProfile:'independent-forward-axis-v2'}};
}
