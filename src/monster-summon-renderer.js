/**
 * On-demand visual bridge for the 50 original bestiary monster sculptures.
 *
 * Only species currently summoned create Three.js objects. This prevents
 * preallocating 50 x high/low high-poly meshes at battle startup. The actual
 * existing bestiary geometry, articulation, materials and PBR are reused.
 * No changes to enemy bestiary scale, m005/m006 donor assets, grid AI or
 * soldier skeletons. A normal human (1.7m) is 1/10 visual height.
 */
import * as THREE from 'three';
import {createMonsterModel,disposeMonsterSculpture}
 from './monster-geometry.js?v=4.5.21';
import {startMonsterAction,animateMonsterModel}
 from './monster-animation.js?v=4.5.18';
import {creatureFlightHeight} from './combat-creature-performance.js?v=4.6.39';
import {isMonsterSummonType,monsterSummonSource,
 monsterSummonWorldScale,MONSTER_SUMMON_MAX_HIGH_DETAIL,
 MONSTER_SUMMON_MAX_ACTIVE,MONSTER_SUMMON_BY_TYPE}
 from './monster-summon-registry.js';

const safe=(x,fallback=0)=>Number.isFinite(x)?x:fallback;

export function createMonsterSummonRenderer(scene,{
 cellSize=1.12,offset=6,terrainY=()=>0,camera=null,
 highDetailDistance=25
}={}){
 const active=new Map();
 let removed=false;
 const stats={created:0,disposed:0,peak:0,dropped:0};
 function release(id){
  const node=active.get(id);
  if(!node)return;
  scene.remove(node.anchor);
  disposeMonsterSculpture(node.actor);
  active.delete(id);
  stats.disposed++;
 }
 function spawn(object,detail){
  const spec=monsterSummonSource(object.type);
  if(!spec)return null;
  const actor=createMonsterModel(spec,{detail});
  // Measure the actual source's visible height, not its item rarity or an
  // estimated sphere. Leviathan retains its native sea-serpent proportions.
  actor.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(actor);
  const h=bounds.max.y-bounds.min.y;
  if(!Number.isFinite(h)||h<=0){
   disposeMonsterSculpture(actor);return null;
  }
  const size=monsterSummonWorldScale(object.type,h);
  const anchor=new THREE.Group();
  anchor.name='SummonedBestiary_'+spec.id;
  const fitting=new THREE.Group();
  fitting.scale.setScalar(size);
  // All articulation is authored relative to the unmodified monster root.
  // Avoid translating the actor directly, as animations reset position.
  const position=new THREE.Group();
  position.position.y=-bounds.min.y;
  position.add(actor);fitting.add(position);anchor.add(fitting);
  scene.add(anchor);
  startMonsterAction(actor,'idle',0);
  stats.created++;
  return {actor,anchor,detail,type:object.type,size,
   lastX:object.x,lastZ:object.z,lastT:0,lastAttack:-Infinity,
   lastPose:null,lastAction:'idle'};
 }
 function sync(objects,time=0,actionTime=time){
  if(removed)return;
  const allSummoned=(objects||[]).filter(o=>o&&isMonsterSummonType(o.type)&&
   (o.alive!==false||(o.poseAction==='defeat'&&
     actionTime-safe(o.poseStartedAt,-Infinity)<=1.2)));
  // Large battle: retain the NEAREST 24 original models, not merely the
  // first 24 spawned. This prevents a distant army occupying the model pool
  // while a visible Leviathan or Hydra silently disappears.
  const distSq=o=>{
    if(!camera)return 0;
    const x=(safe(o.x)-offset)*cellSize,z=(safe(o.z)-offset)*cellSize;
    return (x-camera.position.x)**2+(z-camera.position.z)**2;
  };
  const summoned=allSummoned.length<=MONSTER_SUMMON_MAX_ACTIVE?
    allSummoned:allSummoned.slice().sort((a,b)=>distSq(a)-distSq(b))
       .slice(0,MONSTER_SUMMON_MAX_ACTIVE);
  stats.dropped+=Math.max(0,allSummoned.length-summoned.length);
  const visibleIds=new Set(summoned.map(o=>String(o.id)));
  for(const id of active.keys())if(!visibleIds.has(id))release(id);
  let highCount=0;
  for(const entry of active.values())if(entry.detail==='high')highCount++;
  // Stable input order is the combat order. New high-poly actors are strictly
  // limited; the entire 50-type catalog is never allocated at startup.
  for(const o of summoned){
   const id=String(o.id);
   let node=active.get(id);
   if(!node&&active.size>=MONSTER_SUMMON_MAX_ACTIVE){
    stats.dropped++;continue;
   }
   const px=(safe(o.x)-offset)*cellSize,pz=(safe(o.z)-offset)*cellSize;
   const ground=terrainY(px,pz);
   const distance=camera?camera.position.distanceTo(
    new THREE.Vector3(px,ground,pz)):Infinity;
   if(!node){
    const detail=highCount<MONSTER_SUMMON_MAX_HIGH_DETAIL&&
     distance<highDetailDistance*Math.sqrt(10)?'high':'low';
    node=spawn(o,detail);
    if(!node)continue;
    if(detail==='high')highCount++;
    active.set(id,node);
   }
   node.anchor.position.set(px,ground,pz);
   const catalog=MONSTER_SUMMON_BY_TYPE[o.type];
   // Match the original 10x dragon/angel flight lane, including roofs.
   if(o.flying)node.anchor.position.y+=creatureFlightHeight(o,time);
   if(catalog?.aquatic)node.anchor.position.y+=.18*Math.sin(time*2.1);
   node.anchor.rotation.y=Number.isFinite(o.yaw)?o.yaw:
    Number.isFinite(o.facingX)&&Number.isFinite(o.facingZ)?
      Math.atan2(o.facingX,o.facingZ):node.anchor.rotation.y;
   // The source animation's pivots give the leviathan a living tail, hydra
   // a working neck, griffons real wings, and arachnids real articulated legs.
   const pulse=Number.isFinite(o.attackStartedAt)&&
    actionTime-o.attackStartedAt>=0&&actionTime-o.attackStartedAt<.95;
   const moving=Math.hypot(safe(o.x)-safe(node.lastX),safe(o.z)-safe(node.lastZ))>.001;
   let action=o.poseAction;
   if(!['guard','dodge','hit','leap','defeat','special','roar'].includes(action)||
      actionTime-safe(o.poseStartedAt,-Infinity)>2)action=null;
   action=action||(pulse?'attack':moving?'run':'idle');
   const actionAt=action===o.poseAction?o.poseStartedAt:
     action==='attack'?o.attackStartedAt:time;
   if(node.lastAction!==action||(
      action==='attack'&&node.lastAttack!==o.attackStartedAt)||
      (action===o.poseAction&&node.lastPose!==o.poseStartedAt)){
    startMonsterAction(node.actor,action,Number.isFinite(actionAt)?actionAt:time);
    node.lastAction=action;
    node.lastAttack=o.attackStartedAt;
    node.lastPose=o.poseStartedAt;
   }
   animateMonsterModel(node.actor,time);
   node.lastX=o.x;node.lastZ=o.z;node.lastT=time;
   stats.peak=Math.max(stats.peak,active.size);
  }
 }
 function dispose(){
  removed=true;
  for(const id of [...active.keys()])release(id);
 }
 return {
  sync,dispose,
  stats:()=>Object.freeze({...stats,active:active.size}),
  detailStats:()=>Object.fromEntries([...active.entries()].map(([id,m])=>[
   id,{type:m.type,high:m.detail==='high'?1:0,low:m.detail==='low'?1:0}
  ])),
  actualModel:id=>active.get(String(id))?.actor||null,
  activeCount:()=>active.size
 };
}
