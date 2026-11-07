/**
 * Licensed external monster models for the bestiary. This module never
 * replaces game combat actors automatically; the curator must approve them.
 * Source/high/low GLBs preserve GLTF animations and PBR materials.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const REGISTRY_URL=new URL('../assets/creatures/external/registry.json',import.meta.url);
const MODEL_ID=/^(?:m(?:00[1-9]|0[1-4][0-9]|050)|wolf|horse|wyvern|dragon|elder_dragon|dragon_lord|forest_archer|seraph_guardian)$/;
const MODEL_PATH=/^\.\/assets\/creatures\/external\/([a-z0-9_]+)\/(source|high|low)\.glb$/;
const ACTION_CLIPS=Object.freeze({
 idle:['idle','stand','breath','rest'],
 walk:['walk','walking'],
 run:['run','running','sprint','fast'],
 attack:['attack','punch','claw','bite','headbutt','strike'],
 special:['special','cast','magic','fire','breath','attack'],
 roar:['roar','taunt','shout','yes','no'],
 dodge:['dodge','roll','jump','evade'],
 hit:['hitreact','hit','damage','hurt'],
 leap:['jump','leap','fly','flying'],
 defeat:['death','die','defeat','dead']
});
export function validateCreatureRegistry(reg){
 if(reg?.schema!=='hai-gin/creature-library/v1'||!reg.entries||
  Array.isArray(reg.entries)||typeof reg.entries!=='object')throw Error('Invalid licensed creature registry');
 for(const [id,entry] of Object.entries(reg.entries)){
  if(!MODEL_ID.test(id)||entry.license!=='CC0-1.0'||!entry.author||
    !/^https:\/\//.test(entry.sourceUrl||''))throw Error('Unverified creature asset '+id);
  for(const [tier,path] of Object.entries(entry.models||{})){
   const m=MODEL_PATH.exec(path||'');
   if(!['source','high','low'].includes(tier)||!m||m[1]!==id||m[2]!==tier)
     throw Error('Unsafe 3D asset path '+id+'/'+tier);
  }
  if(!entry.models.high)throw Error('Missing high LOD for '+id);
 }
 return reg;
}
export async function fetchCreatureRegistry(){
 const response=await fetch(REGISTRY_URL,{cache:'no-store'});
 if(!response.ok)throw Error('3D library unavailable: HTTP '+response.status);
 return validateCreatureRegistry(await response.json());
}
function chooseClip(clips,action){
 const names=ACTION_CLIPS[action]||ACTION_CLIPS.idle;
 for(const keyword of names){
  const found=clips.find(clip=>(clip.name||'').toLowerCase().replace(/[^a-z0-9]/g,'').includes(keyword));
  if(found)return found;
 }
 return action==='idle'?clips[0]||null:null;
}
export function prepareExternalGLTF(gltf,{
 id='local',name='Creature',targetHeight=2.4
}={}){
 const source=gltf?.scene;
 if(!source?.isObject3D)throw Error('GLB must contain a 3D scene');
 const box=new THREE.Box3().setFromObject(source);
 const height=box.max.y-box.min.y;
 if(box.isEmpty()||!Number.isFinite(height)||height<.00001)
   throw Error('GLB has no visible geometry');
 const factor=Math.max(.005,Math.min(500,targetHeight/height));
 const root=new THREE.Group();
 root.name='ExternalCreature_'+id;
 source.scale.multiplyScalar(factor);
 source.updateMatrixWorld(true);
 const updated=new THREE.Box3().setFromObject(source);
 source.position.x-=(updated.min.x+updated.max.x)*.5;
 source.position.z-=(updated.min.z+updated.max.z)*.5;
 source.position.y-=updated.min.y;
 root.add(source);
 root.userData.homeScale=1;
 root.userData.pivots={};
 root.userData.externalSourceId=id;
 root.userData.external=true;
 let mixer=null,active=null;
 const clips=gltf.animations||[];
 if(clips.length)mixer=new THREE.AnimationMixer(source);
 source.traverse(node=>{if(node.isMesh){
   node.castShadow=true;node.receiveShadow=true;
 }});
 const play=action=>{
  if(!mixer)return false;
  const clip=chooseClip(clips,action);
  if(!clip)return false;
  if(active?.getClip()===clip)return true;
  if(active)active.fadeOut(.14);
  const next=mixer.clipAction(clip);
  next.reset().fadeIn(.14);
  const oneShot=action!=='idle'&&action!=='walk'&&action!=='run';
  next.setLoop(oneShot?THREE.LoopOnce:THREE.LoopRepeat,oneShot?1:Infinity);
  next.clampWhenFinished=oneShot;
  next.play();
  active=next;
  return true;
 };
 play('idle');
 let disposed=false;
 return {
  root,mixer,clips:clips.map(c=>c.name),
  play,
  update(dt){if(!disposed)mixer?.update(Math.max(0,Math.min(dt,.1)));},
  dispose(){
   if(disposed)return;
   disposed=true;mixer?.stopAllAction();
   root.parent?.remove(root);
   const geometries=new Set(),materials=new Set(),textures=new Set();
   source.traverse(node=>{
    if(!node.isMesh)return;
    if(node.geometry)geometries.add(node.geometry);
    for(const material of (Array.isArray(node.material)?node.material:[node.material])){
     if(!material)continue;materials.add(material);
     for(const value of Object.values(material)){
      if(value?.isTexture)textures.add(value);
     }
    }
   });
   geometries.forEach(g=>g.dispose());
   materials.forEach(m=>m.dispose());
   textures.forEach(t=>t.dispose());
  }
 };
}
export async function loadExternalCreature(entry,detail='high'){
 if(!entry||entry.license!=='CC0-1.0')throw Error('Missing license approval');
 const path=entry.models?.[detail]||entry.models?.high;
 if(!MODEL_PATH.test(path||''))throw Error('Unsafe external model URL');
 const url=new URL('../'+path.slice(2),import.meta.url);
 const loader=new GLTFLoader();
 const gltf=await loader.loadAsync(url.href);
 return prepareExternalGLTF(gltf,{
   id:path.split('/').at(-2),name:entry.name,
   targetHeight:entry.targetHeight||2.4
 });
}
export async function loadPersonalGLB(file,{id,targetHeight=2.4}={}){
 if(!file||!/\.glb$/i.test(file.name)||file.size>35_000_000||file.size<20)
   throw Error('35MB以下の単体GLBファイルを選択してください');
 const buffer=await file.arrayBuffer();
 const gltf=await new GLTFLoader().parseAsync(buffer,'');
 return prepareExternalGLTF(gltf,{id,targetHeight});
}
