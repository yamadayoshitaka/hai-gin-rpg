// Real modular platemail GLBs, fitted once to the reference 65-bone skeleton.
// Every metal piece is a separate object rigidly attached to the appropriate
// joint: there is no vertex-weight stretching, barrel-shaped torso, or torn
// cloth mesh where elbows and knees bend.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const loader=new GLTFLoader();
const cache=new Map();
const MODEL_ORIGIN_PELVIS=4.10;
const MODEL_ORIGIN_HEAD=7.64;
const parts=['head','chest','hands','legs','feet'];

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
    case 'gauntlet':return bonePos(bones,`hand${suffix}`);
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
export async function attachSegmentedArmor({root,dressed,sex,textures,loadModel=loadArmor}){
  if(!root||!dressed)throw Error('鎧の人物ルートと骨格が必要です');
  const bones=boneMap(dressed),pelvis=bonePos(bones,'pelvis'),head=bonePos(bones,'head');
  const scale=(head.y-pelvis.y)/(MODEL_ORIGIN_HEAD-MODEL_ORIGIN_PELVIS);
  if(!(scale>.12&&scale<.4))throw Error('鎧フィット率が異常: '+scale.toFixed(4));
  const stage=new THREE.Group();stage.name='plate-armor-coordinate-fit';
  stage.position.set(pelvis.x,pelvis.y-MODEL_ORIGIN_PELVIS*scale,pelvis.z);
  stage.scale.setScalar(scale);stage.rotation.y=Math.PI;
  root.add(stage);
  const resources=await Promise.all(segmentedArmorAssetPaths(sex).map(loadModel));
  resources.forEach((resource,i)=>stage.add(resource.scene.clone(true)));
  root.updateMatrixWorld(true);

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
    delta.z=0;
    offsetByKey.set(key,delta);
  }

  const created=[],materials=[];
  // The preview has no HDR reflection environment. Fully metallic dark photo
  // albedo previously looked pitch black: use a luminous steel base tone while
  // preserving the photographed scratches as a true micro-bump layer.
  const matMetal=new THREE.MeshPhysicalMaterial({bumpMap:textures.steel,bumpScale:.0024,
    color:0xaebcc7,metalness:.38,roughness:.34,clearcoat:.42,clearcoatRoughness:.26,side:THREE.DoubleSide});
  const matTrim=new THREE.MeshStandardMaterial({map:textures['gold-brocade'],bumpMap:textures['gold-brocade'],bumpScale:.001,
    color:0xf3dfb7,metalness:.64,roughness:.33,side:THREE.DoubleSide});
  materials.push(matMetal,matTrim);
  const inverseRoot=root.matrixWorld.clone().invert();
  for(const d of descriptors){
    const localMatrix=d.matrix.clone(),p=new THREE.Vector3(),q=new THREE.Quaternion(),s=new THREE.Vector3();
    const offset=offsetByKey.get(`${d.slot}/${d.side||''}`);
    localMatrix.setPosition(localMatrix.elements[12]+offset.x,localMatrix.elements[13]+offset.y,localMatrix.elements[14]+offset.z);
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
  root.remove(stage);
  root.userData.armor={variant:'plate',pieceCount:created.length,scale,slots:[...centers.keys()]};
  return {objects:created,materials,diagnostics:{armorPieces:created.length,armorScale:scale,armorSlots:[...centers.keys()]}};
}
