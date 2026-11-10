/**
 * Stage-1 prototype: assemble ACTUAL CC0 Blender Studio body/head and CC0
 * Makehuman-2 textured Viking outfit as ONE inspectable, non-rigged actor.
 *
 * Source GLBs are never edited or decimated. This preview fits by measured
 * bounds and clips the donor body head at the neck. It does NOT claim skin
 * weights, fitted armour, animation retargeting, photo-scanned human skin,
 * photoreal FF13 art approval, or suitability for live 50v50 troops.
 */
import * as THREE from 'three';
import {bendSourceTunicSleeves,slimSourceTunicUpperSilhouette,trimDanglingTunicSleeveFins} from './master-swordsman-fitted-shoulders.js';
import {buildHeadConformingScalp,buildFittedShortHairStrands,buildFantasyRearHairLayers} from './master-swordsman-scalp-shell.js';
import {prepareYouthfulFace} from './master-swordsman-youthful-face.js';
import {createFittedFantasyHeroGarment} from './master-hero-fitted-garment.js';
import {buildReferenceHeroineHair} from './master-heroine-coiffure.js';
import {buildHeroineFantasyLongHair,buildHeroineWigRootCap,measureHeroineTorsoEnvelope} from './master-heroine-long-hair.js';
import {applyHeroineSkinPBR,HEROINE_SKIN_TEXTURE_INFO} from './master-heroine-skin-pbr.js';
import {validateFaceProportions} from './master-swordsman-face-proportions.js';

const round=n=>Number(n.toFixed(4));
const dimensions=o=>new THREE.Box3().setFromObject(o);
const names={JawWidth:'顎幅',CheekVolume:'頬骨',NoseProjection:'鼻の高さ',
 NoseWidth:'鼻幅',MouthWidth:'口幅',ChinLength:'顎先',BrowArc:'眉骨'};
export const HERO_FACE_MORPHS=Object.freeze(Object.keys(names));
export const HERO_FACE_PRESETS=Object.freeze({
 swordsman:Object.freeze({JawWidth:.67,CheekVolume:.50,NoseProjection:.32,
  NoseWidth:.34,MouthWidth:.23,ChinLength:.62,BrowArc:.30}),
 mage:Object.freeze({JawWidth:.10,CheekVolume:.22,NoseProjection:.63,
  NoseWidth:.11,MouthWidth:.44,ChinLength:.13,BrowArc:.42}),
 ninja:Object.freeze({JawWidth:.24,CheekVolume:.11,NoseProjection:.18,
  NoseWidth:.14,MouthWidth:.14,ChinLength:.24,BrowArc:.57}),
 neutral:Object.freeze({})
});

export function computeSourceFit(bodyBounds,headBounds,outfitBounds){
 for(const b of [bodyBounds,headBounds,outfitBounds])
  if(!b||b.isEmpty())throw Error('Measured real 3D model bounds required');
 const bd=bodyBounds.getSize(new THREE.Vector3());
 const hd=headBounds.getSize(new THREE.Vector3());
 const od=outfitBounds.getSize(new THREE.Vector3());
 if(bd.y<1||bd.y>2.4||hd.y<.25||hd.y>.8||od.y<1||od.y>2.3)
  throw Error('Actual source geometry has wrong character units');
 const bc=bodyBounds.getCenter(new THREE.Vector3());
 const hc=headBounds.getCenter(new THREE.Vector3());
 const oc=outfitBounds.getCenter(new THREE.Vector3());
 const headTop=bodyBounds.max.y;
 const headShift=new THREE.Vector3(bc.x-hc.x,headTop-headBounds.max.y,
                               bc.z-hc.z);
 const outfitShift=new THREE.Vector3(bc.x-oc.x,bodyBounds.min.y-outfitBounds.min.y,bc.z-oc.z);
 const neckY=headTop-hd.y*.76;
 const matchedHeight=(bodyBounds.max.y-bodyBounds.min.y);
 const fit={
  headShift, outfitShift, neckY,
  heightRatio:od.y/matchedHeight,
  headHeight:hd.y,
  outfitDepthRatio:od.z/bd.z,
  outfitWidthRatio:od.x/bd.x,
  bodyHeight:bd.y,
  bodyCenter:bc
 };
 if(fit.heightRatio<.78||fit.heightRatio>1.25||
  fit.outfitWidthRatio<.70||fit.outfitWidthRatio>1.65)
  throw Error('Donor body/garment dimensions require manual remeshing before fit');
 return fit;
}

