/**
 * Bridges the model-adoption editor to an actual enemy unit in the battle
 * scene. The approved procedural actor appears immediately; an explicitly
 * selected GLB may replace ONLY one near-LOD actor after a successful load.
 * No missing actor while loading, no per-instance 1000v1000 GLB request.
 */
import * as THREE from 'three';
import {createCosplayedHumanoidMonster}
 from './monster-character-cosplay.js?v=seraph-forest-quality-v5-20261122';
import {monsterBattleLengthCells,monsterBattleLengthScale} from './monster-battle-display-size.js';
import {createMonsterModel,disposeMonsterSculpture}
 from './monster-geometry.js?v=monster-all50-pbr-v1-20261121';
import {resolveMonsterThemeAction} from './monster-theme-actions.js';
import {startMonsterAction,animateMonsterModel}
 from './monster-animation.js?v=monster-50-family-actions-v1-20261121';
import {resolveRegisteredMonsterModel}
 from './creature-game-model-routing.js?v=beetle-four-reference-sculpt-v1-20261121';
import {fetchCreatureRegistry} from './creature-external-runtime.js';
import {loadCreatureMeshSource}
 from './creature-real-source-catalog.js?v=real-body-only-v4';

const boundsOf=root=>{
 root.updateMatrixWorld(true);
 return new THREE.Box3().setFromObject(root);
};

export function createRegisteredBattleMonster(spec,{
 detail='low',allowExternal=false,storage=globalThis.localStorage,cellSize=1
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
 let native=null,external=null,cosplayHandle=null,statusMarker=null;
 let disposed=false,lastAction='idle',lastTime=null;
 const lengthCells=monsterBattleLengthCells(spec.id);
 let restBounds=null;
 let ready=Promise.resolve(root);
 if(choice.kind==='canonical-humanoid'){
  // The editor and summoned bestiary both use this precise rig+costume
  // pipeline for all 16 humanoids, including m031's real sculpted bones.
  // Do not instantiate the retired generic upright torso even temporarily.
  root.userData.modelLoadStatus='loading-canonical-humanoid';
  cosplayHandle=createCosplayedHumanoidMonster(spec,{
   detail,withoutFallback:true
  });
  root.add(cosplayHandle.root);
  statusMarker=new THREE.Mesh(new THREE.OctahedronGeometry(.13,0),
   new THREE.MeshBasicMaterial({color:0xd7ab66}));
  statusMarker.name='canonical-humanoid-load-indicator';
  statusMarker.position.y=1;
  root.add(statusMarker);
  cosplayHandle.start('idle',0);
  ready=cosplayHandle.ready.then(result=>{
   if(disposed)return root;
   if(result.source==='canonical-character-cosplay'){
    statusMarker.parent?.remove(statusMarker);
    statusMarker.geometry.dispose();statusMarker.material.dispose();statusMarker=null;
    root.userData.selectedMesh='canonical-character-cosplay';
    root.userData.modelLoadStatus='canonical-humanoid-ready';
    root.traverse(part=>{
     if(part.isMesh){part.castShadow=true;part.receiveShadow=true;}
    });
   }else{
    root.userData.modelLoadStatus='canonical-humanoid-failed';
    root.userData.modelLoadError=result.reason||result.source;
    if(statusMarker)statusMarker.material.color.setHex(0xcf5964);
   }
   return root;
  }).catch(error=>{
   if(!disposed){
    root.userData.modelLoadStatus='canonical-humanoid-failed';
    root.userData.modelLoadError=String(error?.message||error);
    if(statusMarker)statusMarker.material.color.setHex(0xcf5964);
   }
   return root;
  });
 }else{
  // Nonhumanoid catalog and combat use the same authored species sculpt.
  native=createMonsterModel(spec,{detail});
  restBounds=lengthCells?boundsOf(native):null;
  if(lengthCells)root.scale.setScalar(monsterBattleLengthScale(restBounds,cellSize,lengthCells));
  root.add(native);
  startMonsterAction(native,'idle',0);
 }
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
    const previous=restBounds??boundsOf(native);
    const next=boundsOf(loaded.root);
    const axis=lengthCells?'z':'y';
    const span=bounds=>bounds.max[axis]-bounds.min[axis];
    if(![span(previous),span(next)].every(n=>Number.isFinite(n)&&n>.001))
      throw Error('Source GLB has no valid geometry bounds');
    // Scale the visual wrapper independently of the actor's grid cell and AI.
    loaded.root.scale.multiplyScalar(span(previous)/span(next));
    const fitted=boundsOf(loaded.root);
    loaded.root.position.y+=previous.min.y-fitted.min.y;
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
  const technique=resolveMonsterThemeAction(spec,action);
  const next=technique||['idle','walk','run','attack','special','roar','dodge',
    'hit','leap','defeat','guard'].includes(action)?action:'idle';
  if(next!==lastAction){
   if(external)external.play(technique?.base||next);
   else if(cosplayHandle)cosplayHandle.start(next,time);
   else if(native)startMonsterAction(native,next,time);
   lastAction=next;
  }
  if(external){
   const dt=lastTime==null?0:Math.max(0,Math.min(.10,time-lastTime));
   external.update(dt);
  }else if(cosplayHandle)cosplayHandle.update(time);
  else if(native)animateMonsterModel(native,time);
  lastTime=time;
  return true;
 }
 function dispose(){
  if(disposed)return;
  disposed=true;
  if(external){external.dispose();external=null;}
  if(cosplayHandle){cosplayHandle.dispose();cosplayHandle=null;}
  if(native){disposeMonsterSculpture(native);native=null;}
  if(statusMarker){
   statusMarker.parent?.remove(statusMarker);
   statusMarker.geometry.dispose();statusMarker.material.dispose();statusMarker=null;
  }
  root.parent?.remove(root);
 }
 return {root,choice,ready,update,dispose,
  currentModel:()=>external?.root||cosplayHandle?.root||native,
  get source(){return root.userData.selectedMesh;}
 };
}
