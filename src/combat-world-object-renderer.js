/**
 * Independent battlefield creatures and mounts, rendered as GPU instances.
 * Each species has an anatomically sculpted near LOD and a distant LOD.
 * Moving body parts (four legs, tail, dragon wings) are independent shared
 * meshes, not thousands of per-creature JS objects or a humanoid rig.
 */
import * as THREE from 'three';
import { COMBAT_OBJECT_SPECS } from './combat-action-spec.js?v=4.4.74';
import { buildCombatObjectGeometry, CREATURE_VISUAL_SPECS } from './combat-creature-geometry.js?v=4.4.74';
import {creatureInstancePhase,creatureFlightHeight,creatureSize,creatureAttackProgress} from './combat-creature-performance.js?v=4.4.74';
import {createCreatureLocomotion,advanceCreatureLocomotion,creatureLegSwing} from './combat-creature-locomotion.js?v=4.4.59';
import {createCreatureFootfallFx} from './combat-creature-footfall-fx.js?v=4.4.23';

const MAX_PER_TYPE = 72;
const HIGH_DETAIL_DISTANCE = 25;
// Tiny compressed, photorealistic albedo tiles. A single texture is
// shared by every high-LOD instance of a species; the procedural DataTexture
// remains available while a photo loads or when the browser is offline.
const SPECIES_PHOTO_COATS = Object.freeze({
  horse:'../assets/creatures/horse-coat-albedo-v1.webp',
  wolf:'../assets/creatures/wolf-fur-albedo-v1.webp',
  wyvern:'../assets/creatures/dragon-scales-albedo-v1.webp',
  dragon:'../assets/creatures/dragon-scales-albedo-v1.webp',
  elder_dragon:'../assets/creatures/dragon-scales-albedo-v1.webp',
  dragon_lord:'../assets/creatures/dragon-scales-albedo-v1.webp',
});
const morphMatrix=new THREE.Matrix4();
const translateMatrix=new THREE.Matrix4(),rotation=new THREE.Matrix4();

function createSharedPhotoTextures(){
  // Wyvern/dragon/elder dragon use the same two GPU textures, not six copies.
  const cache=new Map();
  const loader=typeof document==='undefined'?null:new THREE.TextureLoader();
  const get=(path,repeat,srgb,onReady)=>{
    if(!loader)return null;
    let entry=cache.get(path);
    if(!entry){
      entry={ready:false,failed:false,listeners:[],texture:null};
      cache.set(path,entry);
      const texture=loader.load(new URL(path,import.meta.url).href,loaded=>{
        entry.ready=true;
        for(const listener of entry.listeners)listener(loaded);
        entry.listeners.length=0;
      },undefined,()=>{entry.failed=true;entry.listeners.length=0;});
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.repeat.set(repeat,repeat);
      texture.anisotropy=4;
      if(srgb)texture.colorSpace=THREE.SRGBColorSpace;
      entry.texture=texture;
    }
    if(entry.ready)onReady(entry.texture);
    else if(!entry.failed)entry.listeners.push(onReady);
    return entry.texture;
  };
  const dispose=()=>{
    for(const entry of cache.values()){
      entry.listeners.length=0;
      entry.texture?.dispose();
    }
    cache.clear();
  };
  return {get,dispose};
}

