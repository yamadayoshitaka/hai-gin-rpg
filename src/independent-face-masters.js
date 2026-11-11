import * as THREE from 'three';
import {createAnatomicalFaceParts} from './face-feature-meshes.js';

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
 * This function is EXACTLY zero outside the inner 55% half-face width.
 * It cannot change cheek edges, jaw width or the outer silhouette.
 * Exported for regression tests against real head vertices.
 */
export function femaleInnerFeatureDelta({xn,yn,zn,offsetX,depth}){
 const ax=Math.abs(xn),front=smooth(.30,.68,zn);
 // Exact no-op at and beyond the facial-feature boundary, including
 // signed-zero cases, so downstream strict QA can prove no influence.
 if(ax>=.55)return {dx:0,dz:0,noseSupport:0,mouthSupport:0};
 const noseSupport=(1-smooth(.30,.53,ax))*bell(yn,.572,.078)*front;
 const bridgeSupport=(1-smooth(.29,.53,ax))*bell(yn,.624,.082)*front;
 const tipSupport=(1-smooth(.28,.52,ax))*bell(yn,.566,.045)*front;
 const mouthSupport=(1-smooth(.30,.55,ax))*bell(yn,.503,.044)*front;
 return {
  dx:-offsetX*(.35*noseSupport+.29*mouthSupport),
  dz:depth*(.023*bridgeSupport+.014*tipSupport-.016*mouthSupport),
  noseSupport,mouthSupport
 };
}


/**
 * Independent cheek and lower-jaw fairing. v5 only tapered the x=.15
 * central chin, while the real chin edge lies farther out. The front of
 * the lower cheek was also left hollow at x≈.30–.50.
 *
 * - z: restore a broad continuous convex cheek to the corner-of-mouth
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
  *bell(ax,.39,.19)*bell(yn,.465,.106)
  *(1-smooth(.56,.625,yn))*front;
 const mouthCornerSupport=smooth(.16,.24,ax)
  *(1-smooth(.60,.77,ax))*bell(ax,.275,.17)
  *bell(yn,.427,.075)
  *(1-smooth(.56,.625,yn))*front;
 const dz=depth*(.010*cheekSupport+.003*mouthCornerSupport);
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
  code:'male-face-base-v1',label:'男性・美青年ベース',
  jawNarrow:.035,cheekFill:.023,chinLift:.006,
  noseBridge:.008,browRelief:.004,mouthRecess:.006,
  eyeSocketSoftness:.002
 }),
 female:Object.freeze({
  code:'female-face-smooth-source-v6',label:'女性・滑らかな頬＋卵型の顎先（新頭部原型）',
  jawNarrow:.055,cheekFill:.018,chinLift:.002,
  sourceHead:'realistic-head-animation.glb',
  noseBridge:0,browRelief:.001,mouthRecess:0,
  eyeSocketSoftness:.004
 })
});

export function makeIndependentFaceMaster(sourceRoot,gender){
 const spec=FACE_MASTER_SPEC[gender];
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
 const cx=(b.min.x+b.max.x)/2;
 let changed=0,cheekDelta=0,chinDelta=0;
 let addedCheekDepth=0,narrowedJawDistance=0,apexLowering=0;
 let cheekSculptSamples=0,jawSculptSamples=0;
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
  const ovalTransition=bell(yn,.365,.165)*smooth(.18,.56,Math.abs(xn))
    *front*neckLock*contourGuard;
  const cheekSupport=(.019*cheek+.011*lowerCheek)*contourGuard;
  const local=gender==='female'?femaleInnerFeatureDelta({
   xn,yn,zn,offsetX:x-cx,depth:d.z
  }):{dx:0,dz:0};
  const surfaceFairing=gender==='female'?femaleCheekJawDelta({
   xn,yn,zn,offsetX:x-cx,depth:d.z,height:d.y
  }):{dx:0,dy:0,dz:0,cheekSupport:0,jawBand:0,apex:0};
  let nx=gender==='female'?
   x+(x-cx)*(cheekSupport-spec.jawNarrow*ovalTransition)
    +local.dx+surfaceFairing.dx:
   x-(x-cx)*spec.jawNarrow*jaw
      +(x-cx)*(.018*cheek-.012*lowerCheek)
      -(x-cx)*.021*alar;
  // Store the source X exactly at the preserved outer silhouette:
  // float math around zero support can otherwise drift by ~1e-9.
  if(gender==='female'&&Math.abs(xn)>=.86)nx=x;
  const ny=y+d.y*spec.chinLift*chin+surfaceFairing.dy;
  const nz=gender==='female'?
   z+d.z*(spec.cheekFill*(.74*cheek+.92*lowerCheek)
    +.016*chinHollow
    +spec.eyeSocketSoftness*bell(Math.abs(xn),.43,.22)
      *bell(yn,.69,.055)*front)+local.dz+surfaceFairing.dz:
   z+d.z*(spec.cheekFill*(.76*cheek+.45*lowerCheek)
    +spec.browRelief*brow+spec.noseBridge*nose
    -spec.mouthRecess*mouth-.004*alar-.002*tip+.004*chinHollow
    +spec.eyeSocketSoftness*bell(Math.abs(xn),.43,.22)
      *bell(yn,.69,.055)*front);
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
  color:0xbfc3cb,roughness:.84,metalness:0,
  side:THREE.FrontSide,flatShading:false
 });
 face.visible=true;
 face.name=gender.toUpperCase()+'_INDEPENDENT_CLAY_FACE';
 // Anatomical parts are child meshes of the cloned face. Their vertices
 // follow its original local coordinate frame; there is no face-photo plane.
 const parts=createAnatomicalFaceParts(face,{gender});
 face.add(parts.root);
 // Original donor eyes/hair are hidden. Only our explicitly generated
 // eyeball/iris, eyelid and lip triangles can accompany the clay face.
 const triangleCount=geometry.index?
  geometry.index.count/3:p.count/3;
 const report=Object.freeze({
  code:spec.code,gender,sourceVertices:most,
  headTemplate:spec.sourceHead||(gender==='male'?'realistic-head-animation.glb':'unknown'),
  triangles:triangleCount,modifiedVertices:changed,
  cheekVolumeMetric:Number((cheekDelta/p.count).toFixed(9)),
  chinSmoothMetric:Number((chinDelta/p.count).toFixed(9)),
  outerContourXError,outerContourSamples,localizedNoseAndMouthSamples,
  cheekSculptSamples,jawSculptSamples,
  addedCheekDepth:Number(addedCheekDepth.toFixed(7)),
  narrowedJawDistance:Number(narrowedJawDistance.toFixed(7)),
  apexLowering:Number(apexLowering.toFixed(7)),
  cheekJawSculpt:'smooth-head-source-feminine-jaw-v6',
  innerFeatureHalfWidthLimit:.55,
  femaleJawStyle:gender==='female'?'full-cheek-smooth-oval-point-v6':null,
  sourceUntouched:true,sourceGeometryIndependent:face.geometry!==original,
  headOnly:true,bodyUnchanged:true,hairVisible:false,makeupVisible:false,
  material:'neutral-gray-clay',artCertified:false,
  sourceNoseMeshIntegrated:true,facePartMeshCount:parts.report.partMeshCount,
  facePartTriangles:parts.report.partTriangles,
  detailedParts:parts.report
 });
 root.userData.faceMasterReport=report;
 root.updateMatrixWorld(true);
 return {root,face,parts:parts.root,report};
}
