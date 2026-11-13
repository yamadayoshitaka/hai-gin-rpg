import * as THREE from 'three';
import {createAnatomicalFaceParts} from './face-feature-meshes.js';
import {attachAgeDetails} from './face-age-detail-v49.js?v=49';
import {resolveDemographicProfile} from './character-demographics-v47.js?v=51';
import {normalizeFemaleFaceControls,normalizeMaleFaceControls,FEMALE_V7_DEFAULTS} from './face-v7-controls.js';

/**
 * Two independent head-only clay mesh prototypes from the CC0 male and female
 * Blender Studio heads. All work is performed on owned geometry clones.
 * No game body, outfit, source GLB, hair, makeup, or battle model is changed.
 */
const bell=(v,c,w)=>Math.exp(-.5*((v-c)/w)**2);
const smooth=(a,b,v)=>{
 const t=THREE.MathUtils.clamp((v-a)/(b-a),0,1);
 return t*t*(3-2*t);
};

/**
 * Compact-support nose and mouth sculpt.
 * This function is EXACTLY zero outside the inner 28% half-face width.
 * It cannot change cheek edges, jaw width or the outer silhouette.
 * Exported for regression tests against real head vertices.
 */
export function femaleInnerFeatureDelta({xn,yn,zn,offsetX,depth,height=0,controls=FEMALE_V7_DEFAULTS}){
 const ax=Math.abs(xn),front=smooth(.30,.68,zn);
 // Exact no-op at and beyond the facial-feature boundary, including
 // signed-zero cases, so downstream strict QA can prove no influence.
 if(ax>=.28)return {dx:0,dy:0,dz:0,noseSupport:0,mouthSupport:0};
 const noseSupport=(1-smooth(.14,.27,ax))*bell(yn,.572,.055)*front;
 const bridgeSupport=(1-smooth(.13,.26,ax))*bell(yn,.624,.075)*front;
 const tipSupport=(1-smooth(.13,.26,ax))*bell(yn,.566,.045)*front;
 const mouthSupport=(1-smooth(.13,.28,ax))*bell(yn,.503,.029)*front;
 // Nasal tip moves up independently; lower alar rim drops subtly
 // to conceal the nostril from the frontal camera.
 const central=(1-smooth(.10,.26,ax))*front;
 const tipLift=central*bell(yn,.566,.036);
 const rimMask=bell(ax,.18,.068)*bell(yn,.530,.026)*front;
 const bridgeRidge=bell(ax,0,.092)*bell(yn,.653,.098)*front;
 return {
  dx:-offsetX*(.35*noseSupport+.29*mouthSupport),
  dy:height*(.020*controls.noseTipLift*tipLift-.008*controls.nostrilCover*rimMask),
  dz:depth*(.023*bridgeSupport+.014*tipSupport-.016*mouthSupport
   +.020*controls.noseBridgeSharpness*bridgeRidge
   +.004*controls.nostrilCover*rimMask),
  noseSupport,mouthSupport
 };
}


/**
 * Independent cheek and lower-jaw fairing. v5 only tapered the x=.15
 * central chin, while the real chin edge lies farther out. The front of
 * the lower cheek was also left hollow at x≈.30–.50.
 *
 * - z: restore soft volume BELOW the cheekbone, smoothing the hollow toward the corner-of-mouth
 * - x: taper ONLY the lower jaw edge into a small oval/V chin point
 * - y: drop ONLY the centre of the chin tip slightly to remove a flat end
 *
 * Do not change the nose, upper cheeks, eye sockets, back of head, neck
 * attachment, or either side's ear.
 */
export function femaleCheekJawDelta({xn,yn,zn,offsetX,depth,height}){
 const ax=Math.abs(xn),front=smooth(.25,.56,zn);
 // Cheek correction occupies the anterior middle/lower cheek surface.
 // Zero at centre mouth, temples, ears and on the rear skull.
 const cheekSupport=smooth(.16,.25,ax)*(1-smooth(.65,.79,ax))
  *bell(ax,.42,.205)*bell(yn,.455,.125)
  *(1-smooth(.56,.625,yn))*front;
 const mouthCornerSupport=smooth(.16,.24,ax)
  *(1-smooth(.60,.77,ax))*bell(ax,.275,.17)
  *bell(yn,.427,.075)
  *(1-smooth(.56,.625,yn))*front;
 // Refill gaunt mid/lower cheeks in depth rather than ballooning the
 // cheekbone or moving the eye sockets. The masks vanish near ears,
 // lips, jaw apex and the rear of the head.
 const dz=depth*(.022*cheekSupport+.006*mouthCornerSupport);
 // Full support on the actual chin outline, not only at the centreline.
 // Taper smoothly to zero before reaching the cheeks (yn >= .485).
 const jawBand=bell(yn,.30,.105)*(1-smooth(.39,.45,yn))*front;
 const jawEdge=smooth(.10,.23,ax)*(1-smooth(.68,.82,ax));
 const dx=jawBand===0||jawEdge===0?0:-offsetX*.12*jawBand*jawEdge;
 const apex=bell(ax,0,.20)*bell(yn,.255,.068)*front;
 const dy=-height*.003*apex;
 return {dx,dy,dz,cheekSupport,mouthCornerSupport,jawBand,apex};
}

