/**
 * Hand-authored Chapter 1 female commander prototype, NOT a mass generator.
 *
 * Numeric parameters feed reversible, REAL 3D preview-mesh transformations.
 * Do not treat the image as a photo-derived 3D scan or art certification.
 * Source GLB and Chapter 1 reference WebP must remain unchanged.
 */
import {FEMALE_COMMANDER_ART_PALETTE} from './chapter-one-character-art-references.js';

export const HEROINE01_MASTER_MODEL_V1=Object.freeze({
 id:'hero-girl-01',
 prototypeVersion:'chapter1-female-commander-sculpt-v1',
 chapter:1,
 image:'assets/story/characters/commander/female-master.webp',
 referenceStatus:'provisional-character-master',
 artApproved:false,
 rigged:false,
 static3D:true,
 look:Object.freeze({...FEMALE_COMMANDER_ART_PALETTE}),
 shape:Object.freeze({
  // These normalized ratios are bounded by FACE_PROPORTION_FIELDS.
  // Wider healthy cheek / less extreme jaw taper avoids deep hollow shadows.
  faceHeight:.955,upperThird:1.021,middleThird:.931,lowerThird:.951,
  jawTaper:.908,cheekRoundness:1.025,chinLength:.937,
  lowerFaceProjection:.770,
  preEarFullness:.695,lowerCheekLateral:.735,parotidWidth:.690,
  // Native eyeballs and upper lids remain attached to their source sockets.
  eyeWidth:1.038,eyeHeight:.880,eyeSpacing:1.008,
  eyeVertical:.001,eyeTilt:.044,
  eyeballScale:.823,eyeSocketDepth:-.0054,
  irisDiameter:.790,pupilDiameter:.745,
  upperLidCoverage:.355,underEyeSoftness:.135,
  browVertical:.004,browEyeGap:1.008,
  browWidth:1.045,browThickness:.705,browAngle:.021,
  noseOverall:.802,noseLength:.894,noseWidth:.785,
  noseBridge:1.018,noseTip:.775,
  mouthWidth:.885,mouthHeight:.875,mouthVertical:.011,
  lipFullness:.735,mouthCorner:.008
 }),
 // Not hair cards: 100k scalp-rooted line segments, 8000 crown micro-ribbons
 // and 520 frontal ribbons. The crown guide is ONE gentle side sweep, not
 // two strong front/back fans leaving a broad V-shaped exposed scalp.
 hair:Object.freeze({
  totalStrands:100000,crownMicroLocks:8000,fringeLocks:520,
  rearLayers:3,rearGuideLocks:12,
  partOffsetHeadWidth:-.18,
  crownForwardFlow:.145,crownBackwardFlow:-.205,
  rootPigmentBlend:.88,
  sideSweepDirection:1
 }),
 costume:Object.freeze({
  base:'silver-armour-navy-fabric',
  metal:'#c9cbd3',fabric:'#263958',goldTrim:'#c3a66f'
 }),
 acceptance:Object.freeze({
  views:Object.freeze(['front','side','back','top']),
  noScalpV:true,noDetachedEyes:true,noLipOnChin:true,
  noHollowCheek:true,noEarPiercing:true,noShoulderClip:true
 })
});
