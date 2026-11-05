// Real modular platemail GLBs, fitted once to the reference 65-bone skeleton.
// Every metal piece is a separate object rigidly attached to the appropriate
// joint: there is no vertex-weight stretching, barrel-shaped torso, or torn
// cloth mesh where elbows and knees bend.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {measureHeadLocalBounds} from './hair-attachment-runtime.js';

const loader=new GLTFLoader();
const cache=new Map();
const MODEL_ORIGIN_PELVIS=4.10;
const MODEL_ORIGIN_HEAD=7.64;
const parts=['head','chest','hands','legs','feet'];
// Clearance is measured from each anatomical slice, not a giant uniform
// character scale. A few percent of radial relief prevents deep penetration
// while keeping seams, joint anchors and armor proportions intact.
export const ARMOR_CLEARANCE=Object.freeze({
 helmet:[1.06,1.08,1.08],chest:[1.005,.985,1.025],
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

function classifyMesh(part,name){
  const n=name.toLowerCase();
  if(part==='head')return 'helmet';
  if(part==='chest')return /pauldron|sleeve|cuff|shoulder/.test(n)?'shoulder':'chest';
  if(part==='hands')return 'gauntlet';
  if(part==='feet')return /upper|cuff|ridge/.test(n)?'boot-upper':'boot-foot';
  if(/trouser_leg/.test(n))return 'skip';
  if(/pelvis|waist/.test(n))return 'hip';
  if(/thigh/.test(n))return 'thigh';
  if(/knee/.test(n))return 'knee';
  if(/shin/.test(n))return 'shin';
  return 'hip';
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
export async function attachSegmentedArmor({root,dressed,sex,textures,characterModel=null,quality='preview',loadModel=loadArmor}){
  if(!root||!dressed)throw Error('鎧の人物ルートと骨格が必要です');
  const bones=boneMap(dressed),pelvis=bonePos(bones,'pelvis'),head=bonePos(bones,'head');
  const scale=(head.y-pelvis.y)/(MODEL_ORIGIN_HEAD-MODEL_ORIGIN_PELVIS);
  if(!(scale>.12&&scale<.4))throw Error('鎧フィット率が異常: '+scale.toFixed(4));
  const stage=new THREE.Group();stage.name='plate-armor-coordinate-fit';
  stage.position.set(pelvis.x,pelvis.y-MODEL_ORIGIN_PELVIS*scale,pelvis.z);
  // The plate source is Z-up with its visor and breastplate at source -Y.
  // The GLB's own -90 degree X rotation maps those surfaces to world +Z,
  // exactly where the Superhero's face points. A second 180 degree Y turn
  // wrongly placed the entire cuirass/visor on the wearer's back.
  stage.scale.setScalar(scale);
  root.add(stage);
  const resources=await Promise.all(segmentedArmorAssetPaths(sex).map(loadModel));
  resources.forEach((resource,i)=>stage.add(resource.scene.clone(true)));
  root.updateMatrixWorld(true);
  // The head GLB was authored against a generic reference head. Fit its
  // true width/depth to the wearer's sampled scalp, retaining visor depth.
  const helmetSize=new THREE.Box3().setFromObject(stage.children[0]).getSize(new THREE.Vector3());
  const scalp=characterModel?measureHeadLocalBounds(characterModel).dimensions:null;
  const helmetFit=scalp?[
    THREE.MathUtils.clamp(scalp.x*1.26/Math.max(.01,helmetSize.x),1.02,1.55),
    THREE.MathUtils.clamp(scalp.y*.89/Math.max(.01,helmetSize.y),1.04,1.28),
    THREE.MathUtils.clamp(scalp.z*1.28/Math.max(.01,helmetSize.z),1.02,1.55)
  ]:[1.09,1.08,1.1];

  const descriptors=[];
  const boxes=new THREE.Box3(),center=new THREE.Vector3();
  for(let i=0;i<parts.length;i++){
    const part=parts[i],source=stage.children[i];
    source.traverse(o=>{
      if(!o.isMesh)return;
      const slot=classifyMesh(part,o.name);
      if(slot==='skip')return;
      boxes.setFromObject(o);boxes.getCenter(center);
      const side=['shoulder','gauntlet','thigh','knee','shin','boot-upper','boot-foot'].includes(slot)?
        (Math.abs(center.x-bonePos(bones,'thigh_l').x)<Math.abs(center.x-bonePos(bones,'thigh_r').x)?'l':'r'):null;
      descriptors.push({source:o,part,slot,side,center:center.clone(),matrix:o.matrixWorld.clone()});
    });
  }

  // Find the center of each original joint-sized assembly and move it, without
  // changing mesh dimensions, onto the corresponding skeleton landmark.
  const centers=new Map();
  for(const d of descriptors){const key=`${d.slot}/${d.side||''}`;let c=centers.get(key);
    if(!c)centers.set(key,c={sum:new THREE.Vector3(),n:0});
    c.sum.add(d.center);c.n++;
  }
  const offsetByKey=new Map();
  for(const [key,c] of centers){const [slot,side]=key.split('/');
    // Chest/hip source is already anatomically aligned to the pelvis; keep
    // its longitudinal relief rather than centering each separate ridge.
    const desired=desiredAnchor(slot,side||null,bones);
    const delta=desired.sub(c.sum.multiplyScalar(1/c.n));
    // Preserve the authored front/back depth. Centering the metal surfaces on
    // the bone Z-coordinate buried the breastplate, knee guards and visor
    // *inside* the body instead of sitting above its skin.
    // The source breastplate already protrudes in front of the tunic. An
    // extra 8%-wide expansion and zero Z recess made it look like a shield
    // floating over the swordsman's chest (user's v4.2.4 side screenshot).
    delta.z=slot==='helmet'?.015:slot==='chest'?-.012:0;
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
  materials.push(matMetal,matTrim);
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
    const originalMaterial=Array.isArray(d.source.material)?d.source.material[0]:d.source.material;
    const trim=/edge|binding|ridge|fastening|seam|facing|sole|welt/.test(d.source.name.toLowerCase())||/edge/.test(originalMaterial?.name||'');
    const mesh=new THREE.Mesh(geometry,trim?matTrim:matMetal);
    mesh.name=name;mesh.position.copy(p);mesh.quaternion.copy(q);mesh.scale.copy(s);
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    mesh.userData={equipmentClass:'armor',equipmentSlot:d.slot,equipmentMaterial:trim?'metal-trim':'plate-steel',equipmentModel:d.part};
    root.add(mesh);root.updateMatrixWorld(true);
    const anchor=bones.get(attachBoneName(d.slot,d.side));
    if(!anchor)throw Error('鎧の骨への取付に失敗: '+d.slot);
    anchor.attach(mesh);created.push(mesh);
  }
  // The imported metal mitts have no articulated fingers. On closeups they
  // read as buckets with exposed flesh protruding horizontally, even when
  // bone-to-hilt contact numerically passes. Give each proximal/distal joint
  // a thin, photo-grained leather glove sleeve which really follows the
  // 65-bone finger curl. Omit these tiny parts in mass battle instances.
  if(quality==='preview'){
    const glove=new THREE.MeshStandardMaterial({
      map:textures.leather||null,bumpMap:textures.leather||null,bumpScale:.0008,
      color:0x69717a,metalness:.08,roughness:.77,side:THREE.DoubleSide
    });
    materials.push(glove);
    const up=new THREE.Vector3(0,1,0);
    for(const side of ['l','r'])for(const finger of ['thumb','index','middle','ring','pinky']){
      const radius=finger==='thumb'?.0105:finger==='pinky'?.0078:.0092;
      for(let segment=1;segment<=3;segment++){
        const bone=bones.get(`${finger}_0${segment}_${side}`);
        const next=bones.get(`${finger}_0${segment+1}${segment===3?'_leaf':''}_${side}`);
        if(!bone||!next)continue;
        const delta=next.position.clone(),length=delta.length();
        if(length<.010||length>.080)continue;
        const mesh=new THREE.Mesh(new THREE.CylinderGeometry(
          radius*.83,radius,length*.91,10,3,true),glove);
        mesh.name=`articulated-glove-${side}-${finger}-${segment}`;
        mesh.position.copy(delta).multiplyScalar(.5);
        mesh.quaternion.setFromUnitVectors(up,delta.normalize());
        mesh.castShadow=true;mesh.receiveShadow=true;
        mesh.userData={equipmentClass:'armor',equipmentSlot:'gauntlet',equipmentMaterial:'leather-finger-glove'};
        bone.add(mesh);created.push(mesh);
      }
    }
  }
  root.remove(stage);
  const fingerGloveSegments=created.filter(piece=>piece.name.startsWith('articulated-glove-')).length;
  root.userData.armor={variant:'plate',pieceCount:created.length,scale,slots:[...centers.keys()],helmetFit,fingerGloveSegments};
  return {objects:created,materials,diagnostics:{armorPieces:created.length,armorScale:scale,armorSlots:[...centers.keys()],helmetFit,fingerGloveSegments,clearanceProfile:'anatomical-v2'}};
}
