/**
 * Independent battlefield creatures and mounts, rendered as GPU instances.
 * Each species has an anatomically sculpted near LOD and a distant LOD.
 * Moving body parts (four legs, tail, dragon wings) are independent shared
 * meshes, not thousands of per-creature JS objects or a humanoid rig.
 */
import * as THREE from 'three';
import { COMBAT_OBJECT_SPECS } from './combat-action-spec.js';
import { buildCombatObjectGeometry, CREATURE_VISUAL_SPECS } from './combat-creature-geometry.js';
import {creatureInstancePhase,creatureFlightHeight,creatureSize,creatureAttackProgress} from './combat-creature-performance.js';

const MAX_PER_TYPE = 72;
const HIGH_DETAIL_DISTANCE = 25;
const morphMatrix=new THREE.Matrix4();
const translateMatrix=new THREE.Matrix4(),rotation=new THREE.Matrix4();

function localAnimationMatrix(type,part,time,seed,object,motion=0){
  morphMatrix.identity();
  const s=CREATURE_VISUAL_SPECS[type];
  if(!s||part==='core')return morphMatrix;
  const progress=creatureAttackProgress(object,time);
  const attackPulse=Math.sin(Math.PI*progress);
  const cryElapsed=time-(object.cryStartedAt??-100);
  const crying=cryElapsed>=0&&cryElapsed<1.3?Math.sin(Math.PI*cryElapsed/1.3):0;
  let pivot=null;
  if(part==='tail'){
    pivot=[0,s.height+.1,-s.length*.82];
    rotation.makeRotationY(Math.sin(time*2.5+seed)*.18+attackPulse*.35);
  }else if(part==='wingL'||part==='wingR'){
    const side=part==='wingL'?-1:1;
    pivot=[side*s.width*.71,s.height+.24,-s.length*.12];
    // Paired wing bones flap in mirrored directions around their shoulders.
    const flapRate=4.2+motion*4+(attackPulse*4);
    rotation.makeRotationZ(side*(.12+(.2+motion*.4)*Math.sin(time*flapRate+seed)+attackPulse*.35));
    return morphMatrix.makeTranslation(...pivot).multiply(rotation);
  }else if(part==='jaw'){
    let headY,headZ;
    if(type==='wolf'){headY=s.height+.31;headZ=s.length+.37;}
    else if(type==='horse'){headY=s.height+.79;headZ=s.length*1.07;}
    else {headY=s.height+(type==='wyvern'?.52:.81);headZ=s.length*1.32;}
    pivot=[0,headY-.18,headZ+.08];
    rotation.makeRotationX(attackPulse*(type==='wolf'?.65:.48)+crying*.32);
  }else if(part.startsWith('leg')){
    const front=part.includes('Front'),side=part.endsWith('L')?-1:1;
    const z=(front?.64:-.68)*s.length;
    pivot=[side*s.width*.72,s.legs*.87,z];
    const diagonal=(front?1:-1)*side;
    const gait=type==='horse'?8.5:type==='wolf'?7:5.5;
    rotation.makeRotationX(Math.sin(time*gait+seed+diagonal*Math.PI/2)*(.025+motion*.42)+
      (type==='horse'&&front?attackPulse*.62:0));
  }
  if(!pivot)return morphMatrix;
  return morphMatrix.makeTranslation(...pivot).multiply(rotation).multiply(translateMatrix.makeTranslation(...pivot.map(v=>-v)));
}

function createHideTexture(){
  // Shared deterministic micro-grain adds material detail without external
  // downloads or per-creature textures. One 128px atlas is reused by all.
  const width=128,data=new Uint8Array(width*width*4);
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    let hash=Math.imul(x+137,374761393)+Math.imul(y+419,668265263);
    hash=Math.imul(hash^(hash>>>13),1274126177);
    const speckle=(hash>>>24)/255,shade=216+Math.round(speckle*34)+Math.round(5*Math.sin(x*.24+y*.31));
    const index=(y*width+x)*4;
    data[index]=shade;data[index+1]=shade;data[index+2]=shade;data[index+3]=255;
  }
  const texture=new THREE.DataTexture(data,width,width,THREE.RGBAFormat);
  texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;
  texture.needsUpdate=true;
  return texture;
}

