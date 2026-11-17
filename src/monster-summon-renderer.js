/**
 * On-demand visual bridge for the 50 original bestiary monster sculptures.
 *
 * Only species currently summoned create Three.js objects. This prevents
 * preallocating 50 x high/low high-poly meshes at battle startup. The actual
 * existing bestiary geometry, articulation, materials and PBR are reused.
 * No changes to enemy bestiary scale, m005/m006 donor assets, grid AI or
 * soldier skeletons. Summoned species have their normal human-relative height.
 */
import * as THREE from 'three';
import {createMonsterModel,disposeMonsterSculpture}
 from './monster-geometry.js?v=registered-wave1-20261117';
import {createCosplayedHumanoidMonster}
 from './monster-character-cosplay.js?v=4.6.90';
import {humanoidMonsterCostumeFor}
 from './monster-character-cosplay-manifest.js?v=4.5.03';
import {startMonsterAction,animateMonsterModel}
 from './monster-animation.js?v=4.5.18';
import {creatureFlightHeight} from './combat-creature-performance.js?v=natural-size-20261116';
import {adoptedCreatureMesh} from './creature-mesh-adoption.js?v=registered-wave1-20261117';
import {resolveRegisteredMonsterModel}
 from './creature-game-model-routing.js';
import {fetchCreatureRegistry} from './creature-external-runtime.js';
import {loadCreatureMeshSource} from './creature-real-source-catalog.js?v=real-body-only-v4';
import {chooseCreatureLod} from './creature-master-library.js?v=masters-v1';
import {protectedCreature} from './creature-mesh-adoption.js?v=real-bodies-v3';
import {isMonsterSummonType,monsterSummonSource,
 monsterSummonWorldScale,MONSTER_SUMMON_MAX_HIGH_DETAIL,
 MONSTER_SUMMON_MAX_ACTIVE,MONSTER_SUMMON_BY_TYPE,MONSTER_SUMMON_MODEL_HEIGHT}
 from './monster-summon-registry.js?v=natural-size-20261116';

const safe=(x,fallback=0)=>Number.isFinite(x)?x:fallback;

