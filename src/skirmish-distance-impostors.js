import * as THREE from 'three';
import {captureCrowdImpostorAtlas} from './crowd-impostor-atlas.js?v=4.6.2';

/**
 * 50v50 distance LOD using photos of the ORIGINAL clothed, animated rig.
 * Nearby actors keep every original hair, face, armour and weapon mesh.
 * Far actors share one instanced billboard draw per job + sex; each card
 * still reproduces one of the actual idle/run-left/run-right/attack poses.
 * No synthetic low-poly human body is ever substituted.
 */
const VIEW_STEPS=Math.PI/2;
// A shared job/sex card has the WRONG personal haircut and boot shape. It
// may only replace the genuine animated 3D rig once it is tiny on screen.
export const DISTANT_CARD_ENTER_PX=48;
export const DISTANT_CARD_EXIT_PX=62;
export function projectedSoldierHeightPx(camera,canvasHeight,distance,height=3.1){
 if(!(distance>0)||!(canvasHeight>0))return Infinity;
 if(camera?.isPerspectiveCamera){
  const fov=Number(camera.getEffectiveFOV?.()??camera.fov)||50;
  return height*canvasHeight/(2*distance*Math.tan(fov*Math.PI/360));
 }
 if(camera?.isOrthographicCamera){
  const zoom=Math.max(.001,Number(camera.zoom)||1);
  return height*canvasHeight*zoom/Math.max(.001,camera.top-camera.bottom);
 }
 return Infinity;
}
export async function createSkirmishDistanceLod(scene,renderer,actors,{
  threshold=45,onProgress=()=>{}
}={}){
 const buckets=new Map(),targets=[],errors=[];
 
 for(const actor of actors){
  if(!actor.character||!actor.outfit||actor.outfitError||actor.defeated)continue;
  const key=(actor.job?.name||'')+'|'+(actor.sex||'male');
  let bucket=buckets.get(key);
  if(!bucket){
   bucket={key,actors:[],mesh:null,phase:null,action:null,direction:null};
   buckets.set(key,bucket);
  }
  bucket.actors.push(actor);
 }
 for(const bucket of buckets.values()){
  const sample=bucket.actors[0];
  try{
   const captured=await captureCrowdImpostorAtlas(renderer,sample,{tileSize:112});
   if(!captured)continue;
   targets.push(captured.target);
   const n=bucket.actors.length;
   const geometry=new THREE.PlaneGeometry(3.1,3.1);
   const direction=new Float32Array(n),phase=new Float32Array(n),action=new Float32Array(n);
   geometry.setAttribute('crowdDirection',new THREE.InstancedBufferAttribute(direction,1));
   geometry.setAttribute('crowdPhase',new THREE.InstancedBufferAttribute(phase,1));
   geometry.setAttribute('crowdAction',new THREE.InstancedBufferAttribute(action,1));
   const cards=new THREE.InstancedMesh(geometry,captured.material,n);
   cards.name='RealDressedDistantSoldiers_'+bucket.key;
   cards.count=0;cards.frustumCulled=false;cards.castShadow=false;
   cards.receiveShadow=false;cards.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   cards.renderOrder=2;
   scene.add(cards);
   Object.assign(bucket,{mesh:cards,direction,phase,action});

  }catch(error){
   errors.push({job:bucket.key,error:String(error?.message||error)});
  }
  onProgress(buckets.size,targets.length,errors.length);
 }
 const scratch=new THREE.Object3D();
 let visible=0,eligible=0;
 const thresholdSq=threshold*threshold;
 const canvasHeight=()=>renderer.domElement?.clientHeight||
  (renderer.domElement?.height||0)/(renderer.getPixelRatio?.()||1);
 function update(camera,time=0,paused=false){
  visible=0;eligible=0;
  for(const bucket of buckets.values()){
   const {mesh,direction,phase,action}=bucket;
   if(!mesh)continue;
   let count=0;
   for(const a of bucket.actors){
    const wasCard=!!a._distantCard;
    a._distantCard=false;
    if(a.defeated||a.hp<=0||!a.root||!a.character||a.crowdSampling||
      a.floorTravel||(a.indoorFloor??1)>1||a.mountId||
      a._summonFall){
      continue;
    }
    const p=a.root.position;
    const distanceSq=p.distanceToSquared(camera.position);
    if(distanceSq<thresholdSq)continue;
    const range=Math.sqrt(distanceSq);
    // 45m is NOT a sufficient reason to replace a large visible 3D soldier.
    // Preserve per-actor real hair, legs and armor down to 48 CSS pixels.
    // Hysteresis retains the card until a returning actor is 62px tall.
    const projected=projectedSoldierHeightPx(camera,canvasHeight(),range);
    if(projected>(wasCard?DISTANT_CARD_EXIT_PX:DISTANT_CARD_ENTER_PX))continue;
    eligible++;
    const yaw=Math.atan2(camera.position.x-p.x,camera.position.z-p.z);
    const relative=Math.atan2(Math.sin(yaw-a.root.rotation.y),
      Math.cos(yaw-a.root.rotation.y));
    const view=((Math.round(relative/VIEW_STEPS)%4)+4)%4;
    direction[count]=view;
    const moving=!!(a.nextCell||a.lastMovedAt!=null&&time-a.lastMovedAt<.32);
    action[count]=moving?1:
      a.attackPoseUntil!=null&&time<a.attackPoseUntil?2:0;
    const lastX=a._cardLastX??p.x,lastZ=a._cardLastZ??p.z;
    const distance=Math.hypot(p.x-lastX,p.z-lastZ);
    if(distance>0&&distance<2.8)a.gaitSteps=(a.gaitSteps||0)+distance/2.2;
    a._cardLastX=p.x;a._cardLastZ=p.z;
    a.lastGaitX=p.x;a.lastGaitZ=p.z;
    phase[count]=Math.PI*(a.gaitSteps||0);
    scratch.position.set(p.x,p.y+.95,p.z);
    scratch.rotation.set(0,yaw,0);
    scratch.scale.setScalar(1);
    scratch.updateMatrix();
    mesh.setMatrixAt(count++,scratch.matrix);
    a._distantCard=true;
   }
   mesh.count=count;
   if(count){
    mesh.instanceMatrix.needsUpdate=true;
    for(const attr of ['crowdDirection','crowdPhase','crowdAction'])
     mesh.geometry.getAttribute(attr).needsUpdate=true;
   }
   visible+=count;
  }
 }
 function dispose(){
  for(const bucket of buckets.values())if(bucket.mesh){
   scene.remove(bucket.mesh);
   bucket.mesh.geometry.dispose();bucket.mesh.material.dispose();
  }
  for(const target of targets)target.dispose();
  for(const actor of actors)actor._distantCard=false;
 }
 return {update,dispose,get stats(){return {visible,eligible,
    jobs:[...buckets.values()].filter(b=>b.mesh).length,
    failedJobs:errors.length,atlasTargets:targets.length,errors:errors.slice(0,4)}}};
}
