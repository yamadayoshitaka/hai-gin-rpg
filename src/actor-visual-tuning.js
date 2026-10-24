/** Declarative world-unit character/camera sizing contract.
 * One place for tuning scales; no hidden per-model multipliers in renderer.
 * Height refers to the visible model in current game world units, not source glTF units.
 */
export const ACTOR_VISUAL_TUNING=Object.freeze({
 hero:{targetHeight:1.42,scaleMultiplier:1,offset:[0,0,0],cameraDistanceMultiplier:1.38,cameraHeightOffset:0.38},
 outdoorNpc:{targetHeight:1.33,scaleMultiplier:1,offset:[0,0,0]},
 indoorNpc:{targetHeight:1.32,scaleMultiplier:1,offset:[0,0,0]},
 sourceScaleCorrection:{Male_Peasant:0.26,Female_Peasant:0.26,Male_Ranger:0.26,Female_Ranger:0.26},
 armRestAngleRadians:1.05,
 profiles:{child:0.76,adult:1,sturdy:1.04,tall:1.08,slim:0.98},
 characterOverrides:{'royal-king':1.04,'castle-sentinel':1.06,'child':0.76},
 bounds:{minSourceHeight:0.08,maxSourceHeight:5,maxRenderedHeight:2.0},
});
export function resolveActorVisualTuning(preset,scene='outdoor'){
 const kind=preset?.role==='hero'?'hero':scene==='indoor'?'indoorNpc':'outdoorNpc';
 const base=ACTOR_VISUAL_TUNING[kind];
 const bodyFactor=ACTOR_VISUAL_TUNING.profiles[preset?.body]??1;
 const characterFactor=ACTOR_VISUAL_TUNING.characterOverrides[preset?.id]??1;
 return Object.freeze({...base,targetHeight:base.targetHeight*bodyFactor*characterFactor});
}
export function validateActorVisualTuning(){
 for(const name of ['hero','outdoorNpc','indoorNpc']){
  const t=ACTOR_VISUAL_TUNING[name];
  if(!Number.isFinite(t.targetHeight)||t.targetHeight<=0||!Number.isFinite(t.scaleMultiplier)||t.scaleMultiplier<=0||!Array.isArray(t.offset)||t.offset.length!==3||!t.offset.every(Number.isFinite))throw Error('Invalid actor tuning '+name);
 }
 return true;
}
