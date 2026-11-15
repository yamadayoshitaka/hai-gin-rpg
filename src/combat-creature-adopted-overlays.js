/**
 * Opt-in replacement of the five NONHUMANOID standalone summons/horse.
 * Keep the existing instanced model active until the selected CC0 GLB
 * has been loaded. Never change collision, AI, mount seat or battle stats.
 * A small pool protects 1000v1000 scenes from per-instance GLTF costs.
 */
import * as THREE from 'three';
import {NONHUMAN_EXTRA_SUMMON_IDS,adoptedCreatureMesh} from './creature-mesh-adoption.js';
import {fetchCreatureRegistry} from './creature-external-runtime.js';
import {loadCreatureMeshSource} from './creature-real-source-catalog.js';
const eligible=new Set(NONHUMAN_EXTRA_SUMMON_IDS);
const MAX_REAL_SOURCE_INSTANCES=8;
export function createAdoptedSpecialSummonRenderer(scene){
 const active=new Map();
 let disposed=false,registryRequest=null;
 const seen=new Set();
 const metrics={requested:0,loaded:0,failed:0};
 function release(id){
  const node=active.get(id);if(!node)return;
  node.expired=true;
  if(node.handle)node.handle.dispose();
  active.delete(id);
 }
 function beginSync(){seen.clear();}
 function use(object,transform,time=0,actionTime=time,visualHeight=2.4){
  if(disposed||!eligible.has(object.type))return false;
  const chosen=adoptedCreatureMesh(object.type);
  const id=String(object.id);
  if(chosen==='legacy'){
   release(id);return false;
  }
  seen.add(id);
  let node=active.get(id);
  if(node&&node.source!==chosen){release(id);node=null;}
  if(!node){
   if(active.size>=MAX_REAL_SOURCE_INSTANCES)return false;
   node={id,type:object.type,source:chosen,expired:false,handle:null,
    lastAction:'idle',lastTime:time,error:null,originalHeight:2.4};
   active.set(id,node);
   metrics.requested++;
   if(chosen.startsWith('q'))registryRequest??=fetchCreatureRegistry();
   const registryTask=chosen.startsWith('q')?registryRequest:
     Promise.resolve({entries:{}});
   const pending=node;
   registryTask.then(reg=>loadCreatureMeshSource(chosen,reg,'low',{creatureId:object.type})).then(handle=>{
    if(disposed||pending.expired||active.get(id)!==pending){
     handle.dispose();return;
    }
    const box=new THREE.Box3().setFromObject(handle.root);
    const sourceHeight=box.getSize(new THREE.Vector3()).y;
    if(!Number.isFinite(sourceHeight)||sourceHeight<=.0001){
     handle.dispose();throw Error('Empty imported model');
    }
    pending.originalHeight=sourceHeight;
    pending.handle=handle;scene.add(handle.root);
    metrics.loaded++;
   }).catch(error=>{
    if(disposed||pending.expired)return;
    pending.error=String(error?.message||error);
    metrics.failed++;
   });
  }
  if(!node.handle)return false;
  node.handle.root.position.copy(transform.position);
  node.handle.root.quaternion.copy(transform.quaternion);
  node.handle.root.scale.copy(transform.scale).multiplyScalar(
    Math.max(.15,Math.min(5,visualHeight/node.originalHeight)));
  const elapsed=Math.max(0,Math.min(.1,time-node.lastTime));node.lastTime=time;
  const attack=Number.isFinite(object.attackStartedAt)&&
    actionTime-object.attackStartedAt>=0&&actionTime-object.attackStartedAt<.8;
  const action=attack?'attack':
    object.poseAction==='defeat'?'defeat':
    object.poseAction==='special'?'special':
    object.poseAction==='leap'?'leap':
    (object.moveElapsed>0||object.moving)?'run':'idle';
  if(action!==node.lastAction){
   node.handle.play(action);node.lastAction=action;
  }
  node.handle.update(elapsed);
  return true;
 }
 function endSync(){
  for(const id of active.keys())if(!seen.has(id))release(id);
 }
 function dispose(){
  disposed=true;
  for(const id of [...active.keys()])release(id);
 }
 return {beginSync,use,endSync,dispose,
  stats:()=>({...metrics,active:active.size,limits:MAX_REAL_SOURCE_INSTANCES})};
}
