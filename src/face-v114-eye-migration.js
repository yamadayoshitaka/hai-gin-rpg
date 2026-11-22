/**
 * V114: only upgrade auto-persisted historical DEFAULT eyes.
 * The studio used to write female-eye-01 (round/open) on load without any
 * explicit action. Returning players should actually see the new natural
 * almond reference on FIRST paint, without resetting their saved character.
 *
 * Never overwrite a manual eye adjustment, another selected eye, or a
 * recognizable non-default/polished custom portrait. No storage mutation;
 * caller persists the resulting explicit canonical controls after first load.
 */
const close=(a,b,eps=.025)=>Number.isFinite(Number(a))&&Math.abs(Number(a)-b)<=eps;
const eyeKeys=['eyeWidth','eyeHeight','irisDiameter','eyeAngle'];
export function migrateV114UneditedAutoSavedEyes({
 savedPreset=null,parts={},controls={},manualOverrides={},naturalControls={}
}={}){
 const untouched={controls,changed:false,reason:'preserved-saved-eye'};
 if(!savedPreset)return {...untouched,reason:'fresh-face-catalog-already-v114'};
 if(Number(parts?.eye)!==0)return {...untouched,reason:'different-eye-style'};
 if(eyeKeys.some(key=>Object.prototype.hasOwnProperty.call(manualOverrides||{},key)))
  return {...untouched,reason:'explicit-manual-eye-preserved'};
 // Old female-eye-01: width 1.12, height 1.28, iris 1.12, angle -4.
 // v47 age recompose multiplied the saved 20s aperture by 1.07. Both
 // snapshots are recognized; any other values are treated as intentional.
 const legacy=close(controls.eyeWidth,1.12)&&
  (close(controls.eyeHeight,1.28,.03)||close(controls.eyeHeight,1.28*1.07,.035))&&
  close(controls.irisDiameter,1.12)&&close(controls.eyeAngle,-4,.01);
 if(!legacy)return {...untouched,reason:'nonstandard-or-custom-eye-preserved'};
 if(!eyeKeys.every(k=>Number.isFinite(Number(naturalControls[k]))))
  return {...untouched,reason:'v114-reference-unavailable'};
 return {controls:{...controls,
  eyeWidth:naturalControls.eyeWidth,eyeHeight:naturalControls.eyeHeight,
  irisDiameter:naturalControls.irisDiameter,eyeAngle:naturalControls.eyeAngle},
  changed:true,reason:'legacy-auto-default-eye-migrated'};
}
