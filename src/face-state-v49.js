/**
 * v49: Manual edits are immutable overrides on freshly resolved face parts.
 * Age and body changes are recalculated, not cumulatively applied, so an
 * edited eye cannot revert to an old preset when an age selector changes.
 */
import {normalizeFemaleFaceControls,normalizeMaleFaceControls} from './face-v7-controls.js';
import {applyDemographicFaceControls} from './character-demographics-v47.js?v=49';
import {polishHeroFaceControls} from './hero-face-presets-v45.js';
export function resolveEditedFaceControls(gender,partControls={},ageBand='twenties',
 bodyType='normal',overrides={},completeFace=false){
 if(!['female','male'].includes(gender))throw Error('Unknown face gender');
 const picked=completeFace?polishHeroFaceControls(gender,partControls):partControls;
 const manual=completeFace?{}:overrides;
 const controls=applyDemographicFaceControls({...picked,...manual},
  ageBand,bodyType,gender);
 return gender==='female'?normalizeFemaleFaceControls(controls):
  normalizeMaleFaceControls(controls);
}
export function recordFaceManualEdit(overrides,key,value){
 if(typeof key!=='string'||!/^[a-z][a-zA-Z0-9]*$/.test(key))
  throw Error('Bad face control name');
 const number=Number(value);
 if(!Number.isFinite(number))throw Error('Face edit must be finite');
 overrides[key]=number;
 return overrides;
}