function localAnimationMatrix(type,part,time,seed,object,motion=0,gaitPhase=0,actionTime=time){
  morphMatrix.identity();
  const s=CREATURE_VISUAL_SPECS[type];
  if(!s||part==='core')return morphMatrix;
  const progress=creatureAttackProgress(object,actionTime);
  const attackPulse=Math.sin(Math.PI*progress);
  const cryElapsed=actionTime-(object.cryStartedAt??-100);
  const crying=cryElapsed>=0&&cryElapsed<1.3?Math.sin(Math.PI*cryElapsed/1.3):0;
  let pivot=null;
  if(part==='tail'){
    pivot=type==='dragon_lord'?[0,1.52,-.58]:[0,s.height+.1,-s.length*.82];
    rotation.makeRotationY(Math.sin(time*2.5+seed)*.18+attackPulse*.35);
  }else if(part==='wingL'||part==='wingR'){
    const side=part==='wingL'?-1:1;
    pivot=[side*s.width*.71,s.height+.24,-s.length*.12];
    if(type==='seraph_guardian'){
      pivot=[side*.305,1.72,-.18];
      rotation.makeRotationZ(side*(.12+.22*Math.sin(time*3+seed)+attackPulse*.16));
      rotation.multiply(translateMatrix.makeRotationX(.08*Math.sin(time*2.5+seed)));
      return morphMatrix.makeTranslation(...pivot).multiply(rotation);
    }
    // Stable wing-beat phase avoids stuttering when flight speed changes.
    const flapPhase=time*5.4+seed;
    rotation.makeRotationZ(side*(.12+(.25+motion*.42)*Math.sin(flapPhase)+attackPulse*.32));
    rotation.multiply(translateMatrix.makeRotationX(.09*Math.sin(flapPhase-.6)+attackPulse*.12));
    return morphMatrix.makeTranslation(...pivot).multiply(rotation);
  }else if(part==='jaw'){
    let headY,headZ;
    if(type==='wolf'){headY=s.height+.31;headZ=s.length+.37;}
    else if(type==='horse'){headY=s.height+.79;headZ=s.length*1.07;}
    else if(type==='dragon_lord'){headY=3.72;headZ=.92;}
    else {headY=s.height+(type==='wyvern'?.52:.81);headZ=s.length*1.32;}
    pivot=type==='dragon_lord'?[0,headY-.26,headZ-.10]:[0,headY-.18,headZ+.08];
    rotation.makeRotationX(attackPulse*(type==='wolf'?.65:.48)+crying*.32);
  }else if((part==='armL'||part==='armR')&&['dragon_lord','forest_archer','seraph_guardian'].includes(type)){
    const side=part==='armL'?-1:1;
    if(type==='dragon_lord'){
      pivot=[side*.66,2.70,.24];
      rotation.makeRotationX(Math.sin(time*(2.1+motion*3)+seed+side)*(.045+motion*.16)-attackPulse*.36);
    }else{
      pivot=[side*.33,1.84,.03];
      const rest=type==='seraph_guardian'?-0.36:-0.14;
      rotation.makeRotationX(rest+Math.sin(time*2.2+seed+side)*(.02+motion*.10)-attackPulse*(type==='forest_archer'?.48:.63));
      rotation.multiply(translateMatrix.makeRotationZ(side*attackPulse*(type==='forest_archer'?.22:.34)));
    }
  }else if(part.startsWith('leg')){
    const front=part.includes('Front'),side=part.endsWith('L')?-1:1;
    const z=(front?.64:-.68)*s.length;
    pivot=type==='dragon_lord'?[side*.48,1.50,-.17]:
      ['forest_archer','seraph_guardian'].includes(type)?[side*.16,1.03,-.045]:[side*s.width*.72,s.legs*.87,z];
    // Hooves transition from trot to gallop using the actual travelled
    // distance; airborne claws retain a subtler, independent leg pose.
    const airborne=!!object.flying;
    const phase=airborne?time*5.5:gaitPhase;
    const legSwing=(type==='dragon_lord'||type==='forest_archer'||type==='seraph_guardian')?Math.sin(phase+seed-side*Math.PI/2)*
      (airborne?.10+motion*.14:motion*.54):
      creatureLegSwing(type,front,side,phase+seed,motion,{flying:airborne});
    rotation.makeRotationX(legSwing+
      (type==='horse'&&front?attackPulse*.62:0));
  }
  if(!pivot)return morphMatrix;
  return morphMatrix.makeTranslation(...pivot).multiply(rotation).multiply(translateMatrix.makeTranslation(...pivot.map(v=>-v)));
}

