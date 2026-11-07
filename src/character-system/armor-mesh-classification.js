/**
 * Plate GLBs are authored as a full suit in Blender. In the game the source
 * trouser tubes are REPLACED by individually fitted, joint-driven fabric.
 * Never attach their long originals to the pelvis: it creates two rigid
 * ghost legs alongside the character's two animated legs.
 *
 * Keep this classifier separate from three.js so every shipped GLB can be
 * regression-tested on GitHub Actions without a GPU or glTF loader.
 */
// GLTFLoader sanitizes "plate trouser leg -1" into
// "plate_trouser_leg_-1". Word-boundary regexes fail before underscore.
export function isPlateSourceTrouserLeg(name=''){
 return /(?:^|[^a-z0-9])trouser[ _-]*leg(?:$|[^a-z0-9])/i.test(String(name));
}

export function classifyArmorMesh(part,name=''){
 const n=String(name).toLowerCase();
 if(part==='head')return 'helmet';
 if(part==='chest')return /pauldron|sleeve|cuff|shoulder/.test(n)?'shoulder':'chest';
 if(part==='hands')return 'gauntlet';
 if(part==='feet')return /upper|cuff|ridge/.test(n)?'boot-upper':'boot-foot';
 if(part==='legs'){
  // Actual files use "plate trouser leg -1" / "plate trouser leg 1",
  // NOT the snake-case "trouser_leg" handled by the old implementation.
  if(isPlateSourceTrouserLeg(n))return 'skip';
  if(/pelvis|waist|yoke/.test(n))return 'hip';
  if(/thigh/.test(n))return 'thigh';
  if(/knee/.test(n))return 'knee';
  if(/shin|greave/.test(n))return 'shin';
  // Unknown vertical geometry must never be glued to the pelvis.
  return 'skip';
 }
 return 'skip';
}

/**
 * Plate boots and joint-fitted trousers replace the FULL original Ranger /
 * Peasant lower-body garments, not the underlying human anatomy.
 * The old source boots were still skinned and rendered beside the added
 * plate boots, looking like a second pair of feet in battle.
 */
export function replacedPlateBaseLegMesh(name=''){
 return /^(?:male|female)_(?:ranger|peasant)_(?:legs|feet(?:_boots)?)(?:_|$)/i.test(String(name));
}
