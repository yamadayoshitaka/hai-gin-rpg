/**
 * Quaternius Superhero actors have +Z-facing faces, but the legacy sculpted
 * monster cosmetics used -Z as facial-forward. Before v4.5.05 this attached
 * makeup behind faces, bat wings over chests and tails at the groin.
 *
 * Keep X side, +Y up, and mirror ONLY the authored Z of the accessory;
 * source skinned body, skeleton, animation and calibrated metre scale are
 * unchanged. Groom fitted to the actual GLB head is already in donor-space
 * and must not be mirrored.
 */
export const CANONICAL_HUMAN_FRONT_Z=1;
export const LEGACY_COSTUME_FRONT_Z=-1;
export const shouldCorrectCostumeFront=
 (canonicalFront=CANONICAL_HUMAN_FRONT_Z,authoredFront=LEGACY_COSTUME_FRONT_Z)=>
  canonicalFront!==authoredFront;

export function alignCostumeToCanonicalFacing(mesh,{
 groom=false,canonicalFront=CANONICAL_HUMAN_FRONT_Z,
 authoredFront=LEGACY_COSTUME_FRONT_Z
}={}){
 if(!mesh)throw Error('Missing anatomical attachment');
 const correct=!groom&&shouldCorrectCostumeFront(canonicalFront,authoredFront);
 if(correct){
  mesh.scale.z*=-1;
  mesh.position.z*=-1;
 }
 mesh.userData={...mesh.userData,
  costumeFacingCorrected:correct,
  costumeIsHeadFittedGroom:!!groom,
  canonicalFrontZ:canonicalFront};
 return mesh;
}