export function createMonsterSummonRenderer(scene,{
 cellSize=1.12,offset=6,terrainY=()=>0,camera=null,
 highDetailDistance=25
}={}){
 const active=new Map();
 let licensedRegistryRequest=null;
 let removed=false;
 const stats={created:0,disposed:0,peak:0,dropped:0};
 function release(id){
  const node=active.get(id);
  if(!node)return;
  node.disposed=true;
  scene.remove(node.anchor);
  if(node.externalHandle)node.externalHandle.dispose();
  else if(node.costumeHandle)node.costumeHandle.dispose();
  else disposeMonsterSculpture(node.actor);
  if(node.statusMarker){
   node.statusMarker.geometry.dispose();
   node.statusMarker.material.dispose();
  }
  active.delete(id);
  stats.disposed++;
 }
 function spawn(object,detail){
  const spec=monsterSummonSource(object.type);
  if(!spec)return null;
  const isHumanoid=!!humanoidMonsterCostumeFor(spec);
  // Human-shaped monsters no longer display their retired procedural
  // sculpture in battle. Keep the independently skinned canonical actor
  // and original ID/stats/actions. In-flight GLB loading leaves a blank
  // visual rather than falsely claiming the old sculpt is the new model.
  const costumeHandle=isHumanoid?createCosplayedHumanoidMonster(spec,{
   detail,withoutFallback:true
  }):null;
  const actor=costumeHandle?.root||createMonsterModel(spec,{detail});
  let statusMarker=null;
  if(isHumanoid){
   actor.userData.speciesId=spec.id;
   actor.userData.modelPending=true;
   actor.userData.legacyGeometryDisabled=true;
   actor.userData.sourceKind='canonical-character-cosplay';
   // While a skinned actor streams in, keep a non-humanoid loading marker
   // visible. An invisible enemy/summon would be a gameplay regression.
   // The marker is NOT the retired monster model and costs one small mesh.
   statusMarker=new THREE.Mesh(new THREE.OctahedronGeometry(.15,0),
     new THREE.MeshBasicMaterial({color:0xd7ab66}));
   statusMarker.name='canonical-human-loading-marker';
   statusMarker.position.y=1;
   actor.add(statusMarker);
  }
  // Measure the actual source's visible height, not its item rarity or an
  // estimated sphere. Leviathan retains its native sea-serpent proportions.
  actor.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(actor);
  const h=bounds.max.y-bounds.min.y;
  if(!isHumanoid&&(!Number.isFinite(h)||h<=0)){
   disposeMonsterSculpture(actor);return null;
  }
  const size=monsterSummonWorldScale(object.type,isHumanoid?1.7:h);
  const anchor=new THREE.Group();
  anchor.name='SummonedBestiary_'+spec.id;
  const fitting=new THREE.Group();
  fitting.scale.setScalar(size);
  // All articulation is authored relative to the unmodified monster root.
  // Avoid translating the actor directly, as animations reset position.
  const position=new THREE.Group();
  position.position.y=isHumanoid?0:-bounds.min.y;
  position.add(actor);fitting.add(position);anchor.add(fitting);
  scene.add(anchor);
  // Box3.setFromObject(actor) (gallery framing and the scale QA) does not
  // update the ANCESTOR world matrices. Finalize the native donor rig's
  // parent chain immediately, before the first renderer.render call.
  // Otherwise it appears 1.7m to the camera fitter despite having a
  // parent scale, clipping the model in mobile gallery.
  anchor.updateMatrixWorld(true);
  if(costumeHandle){
   costumeHandle.start('idle',0);
   costumeHandle.ready.then(result=>{
    if(removed||!actor.parent||result.source==='cancelled')return;
    actor.userData.modelPending=false;
    if(result.source!=='canonical-character-cosplay'){
     actor.userData.modelError=result.reason||'canonical-actor-unavailable';
     if(statusMarker)statusMarker.material.color.setHex(0xcf5964);
     // A failed GLB must NEVER fall back to a legacy humanlike sculpt.
     return;
    }
    anchor.updateWorldMatrix(true,true);
    const finalBox=new THREE.Box3().setFromObject(actor);
    const finalHeight=finalBox.max.y-finalBox.min.y;
    if(!Number.isFinite(finalHeight)||finalHeight<=.01){
     actor.userData.modelError='empty-loaded-skin';return;
    }
    const targetHeight=MONSTER_SUMMON_BY_TYPE[object.type].size*MONSTER_SUMMON_MODEL_HEIGHT;
    fitting.scale.multiplyScalar(targetHeight/finalHeight);
    anchor.updateWorldMatrix(true,true);
    const corrected=new THREE.Box3().setFromObject(actor);
    position.position.y+=(anchor.position.y-corrected.min.y)/
      Math.max(.00001,fitting.scale.y);
    if(statusMarker?.parent)statusMarker.parent.remove(statusMarker);
    if(statusMarker){
     statusMarker.geometry.dispose();statusMarker.material.dispose();
     statusMarker=null;
    }
    actor.userData.productionHumanoidReady=true;
    anchor.updateWorldMatrix(true,true);
   }).catch(error=>{actor.userData.modelPending=false;
    actor.userData.modelError=String(error?.message||error);
    if(statusMarker)statusMarker.material.color.setHex(0xcf5964);
   });
  }else startMonsterAction(actor,'idle',0);
  stats.created++;
  const node={actor,anchor,detail,type:object.type,size,costumeHandle,
   statusMarker,externalHandle:null,
   // Source is selected through the SAME validated species/LOD policy as
   // regular enemies. Invalid local saved donor IDs never reach GLTFLoader.
   sourceChoice:resolveRegisteredMonsterModel(object.type,{
    detail,allowExternal:true
   }).externalSource||'legacy',
   registeredRevision:resolveRegisteredMonsterModel(object.type).record?.version,
   disposed:false,sourceError:null,
   lastX:object.x,lastZ:object.z,lastT:0,lastAttack:-Infinity,
   lastPose:null,lastAction:'idle'};
  // No implicit replacement: keep the existing monster visible and
  // animated until an explicitly adopted licensed source has loaded.
  // Human-shaped monster rigs stay on the established character path.
  // Keep expensive high-resolution skin rigs limited to the two nearest
  // high-LOD summoned actors. Distant wolves preserve the original source
  // silhouette/animation until camera proximity warrants the detailed GLB.
  const useHeavyWolf=node.sourceChoice==='r-wolf';
  if(!isHumanoid&&node.sourceChoice!=='legacy'&&
     (!useHeavyWolf||detail==='high'||detail==='medium'||detail==='source')){
   const sourceId=node.sourceChoice;
   if(sourceId.startsWith('q'))licensedRegistryRequest??=fetchCreatureRegistry();
   const registryTask=sourceId.startsWith('q')?licensedRegistryRequest:
     Promise.resolve({entries:{}});
   registryTask.then(registry=>
    loadCreatureMeshSource(sourceId,registry,detail,{creatureId:object.type})
   ).then(loaded=>{
    if(removed||node.disposed||!node.anchor.parent||
       (resolveRegisteredMonsterModel(object.type,{
        detail,allowExternal:true
       }).externalSource||'legacy')!==sourceId){
      loaded.dispose();return;
    }
    const sourceBounds=new THREE.Box3().setFromObject(loaded.root);
    const sourceHeight=sourceBounds.max.y-sourceBounds.min.y;
    if(!Number.isFinite(sourceHeight)||sourceHeight<=.0001){
     loaded.dispose();node.sourceError='Empty source GLB';return;
    }
    const targetScale=monsterSummonWorldScale(object.type,sourceHeight);
    // Only this summoned actor changes. Original source and catalog remain.
    position.remove(node.actor);
    disposeMonsterSculpture(node.actor);
    node.actor=loaded.root;node.externalHandle=loaded;
    position.position.y=-sourceBounds.min.y;
    position.add(loaded.root);
    fitting.scale.setScalar(targetScale);
    node.size=targetScale;
    anchor.updateMatrixWorld(true);
    loaded.play(node.lastAction);
    node.sourceError=null;
   }).catch(error=>{
    if(!node.disposed)node.sourceError=String(error?.message||error);
    // Failed optional GLB never removes the original 3D actor.
   });
  }
  return node;
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
  // Rank every visible actor by distance, including crowds under the cap.
 // This reserves the source master for the actual closest nonhuman beast,
 // rather than the first summon in an input collection.
 const summoned=allSummoned.slice().sort((a,b)=>distSq(a)-distSq(b))
   .slice(0,MONSTER_SUMMON_MAX_ACTIVE);
  stats.dropped+=Math.max(0,allSummoned.length-summoned.length);
  const visibleIds=new Set(summoned.map(o=>String(o.id)));
  for(const id of active.keys())if(!visibleIds.has(id))release(id);
  let detailedCount=0,sourceCount=0;
  // Exactly three visual distances in combat. Source is deliberately
  // allocated only to one nearest nonhuman actor; high is the intermediate
  // shape and low is the distant shape. The gallery has no such cap.
  for(const o of summoned){
   const id=String(o.id);
   let node=active.get(id);
   const px=(safe(o.x)-offset)*cellSize,pz=(safe(o.z)-offset)*cellSize;
   const ground=terrainY(px,pz);
   const distance=camera?camera.position.distanceTo(
    new THREE.Vector3(px,ground,pz)):Infinity;
   const spec=monsterSummonSource(o.type);
   const human=!!humanoidMonsterCostumeFor(spec);
   const sourceAllowed=!human&&!protectedCreature(spec?.id);
   let target=chooseCreatureLod(distance,{
    near:highDetailDistance*.72,mid:highDetailDistance*Math.sqrt(10)
   });
   if(target==='near'&&(!sourceAllowed||sourceCount>=1))target='mid';
   let detail=target==='near'?'source':target==='mid'?(human?'high':'medium'):'low';
   if(detail!=='low'&&detailedCount>=MONSTER_SUMMON_MAX_HIGH_DETAIL)
    detail='low';
   // Avoid reallocating intricate models when the zoom hovers over a
   // threshold. Hysteresis applies only if an actor has a slot to retain.
   if(node&&node.detail!==detail){
    const boundary=detail==='source'||node.detail==='source'?
     highDetailDistance*.72:highDetailDistance*Math.sqrt(10);
    const sameBand=Math.abs(distance-boundary)<boundary*.10;
    if(sameBand&&node.detail!=='source'||
       sameBand&&node.detail==='source'&&sourceAllowed&&sourceCount===0)
     detail=node.detail;
   }
   if(detail==='source')sourceCount++;
   if(detail!=='low')detailedCount++;
   if(node&&(node.sourceChoice!==(
      resolveRegisteredMonsterModel(o.type,{detail,allowExternal:true})
       .externalSource||'legacy')||node.detail!==detail)){
    release(id);node=null;
   }
   if(!node&&active.size>=MONSTER_SUMMON_MAX_ACTIVE){
    stats.dropped++;continue;
   }
   if(!node){
    node=spawn(o,detail);
    if(!node)continue;
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
   const moving=!!o.moving||Math.hypot(safe(o.x)-safe(node.lastX),safe(o.z)-safe(node.lastZ))>.001;
   let action=o.poseAction;
   if(!['guard','dodge','hit','leap','defeat','special','roar'].includes(action)||
      actionTime-safe(o.poseStartedAt,-Infinity)>2)action=null;
   action=action||(pulse?'attack':moving?(o.previewWalk?'walk':'run'):'idle');
   const actionAt=action===o.poseAction?o.poseStartedAt:
     action==='attack'?o.attackStartedAt:time;
   if(node.lastAction!==action||(
      action==='attack'&&node.lastAttack!==o.attackStartedAt)||
      (action===o.poseAction&&node.lastPose!==o.poseStartedAt)){
    if(node.externalHandle)node.externalHandle.play(action);
    else if(node.costumeHandle)node.costumeHandle.start(action,Number.isFinite(actionAt)?actionAt:time);
    else startMonsterAction(node.actor,action,Number.isFinite(actionAt)?actionAt:time);
    node.lastAction=action;
    node.lastAttack=o.attackStartedAt;
    node.lastPose=o.poseStartedAt;
   }
   if(node.externalHandle)node.externalHandle.update(
    Math.max(0,Math.min(.1,time-node.lastT)));
   else if(node.costumeHandle)node.costumeHandle.update(time);
   else animateMonsterModel(node.actor,time);
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
   id,{type:m.type,source:m.detail==='source'?1:0,
    high:m.detail==='high'?1:0,medium:m.detail==='medium'?1:0,
    low:m.detail==='low'?1:0,
    selectedMesh:m.sourceChoice,registeredRevision:m.registeredRevision,
    loadedMesh:m.externalHandle?.root.userData.externalSourceId||'legacy',
    error:m.sourceError}
  ])),
  actualModel:id=>active.get(String(id))?.actor||null,
  activeCount:()=>active.size
 };
}
