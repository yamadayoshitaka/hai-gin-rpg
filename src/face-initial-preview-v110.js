/**
 * v110 first-frame face selection contract.
 *
 * Old v40 presets were written automatically on page load, even before a
 * user explicitly selected a body type. Such a persisted 'ultraThin' shape
 * is not a reliable instruction for the initial portrait. The approved
 * initial comparison is 20s / normal with the same geometry as choosing
 * '普通' in the selector. A body selection made explicitly AFTER v110 is
 * preserved across reloads.
 */
import {resolveBodyType,resolveAgeBand} from './character-demographics-v47.js';

export function v110InitialFemaleFaceState({
 savedPreset=null,parts={},controls={}
}={}){
 const hasLegacyPreset=Boolean(savedPreset)&&
  savedPreset.bodySelectionExplicit!==true;
 const selectedBody=hasLegacyPreset?'normal':
  resolveBodyType(parts.bodyType).id;
 const selectedAge=resolveAgeBand(parts.ageBand).id;
 const selectedParts={...parts,bodyType:selectedBody,ageBand:selectedAge};
 const controlsStale=controls.bodyType!==selectedBody||
  controls.ageBand!==selectedAge;
 return {
  parts:selectedParts,
  // A brand-new studio must also run the SAME demographic sculpt as
  // selecting 普通; the raw part defaults lack that age/build transform.
  shouldRecompose:!savedPreset||hasLegacyPreset||controlsStale,
  migratedLegacyBody:hasLegacyPreset&&parts.bodyType!==selectedBody,
  explicitBodySelection: savedPreset?.bodySelectionExplicit===true,
  defaultView:'color',defaultWireframe:false
 };
}