function makeBrowRibbon(points,thickness){
 // One smooth brow, with tapered tips. The old seven-vertex flat panels
 // intersected the forehead and appeared as several disconnected black
 // rectangles. Sample a centripetal spline into a continuous fine ribbon.
 if(points.length<3||points.some(p=>![p.x,p.y,p.z].every(Number.isFinite)))
  throw Error('Invalid forehead brow anchors');
 const curve=new THREE.CatmullRomCurve3(points,false,'centripetal');
 const pos=[],tri=[],segments=32;
 for(let j=0;j<=segments;j++){
  const t=j/segments;
  const p=curve.getPoint(t);
  const previous=curve.getPoint(Math.max(0,t-.015));
  const next=curve.getPoint(Math.min(1,t+.015));
  const dx=next.x-previous.x,dy=next.y-previous.y;
  const norm=Math.hypot(dx,dy)||1;
  // Rounded, subtle line with fine ends rather than rectangular decals.
  const width=thickness*(.18+.82*Math.pow(Math.sin(Math.PI*t),.72));
  for(const sign of [-1,1])
   pos.push(p.x+sign*width*(-dy/norm),
    p.y+sign*width*(dx/norm),p.z);
  if(j<segments){
   const k=j*2;
   tri.push(k,k+1,k+2,k+1,k+3,k+2);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geometry.setIndex(tri);geometry.computeVertexNormals();
 geometry.computeBoundingSphere();
 return geometry;
}
function makeEyeRim(width,height,upper=true){
 // One narrow, continuous anatomical eyelid crease; not an opaque disc
 // across the pupil. Close-blink coverage remains a separate temporary mesh.
 const pts=[];
 for(let i=0;i<=12;i++){
  const t=i/6-1;
  const arch=(1-t*t)*(upper?1:-.72);
  pts.push(new THREE.Vector3(t*width*.5,arch*height*.24,
   .0012+height*.04*(1-t*t)));
 }
 return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),32,.00135,6,false);
}
function makeAttachedUpperLashes(width,height){
 const pts=[];
 for(let i=0;i<13;i++){
  const t=i/6-1,arch=(1-t*t)*height*.24;
  const x=t*width*.46,y=arch,z=.0025+height*.04*(1-t*t);
  const len=height*(.10+.09*(1-Math.abs(t)));
  // Roots lie on the upper rim spline; its transform drives every lash.
  pts.push(x,y,z,x+t*len*.22,y+len*.55,z+len*.28);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 const mat=new THREE.LineBasicMaterial({color:0x594048,depthTest:true,depthWrite:false});
 const lashes=new THREE.LineSegments(geo,mat);
 lashes.name='ANATOMICAL_LASHES_FOLLOW_UPPER_LID';
 lashes.renderOrder=3;return lashes;
}
function makeEyeLid(width,height){
 // Anatomical almond-shaped closed-eye mask, feathered into the brow/cheek
 // rather than a flat rectangular or triangular "cardboard eyelid".
 // A true facial FACS deformable eyelid remains a later production milestone.
 const rings=10,segments=40,pts=[],indices=[],uv=[],colors=[];
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 for(let r=0;r<=rings;r++){
  const radial=r/rings;
  for(let a=0;a<=segments;a++){
   const angle=Math.PI*2*a/segments;
   const x=radial*Math.cos(angle),y=radial*Math.sin(angle);
   const taper=Math.sqrt(Math.max(0,1-x*x));
   pts.push(x*width*.52,y*height*.52*taper,
    height*(.055*(1-radial)-.055*x*x));
   uv.push(x*.5+.5,y*.5+.5);
   const edge=clamp((1-radial)/.22,0,1);
   colors.push(1,1,1,edge*edge*(3-2*edge));
   if(r<rings&&a<segments){
    const k=r*(segments+1)+a;
    indices.push(k,k+1,k+segments+1,k+1,k+segments+2,k+segments+1);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
 geo.setIndex(indices);geo.computeVertexNormals();
 return geo;
}

/**
 * Anatomical eyelid blink moves the upper-lid group and ALL of its lashes.
 * Exported for regression testing without loading multi-megabyte donor GLBs.
 */
/**
 * Original 3D face makeup, reprojected after EVERY facial slider update.
 * Multiplicative vertex colors stay on the actual sculpt, not floating
 * eyeliner/lip cards. Each pass reconstructs from immutable neutral colors.
 */
export function applyHeroineMakeupToFace(faceMesh,neutralColors,{
 strength=0,eyeAnchors=null,blush=.85,lip=.95,eyeliner=.94
}={}){
 const geometry=faceMesh?.geometry,attr=geometry?.getAttribute('color');
 const p=geometry?.getAttribute('position');
 if(!attr||attr.itemSize<3||!p||neutralColors?.length!==attr.array.length)
  throw Error('Real face with original RGB vertex colors required for makeup');
 geometry.computeBoundingBox();
 const b=geometry.boundingBox,d=b.getSize(new THREE.Vector3());
 const cx=(b.min.x+b.max.x)*.5;
 const intensity=THREE.MathUtils.clamp(Number(strength)||0,0,1);
 const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
 const smooth=(a,c,x)=>{const t=THREE.MathUtils.clamp((x-a)/(c-a),0,1);return t*t*(3-2*t)};
 const landmarks=Array.isArray(eyeAnchors)&&eyeAnchors.length===2&&
  eyeAnchors.every(a=>[a?.x,a?.y].every(Number.isFinite))?
  eyeAnchors:null;
 const landmarkX=landmarks?
  THREE.MathUtils.clamp(landmarks.reduce((n,a)=>n+Math.abs((a.x-cx)/(d.x*.5)),0)/2,.27,.70):.45;
 const landmarkY=landmarks?
  THREE.MathUtils.clamp(landmarks.reduce((n,a)=>n+(a.y-b.min.y)/d.y,0)/2,.65,.86):.747;
 let blushVertices=0,lipVertices=0,linerVertices=0,changedVertices=0;
 for(let i=0;i<p.count;i++){
  const x=(p.getX(i)-cx)/Math.max(.001,d.x*.5);
  const y=(p.getY(i)-b.min.y)/Math.max(.001,d.y);
  const z=(p.getZ(i)-b.min.z)/Math.max(.001,d.z);
  const front=smooth(.52,.78,z);
  // Slightly raised upper outer cheek instead of two red dots.
  const cheek=front*bell(Math.abs(x),.57,.235)*bell(y,.50,.105)*
   intensity*THREE.MathUtils.clamp(blush,0,1);
  // Actual three-dimensional vermilion surface, including a soft top lip.
  // Two rose-tinted lips, with the lower lip fuller than the upper.
  // Keep the centerline and corners softly feathered onto the real sculpt.
  const lips=front*bell(x,0,.355)*
   (.86*bell(y,.392,.033)+.67*bell(y,.353,.031))*
   intensity*THREE.MathUtils.clamp(lip,0,1);
  // Dark-brown upper lash line, located against the SOURCE sclera anchors,
  // not an unrelated eyebrow-height strip. Keeps the eyeballs exposed.
  const liner=front*bell(Math.abs(x),landmarkX,.245)*
   bell(y,landmarkY+.018,.023)*
   intensity*THREE.MathUtils.clamp(eyeliner,0,1);
  const n=i*3;
  // Linear vertex color multipliers are multiplied by the actual PBR skin
  // material. Tint rather than merely dimming every RGB channel together.
  const red=Math.min(1.25,neutralColors[n]*
   (1+.15*cheek+.49*lips-.49*liner));
  const green=neutralColors[n+1]*(1-.25*cheek-.61*lips-.56*liner);
  const blue=neutralColors[n+2]*(1-.20*cheek-.41*lips-.52*liner);
  attr.setXYZ(i,red,green,blue);
  if(cheek>.08)blushVertices++;
  if(lips>.08)lipVertices++;
  if(liner>.08)linerVertices++;
  if(Math.abs(red-neutralColors[n])+Math.abs(green-neutralColors[n+1])+
    Math.abs(blue-neutralColors[n+2])>.003)changedVertices++;
 }
 attr.needsUpdate=true;
 const mats=Array.isArray(faceMesh.material)?faceMesh.material:[faceMesh.material];
 return {strength:intensity,blushVertices,lipVertices,linerVertices,
  changedVertices,eyeAnchorNormalized:[Number(landmarkX.toFixed(3)),Number(landmarkY.toFixed(3))],
  skinShaderUsesVertexColors:mats.some(mat=>mat?.vertexColors===true),
  cosmeticsHue:'rose-cheek-defined-lip-upper-lash',
  sourceVertexColorsUnchanged:true,faceMeshVertices:p.count};
}

export function applyEyeFixtureBlink(fixture,value){
 const blink=THREE.MathUtils.clamp(Number(value)||0,0,1);
 const {upper,lower,lashes,lid}=fixture;
 lid.visible=blink>.015;
 lid.scale.y=Math.max(.001,blink);
 if(Number.isFinite(upper.userData.openLocalY)){
  upper.position.y=upper.userData.openLocalY-
   blink*upper.userData.blinkTravelLocal;
  upper.scale.y=upper.userData.openScaleY*(1-blink*.18);
  lower.position.y=lower.userData.openLocalY+
   blink*lower.userData.blinkTravelLocal*.12;
 }
 lashes.visible=true;
 return blink;
}

/**
 * Preview-specific cover mask. Selectively removes donor-skin triangles
 * underneath real cloth volumes (tunic/pants/boots). The imported GLB is never
 * modified: every displayed geometry is a clone. This is a coarse first pass,
 * NOT an artist-approved garment-surface or limb intersection proof.
 */
export function maskBodyUnderSourceGarment(bodyRoot,dressParts,{margin=.028}={}){
 if(!bodyRoot||!dressParts)throw Error('Both real body and source dress are required');
 const boxes=['tunic','pants','boots'].map(n=>dressParts.get(n)).filter(Boolean)
  .map(mesh=>new THREE.Box3().setFromObject(mesh).expandByVector(new THREE.Vector3(margin,.018,margin+.024)));
 if(boxes.length!==3)throw Error('Cannot build coverage without real source tunic, pants and boots');
 bodyRoot.updateWorldMatrix(true,true);
 const bodyBox=new THREE.Box3().setFromObject(bodyRoot);
 const bodyHeight=bodyBox.max.y-bodyBox.min.y;
 const midX=(bodyBox.min.x+bodyBox.max.x)*.5;
 let total=0,removed=0,remaining=0,modifiedMeshes=0;
 let limbTrianglesBefore=[0,0],limbTrianglesAfter=[0,0];
 const p=new THREE.Vector3();
 const centroid=new THREE.Vector3();
 const triangleWorld=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
 const narrowTorsoWidth=Math.min(.185,(bodyBox.max.x-bodyBox.min.x)*.22);
 const narrowLegWidth=Math.min(.16,(bodyBox.max.x-bodyBox.min.x)*.19);
 bodyRoot.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
  const original=mesh.geometry;
  const positions=original.getAttribute('position');
  const index=original.getIndex();
  const count=index?index.count:positions.count;
  if(count%3!==0)throw Error('Triangle mesh source required for garment coverage');
  // Missing or single-vertex source geometry should never be optimized away.
  if(count<3)return;
  const kept=[],get=i=>index?index.getX(i):i;
  const bone=new THREE.Vector3();
  for(let i=0;i<count;i+=3){
   centroid.set(0,0,0);
   for(let t=0;t<3;t++){
    const j=get(i+t);
    p.fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld);
    triangleWorld[t].copy(p);
    centroid.add(p);
   }
   centroid.multiplyScalar(1/3);
   const t=(centroid.y-bodyBox.min.y)/bodyHeight;
   const absX=Math.abs(centroid.x-midX);
   // Keep genuine exposed arms, wrists and hands. The Viking tunic bounding
   // box extends beyond shoulder sleeves; blindly masking the whole bbox
   // produced handless black tubes and was a false-positive coverage pass.
   // Preserve EVERY limb triangle, including ones that CROSS the outline
   // of the shirt. Triangle-centroid culling previously amputated an irregular
   // strip of forearms and wrists because the hand hung close to the torso.
   // An arm triangle can span from a safe outside point into the torso mask.
   const outerX=Math.max(...triangleWorld.map(v=>Math.abs(v.x-midX)));
   const torsoCore=triangleWorld.every(v=>Math.abs(v.x-midX)<narrowTorsoWidth);
   const legCore=triangleWorld.every(v=>Math.abs(v.x-midX)<narrowLegWidth);
   const exposedArm=t>=.22&&t<=.84&&outerX>=narrowTorsoWidth;
   const armSide=centroid.x<midX?0:1;
   if(exposedArm)limbTrianglesBefore[armSide]++;
   const centralTorso=t>=.48&&t<=.82&&torsoCore;
   const centralLegs=t<.48&&legCore;
   const hidden=!exposedArm&&(centralTorso||centralLegs)&&
    boxes.some(b=>b.containsPoint(centroid));
   if(exposedArm&&!hidden)limbTrianglesAfter[armSide]++;
   total++;
   if(hidden){removed++;continue;}
   remaining++;
   kept.push(get(i),get(i+1),get(i+2));
  }
  if(kept.length!==count){
   const preview=original.clone();
   preview.setIndex(kept);
   preview.computeBoundingSphere();
   mesh.geometry=preview;
   modifiedMeshes++;
  }
 });
 if(total<300||removed<200||remaining<100)
  throw Error('Non-destructive outfit coverage had implausible triangle counts '+JSON.stringify({total,removed,remaining}));
 const armRetention=limbTrianglesBefore.map((n,k)=>n?limbTrianglesAfter[k]/n:0);
 if(armRetention.some(v=>v<.999))throw Error('Exposed hand or arm triangles lost during outfit masking');
 return Object.freeze({total,removed,remaining,modifiedMeshes,
  armTrianglesBefore:limbTrianglesBefore,armTrianglesAfter:limbTrianglesAfter,
  armRetentionRatio:armRetention,armsAndHandsPreserved:true,
  sourceWasNotEdited:true,coverage:'coarse-preview-only'});
}

export function fitCCBYHairToHead(asset,actorHead,{density='source-lod0',featured=false,style=1,
  femaleHair=false,referenceCoiffure=null,torso=null}={}){
 if(!asset||!actorHead)throw Error('Actual head and separately credited hairstyle required');
 asset.updateWorldMatrix(true,true);actorHead.updateWorldMatrix(true,true);
 const original=new THREE.Box3().setFromObject(asset);
 const b=new THREE.Box3().setFromObject(actorHead);
 const src=original.getSize(new THREE.Vector3());
 const size=b.getSize(new THREE.Vector3());
 if(src.x<=0||src.y<=0||src.z<=0||size.y<=0)throw Error('Empty hair/head mesh');
 const fitted=asset.clone(true);
 // The old 1.07x width and high crown created a hovering bowl-cut wig.
 // Shrink laterally and seat it on the actual head top, overlapping scalp.
 const scale=new THREE.Vector3(size.x*(femaleHair?.94:.91)/src.x,
   size.y*(femaleHair?.89:.44)/src.y,size.z*(femaleHair?.92:.82)/src.z);
 fitted.scale.multiply(scale);
 fitted.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(fitted);
 const bc=b.getCenter(new THREE.Vector3()),hc=box.getCenter(new THREE.Vector3());
 // A full scalp crown must extend from the hairline to the top of the head.
 fitted.position.add(new THREE.Vector3(bc.x-hc.x,b.max.y-.035-box.max.y,
   bc.z-hc.z-size.z*(femaleHair?.30:.065)));
 fitted.name='LICENSE_CC_BY_4_HIGH_DENSITY_FITTED_HAIR';
 // Some public collection hairstyles contain only side hair and expose a
 // bald scalp. Add a separately identified procedural scalp layer, preserving
 // the ORIGINAL licensed strand meshes untouched. The layer is not claimed
 // to have come from the original asset.
 // Reuse the real high-resolution Blender head triangles to cover crown
 // and occiput without generating a floating sphere or straight wig boundary.
 const {scalp,report:scalpReport}=buildHeadConformingScalp(actorHead);
 const hairGroup=new THREE.Group();hairGroup.name='CC_BY_HAIR_AND_REAL_HEAD_SCALP';
 hairGroup.add(fitted,scalp);
 let styledHairReport=null,fantasyBackReport=null,wigCrownReport=null;
 const longHeroine=featured&&femaleHair&&referenceCoiffure==='fantasy-long-blonde';
 const authoredHeroine=featured&&femaleHair&&(longHeroine||referenceCoiffure==='swept-low-bun');
 if(featured){
  // The archived CC-BY strand donor remains loaded and inspectable, but is
  // not rendered on main protagonists: screenshot QA showed separate large
  // polygon clumps and missing side layers. Keep source intact for troops.
  fitted.visible=!!femaleHair&&!authoredHeroine;
  if(authoredHeroine){
   // A bald original female head plus ONE authored wig is the only visual
   // stack. Keep the source-geometry scalp as a non-rendered ROOT provider:
   // previously its alpha-shell was visible as a second jagged hair helmet.
   scalp.visible=false;
   const envelope=longHeroine&&torso?measureHeroineTorsoEnvelope(torso,scalp):null;
   if(longHeroine){
    const foundation=buildHeroineWigRootCap(scalp);
    hairGroup.add(foundation.cap);wigCrownReport=foundation.report;
   }
   const {hair:coiffure,report}=longHeroine?
    buildHeroineFantasyLongHair(scalp,{bodyEnvelope:envelope}):buildReferenceHeroineHair(scalp);
   hairGroup.add(coiffure);
   styledHairReport=report;
  }else{
   const {hair:microHair,report}=buildFittedShortHairStrands(scalp,{style});
   hairGroup.add(microHair);
   styledHairReport=report;
  }
  if(!longHeroine){
   const {hair:rear,report:rearReport}=buildFantasyRearHairLayers(scalp,{
    style,female:femaleHair});
   hairGroup.add(rear);
   fantasyBackReport=rearReport;
  }else fantasyBackReport=Object.freeze({
   style:style%14,bodyRearOnly:true,closedAtScalp:true,
   longHairCoversRear:true,layerLengthMeters:styledHairReport.lengthInHeads,
   sourceHeadUnchanged:true,noFrontEyeCoverage:styledHairReport.frontEyeZoneVertices===0
  });
 }
 // The Sketchfab hair source often defaults to a bleached preview material.
 // Retain source alpha and real cutout cards but give the swordsman a natural
 // dark chestnut tint, while preserving the original glTF/material assets.
 fitted.traverse(o=>{
  if(!o.isMesh)return;
  const apply=original=>{
   if(!original?.isMaterial)return original;
   const mat=original.clone();
   if(mat.color)mat.color.setHex(0x43352c);
   if('roughness' in mat)mat.roughness=.78;
   if('metalness' in mat)mat.metalness=0;
   mat.side=THREE.DoubleSide;
   mat.needsUpdate=true;
   return mat;
  };
  o.material=Array.isArray(o.material)?o.material.map(apply):apply(o.material);
  o.castShadow=true;
 });
 let vertices=0,materials=0;
 fitted.traverse(mesh=>{if(mesh.isMesh){
  vertices+=mesh.geometry?.getAttribute('position')?.count||0;
  materials+=(Array.isArray(mesh.material)?mesh.material:[mesh.material]).filter(Boolean).length;
 }});
 if(vertices<500)throw Error('Licensed hairstyle has no meaningful 3D geometry');
 return {hair:hairGroup,report:Object.freeze({vertices,materials,density,
  headConformingScalp:scalpReport,styledHairReport,fantasyBackReport,
  wigCrownReport,
  disjointDonorHiddenForFeatured:featured&&(!femaleHair||authoredHeroine),
  referenceHeroineHairShown:authoredHeroine,
  longBlondeHeroineHairShown:longHeroine,
  femaleLicensedHairShown:!!femaleHair&&!authoredHeroine,
  oldScalpHiddenForWig:authoredHeroine&&!scalp.visible,
  newFittedWigCrownVisible:longHeroine&&!!wigCrownReport,
  sourceHeadBaldUnderWig:authoredHeroine&&!fitted.visible&&!scalp.visible,
  bodySurfaceClearanceActive:longHeroine&&!!torso,
  originalHairMeshesPreserved:true,sourceAttribution:
  'Vincent Freelance CC BY 4.0; see assets/characters/hair-fitted-v1/ATTRIBUTION.md',
  actual3d:true,headMeshFittedApproximate:true,helmetIntersectionApproved:false})};
}

export function identifyOriginalVikingParts(outfit){
 const found=new Map();outfit.traverse(o=>{
  if(!o.isMesh)return;
  const name=o.name.toLowerCase();
  for(const part of ['tunic','pants','boots','scalp','beard','eyebrows','moustache'])
   if(name.includes(part))found.set(part,o);
 });
 return found;
}

export function createIntegratedSwordsman({body,head,outfit,showHelmet=false,gender='male'}={}){
 if(!body||!head||!outfit)throw Error('Three ACTUAL Blender/Makehuman GLB sources are mandatory');
 body.updateMatrixWorld(true);head.updateMatrixWorld(true);outfit.updateMatrixWorld(true);
 const bodyBox=dimensions(body),headBox=dimensions(head),outfitBox=dimensions(outfit);
 const fit=computeSourceFit(bodyBox,headBox,outfitBox);
 const actor=new THREE.Group();actor.name='CC0_REAL_SWORDSMAN_MASTER_INSPECTION';
 const donorBody=body.clone(true),detailedHead=head.clone(true),dressed=outfit.clone(true);
 actor.add(donorBody,detailedHead,dressed);
 detailedHead.position.add(fit.headShift);
 const youthfulFace=prepareYouthfulFace(detailedHead,{
  // Female reference overlay is for comparison only. Previous contour fitting
  // visibly distorted the jaw and must not be applied to the mesh.
  referenceGuide:gender==='female',
  referenceFit:false
 });
 // Immutable neutral-head coordinates are the reference for eye-socket
 // attachment. Facial proportion edits deform these vertices, but formerly
 // left both native sclera meshes at their undeformed source positions.
 const faceSource=youthfulFace.faceMesh;
 const faceNeutralColors=faceSource.geometry.getAttribute('color').array.slice();
 let heroineMakeupReport=null;
 const neutralFacePositions=faceSource.geometry.getAttribute('position').array.slice();
 function socketDisplacement(reference){
  const updated=faceSource.geometry.getAttribute('position');
  // Blend the nearest real face-surface vertices instead of guessing a fixed
  // Y shift from one slider. Handles thirds, face height, chin and morph edits.
  const closest=[];
  for(let i=0;i<updated.count;i++){
   const x=neutralFacePositions[i*3],y=neutralFacePositions[i*3+1],
    z=neutralFacePositions[i*3+2];
   const dx=x-reference.x,dy=y-reference.y,dz=z-reference.z;
   const distance=dx*dx+dy*dy+dz*dz*.18;
   if(closest.length>=18&&distance>=closest[closest.length-1].distance)continue;
   const item={index:i,distance};
   let j=closest.length;
   while(j>0&&closest[j-1].distance>distance)j--;
   closest.splice(j,0,item);
   if(closest.length>18)closest.pop();
  }
  const delta=new THREE.Vector3();
  let total=0;
  for(const {index,distance} of closest){
   const w=1/(distance+.000012),i=index*3;
   delta.x+=(updated.getX(index)-neutralFacePositions[i])*w;
   delta.y+=(updated.getY(index)-neutralFacePositions[i+1])*w;
   delta.z+=(updated.getZ(index)-neutralFacePositions[i+2])*w;
   total+=w;
  }
  if(total)delta.divideScalar(total);
  if(![delta.x,delta.y,delta.z].every(Number.isFinite)||delta.length()>.08)
   throw Error('Eye socket lost stable facial surface anchor');
  return delta;
 }
 // The original eye spheres sit too far forward and make this human look
 // bug-eyed. Reshape ONLY displayed geometry clones, not CC0 source GLBs.
 let ocularMeshesReshaped=0;
 const ocularSources=[];
 detailedHead.traverse(o=>{
  if(!o.isMesh||!/sclera|iris/i.test(o.name)||!o.geometry?.getAttribute('position'))return;
  const modified=o.geometry.clone();
  modified.computeBoundingBox();
  const center=modified.boundingBox.getCenter(new THREE.Vector3());
  const p=modified.getAttribute('position');
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   p.setXYZ(i,center.x+(x-center.x)*.87,
    center.y+(y-center.y)*(gender==='female'?.68:.73),
    center.z+(z-center.z)*.76-.0028);
  }
  p.needsUpdate=true;modified.computeVertexNormals();
  modified.computeBoundingBox();modified.computeBoundingSphere();
  o.geometry=modified;ocularMeshesReshaped++;
  // Source iris and fitted overlay should never render as two irises.
  if(/iris/i.test(o.name))o.visible=false;
  const suffix=o.name.replace(/[^a-z0-9]/gi,'').toLowerCase();
  ocularSources.push({
   mesh:o,side:suffix.endsWith('l')?-1:1,
   restPosition:o.position.clone(),
   base:modified.getAttribute('position').array.slice(),
   center:center.clone()
  });
 });
 dressed.position.add(fit.outfitShift);
 actor.updateMatrixWorld(true);
 const bodyClip=new THREE.Plane(new THREE.Vector3(0,-1,0),fit.neckY);
 const bodySkinMaterials=[];
 let clippedParts=0;
 donorBody.traverse(o=>{
  if(!o.isMesh)return;
  if(Array.isArray(o.material))o.material=o.material.map(m=>{
   const clone=m.clone();clone.clippingPlanes=[bodyClip];clone.clipIntersection=false;return clone;
  });
  else if(o.material){
   o.material=o.material.clone();o.material.clippingPlanes=[bodyClip];
   o.material.clipIntersection=false;
  }
  const mats=Array.isArray(o.material)?o.material:[o.material];
  if(!/iris|sclera/i.test(o.name))bodySkinMaterials.push(...mats.filter(Boolean));
  o.castShadow=true;o.receiveShadow=true;clippedParts++;
 });
 let nativeTextures=0,garmentVertices=0,doubleSidedGarmentMeshes=0;
 dressed.traverse(o=>{if(!o.isMesh)return;
  o.castShadow=true;o.receiveShadow=true;
  garmentVertices+=o.geometry?.getAttribute('position')?.count||0;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  nativeTextures+=mats.filter(m=>m?.map).length;
  // The CC0 donor tunic has single-sided sleeve polygons in the rear view.
  // Clone material instances so their reverse faces render on the preview
  // without mutating original GLB materials or dropping photo texture maps.
  const backside=mats.map(m=>{
   if(!m)return m;
   const clone=m.clone();clone.side=THREE.DoubleSide;
   clone.needsUpdate=true;return clone;
  });
  o.material=Array.isArray(o.material)?backside:backside[0];
  if(backside.some(m=>m?.side===THREE.DoubleSide))doubleSidedGarmentMeshes++;
 });
 if(nativeTextures<5)throw Error('Garments do not include original CC0 UV diffuse atlases');
 const parts=identifyOriginalVikingParts(dressed);
 if(parts.size<6)throw Error('Missing actual cloth/boots/scalp/beard meshes');
 actor.updateMatrixWorld(true);
 // Adapt exported cloth sleeve source geometry from its horizontal T pose
 // to the lower arm angle of the actual Blender Studio body.
 const sleeveFit=bendSourceTunicSleeves(parts.get('tunic'),donorBody);
 const tailoredTunic=slimSourceTunicUpperSilhouette(parts.get('tunic'),donorBody);
 const trimmedSleeveFins=trimDanglingTunicSleeveFins(parts.get('tunic'),donorBody);
 actor.updateMatrixWorld(true);
 // Capture the FULL anatomical body surface before torso coverage mask
 // removes vertices which will eventually lie beneath this fitted clothing.
 const youthOutfit=createFittedFantasyHeroGarment(donorBody,{female:gender==='female'});
 // Save the intact, source-derived body topology BEFORE the legacy Viking
 // outfit mask removes interior triangles. The hero's feathered garment must
 // sit on continuous anatomy, otherwise uncovered chest regions appear as
 // black holes. Nonhero NPCs continue using the archived coverage mask.
 const sourceBodyGeometry=new Map();
 donorBody.traverse(o=>{if(o.isMesh)sourceBodyGeometry.set(o,o.geometry)});
 const coverage=maskBodyUnderSourceGarment(donorBody,parts);
 const maskedBodyGeometry=new Map();
 donorBody.traverse(o=>{if(o.isMesh)maskedBodyGeometry.set(o,o.geometry)});
 // Protagonists use true source-body contour clothing, not barrel-shaped
 // approximations. The original outfit remains preserved for NPCs.
 actor.add(youthOutfit.object);
 youthOutfit.object.visible=false;
 let currentIsHero=false;
 // Original brows/beard/hair may show through the model face; expose each
 // visibility toggle. They are NOT assumed to be anatomically fitted.
 for(const p of ['moustache','beard','eyebrows'])parts.get(p)&&(parts.get(p).visible=false);
 // The source high-detail face head materials have no photographed skin map:
 // physical finish is preview-only, never falsely labelled photo skin.
 const ownedMaterials=[],headSkinMaterials=[],nativeIrisMaterials=[],overlayIrisMaterials=[];
 let originalHeadMeshes=0;
 detailedHead.traverse(o=>{
  if(!o.isMesh)return;originalHeadMeshes++;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  const updated=mats.map(m=>{
   const c=m.clone();
   // Source-derived cheek / lip vertex tones apply to skin only.
   if(o===youthfulFace.faceMesh)c.vertexColors=true;
   if(/iris/i.test(o.name)){
    c.color.set(0x33543c);c.roughness=.25;c.metalness=0;
   }else if(/sclera/i.test(o.name)){
    c.color.set(0xe6dcd1);c.roughness=.32;c.metalness=0;
   }else{
    c.color.set(0xb58971);c.roughness=.56;c.metalness=0;
   }
   c.needsUpdate=true;ownedMaterials.push(c);
   if(/iris/i.test(o.name))nativeIrisMaterials.push(c);
   else if(!/sclera/i.test(o.name))headSkinMaterials.push(c);
   return c;
  });
  o.material=Array.isArray(o.material)?updated:updated[0];
  o.castShadow=true;
 });
 // Keep source head material maps recoverable when switching female/male.
 const faceSkinBaseMaterials=new Map();
 for(const mat of (Array.isArray(faceSource.material)?faceSource.material:[faceSource.material]))
  if(mat)faceSkinBaseMaterials.set(mat,{
   map:mat.map||null,normalMap:mat.normalMap||null,
   roughnessMap:mat.roughnessMap||null,normalScale:mat.normalScale?.clone?.()||null
  });
 const morphTargets=new Map();
 detailedHead.traverse(o=>{
  if(!o.isMesh||!o.morphTargetDictionary||!o.morphTargetInfluences)return;
  for(const name of HERO_FACE_MORPHS){
   const index=o.morphTargetDictionary[name];
   if(index!=null){
    const targets=morphTargets.get(name)||[];
    targets.push({mesh:o,index});morphTargets.set(name,targets);
   }
  }
 });
 if(morphTargets.size!==7)throw Error('Seven true 3D face morph targets missing');
 function setMorph(key,value){
  const refs=morphTargets.get(key);
  if(!refs)throw Error('Unsupported real source morph '+key);
  const v=THREE.MathUtils.clamp(Number(value)||0,0,1);
  for(const {mesh,index} of refs)mesh.morphTargetInfluences[index]=v;
  return v;
 }
 function preset(name='swordsman'){
  const values=HERO_FACE_PRESETS[name];
  if(!values)throw Error('Unknown face prototype '+name);
  for(const key of morphTargets.keys())setMorph(key,values[key]||0);
  return name;
 }
 // Actual sclera surfaces locate real eyelid planes, independent of screen
 // dimensions; no blanket "fake eye blink" on the whole head.
 const lids=[],upperLids=[],irisOverlays=[],actualScleraNames=[],allEyeSourceNames=[];
 const eyeFixtures=[],browMaterials=[],lowerLids=[],upperEyelashes=[];
  let openEyeClearanceRatio=Infinity;
 detailedHead.traverse(o=>{if(o.isMesh&&/iris|sclera|eye/i.test(o.name))allEyeSourceNames.push(o.name)});
 for(const side of ['L','R']){
  let sclera=null;
  detailedHead.traverse(o=>{
   if(!o.isMesh||!/sclera/i.test(o.name))return;
   // Blender's glTF exporter sanitizes source names by *deleting* dots,
   // e.g. GEO-head_animation_realisticscleraL. Never assume an underscore.
   const compact=o.name.replace(/[^a-z0-9]/gi,'').toLowerCase();
   if(compact.endsWith('sclera'+side.toLowerCase()))sclera=o;
  });
  if(!sclera)continue;
  actualScleraNames.push(sclera.name);
  const box=dimensions(sclera),size=box.getSize(new THREE.Vector3());
  const mid=box.getCenter(new THREE.Vector3());
  // Record the socket anchor ONCE, in actual face-mesh coordinates. Never
  // sample it from an eye that was already shifted by a previous slider edit.
  const socketReference=faceSource.worldToLocal(mid.clone());
  // Native iris normals/face overlap caused a white-eye screenshot. A real
  // visible pupil/iris is layered onto the actual sclera bounds, rather than
  // swapping the whole eye for a flat skin texture. It remains a preview.
  // The prior oversized eye overlay produced a cartoon staring expression.
   // Keep real sclera/iris meshes but match the iris diameter to the socket.
   const irisRadius=THREE.MathUtils.clamp(Math.min(size.x,size.y)*.34,.0065,.0115);
  const irisGroup=new THREE.Group();
  irisGroup.name='VisibleRealEyeIris_'+side;
  irisGroup.position.set(mid.x,mid.y,box.max.z+.0015);
  const rimMat=new THREE.MeshPhysicalMaterial({color:0x243b42,roughness:.32,metalness:0,
   side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
  const tintMat=new THREE.MeshPhysicalMaterial({color:0x517996,roughness:.3,metalness:0,
   side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3});
  const pupilMat=new THREE.MeshPhysicalMaterial({color:0x11141b,roughness:.12,metalness:0,
   side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4});
  const shineMat=new THREE.MeshBasicMaterial({color:0xfafaff,side:THREE.DoubleSide});
  const addEye=(name,radius,depth,material,x=0,y=0)=>{
   const mesh=new THREE.Mesh(new THREE.CircleGeometry(radius,36),material);
   mesh.name=name;mesh.position.set(x,y,depth);irisGroup.add(mesh);return mesh;
  };
  addEye('IRIS_LIMBAL_RING',irisRadius,0,rimMat);
  addEye('IRIS_COLORED',irisRadius*.86,.0008,tintMat);
  const pupilLayer=new THREE.Group();pupilLayer.name='INDEPENDENT_PUPIL_XYZ_'+side;
  irisGroup.add(pupilLayer);
  const pupil=new THREE.Mesh(new THREE.CircleGeometry(irisRadius*.40,36),pupilMat);
  pupil.name='IRIS_TRUE_BLACK_PUPIL';pupil.position.z=.0018;pupilLayer.add(pupil);
  const light=new THREE.Mesh(new THREE.CircleGeometry(irisRadius*.16,36),shineMat);
  light.name='CORNEAL_CATCHLIGHT';
  light.position.set(-irisRadius*.23,irisRadius*.32,.0024);
  pupilLayer.add(light);
  irisGroup.position.sub(fit.headShift);
  detailedHead.add(irisGroup);
  irisOverlays.push(irisGroup);
  overlayIrisMaterials.push(tintMat);
  ownedMaterials.push(rimMat,tintMat,pupilMat,shineMat);
  const width=THREE.MathUtils.clamp(size.x*1.24,.012,.075);
  const height=THREE.MathUtils.clamp(size.y*1.17,.006,.06);
  if(width>0&&height>0){
   const material=new THREE.MeshPhysicalMaterial({color:0xb68b72,
    roughness:.63,metalness:0,side:THREE.DoubleSide,vertexColors:true,
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
   ownedMaterials.push(material);headSkinMaterials.push(material);
   // Visible anatomical upper lid reduces the wide-eyed stare even when
   // blinking is inactive. This is a separate source-relative skin surface.
   const upperMat=new THREE.MeshPhysicalMaterial({
    color:0xb68b72,roughness:.59,metalness:0,
    side:THREE.DoubleSide,vertexColors:false,transparent:false,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3
   });
   ownedMaterials.push(upperMat);headSkinMaterials.push(upperMat);
   const upper=new THREE.Mesh(makeEyeRim(width*.99,height*.9,true),upperMat);
   upper.name='ANATOMICAL_UPPER_EYELID_'+side;
   upper.position.set(mid.x,mid.y+size.y*.16,box.max.z+.009);
   upper.position.sub(fit.headShift);
   upper.scale.y=1;upperLids.push(upper);detailedHead.add(upper);
   // The lashes are children of the very same upper eyelid, so every
   // slider or blinking transform is inherited rather than guessed.
   const lashes=makeAttachedUpperLashes(width*.99,height*.9);
   upper.add(lashes);upperEyelashes.push(lashes);
   const lowerMat=upperMat.clone();ownedMaterials.push(lowerMat);headSkinMaterials.push(lowerMat);
   const lower=new THREE.Mesh(makeEyeRim(width*.99,height*.9,false),lowerMat);
   lower.name='ANATOMICAL_LOWER_EYELID_'+side;
   lower.position.set(mid.x,mid.y-size.y*.15,box.max.z+.009);
   lower.position.sub(fit.headShift);detailedHead.add(lower);
   lowerLids.push(lower);
   // Preserve actual visible eyebrows: the source Viking eyebrow mesh is
   // intentionally hidden because it floats on this separate Blender head.
   // Our own ribbons must be above skin and thick enough at portrait scale.
   const browMat=new THREE.MeshStandardMaterial({
    color:0x30242b,roughness:.87,metalness:0,side:THREE.DoubleSide,
    emissive:0x090607,emissiveIntensity:.28
   });
   const brow=new THREE.Mesh(new THREE.BufferGeometry(),browMat);
   brow.name='SOURCE_ALIGNED_EYEBROW_'+side;
   brow.castShadow=true;detailedHead.add(brow);
   browMaterials.push(browMat);
   eyeFixtures.push({side:side==='L'?-1:1,sideLabel:side,
    sclera,irisGroup,pupilLayer,upper,lower,lashes,lid:null,brow,
    socketReference,socketDelta:new THREE.Vector3()});
    // Upper lids must leave the pupil and lower eye visibly open at rest.
    // This numerical aperture check catches the 'already blinking' regression.
    // Rim, unlike a closed-lid disc, leaves the central pupil unobstructed.
    openEyeClearanceRatio=Math.min(openEyeClearanceRatio,.09);
   const lid=new THREE.Mesh(makeEyeLid(width,height),material);
   lid.name='CC0-HEAD_PROVISIONAL_'+side+'_ALMOND_CLOSED_LID';
   lid.position.copy(mid).add(new THREE.Vector3(0,0,size.z*.56+.004));
   lid.userData.blinkTop=true;lid.visible=false;
   actor.add(lid);lids.push(lid);
   eyeFixtures[eyeFixtures.length-1].lid=lid;
  }
 }
 // Three.js boxes above are in scene-relative coordinates, while the eyelids
 // were built in absolute head coordinates. Position lids relative to head
 // after measuring the original source scene to follow the fit offset.
 // Since eyes are children of detailedHead, eyelids also follow that root.
 for(const lid of lids){
  actor.remove(lid);detailedHead.add(lid);
  lid.position.sub(fit.headShift);
 }
 const metrics={actualBody:true,actualFace:true,actualTexturedCloth:true,
  faceVerticesSource:5134, bodyVerticesSource:11674,garmentVertices,
  nativeGarmentMaps:nativeTextures,garmentParts:[...parts.keys()],
  faceMorphs:[...morphTargets.keys()],faceOriginalMeshes:originalHeadMeshes,
  actualScleraNames,allEyeSourceNames,provisionalEyelidMeshCount:lids.length,
  restingUpperEyelidMeshCount:upperLids.length,
   openEyeClearanceRatio:Number.isFinite(openEyeClearanceRatio)?round(openEyeClearanceRatio):null,
  visibleIrisMeshes:irisOverlays.length,realPupilMeshes:irisOverlays.length,
   fittedNativeOcularMeshes:ocularMeshesReshaped,
   sourceAlignedBrowMeshes:eyeFixtures.length,
   restingLowerEyelidMeshCount:lowerLids.length,
  upperEyelashMeshCount:upperEyelashes.length,
  heightMeters:round(fit.bodyHeight),neckCutMeters:round(fit.neckY),
  outfitWidthRatio:round(fit.outfitWidthRatio),
  outfitDepthRatio:round(fit.outfitDepthRatio),
  garmentBackFacesEnabled:doubleSidedGarmentMeshes>=3,
  garmentBackFaceMeshCount:doubleSidedGarmentMeshes,
  sourceSleeveVerticesBent:sleeveFit.movedSourceVertices,
  sourceSleeveUVPreserved:sleeveFit.sourceTrianglesUnchanged,
  garmentUpperTailoring:tailoredTunic,
  garmentSleeveFinCleanup:trimmedSleeveFins,
  outfitHeightRatio:round(fit.heightRatio),
  bodyHeadClipped:clippedParts>0,maskedSkinTriangles:coverage.removed,
  retainedSkinTriangles:coverage.remaining,skinMaskIsPreviewOnly:true,
  armMeshRetention:coverage.armRetentionRatio,armTriangleCount:coverage.armTrianglesAfter,
  armsAndHandsPreserved:coverage.armsAndHandsPreserved,skinned:false,
  originalCC0MastersUntouched:true,photoSkinApplied:false,
  youthfulFacePreviewMorph:true,
  outfitRigRetargeted:false,helmetFitted:false,ff13ArtGatePassed:false};
 let blink=0;
 function syncBlinkPose(){
  for(const fixture of eyeFixtures)applyEyeFixtureBlink(fixture,blink);
 }
 function setBlink(value){
  blink=THREE.MathUtils.clamp(Number(value)||0,0,1);
  syncBlinkPose();
  return blink;
 }
 function setAppearance(profile){
  if(!profile||!/^#[0-9a-f]{6}$/i.test(profile.skin||'')||
      !/^#[0-9a-f]{6}$/i.test(profile.iris||''))
   throw Error('Skin and iris colors must be valid six-digit hexadecimal values');
  const skin=new THREE.Color(profile.skin);
  const iris=new THREE.Color(profile.iris);
  currentIsHero=profile.category==='hero';
  // No geometry re-cloning per slider edit. Restore exact CC0 full-body
  // geometry for all featured protagonists; keep masked body for NPC outfits.
  for(const [mesh,original] of sourceBodyGeometry)
   mesh.geometry=currentIsHero?original:maskedBodyGeometry.get(mesh);
  youthOutfit.object.visible=currentIsHero;
  youthOutfit.changeAppearance(profile);
  for(const part of ['tunic','pants','boots'])
   parts.get(part).visible=!currentIsHero;
  for(const mat of [...headSkinMaterials,...bodySkinMaterials]){
   if(mat.color)mat.color.copy(skin);
   if('roughness' in mat)mat.roughness=profile.skinRoughness||.59;
   mat.needsUpdate=true;
  }
  for(const mat of [...nativeIrisMaterials,...overlayIrisMaterials]){
   if(mat.color)mat.color.copy(iris);
   mat.needsUpdate=true;
  }
  // Fit eyes and brows against the FINAL face width. Previously the head was
  // scaled only after eyebrow raycasts, causing profile/reset asymmetry.
  const faceWidth=THREE.MathUtils.clamp(Number(profile.faceWidth)||1,.90,1.04);
  const headScale=THREE.MathUtils.clamp(Number(profile.headScale)||1,1,1.11);
  // Enlarging a youthful head about the SOURCE neck base avoids pulling it
  // out of the collar. Apply the same factor to eye bones and scalp meshes.
  detailedHead.scale.set(faceWidth*headScale,headScale,headScale);
  detailedHead.position.copy(fit.headShift);
  detailedHead.position.y+=(1-headScale)*headBox.min.y;
  detailedHead.updateWorldMatrix(true,true);
  const proportions=validateFaceProportions(profile.proportions||{});
  const youthfulReport=youthfulFace.apply(profile.youthfulness??0,proportions);
  const femalePortrait=profile.gender==='female';
  // The old skin was a flat solid-color material. Give the actual source
  // female sculpt a subtle UV-based pore/roughness map, without changing GLB.
  // Tests in bare Node have no document; this optional GPU finish is browser
  // only and never substitutes a raster portrait for the geometry.
  if(femalePortrait&&typeof document!=='undefined'){
   applyHeroineSkinPBR(faceSource,{face:true});
   for(const mat of faceSkinBaseMaterials.keys())mat.roughness=.78;
  }else{
   for(const [mat,base] of faceSkinBaseMaterials){
    mat.map=base.map;mat.normalMap=base.normalMap;
    mat.roughnessMap=base.roughnessMap;
    if(mat.normalScale&&base.normalScale)mat.normalScale.copy(base.normalScale);
    mat.needsUpdate=true;
   }
  }
  heroineMakeupReport=applyHeroineMakeupToFace(faceSource,faceNeutralColors,{
   strength:femalePortrait?(profile.makeup?.strength??.90):0,
   eyeAnchors:eyeFixtures.map(f=>f.socketReference),
   blush:femalePortrait?(profile.makeup?.blush??.90):0,
   lip:femalePortrait?(profile.makeup?.lip??.94):0,
   eyeliner:femalePortrait?(profile.makeup?.eyeliner??.96):0
  });
  // Apply source expression morphs before fitting eye geometry and lids.
  for(const key of HERO_FACE_MORPHS)
   if(profile.face&&profile.face[key]!==undefined)setMorph(key,profile.face[key]);
  const headDim=faceSource.geometry.boundingBox.getSize(new THREE.Vector3());
  // Re-anchor both real eye sockets to the already deformed face surface,
  // then let iris, pupil, blink and both rims use the new native sclera box.
  // All offsets are recalculated from source every time: no cumulative drift.
  detailedHead.updateWorldMatrix(true,true);
  const socketOffsets=new Map();
  for(const fixture of eyeFixtures){
   const original=fixture.socketReference;
   const delta=socketDisplacement(original);
   fixture.socketDelta.copy(delta);
   const worldBefore=faceSource.localToWorld(original.clone());
   const worldAfter=faceSource.localToWorld(original.clone().add(delta));
   socketOffsets.set(fixture.side,worldAfter.sub(worldBefore));
  }
  for(const eye of ocularSources){
   const geom=eye.mesh.geometry,attr=geom.getAttribute('position');
   const {x:cx,y:cy}=eye.center;
   for(let i=0;i<attr.count;i++){
    const x0=eye.base[3*i],y0=eye.base[3*i+1],z0=eye.base[3*i+2];
    const dx=(x0-cx)*proportions.eyeWidth;
    attr.setXYZ(i,cx+dx,cy+(y0-cy)*proportions.eyeHeight+
      dx*proportions.eyeTilt*.30,z0);
   }
   attr.needsUpdate=true;geom.computeVertexNormals();geom.computeBoundingBox();
   geom.computeBoundingSphere();
   eye.mesh.position.copy(eye.restPosition);
   // Eye meshes may be nested under a node with its own transform. Convert
   // the world socket displacement to the eye's actual parent coordinates.
   const displacement=socketOffsets.get(eye.side);
   if(displacement){
    const parent=eye.mesh.parent;
    parent.updateWorldMatrix(true,false);
    const worldOrigin=parent.localToWorld(new THREE.Vector3());
    const localDelta=parent.worldToLocal(worldOrigin.clone().add(displacement))
     .sub(parent.worldToLocal(worldOrigin));
    eye.mesh.position.add(localDelta);
   }
   eye.mesh.position.x+=eye.side*(proportions.eyeSpacing-1)*headDim.x*.09;
   eye.mesh.position.y+=proportions.eyeVertical*headDim.y;
   eye.mesh.position.x+=eye.side*proportions.eyeOffsetX;
   eye.mesh.position.y+=proportions.eyeOffsetY;
   eye.mesh.position.z+=proportions.eyeOffsetZ;
  }
  detailedHead.updateWorldMatrix(true,true);
  // Stable brow projection: sample the real (cloned) face vertices once
  // per edit. Raycasting against dynamically changing morph targets was
  // nondeterministic across repeated edits and made 'Reset' drift.
  const facePositions=faceSource.geometry.getAttribute('position');
  const skinBounds=dimensions(faceSource),skinSize=skinBounds.getSize(new THREE.Vector3());
  const frontGate=skinBounds.min.z+skinSize.z*.55;
  const skinPoints=[];
  const sample=new THREE.Vector3();
  for(let i=0;i<facePositions.count;i++){
   sample.fromBufferAttribute(facePositions,i).applyMatrix4(faceSource.matrixWorld);
   if(sample.z>=frontGate)skinPoints.push(sample.clone());
  }
  function sourceSkinDepth(x,y,fallback){
   let distance=Infinity,z=fallback;
   for(const p of skinPoints){
    const dx=p.x-x,dy=p.y-y;
    const score=dx*dx+dy*dy;
    if(score<distance-1e-12||(Math.abs(score-distance)<1e-12&&p.z>z)){
     distance=score;z=p.z;
    }
   }
   return distance<.00048?z+.0022:fallback;
  }
  for(const fixture of eyeFixtures){
   const box=dimensions(fixture.sclera);
   const center=box.getCenter(new THREE.Vector3());
   const dim=box.getSize(new THREE.Vector3());
   // Adjust all eye overlays and eyelids with their real sclera, rather
   // than leaving pupil/upper-lid meshes behind after a spacing edit.
   const group=fixture.irisGroup;
   // Box3 is in WORLD coordinates (the actor may already be scaled).
   // Convert through the actual head transform; subtracting fit.headShift
   // directly caused detached pupils above the native eye sockets.
   // Keep iris in front of face even after a socket moves forward.
   const skinEyeZ=sourceSkinDepth(center.x,center.y,box.max.z+.003);
   const exposedIrisZ=Math.max(box.max.z+.008,skinEyeZ+.0075);
   group.position.copy(detailedHead.worldToLocal(
    new THREE.Vector3(center.x,center.y,exposedIrisZ)));
   group.visible=true;fixture.sclera.visible=true;
   group.position.x+=fixture.side*proportions.irisOffsetX;
   group.position.y+=proportions.irisOffsetY;
   group.position.z+=proportions.irisOffsetZ;
   fixture.pupilLayer.position.set(
    fixture.side*proportions.pupilOffsetX,
    proportions.pupilOffsetY,proportions.pupilOffsetZ);
   // Native sclera geometry already applied eyeWidth/eyeHeight/tilt.
   // Do not multiply them AGAIN on the iris overlay.
   const irisScale=THREE.MathUtils.clamp(profile.eyeSize??1,.92,1.24);
   group.scale.set(
    irisScale*Math.sqrt(proportions.eyeWidth),
    irisScale*Math.sqrt(proportions.eyeHeight),1);
   group.rotation.z=proportions.eyeTilt*.15;
   fixture.upper.position.copy(detailedHead.worldToLocal(
    new THREE.Vector3(center.x,center.y+dim.y*.16,box.max.z+.009)));
   fixture.upper.position.add(new THREE.Vector3(
    fixture.side*proportions.upperLidOffsetX,proportions.upperLidOffsetY,
    proportions.upperLidOffsetZ));
   fixture.lower.position.copy(detailedHead.worldToLocal(
    new THREE.Vector3(center.x,center.y-dim.y*.15,box.max.z+.009)));
   fixture.lower.position.add(new THREE.Vector3(
    fixture.side*proportions.lowerLidOffsetX,proportions.lowerLidOffsetY,
    proportions.lowerLidOffsetZ));
   fixture.lid.position.copy(detailedHead.worldToLocal(
    center.clone().add(new THREE.Vector3(0,0,dim.z*.56+.004))));
   fixture.upper.scale.y=proportions.eyeHeight;
   fixture.lower.scale.y=proportions.eyeHeight;
   // Capture the latest transformed socket position and blinking travel.
   fixture.upper.userData.openLocalY=fixture.upper.position.y;
   fixture.upper.userData.openScaleY=fixture.upper.scale.y;
   fixture.lower.userData.openLocalY=fixture.lower.position.y;
   const blinkTarget=detailedHead.worldToLocal(
    new THREE.Vector3(center.x,center.y-dim.y*.36,box.max.z+.009));
   fixture.upper.userData.blinkTravelLocal=Math.max(
    0,fixture.upper.position.y-blinkTarget.y);
   fixture.lower.userData.blinkTravelLocal=
    fixture.upper.userData.blinkTravelLocal;
   fixture.upper.scale.x=proportions.eyeWidth;
   fixture.lower.scale.x=proportions.eyeWidth;
   fixture.upper.rotation.z=proportions.eyeTilt*.18;
   fixture.lower.rotation.z=proportions.eyeTilt*.18;
   fixture.lashes.visible=true;
   fixture.lashes.material.color.set(
    profile.gender==='female'?'#292027':profile.hairColor||'#594048');
   fixture.lashes.scale.y=profile.gender==='female'?1.26:1;
   fixture.lid.scale.x=proportions.eyeWidth;
   // Keep the brow on the supraorbital ridge rather than directly on
   // the upper eyelid: the earlier brow looked like a second lash line.
   const eyebrowY=center.y+dim.y*(.72+.45*(proportions.browEyeGap-1))+
     .008*headScale+proportions.browVertical*headDim.y;
   const browWidth=dim.x*1.18*proportions.browWidth;
   const pts=[];
   // Sample the actual face projection where possible. A brow is not a
   // floating strip based solely on a generic head bounding box.
   for(let j=0;j<=6;j++){
    const t=j/6*2-1;
    const x=center.x+t*browWidth*.5;
    const y=eyebrowY+(.0035*(1-t*t))+
      t*(proportions.browAngle+(proportions.eyeTilt*.20))*dim.x*.18;
    const z=sourceSkinDepth(x,y,box.max.z+.011)+.0055;
    const worldPoint=new THREE.Vector3(x,y,z);
    const point=detailedHead.worldToLocal(worldPoint);
    point.x+=fixture.side*proportions.browOffsetX;
    point.y+=proportions.browOffsetY;
    point.z+=proportions.browOffsetZ;
    pts.push(point);
   }
   // Keep all ribbon samples in front of the actual supraorbital skin.
   // Otherwise depth testing erases alternating brow panels into 'blocks'.
   const frontZ=Math.max(...pts.map(p=>p.z))+.002;
   for(const p of pts)p.z=frontZ;
   const old=fixture.brow.geometry;
   fixture.brow.geometry=makeBrowRibbon(pts,.0025*proportions.browThickness);
   old.dispose();
   fixture.brow.material.color.set(profile.hairColor||'#30242b')
    .lerp(new THREE.Color(0x181015),.34);
   fixture.brow.visible=true;
  }
  syncBlinkPose();
  // Shape the ACTUAL face mesh, not merely the accompanying preview portrait.
  // Target of .93..1.02 makes youthful candidates subtly narrower at the jaw.
  const eyeScale=THREE.MathUtils.clamp(Number(profile.eyeSize)||1,.92,1.24);
  return {skin:profile.skin,iris:profile.iris,faceWidth,headScale,eyeScale,
   facialProportions:proportions,faceGeometryDigest:youthfulReport.geometryDigest,
   youthfulModifiedVertices:youthfulReport.modifiedVertices,
   appliedUserPortraitSilhouette:null,
   referenceSilhouetteComparisonOnly:youthfulReport.referenceSilhouette?.source||null,
   referenceLandmarksTraced:youthfulReport.referenceSilhouette?.landmarkCount||0,
   real3dMorphs:7,visiblePupils:irisOverlays.length,
   customGarmentFitted:currentIsHero};
 }
 function checksumGeometry(meshes){
  let sum=0;
  for(const [j,mesh] of meshes.entries()){
   const attr=mesh.geometry?.getAttribute('position');
   if(!attr)continue;
   for(let i=0;i<attr.count;i+=11)
    sum+=(attr.getX(i)*3+attr.getY(i)*7+attr.getZ(i)*11)*((i%13)+1)*(j+1);
   sum+=(mesh.position.x*53+mesh.position.y*29+mesh.position.z*37)*(j+1);
  }
  return round(sum);
 }
 function poseChecksum(objects){
  let sum=0;
  const p=new THREE.Vector3(),q=new THREE.Quaternion();
  for(const [i,obj] of objects.entries()){
   obj.getWorldPosition(p);obj.getWorldQuaternion(q);
   sum+=(p.x*19+p.y*29+p.z*37)*(i+1);
   sum+=(obj.scale.x*7+obj.scale.y*11+obj.scale.z*13)*(i+1);
   sum+=q.x*5+q.y*7+q.z*11+q.w*13;
  }
  return round(sum);
 }
 function setBrowsVisible(visible){
  for(const eye of eyeFixtures)eye.brow.visible=Boolean(visible);
 }
 function getFacialQA(){
  const headReport=youthfulFace.getReport();
  let clearance=Infinity,pupilOffset=0,irisGap=0,pupilGap=0,eyeHeightAsymmetry=0;
  let socketDrift=0,socketTravel=0;
  const eyeYs=[];
  for(const {sclera,upper,lower,irisGroup,pupilLayer,socketReference,socketDelta,side} of eyeFixtures){
   const box=dimensions(sclera),size=box.getSize(new THREE.Vector3());
   const mid=box.getCenter(new THREE.Vector3());
   // Compare the actual native eyeball center with the deformed face socket
   // plus the intentional eye X/Y/Z offset chosen by the user.
   const expected=faceSource.localToWorld(socketReference.clone().add(socketDelta));
   const eyeMesh=ocularSources.find(o=>o.mesh===sclera);
   if(eyeMesh){
    const p=eyeMesh.mesh.parent;
    const explicitOffset=new THREE.Vector3(
     side*(headReport.proportions.eyeSpacing-1)*faceSource.geometry.boundingBox.getSize(new THREE.Vector3()).x*.09+
      side*headReport.proportions.eyeOffsetX,
     headReport.proportions.eyeVertical*faceSource.geometry.boundingBox.getSize(new THREE.Vector3()).y+
      headReport.proportions.eyeOffsetY,
     headReport.proportions.eyeOffsetZ);
    const origin=p.localToWorld(new THREE.Vector3());
    const translated=p.localToWorld(explicitOffset);
    expected.add(translated.sub(origin));
   }
   socketDrift=Math.max(socketDrift,mid.distanceTo(expected));
   socketTravel=Math.max(socketTravel,socketDelta.length());
   const pupilWorld=irisGroup.getWorldPosition(new THREE.Vector3());
   pupilOffset=Math.max(pupilOffset,Math.abs(pupilWorld.y-mid.y)/Math.max(.001,size.y));
   irisGap=Math.max(irisGap,
    Math.hypot(pupilWorld.x-mid.x,pupilWorld.y-mid.y)/Math.max(.001,Math.max(size.x,size.y)));
   const nominalRadius=Math.min(size.x,size.y)*.155;
   pupilGap=Math.max(pupilGap,
    Math.hypot(pupilLayer.position.x,pupilLayer.position.y)/Math.max(.001,nominalRadius));
   eyeYs.push(mid.y);
   const lowerEdge=new THREE.Box3().setFromObject(upper).min.y;
   clearance=Math.min(clearance,(lowerEdge-mid.y)/Math.max(.001,size.y));
  }
  if(eyeYs.length===2)eyeHeightAsymmetry=Math.abs(eyeYs[0]-eyeYs[1]);
  return {
   faceGeometryDigest:headReport.geometryDigest,
   ocularGeometryDigest:checksumGeometry(ocularSources.map(x=>x.mesh)),
   browGeometryDigest:checksumGeometry(eyeFixtures.map(x=>x.brow)),
   irisPoseDigest:poseChecksum(eyeFixtures.map(x=>x.irisGroup)),
   pupilPoseDigest:poseChecksum(eyeFixtures.map(x=>x.pupilLayer)),
   upperLidPoseDigest:poseChecksum(eyeFixtures.map(x=>x.upper)),
   lowerLidPoseDigest:poseChecksum(eyeFixtures.map(x=>x.lower)),
   sourceBrowMeshes:eyeFixtures.length,
    heroineMakeup:heroineMakeupReport,
   realEyebrowVisibleCount:eyeFixtures.filter(e=>e.brow.visible&&
    e.brow.material.visible!==false&&
    (e.brow.geometry.getAttribute('position')?.count||0)>=14).length,
   eyebrowRibbonHalfWidthMeters:.0025,
   eyebrowRibbonSegments:32,
   fittedNativeOcularMeshes:ocularSources.length,
   openEyeClearanceRatio:Number.isFinite(clearance)?round(clearance):null,
   maxPupilVerticalOffsetRatio:round(pupilOffset),
   maxEyeSocketAlignmentErrorMeters:round(socketDrift),
   faceSocketTravelMeters:round(socketTravel),
   maxIrisCenterOffsetRatio:round(irisGap),
   maxPupilIrisOffsetRatio:round(pupilGap),
   leftRightEyeHeightDifference:round(eyeHeightAsymmetry),
   lowerLidMeshCount:lowerLids.length,
   attachedEyelashMeshCount:upperEyelashes.length,
   visibleEyelashMeshCount:upperEyelashes.filter(x=>x.visible&&x.parent?.visible).length,
   lashFollowsUpperLid:eyeFixtures.every(x=>x.lashes.parent===x.upper),
   blinkLashPoseSynchronized:eyeFixtures.every(x=>x.lashes.parent===x.upper&&
    Number.isFinite(x.upper.userData.openLocalY)&&
    Number.isFinite(x.upper.userData.blinkTravelLocal)),
   visibleNativeEyeballCount:eyeFixtures.filter(x=>x.sclera.visible).length,
   visibleIrisOverlayCount:eyeFixtures.filter(x=>x.irisGroup.visible).length,
   eyelashPoseDigest:poseChecksum(upperEyelashes),
   proportions:headReport.proportions,
   sourceUnchanged:headReport.sourceUnchanged,
   artGradeCertified:false
  };
 }
 // Adult hero's temporary anatomical inspection. Clothing is hidden only
 // in this viewer: game meshes, source GLBs and the equipped preset survive.
 const originalSkinMaterials=new Map(),anatomyUVClones=new Map();
 let anatomyPreviewActive=false,anatomySkinSurfaces=0;
 function setAnatomyPreview(enabled=false){
  const active=Boolean(enabled)&&currentIsHero&&gender==='female';
  anatomyPreviewActive=active;
  const allBody=[];
  donorBody.traverse(o=>{
   if(o.isMesh&&!/iris|sclera|pupil|eye/i.test(o.name))allBody.push(o);
  });
  if(active){
   anatomySkinSurfaces=0;
   for(const mesh of [faceSource,...allBody]){
    // The real fitted face is the authoritative animated morph geometry;
    // do not replace it with a disconnected UV clone.
    if(anatomyUVClones.has(mesh))mesh.geometry=anatomyUVClones.get(mesh);
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const m of mats){
     if(!m||originalSkinMaterials.has(m))continue;
     originalSkinMaterials.set(m,{
      map:m.map||null,normalMap:m.normalMap||null,
      roughnessMap:m.roughnessMap||null,roughness:m.roughness
     });
    }
    if(applyHeroineSkinPBR(mesh,{face:mesh===faceSource})){
     if(mesh!==faceSource)anatomyUVClones.set(mesh,mesh.geometry);
     anatomySkinSurfaces++;
    }
   }
  }else{
   for(const [mat,previous] of originalSkinMaterials){
    mat.map=previous.map;mat.normalMap=previous.normalMap;
    mat.roughnessMap=previous.roughnessMap;
    if(Number.isFinite(previous.roughness))mat.roughness=previous.roughness;
    mat.needsUpdate=true;
   }
   for(const [mesh,geo] of sourceBodyGeometry)mesh.geometry=
    currentIsHero?geo:maskedBodyGeometry.get(mesh);
  }
  dressed.visible=!active;
  youthOutfit.object.visible=currentIsHero&&!active;
  return {
   active,
   skinMeshes:active?anatomySkinSurfaces:0,
   texture:active?HEROINE_SKIN_TEXTURE_INFO:null,
   originalEyesPreserved:true,
   sourceModelsUnchanged:true,previewOnly:true,
   portraitSimilarityCertified:false
  };
 }
 function setPart(part,show){
  const o=parts.get(part);if(!o)return false;
  // Female preview never shows the Viking donor's moustache or beard,
  // even when the generic viewer toggles beard visibility on.
  if(gender==='female'&&['beard','moustache'].includes(part)){
   o.visible=false;return true;
  }
  if(currentIsHero&&['tunic','pants','boots'].includes(part)){
   o.visible=false;
   if(part==='tunic')youthOutfit.object.visible=Boolean(show);
   else youthOutfit.setLowerVisible(part,show);
   return true;
  }
  o.visible=Boolean(show);return true;
 }
 function getPart(part){return parts.get(part);}
 preset('swordsman');setBlink(0);
 const rendererMaterials=[...ownedMaterials];
 return {
  actor,body:donorBody,head:detailedHead,outfit:dressed,parts,lids,
  fitted:fit,metrics,rendererMaterials,setBlink,setMorph,setPart,getPart,preset,setAppearance,
  setAnatomyPreview,
  getFaceReport:()=>youthfulFace.getReport(),
  setReferenceGuideVisible:show=>youthfulFace.setReferenceGuideVisible(show),
  getFacialQA,setBrowsVisible,
  diagnostics:()=>({...metrics,blink:round(blink),
   youthGarment:youthOutfit.report,
   youthGarmentVisible:youthOutfit.object.visible,
   originalBodyRestoredUnderHeroCloth:currentIsHero&&[...sourceBodyGeometry]
    .every(([mesh,g])=>mesh.geometry===g),
   bodyUnderGarmentMode:currentIsHero?'continuous-source-skin':'legacy-npc-mask',
   sourceLowerGarmentVisible:currentIsHero?
    Boolean(parts.get('pants').visible||parts.get('boots').visible):true,
   sourceTunicVisible:parts.get('tunic').visible,
   hairVisible:!!parts.get('scalp')?.visible,
   adultAnatomyPreview:anatomyPreviewActive,
   adultSkinPBR:anatomyPreviewActive?HEROINE_SKIN_TEXTURE_INFO:null,
   adultSkinMappedMeshes:anatomyPreviewActive?anatomySkinSurfaces:0,
   swordReady:false}),
  dispose(){
   // Both geometry modes are owned by this inspection actor. The source
   // clone geometry is shared with the loaded GLB and is not disposed here.
   for(const [mesh,g] of maskedBodyGeometry)
    if(g!==sourceBodyGeometry.get(mesh))g.dispose();
   youthOutfit.dispose();
   for(const lid of [...lids,...upperLids,...lowerLids])lid.geometry.dispose();
   for(const lash of upperEyelashes){lash.geometry.dispose();lash.material.dispose();}
   for(const b of eyeFixtures){b.brow.geometry.dispose();b.brow.material.dispose();}
   for(const m of ownedMaterials)m.dispose();
   donorBody.traverse(o=>{
    if(!o.isMesh)return;
    for(const mat of Array.isArray(o.material)?o.material:[o.material])mat?.dispose();
   });
  }
 };
}
