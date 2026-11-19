/**
 * Bridges the model-adoption editor to an actual enemy unit in the battle
 * scene. The approved procedural actor appears immediately; an explicitly
 * selected GLB may replace ONLY one near-LOD actor after a successful load.
 * No missing actor while loading, no per-instance 1000v1000 GLB request.
 */
import * as THREE from 'three';
import {createMonsterModel,disposeMonsterSculpture}
 from './monster-geometry.js?v=m019-lateral-elbow90-v6-20261120';
import {startMonsterAction,animateMonsterModel}
 from './monster-animation.js?v=phoenix-tengu-flight-motion-v14-cere-20261118';
import {resolveRegisteredMonsterModel}
 from './creature-game-model-routing.js?v=m019-lateral-elbow90-v6-20261120';
import {fetchCreatureRegistry} from './creature-external-runtime.js';
import {loadCreatureMeshSource}
 from './creature-real-source-catalog.js?v=real-body-only-v4';

const targetHeightOf=root=>{
 root.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(root);
 return {height:b.max.y-b.min.y,bottom:b.min.y};
};

export function createRegisteredBattleMonster(spec,{
 detail='low',allowExternal=false,storage=globalThis.localStorage
}={}){
 if(!spec?.id)throw Error('Battle monster needs a canonical species ID');
 const choice=resolveRegisteredMonsterModel(spec.id,{
  detail,allowExternal,storage});
 if(!choice.registered)throw Error('Unregistered battle monster: '+spec.id);
 const root=new THREE.Group();
 root.name='RegisteredBattleMonster_'+spec.id;
 root.userData.registeredMonster=spec.id;
 root.userData.modelRevision=choice.record.version;
 root.userData.requestedMesh=choice.selected;
 root.userData.selectedMesh='legacy';
 root.userData.modelLoadStatus='procedural-ready';
 let native=createMonsterModel(spec,{detail}),external=null;
 let disposed=false,lastAction='idle',lastTime=null;
 root.add(native);
 startMonsterAction(native,'idle',0);
 let ready=Promise.resolve(root);
 if(choice.externalSource){
  root.userData.modelLoadStatus='loading-optional-source';
  const source=choice.externalSource;
  ready=(async()=>{
   let loaded=null;
   try{
    const registry=source.startsWith('q')?
     await fetchCreatureRegistry():{entries:{}};
    loaded=await loadCreatureMeshSource(source,registry,detail,{
     creatureId:spec.id
    });
    if(disposed||choice.selected!==resolveRegisteredMonsterModel(spec.id,{
      detail,allowExternal,storage}).selected){
     loaded.dispose();return root;
    }
    const previous=targetHeightOf(native);
    const next=targetHeightOf(loaded.root);
    if(!Number.isFinite(next.height)||next.height<=.001||
       !Number.isFinite(previous.height)||previous.height<=.001)
      throw Error('Source GLB has no valid geometry bounds');
    const scale=previous.height/next.height;
    // Preserve collision and AI: all re-fitting is inside the visual
    // wrapper, never the actual soldier/collider root.
    loaded.root.scale.multiplyScalar(scale);
    loaded.root.updateMatrixWorld(true);
    const fitted=targetHeightOf(loaded.root);
    loaded.root.position.y+=previous.bottom-fitted.bottom;
    root.add(loaded.root);
    root.remove(native);
    disposeMonsterSculpture(native);native=null;
    external=loaded;
    loaded.play(lastAction);
    root.userData.selectedMesh=source;
    root.userData.modelLoadStatus='external-ready';
    root.userData.modelAttribution=loaded.root.userData.creatureMeshAttribution||null;
   }catch(error){
    if(loaded&&!external)loaded.dispose();
    if(!disposed){
     root.userData.modelLoadStatus='fallback-procedural';
     root.userData.modelLoadError=String(error?.message||error);
    }
   }
   return root;
  })();
 }
 function update(time=0,action='idle'){
  if(disposed)return false;
  const next=['idle','walk','run','attack','special','roar','dodge',
    'hit','leap','defeat','guard'].includes(action)?action:'idle';
  if(next!==lastAction){
   if(external)external.play(next);
   else if(native)startMonsterAction(native,next,time);
   lastAction=next;
  }
  if(external){
   const dt=lastTime==null?0:Math.max(0,Math.min(.10,time-lastTime));
   external.update(dt);
  }else if(native)animateMonsterModel(native,time);
  lastTime=time;
  return true;
 }
 function dispose(){
  if(disposed)return;
  disposed=true;
  if(external){external.dispose();external=null;}
  if(native){disposeMonsterSculpture(native);native=null;}
  root.parent?.remove(root);
 }
 return {root,choice,ready,update,dispose,
  currentModel:()=>external?.root||native,
  get source(){return root.userData.selectedMesh;}
 };
}