/**
 * @param {THREE.Scene} scene
 * @param {object} options
 * @param {THREE.Camera=} options.camera - enables distance-based LOD
 */
export function createCombatWorldObjectRenderer(scene,{cellSize=1.12,offset=6,terrainY=()=>0,camera=null,highDetailDistance=HIGH_DETAIL_DISTANCE}={}){
  const types=Object.keys(COMBAT_OBJECT_SPECS);
  const species=new Map();
  // Renderer-only interpolation and gait history; gameplay keeps integer tiles.
  const locomotion=new Map();
  const hideTexture=createHideTexture();
  const material=new THREE.MeshStandardMaterial({vertexColors:true,map:hideTexture,roughness:.69,metalness:.075,side:THREE.DoubleSide});
  const distantMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.81,metalness:.02,side:THREE.DoubleSide});
  for(const type of types){
    const lods={};
    for(const detail of ['high','low']){
      const geometryParts=buildCombatObjectGeometry(type,{detail});
      const meshes=new Map();
      for(const [part,geometry] of Object.entries(geometryParts)){
        const mesh=new THREE.InstancedMesh(geometry,detail==='high'?material:distantMaterial,MAX_PER_TYPE);
        mesh.name=`CombatWorldObject_${type}_${detail}_${part}`;
        mesh.count=0;mesh.visible=false;
        // Culling an InstancedMesh uses its original bounds, not instance offsets.
        mesh.frustumCulled=false;
        mesh.castShadow=true;mesh.receiveShadow=true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        meshes.set(part,mesh);scene.add(mesh);
      }
      lods[detail]={meshes,count:0};
    }
    species.set(type,lods);
  }
  const base=new THREE.Object3D(),world=new THREE.Matrix4();
  const counts={};
  function sync(objects,time=0,units=null){
    for(const [type,lods] of species){
      counts[type]=0;
      lods.high.count=0;lods.low.count=0;
    }
    for(const o of objects){
      if(!o.alive||!species.has(o.type)||counts[o.type]>=MAX_PER_TYPE)continue;
      const rider=o.mountedBy!=null&&units?
        (units[o.mountedBy]?.id===o.mountedBy?units[o.mountedBy]:units.find(u=>u.id===o.mountedBy)):null;
      const x=rider?.x??o.x,z=rider?.z??o.z;
      let motion=locomotion.get(o.id);
      if(!motion){motion={cellX:x,cellZ:z,fromX:x,fromZ:z,toX:x,toZ:z,at:time,duration:.3,activity:0};locomotion.set(o.id,motion);}
      if(x!==motion.cellX||z!==motion.cellZ){
        const t=Math.min(1,Math.max(0,(time-motion.at)/motion.duration));
        const e=t*t*(3-2*t);
        motion.fromX=motion.fromX+(motion.toX-motion.fromX)*e;
        motion.fromZ=motion.fromZ+(motion.toZ-motion.fromZ)*e;
        motion.toX=x;motion.toZ=z;motion.cellX=x;motion.cellZ=z;
        motion.at=time;motion.duration=Math.min(.52,Math.max(.16,.9/(o.spec?.speed||3)));
      }
      const ratio=Math.min(1,Math.max(0,(time-motion.at)/motion.duration));
      const easing=ratio*ratio*(3-2*ratio);
      const travel=rider?{x,z}:{x:motion.fromX+(motion.toX-motion.fromX)*easing,
        z:motion.fromZ+(motion.toZ-motion.fromZ)*easing};
      motion.activity=rider?Number(Math.hypot(x-motion.fromX,z-motion.fromZ)>.05):
        Math.min(1,Math.max(0,(1-ratio)*1.25));
      const px=(travel.x-offset)*cellSize,pz=(travel.z-offset)*cellSize;
      const seed=creatureInstancePhase(o.id),spec=CREATURE_VISUAL_SPECS[o.type];
      const scale=creatureSize(o.type,o.mountedBy!=null);
      const attackPulse=Math.sin(Math.PI*creatureAttackProgress(o,time));
      const bounce=creatureFlightHeight(o,time)+(o.flying?0:.018*motion.activity*Math.sin(time*12+seed));
      base.position.set(px,terrainY(px,pz)+bounce,pz);
      base.position.z+=attackPulse*(o.type==='wolf'?.30:.12);
      if(o.type==='horse')base.position.y+=attackPulse*.14;
      const target=o.attackTarget,hasTarget=attackPulse>0&&target;
      const riderFacing=rider?.root?.rotation?.y ??
        (Number.isFinite(rider?.facingX)&&Number.isFinite(rider?.facingZ)&&
        Math.abs(rider.facingX)+Math.abs(rider.facingZ)>0?
        Math.atan2(rider.facingX,rider.facingZ):null);
      const movingFace=motion.activity>.1&&Math.hypot(motion.toX-motion.fromX,motion.toZ-motion.fromZ)>.05?
        Math.atan2(motion.toX-motion.fromX,motion.toZ-motion.fromZ):null;
      const facing=hasTarget?Math.atan2((target.x-x)*cellSize,(target.z-z)*cellSize):
        movingFace??
        riderFacing??((o.team===0?Math.PI/2:-Math.PI/2)+Math.sin(time*.6+seed)*.055);
      base.rotation.set(-attackPulse*(o.type==='horse'?.22:o.type==='wolf'?.13:.08)+
        (o.flying?.05*motion.activity*Math.sin(time*3.4+seed):0),facing,
        o.flying?.045*motion.activity*Math.sin(time*2.6+seed):0);
      const breathe=1+.018*Math.sin(time*2+seed);
      base.scale.set(scale*breathe,scale,scale*breathe);
      base.updateMatrix();
      const distance=camera?camera.position.distanceTo(base.position):0;
      const detail=distance<highDetailDistance*scale?'high':'low';
      const lod=species.get(o.type)[detail],slot=lod.count++;
      counts[o.type]++;
      for(const [part,mesh] of lod.meshes){
        // Each part shares the same base instance transform and ID slot.
        if(spec&&part!=='core')world.copy(base.matrix).multiply(localAnimationMatrix(o.type,part,time,seed,o,motion.activity));
        else world.copy(base.matrix);
        mesh.setMatrixAt(slot,world);
      }
    }
    for(const lods of species.values())for(const lod of Object.values(lods)){
      for(const mesh of lod.meshes.values()){
        mesh.count=lod.count;
        mesh.visible=lod.count>0;
        if(lod.count)mesh.instanceMatrix.needsUpdate=true;
      }
    }
    // Keep history bounded even when summons expire or are replaced.
    if(locomotion.size>objects.length+24){const aliveIds=new Set(objects.filter(o=>o.alive).map(o=>o.id));
      for(const id of locomotion.keys())if(!aliveIds.has(id))locomotion.delete(id);}
  }
  function dispose(){
    locomotion.clear();
    for(const lods of species.values())for(const lod of Object.values(lods))for(const mesh of lod.meshes.values()){
      scene.remove(mesh);mesh.geometry.dispose();
    }
    material.dispose();distantMaterial.dispose();hideTexture.dispose();
  }
  return {
    sync,dispose,
    stats:()=>Object.fromEntries(types.map(type=>[type,counts[type]??0])),
    detailStats:()=>Object.fromEntries(types.map(type=>[type,{
      high:species.get(type).high.count,low:species.get(type).low.count,
    }])),
  };
}