export const FACE_MASTER_SPEC=Object.freeze({
 male:Object.freeze({
  code:'male-shared-head-natural-eyes-v8',label:'男性・共通顔ベース／自然な目元・化粧なし',
  // Match the exact saved female base geometry; only face parts and
  // cosmetics differ for the clean-shaven male derivative.
  jawNarrow:.055,cheekFill:.027,chinLift:.002,
  noseBridge:0,browRelief:.001,mouthRecess:0,
  eyeSocketSoftness:.004
 }),
 female:Object.freeze({
  code:'female-saved-preset-contact-makeup-v8',label:'女性・写真の標準値／カラコン・目元連動・口紅位置調整',
  jawNarrow:.055,cheekFill:.027,chinLift:.002,
  sourceHead:'realistic-head-animation.glb',
  noseBridge:0,browRelief:.001,mouthRecess:0,
  eyeSocketSoftness:.004
 })
});

export function makeIndependentFaceMaster(sourceRoot,gender,{femaleControls={},maleControls={},partSelection=null}={}){
 const spec=FACE_MASTER_SPEC[gender];
 const controls=gender==='male'?normalizeMaleFaceControls(maleControls):
  normalizeFemaleFaceControls(femaleControls);
 if(!sourceRoot?.traverse||!spec)
  throw Error('Real CC0 head hierarchy and male/female gender required');
 const root=sourceRoot.clone(true);
 root.name=gender.toUpperCase()+'_FACE_MASTER_SOURCE_CLONE';
 let face=null,most=0;
 root.traverse(o=>{
  if(!o.isMesh)return;
  const n=o.geometry?.getAttribute('position')?.count||0;
  if(!/sclera|iris|pupil|eyelash|eyebrow|eyelid/i.test(o.name)&&n>most){
   face=o;most=n;
  }
  o.visible=false;
 });
 if(!face||most<1100)throw Error('No high-resolution original human face mesh');
 // Do not mutate the GLB geometry, even when the same source is used twice.
 const original=face.geometry;
 const geometry=original.clone();
 face.geometry=geometry;
 if(face.morphTargetInfluences)face.morphTargetInfluences.fill(0);
 geometry.computeBoundingBox();
 const b=geometry.boundingBox.clone();
 const d=b.getSize(new THREE.Vector3());
 if(d.x<.02||d.y<.02||d.z<.02)throw Error('Invalid real head geometry bounds');
 const p=geometry.getAttribute('position');
 const originalPoints=p.array.slice();
 const demo=resolveDemographicProfile(controls.ageBand,controls.bodyType);
 const cx=(b.min.x+b.max.x)/2;
 let changed=0,cheekDelta=0,chinDelta=0;
 let addedCheekDepth=0,narrowedJawDistance=0,apexLowering=0;
 let cheekSculptSamples=0,jawSculptSamples=0;
 let cheekProtectedSamples=0,maxCheekWidthChange=0;
 let outerContourXError=0,outerContourSamples=0;
 let localizedNoseAndMouthSamples=0;
 // A continuous low-amplitude sculpt, not many stacked portrait morphs.
 // Refill sunken cheeks and soften the jaw without shifting nose, scalp,
 // rear skull, or the neck attachment. Male retains slightly stronger brow.
 for(let i=0;i<p.count;i++){
  const x=originalPoints[i*3],y=originalPoints[i*3+1],z=originalPoints[i*3+2];
  const xn=(x-cx)/(d.x*.5),yn=(y-b.min.y)/d.y,zn=(z-b.min.z)/d.z;
  const front=smooth(.30,.68,zn);
  const neckLock=smooth(.12,.27,yn);
  const cheek=bell(Math.abs(xn),.52,.36)*bell(yn,.515,.135)*front*neckLock;
  const lowerCheek=bell(Math.abs(xn),.61,.32)*bell(yn,.415,.14)*front*neckLock;
  const jaw=bell(yn,.315,.15)*smooth(.21,.48,Math.abs(xn))*neckLock;
  const chin=bell(xn,0,.48)*bell(yn,.26,.14)*front*neckLock;
  const brow=bell(Math.abs(xn),.43,.23)*bell(yn,.755,.07)*front;
  const nose=bell(xn,0,.23)*bell(yn,.605,.10)*front;
  const mouth=bell(xn,0,.35)*bell(yn,.445,.055)*front;
  // The reference has petite alar wings and an understated round tip.
  // Shape the existing facial topology rather than gluing a nose blob
  // onto the skin surface. Leave the true bridge and rear skull unchanged.
  const alar=bell(Math.abs(xn),.23,.17)*bell(yn,.55,.060)*front;
  const tip=bell(xn,0,.19)*bell(yn,.565,.052)*front;
  const chinHollow=bell(Math.abs(xn),.32,.30)*bell(yn,.355,.080)
    *front*neckLock;
  // Localized chin-tip refinement: mid/lower cheeks and jaw angles retain
  // their width, while only the central chin point is made a bit sharper.
  const chinTip=bell(xn,0,.15)*bell(yn,.235,.055)*front*neckLock;
  // Female jaw: preserve the cheek-to-chin convex curve. Do NOT apply
  // the old v3 dual narrowing (jawNarrow plus lowerJaw), or the wide
  // Gaussian mouthCorner that inadvertently collapsed the cheek edges.
  // Beyond 86% of the half-head width, female X stays at the source X.
  const contourGuard=1-smooth(.72,.86,Math.abs(xn));
  const ovalTransition=bell(yn,.365,.115)*smooth(.18,.56,Math.abs(xn))
    *front*neckLock*contourGuard*smooth(.235,.29,yn);
  const cheekSupport=(.019*cheek+.011*lowerCheek)*contourGuard;
  const local=femaleInnerFeatureDelta({
   xn,yn,zn,offsetX:x-cx,depth:d.z,height:d.y,controls
  });
  const surfaceFairing=femaleCheekJawDelta({
   xn,yn,zn,offsetX:x-cx,depth:d.z,height:d.y
  });
  // Shared v8 facial topology and nose/mouth proportions. Masculine
  // profile retains a broader lower jaw and slightly smaller, flatter eyes.
  // Only taper the anterior chin point. The neck, mandibular angles,
  // cheeks and mouth stay unchanged as this slider moves.
  const pointY=smooth(.225,.265,yn)*(1-smooth(.375,.425,yn))
    *bell(yn,.315,.067)*front;
  const pointX=smooth(.08,.17,Math.abs(xn))*
    (1-smooth(.36,.53,Math.abs(xn)));
  const pointGain=controls.jawSharpness;
  const pointDx=-(x-cx)*.065*pointGain*pointX*pointY;
  // Eye-distance edits must also reposition the ANATOMICAL orbital
  // socket in the source head. Previously only the synthetic eye assembly
  // moved, making sclera/irises float outside the original eye openings.
  // Move the FACE'S actual orbital opening with the eye rig.
  // A soft Gaussian displaced only the middle of the socket and left the
  // inner/outer eyelid edge at its old location when the eye moved.
  const apertureLateral=smooth(.085,.17,Math.abs(xn))*
   (1-smooth(.48,.67,Math.abs(xn)));
  const apertureVertical=smooth(.55,.64,yn)*
   (1-smooth(.77,.86,yn));
  const orbitalWeight=apertureLateral*apertureVertical*
   smooth(.34,.56,zn);
  const socketCenterX=cx+Math.sign(xn)*d.x*.123*controls.eyeSpacing;
  const eyeSocketDx=(
   Math.sign(xn)*d.x*.123*(controls.eyeSpacing-1)+
   (x-socketCenterX)*(controls.eyeWidth-1)*.72
  )*orbitalWeight;
  // Width, lid opening and angle reshape the actual eye socket SKIN at
  // the same time as the linked eye-region meshes and eyeliner.
  const eyeAngleRadians=(controls.eyeAngle||0)*Math.PI/180;
  const eyeSocketDy=(Math.tan(eyeAngleRadians)*
   (x-socketCenterX)*.8+
   (y-(b.min.y+d.y*.684))*(controls.eyeHeight-1)*.68
  )*orbitalWeight;
  // v32 landmark-weighted mesh blending; modify contiguous original skin.
  const noseMask=bell(xn,0,.21)*bell(yn,.58,.084)*front;
  const mouthMask=bell(xn,0,.35)*bell(yn,.50,.052)*front;
  const smileMask=bell(Math.abs(xn),.25,.20)*bell(yn,.50,.034)*front;
  const noseOffsetX=d.x*.004*controls.nosePositionX*noseMask+
   d.x*.010*(controls.noseAngle*Math.PI/180)*(yn-.62)*noseMask;
  const mouthOffsetX=d.x*.004*controls.mouthPositionX*mouthMask;
  const faceMorphX=-(x-cx)*.022*controls.faceMorph*lowerCheek*contourGuard;
  const faceMorphZ=d.z*.018*controls.faceMorph*cheek*contourGuard;
  const browFitY=d.y*.006*controls.eyePositionY*orbitalWeight;
  const noseFitY=d.y*.006*controls.nosePositionY*noseMask;
  const mouthFitY=d.y*(.006*controls.mouthPositionY*mouthMask+
   .009*controls.mouthSmile*smileMask+
   .015*(controls.mouthAngle*Math.PI/180)*xn*mouthMask);
  let nx=x+(x-cx)*(cheekSupport-spec.jawNarrow*ovalTransition)
    +local.dx+surfaceFairing.dx*.9+pointDx+eyeSocketDx+
    noseOffsetX+mouthOffsetX+faceMorphX;
  // Store the source X exactly at the preserved outer silhouette:
  // float math around zero support can otherwise drift by ~1e-9.
  if(Math.abs(xn)>=.86)nx=x;
  const pointApex=smooth(.225,.265,yn)*(1-smooth(.34,.40,yn))
    *bell(yn,.282,.045)*bell(xn,0,.16)*front;
  let ny=y+d.y*spec.chinLift*chin+surfaceFairing.dy*.9
    +local.dy-d.y*.0025*pointGain*pointApex+eyeSocketDy+
    browFitY+noseFitY+mouthFitY;
  // v47 age × weight: deform ORIGINAL source-head vertices, never paste
  // spheres or detachable wrinkles on top of the face.
  const fullness=demo.body.faceFullness;
  const demographicWidthDelta=(x-cx)*fullness*
   (.075*cheek+.052*lowerCheek+.022*chin)*contourGuard-
   (x-cx)*demo.age.sag*(.014*lowerCheek+.010*jaw)*contourGuard;
  nx+=demographicWidthDelta;
  const ageSag=d.y*demo.age.sag*
   (.010*lowerCheek+.005*bell(yn,.58,.13)*front);
  const faceAgeY=-ageSag+
   d.y*demo.age.cheekRound*.009*cheek;
  const forehead=bell(xn,0,.76)*front;
  const foreheadLines=[.745,.784,.822].reduce((sum,at,k)=>
   sum+Math.exp(-Math.pow((yn-at)/.0075,2))*(.73+.13*k),0)*forehead;
  const crowsFeet=bell(Math.abs(xn),.53,.12)*
   bell(yn,.68,.095)*front*
   (Math.sin((yn-.645)*d.y*260+Math.abs(xn)*22)*.42+.58);
  const smileCrease=bell(Math.abs(xn),.31,.068)*
   bell(yn,.495,.095)*front;
  const ageLines=d.z*demo.age.wrinkles*
   (-.013*foreheadLines+.011*crowsFeet-.012*smileCrease-
    .007*bell(Math.abs(xn),.32,.13)*bell(yn,.636,.028)*front);
  ny+=faceAgeY;
  const nz=z+d.z*(spec.cheekFill*(.74*cheek+1.11*lowerCheek)
    +.016*chinHollow
    +spec.eyeSocketSoftness*bell(Math.abs(xn),.43,.22)
      *bell(yn,.69,.055)*front)+local.dz+surfaceFairing.dz
    +d.z*.003*pointGain*pointApex+faceMorphZ+
    d.z*(.006*controls.nosePositionZ*noseMask+
     .005*controls.mouthPositionZ*mouthMask)+
    d.z*fullness*(.065*cheek+.040*lowerCheek+.022*chin)+
    d.z*demo.age.cheekRound*.014*cheek-
    d.z*demo.age.sag*(.012*lowerCheek+.010*chin)+ageLines;
  if(gender==='female'){
   if(Math.abs(xn)>=.86){
    outerContourSamples++;
    outerContourXError=Math.max(outerContourXError,Math.abs(nx-x));
   }
   if(local.noseSupport>.01||local.mouthSupport>.01)
    localizedNoseAndMouthSamples++;
   if(surfaceFairing.cheekSupport>.05){
    cheekSculptSamples++;
    addedCheekDepth+=Math.max(0,surfaceFairing.dz);
   }
   if(surfaceFairing.jawBand>.05){
    jawSculptSamples++;
    narrowedJawDistance+=Math.abs(surfaceFairing.dx);
   }
   apexLowering+=Math.abs(surfaceFairing.dy);
   // Source-derived cheek sidewall must not be dragged inward by nose
   // or mouth morphs. Real 3D guard, not a parameter-only assertion.
   if(Math.abs(xn)>=.30&&Math.abs(xn)<=.58
      &&yn>=.46&&yn<=.62&&zn>.58){
    cheekProtectedSamples++;
    // QA protects cheek sidewalls against NOSE and MOUTH morphs.
    // Subtract the intentional age/build face silhouette before measuring.
    maxCheekWidthChange=Math.max(maxCheekWidthChange,
     Math.abs((nx-demographicWidthDelta)-x));
   }
  }
  p.setXYZ(i,nx,ny,nz);
  if(Math.abs(nx-x)+Math.abs(ny-y)+Math.abs(nz-z)>1e-6)changed++;
  cheekDelta+=Math.max(0,nz-z)*cheek;
  chinDelta+=Math.abs(ny-y)*chin;
 }
 p.needsUpdate=true;
 geometry.computeVertexNormals();
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 face.material=new THREE.MeshStandardMaterial({
  color:0xbfc3cb,roughness:.70,metalness:0,
  side:THREE.FrontSide,flatShading:false
 });
 face.visible=true;
 face.name=gender.toUpperCase()+'_INDEPENDENT_CLAY_FACE';
 face.userData.colorRole='skin';
 if(partSelection)face.userData.v32SelectedPartIds={...partSelection};
 // Anatomical parts are child meshes of the cloned face. Their vertices
 // follow its original local coordinate frame; there is no face-photo plane.
 const parts=createAnatomicalFaceParts(face,{gender,controls});
 face.add(parts.root);
 const ageDetail=attachAgeDetails(face,demo.ageBand);
 // Original donor eyes/hair are hidden. Only our explicitly generated
 // eyeball/iris, eyelid and lip triangles can accompany the clay face.
 const triangleCount=geometry.index?
  geometry.index.count/3:p.count/3;
 const report=Object.freeze({
  code:spec.code,gender,sourceVertices:most,
  v47Demographics:{ageBand:demo.ageBand,bodyType:demo.bodyType,wrinkleStrength:demo.age.wrinkles,faceFullness:demo.faceFullness},
  v49AgeCreases:ageDetail,
  headTemplate:spec.sourceHead||(gender==='male'?'realistic-head-animation.glb':'unknown'),
  triangles:triangleCount,modifiedVertices:changed,
  cheekVolumeMetric:Number((cheekDelta/p.count).toFixed(9)),
  chinSmoothMetric:Number((chinDelta/p.count).toFixed(9)),
  outerContourXError,outerContourSamples,localizedNoseAndMouthSamples,
  cheekSculptSamples,jawSculptSamples,
  addedCheekDepth:Number(addedCheekDepth.toFixed(7)),
  narrowedJawDistance:Number(narrowedJawDistance.toFixed(7)),
  apexLowering:Number(apexLowering.toFixed(7)),
  cheekProtectedSamples,maxCheekWidthChange:Number(maxCheekWidthChange.toFixed(7)),
  cheekJawSculpt:'smooth-head-source-feminine-jaw-v6',
  femaleControls:gender==='female'?Object.freeze({...controls}):null,
  maleControls:gender==='male'?Object.freeze({...controls}):null,
  orbitalSocketShiftEnabled:true,orbitalSocketSpacing:controls.eyeSpacing,
  sharedFemaleBase:true,maleNoMakeup:gender==='male',
  innerFeatureHalfWidthLimit:.28,
  femaleJawStyle:gender==='female'?'full-cheek-smooth-oval-point-v6':null,
  sourceUntouched:true,sourceGeometryIndependent:face.geometry!==original,
  headOnly:true,bodyUnchanged:true,hairVisible:false,makeupVisible:false,
  v32SelectedPartIds:partSelection?{...partSelection}:null,
  material:'neutral-gray-clay',artCertified:false,
  sourceNoseMeshIntegrated:true,facePartMeshCount:parts.report.partMeshCount,
  facePartTriangles:parts.report.partTriangles,
  detailedParts:parts.report
 });
 root.userData.faceMasterReport=report;
 root.updateMatrixWorld(true);
 return {root,face,parts:parts.root,report};
}