function createSpeciesCoat(type,photos){
  // Distinct surface directions: wolf fur, horse coat, and raised dragon scales.
  // The materials are shared across all GPU instances of the same species.
  const width=256,heights=new Float32Array(width*width),pixels=new Uint8Array(width*width*4);
  const normals=new Uint8Array(width*width*4);
  const isFur=type==='wolf',isHorse=type==='horse';
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    let hash=Math.imul(x+137,374761393)+Math.imul(y+419,668265263);
    hash=Math.imul(hash^(hash>>>13),1274126177);
    const grain=(hash>>>24)/255-.5;
    const follicle=Math.cos(x*(isFur ? .55 : isHorse ? .28 : .19)+Math.sin(y*.11)*1.8);
    const coat=isFur?follicle*5+grain*22:
      isHorse?follicle*2.8+grain*10+7*Math.sin(x*.025+y*.044)*Math.cos(y*.041):
      9*Math.cos(x*.21+y*.11)*Math.sin(y*.35)+grain*14;
    heights[y*width+x]=coat;
    const shade=Math.max(180,Math.min(255,235+coat));
    const i=(y*width+x)*4;
    pixels[i]=shade;pixels[i+1]=shade;pixels[i+2]=shade;pixels[i+3]=255;
  }
  for(let y=0;y<width;y++)for(let x=0;x<width;x++){
    const left=heights[y*width+(x+width-1)%width],right=heights[y*width+(x+1)%width];
    const up=heights[((y+width-1)%width)*width+x],down=heights[((y+1)%width)*width+x];
    const scale=isFur?1.85:isHorse?1.25:1.35;
    const normal=new THREE.Vector3((left-right)*scale,(up-down)*scale,44).normalize();
    const i=(y*width+x)*4;
    normals[i]=128+Math.round(normal.x*127);normals[i+1]=128+Math.round(normal.y*127);
    normals[i+2]=128+Math.round(normal.z*127);normals[i+3]=255;
  }
  const texture=(data,srgb)=>{
    const result=new THREE.DataTexture(data,width,width,THREE.RGBAFormat);
    result.wrapS=THREE.RepeatWrapping;result.wrapT=THREE.RepeatWrapping;
    result.anisotropy=2;if(srgb)result.colorSpace=THREE.SRGBColorSpace;
    result.needsUpdate=true;return result;
  };
  const map=texture(pixels,true),normalMap=texture(normals,false);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,map,normalMap,
    normalScale:new THREE.Vector2(isFur ? .28 : isHorse ? .18 : .36,isFur ? .28 : isHorse ? .18 : .36),
    roughness:isFur ? .93 : isHorse ? .83 : .71,metalness:0,
    side:THREE.DoubleSide});
  const coat={material,map,normalMap,disposed:false};
  // TextureLoader needs an Image element, so geometry-only Node tests keep the
  // deterministic procedural material. Failed image requests keep it too.
  if(SPECIES_PHOTO_COATS[type]){
    const path=SPECIES_PHOTO_COATS[type];
    const repeat=isFur?1.9:isHorse?1.7:1.3;
    photos.get(path,repeat,true,loaded=>{
      if(coat.disposed)return;
      material.map=loaded;
      material.needsUpdate=true;
    });
    const normalPath=path.replace('-albedo-v1.webp','-normal-v1.webp');
    photos.get(normalPath,repeat,false,loaded=>{
      if(coat.disposed)return;
      material.normalMap=loaded;
      material.needsUpdate=true;
    });
  }
  return coat;
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
  const footfalls=createCreatureFootfallFx(scene,{camera});
  const photos=createSharedPhotoTextures();
  const coats=new Map(types.filter(type=>CREATURE_VISUAL_SPECS[type]&&!['forest_archer','seraph_guardian'].includes(type)).map(type=>[type,createSpeciesCoat(type,photos)]));
  // The cornea is a separate instanced surface: fur/scale normal maps must
  // never cover pupils or create furry, button-shaped cartoon highlights.
  const eyeMaterial=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.12,
    metalness:0,ior:1.38,clearcoat:1,clearcoatRoughness:.055,side:THREE.DoubleSide});
  // Armour and leather must not inherit horsehair or dragon-scale normals.
  const humanoidMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:0,side:THREE.DoubleSide});
  const equipmentMaterial=new THREE.MeshStandardMaterial({vertexColors:true,
    roughness:.50,metalness:.27,side:THREE.DoubleSide});
  const distantMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.81,metalness:.02,side:THREE.DoubleSide});
  for(const type of types){
    const lods={};
    for(const detail of ['high','low']){
      const geometryParts=buildCombatObjectGeometry(type,{detail});
      const meshes=new Map();
      for(const [part,geometry] of Object.entries(geometryParts)){
        const surface=part==='eyes'?eyeMaterial:part==='equipment'?equipmentMaterial:
          (['forest_archer','seraph_guardian'].includes(type)?humanoidMaterial:
           (detail==='high'?(coats.get(type)?.material??distantMaterial):distantMaterial));
        const mesh=new THREE.InstancedMesh(geometry,surface,MAX_PER_TYPE);
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
  const ordinaryHorseColor=new THREE.Color(1,1,1);
  const commanderHorseColor=new THREE.Color(1.3,1.10,.72);
  const counts={};
  function sync(objects,time=0,units=null,actionTime=time){
    for(const [type,lods] of species){
      counts[type]=0;
      lods.high.count=0;lods.low.count=0;
    }
    for(const o of objects){
      if(!o.alive||!species.has(o.type)||counts[o.type]>=MAX_PER_TYPE)continue;
      const rider=o.mountedBy!=null&&units?
        (units[o.mountedBy]?.id===o.mountedBy?units[o.mountedBy]:units.find(u=>u.id===o.mountedBy)):null;
      // Skirmish riders have a continuously interpolated Three.js root. Match
      // it directly so a mount cannot lag behind its seated soldier.
      const riderWorld=rider?.root?.position;
      const x=riderWorld?offset+riderWorld.x/cellSize:rider?.x??o.x;
      const z=riderWorld?offset+riderWorld.z/cellSize:rider?.z??o.z;
      let motion=locomotion.get(o.id);
      if(!motion){motion=createCreatureLocomotion(x,z,time,o.team===0?Math.PI/2:-Math.PI/2);locomotion.set(o.id,motion);}
      const attackPulse=Math.sin(Math.PI*creatureAttackProgress(o,actionTime));
      const target=o.attackTarget,hasTarget=attackPulse>0&&target;
      const riderFacing=rider?.root?.rotation?.y ??
        (Number.isFinite(rider?.facingX)&&Number.isFinite(rider?.facingZ)&&
        Math.abs(rider.facingX)+Math.abs(rider.facingZ)>0?
        Math.atan2(rider.facingX,rider.facingZ):null);
      const forcedFacing=hasTarget?Math.atan2((target.x-x)*cellSize,(target.z-z)*cellSize):riderFacing;
      advanceCreatureLocomotion(motion,x,z,time,{
        speed:o.spec?.speed??COMBAT_OBJECT_SPECS[o.type]?.speed??3,
        flying:!!o.flying,type:o.type,facing:forcedFacing,
      });
      const travel=riderWorld?{x,z}:{x:motion.x,z:motion.z};
      const px=(travel.x-offset)*cellSize,pz=(travel.z-offset)*cellSize;
      // One pooled effect per stride distance, independent of FPS and map-tile
      // changes. A mount follows its rider's continuous position directly.
      if(!o.flying&&motion.activity>.28){
        const previousX=motion.lastFxX??travel.x,previousZ=motion.lastFxZ??travel.z;
        motion.dustDistance=(motion.dustDistance??0)+Math.hypot(travel.x-previousX,travel.z-previousZ);
        const stride=o.type==='horse'?.42:.57;
        if(motion.dustDistance>stride){
          motion.dustDistance%=stride;
          footfalls.spawn(px,terrainY(px,pz)+.025,pz,time,{
            kind:o.type==='horse'?'sand':'dust',
            scale:o.type==='horse'?1.2:.67,heading:motion.facing,
          });
        }
      }else motion.dustDistance=0;
      motion.lastFxX=travel.x;motion.lastFxZ=travel.z;
      if(o.lastAttackHitAt!==undefined&&o.lastAttackHitAt!==motion.lastImpactTime){
        motion.lastImpactTime=o.lastAttackHitAt;
        if(actionTime-o.lastAttackHitAt<.6)
          footfalls.spawn(px,terrainY(px,pz)+.1,pz,time,{kind:'sparks',scale:o.type==='horse'?.9:1.2});
      }
      const seed=creatureInstancePhase(o.id),spec=CREATURE_VISUAL_SPECS[o.type];
      const scale=creatureSize(o.type,o.mountedBy!=null)*(o.commanderMount?1.12:1);
      const gallop=motion.activity>.44?Math.min(1,(motion.activity-.44)/.42):0;
      const hoofLift=.022+.060*gallop;
      const bounce=creatureFlightHeight(o,time)+(o.flying?0:hoofLift*motion.activity*Math.sin(motion.gaitPhase*2+seed));
      base.position.set(px,terrainY(px,pz)+bounce,pz);
      base.position.z+=attackPulse*(o.type==='wolf'?.30:.12);
      if(o.type==='horse')base.position.y+=attackPulse*.14;
      const facing=motion.facing;
      base.rotation.set(-attackPulse*(o.type==='horse'?.22:o.type==='wolf'?.13:.08)+
        (o.flying?.05*motion.activity*Math.sin(time*3.4+seed):
          o.type==='horse'?gallop*.033*Math.sin(motion.gaitPhase+seed):0),facing,
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
        if(spec&&part!=='core')world.copy(base.matrix).multiply(localAnimationMatrix(o.type,part,time,seed,o,motion.activity,motion.gaitPhase,actionTime));
        else world.copy(base.matrix);
        mesh.setMatrixAt(slot,world);
        if(o.type==='horse')mesh.setColorAt(slot,o.commanderMount?commanderHorseColor:ordinaryHorseColor);
      }
    }
    for(const lods of species.values())for(const lod of Object.values(lods)){
      for(const mesh of lod.meshes.values()){
        mesh.count=lod.count;
        mesh.visible=lod.count>0;
        if(lod.count){
          mesh.instanceMatrix.needsUpdate=true;
          if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
        }
      }
    }
    footfalls.update(time);
    // Keep history bounded even when summons expire or are replaced.
    if(locomotion.size>objects.length+24){const aliveIds=new Set(objects.filter(o=>o.alive).map(o=>o.id));
      for(const id of locomotion.keys())if(!aliveIds.has(id))locomotion.delete(id);}
  }
  function dispose(){
    locomotion.clear();
    footfalls.dispose();
    for(const lods of species.values())for(const lod of Object.values(lods))for(const mesh of lod.meshes.values()){
      scene.remove(mesh);mesh.geometry.dispose();
    }
    for(const coat of coats.values()){
      coat.disposed=true;
      coat.material.dispose();coat.map.dispose();coat.normalMap.dispose();
    }
    eyeMaterial.dispose();equipmentMaterial.dispose();humanoidMaterial.dispose();
    photos.dispose();
    distantMaterial.dispose();
  }
  return {
    sync,dispose,
    footfallStats:footfalls.stats,
    stats:()=>Object.fromEntries(types.map(type=>[type,counts[type]??0])),
    detailStats:()=>Object.fromEntries(types.map(type=>[type,{
      high:species.get(type).high.count,low:species.get(type).low.count,
    }])),
  };
}
