import * as THREE from 'three';
import {buildStudioContourNeck} from './studio-contour-neck-v58.js';
import {weldStudioNeckIntoFace,addStudioRaisedInnerCollar,
 measureStudioBareTorsoNeck,measureStudioGarmentCollar} from './studio-unified-neck-v59.js?v=62';
import {clipStudioFaceBustPreservingSurface,restoreStudioFaceSurfaceQuality,
 sampleStudioFacePigment,smoothStudioFaceNormals,
 studioAnatomicalSeamY,taperStudioLowerBustBelowChin} from './studio-face-quality-v56.js?v=60';
import {createCharacter} from './character-system/shared-character-runtime.js?v=4.6.36';
import {buildRiggedJobOutfit} from './character-system/rigged-outfit-runtime.js?v=63';
import {loadJobMotionMap} from './character-system/job-motion-source.js?v=4.6.36';
import {measureHeadLocalBounds} from './character-system/hair-attachment-runtime.js?v=4.4.89';
import {createHeroineBattleActionVfx} from './heroine-battle-action-vfx.js?v=40';
import {resolveBodyShape} from './character-cast-v46.js?v=46';
import {resolveDemographicProfile,resolveBodyType,resolveAgeBand}
 from './character-demographics-v47.js?v=60';
import {applySkinnedBuildMorph} from './body-build-morph-v48.js?v=60';

/**
 * Reuse EXACT game battle clothing: Female_Ranger / Female_Peasant skinned GLTF,
 * per-job armor/cloth/gear and the 65-bone Quaternius motion rig.
 * The authoring studio supplies ONLY the independent face and wig.
 */
/**
 * Studio-only proportion correction. Scale the complete combat actor
 * (body, armor, cloth and hand-held gear) as one unit, then counter-scale
 * the independently authored face. This is NEVER applied in battle.
 */
export const HEROINE_STUDIO_BODY_SCALE=.84;
export const HERO_STUDIO_MALE_BODY_SCALE=.84;
export const HEROINE_STUDIO_HEAD_LIFT=.30;
export const HEROINE_STUDIO_HEAD_FORWARD=.16;

export function fitStudioFaceAboveArmor({actorRoot,faceRoot,faceFit,bodyScale=HEROINE_STUDIO_BODY_SCALE}){
 if(!actorRoot?.isObject3D||!faceRoot?.isObject3D||!faceFit?.targetSize)
  throw Error('Real actor, independent face and measured head required');
 if(!Number.isFinite(bodyScale)||bodyScale<=.5||bodyScale>1)
  throw Error('Invalid preview body scale');
 // Store the initial scale so a new job never accumulates scale factors.
 const original=actorRoot.userData.originalStudioActorScale||
  actorRoot.scale.toArray();
 actorRoot.userData.originalStudioActorScale=[...original];
 actorRoot.scale.set(original[0]*bodyScale,original[1]*bodyScale,original[2]*bodyScale);
 // The face should not shrink along with the breastplate and shoulder armor.
 faceRoot.scale.setScalar(faceFit.scale/bodyScale);
 const headHeight=faceFit.targetSize[1],headDepth=faceFit.targetSize[2];
 const lift=headHeight*HEROINE_STUDIO_HEAD_LIFT/bodyScale;
 const forward=headDepth*HEROINE_STUDIO_HEAD_FORWARD/bodyScale;
 // Re-derive the aligned face position rather than adding offsets on
 // repeated face rebuilds, which previously pushed the head into the collar.
 faceRoot.position.set(
  faceFit.targetCenter[0]-faceFit.sourceCenter[0]*faceRoot.scale.x,
  faceFit.targetCenter[1]-faceFit.sourceCenter[1]*faceRoot.scale.y+lift,
  faceFit.targetCenter[2]-faceFit.sourceCenter[2]*faceRoot.scale.z+forward
 );
 faceRoot.userData.studioBodyScale=bodyScale;
 faceRoot.userData.studioHeadLift=lift;
 faceRoot.userData.studioHeadForward=forward;
 return {bodyScale,faceCompensation:1/bodyScale,
  lift,forward,relativeFaceHeight:faceRoot.scale.y/(faceFit.scale||1),
  appliedToAllCombatJobs:true,previewOnly:true};
}

/**
 * Upgrade materials only for the studio preview. No battle-wide material,
 * shared GLTF, UV, normal map or texture is modified.
 */
export function enhanceStudioCombatMaterials(wardrobeRoot){
 if(!wardrobeRoot?.traverse)throw Error('Real outfit root required');
 let armorMaterials=0,fabricMaterials=0,preservedTextures=0;
 wardrobeRoot.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.material)return;
  const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const mapped=source.map(material=>{
   if(!material?.isMeshStandardMaterial)return material;
   const name=(mesh.name+' '+(material.name||'')).toLowerCase();
   if(/(^|[^a-z])(skin|face|head|eye|hand)([^a-z]|$)/.test(name))
    return material;
   const metallic=/armor|armour|plate|mail|steel|metal|shield|helm|pauldron|sword|blade|brass|silver/.test(name)||
    Number(material.metalness)>.24;
   const fabric=/fabric|cloth|robe|gambeson|leather|linen|cotton|tunic|cape|skirt|sleeve/.test(name);
   if(!metallic&&!fabric)return material;
   const upgraded=material.clone();
   if(upgraded.map||upgraded.normalMap||upgraded.roughnessMap)
    preservedTextures++;
   if(metallic){
    upgraded.roughness=THREE.MathUtils.clamp(upgraded.roughness*.83,.25,.48);
    upgraded.metalness=THREE.MathUtils.clamp(Math.max(upgraded.metalness,.35),.35,.72);
    if(upgraded.isMeshPhysicalMaterial){
     upgraded.clearcoat=Math.max(upgraded.clearcoat||0,.16);
     upgraded.clearcoatRoughness=.29;
    }
    armorMaterials++;
   }else{
    upgraded.roughness=THREE.MathUtils.clamp(upgraded.roughness,.69,.91);
    fabricMaterials++;
   }
   upgraded.needsUpdate=true;
   return upgraded;
  });
  mesh.material=Array.isArray(mesh.material)?mapped:mapped[0];
 });
 return {armorMaterials,fabricMaterials,preservedTextures,sourceAssetsPreserved:true};
}


/**
 * Preview-only skin PBR pass. Cloning leaves cached GLTF materials untouched.
 * Keep original color, UV, normal and roughness texture maps.
 */
export function enhanceStudioBodyMaterials(characterModel){
 if(!characterModel?.traverse)throw Error('Real skinned body required');
 let skinMaterials=0,preservedTextures=0;
 characterModel.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.material)return;
  const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const changed=originals.map(source=>{
   if(!source?.isMeshStandardMaterial)return source;
   const name=(mesh.name+' '+(source.name||'')).toLowerCase();
   if(!/skin|body|torso|hand|arm|neck|face|leg|foot/.test(name)||
    /armor|metal|shield|blade|weapon|fabric|cloth|trouser|pants|leather|eye|lash|brow/.test(name))
    return source;
   const surface=source.clone();
   if(surface.map||surface.normalMap||surface.roughnessMap)preservedTextures++;
   surface.metalness=0;
   surface.roughness=THREE.MathUtils.clamp(surface.roughness,.64,.78);
   surface.needsUpdate=true;skinMaterials++;
   return surface;
  });
  mesh.material=Array.isArray(mesh.material)?changed:changed[0];
 });
 return {skinMaterials,preservedTextures,originalMaterialsUntouched:true,previewOnly:true};
}

/**
 * Garment removal must also restore the rigged torso/arms.
 * The body coverage cache is created after the original donor face is cut,
 * so restoring skin will never resurrect the old eye sockets.
 */
export function syncStudioBodyOutfitVisibility(characterModel,outfit,{showBody=true,showOutfit=true}={}){
 characterModel?.traverse?.(object=>{
  if(!object.isSkinnedMesh)return;
  if(/^(eyes|eyebrows)$/i.test(object.name)){object.visible=false;return;}
  object.visible=!!showBody;
 });
 outfit?.setBodyOcclusion?.(!!(showBody&&showOutfit));
 if(outfit?.root)outfit.root.visible=!!(showBody&&showOutfit);
 return {bodyVisible:!!showBody,outfitVisible:!!(showBody&&showOutfit),
  bodyOccludedByGarment:!!(showBody&&showOutfit)};
}

/**
 * Costume-only fitting pass. The source GLTFs remain intact:
 * the studio narrows overly massive female plate limbs, and removes
 * disconnected *spherical* rivet objects that look like floating marbles.
 */
/**
 * Anatomical head/torso fitting for the human STUDIO. The previous system
 * fitted a detached head to a skull bone without considering where the
 * imported Ranger/Peasant neckline actually ends. On the live female model
 * this placed the face bottom at Y=1.00 while the skinned torso ended at
 * Y=1.137: the neck and cuirass literally covered the mouth.
 *
 * Move the ENTIRE authored head hierarchy (skin, eyes, lashes, wig and
 * closed-neck bridge) toward the *actual skinned torso* in world space.
 * No mesh geometry, bind pose, battle units, or equipment is modified.
 * Idempotent: repeated calls never add a second offset after alignment.
 */
export function alignStudioHeadToSkinnedTorso({
 faceRoot,faceMesh,wardrobeRoot,clearance=.008,maxLift=.28
}={}){
 if(!faceRoot?.isObject3D||!faceMesh?.isMesh||
    !wardrobeRoot?.traverse||!faceRoot.parent)
  return {applied:false,reason:'head-or-wardrobe-missing'};
 const bodies=[];
 wardrobeRoot.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.geometry?.getAttribute('position'))return;
  if(/^(?:(?:female|male)_(?:ranger|peasant)_body|superhero_(?:female|male))$/i.test(mesh.name))
   bodies.push(mesh);
 });
 if(!bodies.length)return {applied:false,reason:'real-torso-mesh-missing'};
 faceRoot.parent.updateWorldMatrix(true,true);
 wardrobeRoot.updateWorldMatrix(true,true);
 faceMesh.geometry.computeBoundingBox();
 const faceSource=STUDIO_FACE_NECK_CACHE.get(faceMesh)?.source||faceMesh.geometry;
 if(!faceSource.boundingBox)faceSource.computeBoundingBox();
 const headWorldBounds=faceSource.boundingBox.clone()
  .applyMatrix4(faceMesh.matrixWorld);
 const beforeMinY=headWorldBounds.min.y;
 const anatomicalHeadHeight=headWorldBounds.getSize(new THREE.Vector3()).y;
 let torsoTopY=-Infinity;
 for(const mesh of bodies){
  mesh.geometry.computeBoundingBox();
  const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  torsoTopY=Math.max(torsoTopY,box.max.y);
 }
 const measuredSkin=measureStudioBareTorsoNeck(wardrobeRoot);
 if(measuredSkin.applied)torsoTopY=measuredSkin.topY;
 if(!Number.isFinite(torsoTopY)||!Number.isFinite(beforeMinY))
  return {applied:false,reason:'nonfinite-head-torso-geometry'};
 // The v53/v54 +8mm rule placed the *uncropped portrait bust* ABOVE the
 // top of the actual torso. Cropping that bust then exposed a long cylinder
 // between a floating chin and the armor. The original untrimmed face has a
 // small lower bust skirt, so its lowest vertex should sit INSIDE the torso
 // neckline by a bounded anatomical inset. The clipped jaw then ends just
 // above the shirt collar, without sinking the mouth into the cuirass.
 const anatomicalInset=THREE.MathUtils.clamp(anatomicalHeadHeight*.10,.012,.028);
 const targetOriginalFaceBottomY=torsoTopY-anatomicalInset;
 const requestedCorrectionY=targetOriginalFaceBottomY-beforeMinY;
 const correctionY=THREE.MathUtils.clamp(requestedCorrectionY,-.20,maxLift);
 if(Math.abs(correctionY)>1e-5){
  const headOriginWorld=faceRoot.getWorldPosition(new THREE.Vector3());
  const desiredLocal=faceRoot.parent.worldToLocal(
   headOriginWorld.add(new THREE.Vector3(0,correctionY,0)));
  faceRoot.position.copy(desiredLocal);
  faceRoot.updateWorldMatrix(true,true);
 }
 // Always remeasure the immutable SOURCE face; the runtime visibly crops
 // the lower bust, and using its smaller box on subsequent frames would
 // feed back into another unwanted head lift.
 const afterBounds=faceSource.boundingBox.clone()
  .applyMatrix4(faceMesh.matrixWorld);
 return {applied:true,torsoMeshes:bodies.length,
  faceBottomBeforeY:beforeMinY,faceBottomAfterY:afterBounds.min.y,
  torsoNeckTopY:torsoTopY,requiredLift:Math.max(0,requestedCorrectionY),
  appliedLift:Math.max(0,correctionY),appliedLowering:Math.max(0,-correctionY),
  correctionY,targetOriginalFaceBottomY,anatomicalInset,
  gapMeters:afterBounds.min.y-torsoTopY,
  headAndHairMovedTogether:true,originalMeshesPreserved:true,
  previewOnly:true,nonAccumulative:true};
}

// Store unmodified source vertices per preview mesh. Re-applying this on
// body/age/job changes must NEVER squash an already fitted breastplate.
const STUDIO_CHEST_ORIGINAL=new WeakMap();
const STUDIO_FACE_NECK_CACHE=new WeakMap();
const STUDIO_NECK_NAME='STUDIO_REAL_SKIN_NECK_CONNECTOR_V54';
const STUDIO_NEW_NECK_NAME='STUDIO_CONTOUR_SKIN_NECK_V58';

/**
 * Remove the source CC0 portrait's flat shoulder-bust rim from the combat
 * studio only. The visible horizontal board beneath the jaw is NOT part of
 * the body outfit. Replace that lower slice with a short, tapered, actual 3D
 * cervical mesh whose top and bottom overlap the intact face and chest.
 *
 * This operates on a cloned preview face geometry, never the GLB source.
 * All positions are computed in world space then transformed into headRoot
 * coordinates so the material/neck follow the 65-bone head animation.
 */
/** Select anatomy from the actual naked donor OR Ranger/Peasant mesh. */
export function studioNapeRiseForBodies(bodies=[]){
 return bodies.some(body=>
  /^(?:male_(?:ranger|peasant)_body|superhero_male)$/i.test(body?.name||''))?
  .018:.012;
}

export function fitStudioNeckContinuity({faceRoot,faceMesh,wardrobeRoot,garmentRoot=null}={}){
 if(!faceRoot?.isObject3D||!faceMesh?.isMesh||
    !faceMesh.geometry?.getAttribute('position')||
    !wardrobeRoot?.traverse)return {applied:false,reason:'head-or-wardrobe-missing'};
 let cached=STUDIO_FACE_NECK_CACHE.get(faceMesh);
 if(!cached||(faceMesh.geometry!==cached.clipped&&faceMesh.geometry!==cached.stitched)){
  if(cached?.clipped)cached.clipped.dispose();
  cached={source:faceMesh.geometry,clipped:null};
  STUDIO_FACE_NECK_CACHE.set(faceMesh,cached);
 }
 const source=cached.source;
 if(!source.boundingBox)source.computeBoundingBox();
 faceRoot.updateWorldMatrix(true,true);
 wardrobeRoot.updateWorldMatrix(true,true);
 const originalFaceBounds=source.boundingBox.clone().applyMatrix4(faceMesh.matrixWorld);
 const headHeight=originalFaceBounds.getSize(new THREE.Vector3()).y;
 if(headHeight<.08)return {applied:false,reason:'face-height-invalid'};
 const bodies=[];
 wardrobeRoot.traverse(mesh=>{
  if(mesh.isSkinnedMesh&&
   /^(?:(?:female|male)_(?:ranger|peasant)_body|superhero_(?:female|male))$/i.test(mesh.name)&&
   mesh.geometry?.getAttribute('position'))bodies.push(mesh);
 });
 if(!bodies.length)return {applied:false,reason:'torso-missing'};
 let torsoTop=-Infinity,torsoZ=0,torsoX=0;
 for(const mesh of bodies){
  mesh.geometry.computeBoundingBox();
  const b=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  if(b.max.y>torsoTop){
   torsoTop=b.max.y;
   torsoX=(b.min.x+b.max.x)*.5;
   torsoZ=(b.min.z+b.max.z)*.5;
  }
 }
 // PHASE 1: align the neck directly to the real posed bare torso skin.
 // No metal plate, cloth collar or outfit visibility participates in this.
 const bareProfile=garmentRoot?
  measureStudioBareTorsoNeck(wardrobeRoot):
  {applied:false,reason:'legacy-single-root-garment-compatibility'};
 if(bareProfile.applied){
  torsoTop=bareProfile.topY;
  torsoX=bareProfile.centerX;
  torsoZ=bareProfile.centerZ;
 }
 // Crop only the lowest 10-12%: the portrait's broad, horizontal shoulder
 // pedestal is at the very bottom; the jaw, lips and ears must survive.
 const cutY=Math.max(originalFaceBounds.min.y+headHeight*.115,torsoTop+.006);
 const safeCutY=Math.min(cutY,originalFaceBounds.min.y+headHeight*.16);
 // Keep all untouched original sculpt vertices, normals, UVs and colour
 // pigments INDEXED. Older preview clipping duplicated every triangle and
 // visibly faceted the cheeks, chin and nose on some mobile renderers.
 const localCutY=faceMesh.worldToLocal(new THREE.Vector3(0,safeCutY,0)).y;
 let cut;
 if(cached.clipped&&cached.cutReport&&
    Math.abs((cached.localCutY??Infinity)-localCutY)<.00020){
  cut=cached.cutReport;
  faceMesh.geometry=cached.clipped;
 }else{
  faceMesh.geometry=source;
  // The imported male nape retains more angular shoulder-bust than the
  // female portrait. Trim only the donor's low rear bust in disposable
  // preview geometry; preserve jaw/lips/eyes and the original source GLB.
  // A skin-first donor is named SuperHero_Male/SuperHero_Female rather
  // than Male_Ranger_Body. Detect both before choosing the rear neckline.
  const napeRise=studioNapeRiseForBodies(bodies);
  cut=clipStudioFaceBustPreservingSurface(faceMesh,safeCutY,{
   anatomicalCurve:true,backRise:napeRise});
  if(cut.keptTriangles<100||cut.removedTriangles<3){
   cut.geometry.dispose();faceMesh.geometry=source;
   return {applied:false,reason:'insufficient-sculpted-bust-to-trim'};
  }
  if(cached.clipped)cached.clipped.dispose();
  cached.clipped=cut.geometry;
  cached.cutReport=cut;cached.localCutY=localCutY;
  faceMesh.geometry=cut.geometry;
  cached.bustTaperReport=taperStudioLowerBustBelowChin(faceMesh,{
   sourceWorldBounds:originalFaceBounds,
   upperRatio:.27,lowerRatio:.10,edgeReduction:.72
  });
  cached.normalReport=smoothStudioFaceNormals(cut.geometry);
 }
 const normalQuality=cached.normalReport;
 const bustTaper=cached.bustTaperReport;
 const faceQuality=restoreStudioFaceSurfaceQuality(faceMesh);
 const facePigment=sampleStudioFacePigment(faceMesh);
 const clothes=garmentRoot||wardrobeRoot;
 const oldRaisedCollar=clothes.getObjectByName('STUDIO_RAISED_INNER_TUNIC_COLLAR_V59');
 if(oldRaisedCollar){
  oldRaisedCollar.removeFromParent();
  oldRaisedCollar.geometry.dispose();oldRaisedCollar.material.dispose();
 }
 const oldContour=faceMesh.getObjectByName(STUDIO_NEW_NECK_NAME);
 if(oldContour){
  oldContour.removeFromParent();
  oldContour.geometry.dispose();
  oldContour.material.dispose();
 }
 const oldBridge=faceRoot.getObjectByName(STUDIO_NECK_NAME);
 if(oldBridge){
  oldBridge.removeFromParent();
  oldBridge.geometry.dispose();
  oldBridge.material.dispose();
 }
 // The connector is a SHORT under-chin transition, not a visible pipe.
 // Overlap its lower ring beneath the clothing; do not extend 27mm below
 // the collar and 13mm above the cropped head as v54 did.
 const bottomY=torsoTop-.016,topY=safeCutY+.003;
 if(topY<=bottomY+.008)return {applied:false,reason:'neck-height-invalid'};
 const cx=(originalFaceBounds.min.x+originalFaceBounds.max.x)*.5;
 const cz=(originalFaceBounds.min.z+originalFaceBounds.max.z)*.5-.011;
 const faceWidth=originalFaceBounds.getSize(new THREE.Vector3()).x;
 // v57: a visible rectangular strip was partly caused by the connector
 // being nearly as wide as the chin. Taper inside the *real* jaw outline,
 // widening only beneath the tunic collar and keeping the top inconspicuous.
 const radiusX=THREE.MathUtils.clamp(faceWidth*.20,.026,.043);
 const radiusZ=THREE.MathUtils.clamp(faceWidth*.17,.024,.039);
 // A cylindrical cut looks like a pipe. Five spline-like tapered rings
 // keep the trapezius and under-jaw continuous without adding shoulders.
 const count=32,rings=9;
 const verts=[],colors=[],uv=[],index=[];
 // Use the same face skin material and sampled lower-cheek pigment;
 // a fixed opaque beige cylinder becomes a glaring white rectangular
 // neck under blue/soft light. Alpha tapers into the actual chin and collar.
 // Real browser isolation proved the flat white bar IS this neck connector.
 // Its lower surface must visually be a cloth collar, not a bright skin
 // cylinder. Match the slate tunic under every combat garment; retain a
 // narrow soft skin transition right under the jaw.
 const skinShade=facePigment.base.clone()
  .multiply(facePigment.multiplier).multiplyScalar(.96);
 // The source sewn-neckline texture is pale and its material.color
 // does not represent the visible fabric pigment. Sampling it produced the
 // same WHITE rectangle in actual Chromium. Use a consistent slate
 // undershirt tint; fading the last ring inside the jaw hides its seam.
 const tunicShade=new THREE.Color(0x526a7e);
 faceRoot.updateWorldMatrix(true,false);
 for(let r=0;r<rings;r++){
  const t=r/(rings-1);
  const baseY=bottomY+(topY-bottomY)*t;
  // Taper the visible top deeply under the chin. A broad top ring made
  // a pale rectangular neck column despite the shorter connector height.
  const widen=1.10-.33*t-.04*Math.sin(Math.PI*t);
  const xCenter=THREE.MathUtils.lerp(torsoX,cx,t);
  const zCenter=THREE.MathUtils.lerp(torsoZ-.015,cz-.022*t,t);
  const nearChin=THREE.MathUtils.smoothstep(t,.31,.86);
  const surface=tunicShade.clone().lerp(skinShade,nearChin);
  for(let s=0;s<=count;s++){
   const angle=2*Math.PI*s/count;
   const x=xCenter+Math.cos(angle)*radiusX*widen;
   const z=zCenter+Math.sin(angle)*radiusZ*widen;
   // Follow the same shallow jaw/nape curve as the source-face cut.
   // The upper ring disappears a few millimeters inside the face instead
   // of ending in a prominent perfectly horizontal rectangular shelf.
   const seamY=studioAnatomicalSeamY(safeCutY,x,z,{
    centerX:cx,centerZ:(originalFaceBounds.min.z+originalFaceBounds.max.z)*.5,
    halfWidth:faceWidth*.48,
    halfDepth:originalFaceBounds.getSize(new THREE.Vector3()).z*.5,
    sideRise:.028,backRise:.006
   });
   // A visible jaw has a shallow U-shaped underside, not a flat bar.
   // At the exposed connector top lift both lateral edges ~5mm into the
   // existing face mesh, leaving the chin center lower and the hard rim
   // concealed behind the cheek contour. The bottom clothing ring stays put.
   const jawArc=.005*Math.pow(Math.abs(Math.cos(angle)),1.5);
   const y=baseY+Math.pow(t,3)*(seamY-safeCutY+jawArc);
   const world=new THREE.Vector3(x,y,z);
   const local=faceRoot.worldToLocal(world);
   verts.push(local.x,local.y,local.z);
   const edgeBlend=.035+.965*Math.min(1,t*4,(1-t)*5);
   colors.push(surface.r,surface.g,surface.b,edgeBlend);
   uv.push(s/count,t);
  }
 }
 for(let r=0;r<rings-1;r++)for(let s=0;s<count;s++){
  const a=r*(count+1)+s,b=a+count+1;
  index.push(a,b,a+1,b,b+1,a+1);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(index);geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,
  roughness:.92,metalness:0,transparent:true,opacity:1,
  depthWrite:false,side:THREE.DoubleSide,flatShading:false
 });
 const bridge=new THREE.Mesh(geometry,material);
 bridge.name=STUDIO_NECK_NAME;
 bridge.userData={studioPreviewOnly:true,realNeckConnector:true,
  placedUsingActualTorso:true,originalFaceGeometryPreserved:true};
 bridge.frustumCulled=false;bridge.castShadow=true;bridge.receiveShadow=true;
 faceRoot.add(bridge);
 // v58: the real cut-edge loft replaces the approximate blue fabric pipe.
 // The former bridge remains as a fallback ONLY when imported geometry
 // genuinely lacks a continuous lower-face cut boundary.
 const contourNeck=buildStudioContourNeck({
  faceRoot,faceMesh,cut,torsoTopY:torsoTop,
  torsoCenterX:torsoX,torsoCenterZ:torsoZ,facePigment
 });
 bridge.visible=!contourNeck.applied;
 // Real skin is stitched into the SAME indexed face geometry and rendered
 // with the SAME material. Unlike v58's separate cylinder, it reaches the
 // actual garment neckline, not the uppermost torso vertex.
 const united=weldStudioNeckIntoFace({
  faceMesh,cut,wardrobeRoot,torsoTopY:torsoTop,
  torsoCenterX:torsoX,torsoCenterZ:torsoZ,facePigment,
  bareTorsoProfile:bareProfile.applied?bareProfile:null
 });
 let raisedCollar={applied:false,reason:'unified-neck-not-ready'};
 if(united.applied){
  // PHASE 2: only after the skin seam exists, fit the outfit collar.
  const actualGarment=measureStudioGarmentCollar(clothes,{torsoTopY:torsoTop});
  raisedCollar=addStudioRaisedInnerCollar({wardrobeRoot:clothes,
   joined:{...united,collarY:actualGarment.y,collarSource:actualGarment.mesh}});
  if(cached.stitched&&cached.stitched!==united.geometry)
   cached.stitched.dispose();
  cached.stitched=united.geometry;
  faceMesh.geometry=united.geometry;
  // v54 and v58 meshes remain geometry fallbacks only. Neither may be
  // rendered on top of the unified facial skin surface.
  bridge.visible=false;
  if(contourNeck.mesh)contourNeck.mesh.visible=false;
 }
 // The standalone portrait page used an older broad, flat neck seal plus
 // LEFT/RIGHT shoulder cut caps. Those parts remain children of this face
 // when it enters the armor preview. Keeping them visible alongside the
 // new cervical connector recreates the white horizontal board beneath
 // the chin, even after correctly cropping the original sculpted bust.
 // These are preview-only visibility toggles; original geometry is kept.
 let legacyNeckPartsHidden=0,legacyNeckPartsAlreadyHidden=0;
 faceRoot.traverse(part=>{
  if(part.isMesh&&/^(?:REAL_HEAD_BODY_CLOSED_NECK_SEAL|(?:LEFT|RIGHT)_SHOULDER_CUT_SURFACE_CAP)$/i.test(part.name)){
   if(!part.visible)legacyNeckPartsAlreadyHidden++;
   legacyNeckPartsHidden++;
   part.visible=false;
  }
 });
 return {applied:true,legacyNeckPartsHidden,legacyNeckPartsAlreadyHidden,
  contourNeckApplied:!!contourNeck.applied,
  contourNeckReason:contourNeck.reason||null,
  unifiedSkinNeckApplied:!!united.applied,
  v62SkinFirst:!!united.v62SkinFirst,
  v62SkinToTorsoOverlap:united.v62SkinToTorsoOverlap??null,
  v62BareBodyNeckSource:bareProfile.applied?bareProfile.mesh:null,
  v62BareBodyNeckSamples:bareProfile.ringSamples??0,
  v62MeasuredBodyNeckWidth:bareProfile.halfWidth??null,
  v62MeasuredBodyNeckDepth:bareProfile.halfDepth??null,
  v62ClothingFittedAfterSkin:!!united.applied&&!!raisedCollar.applied,
  unifiedSkinNeckReason:united.reason||null,
  unifiedSkinNeckTriangles:united.addedTriangles||0,
  v61WidenedNeck:!!united.v61WidenedNeck,
  v61NeckRingCount:united.v61NeckRingCount??null,
  v61WidthGainAtMid:united.v61WidthGainAtMid??null,
  v61DepthGainAtMid:united.v61DepthGainAtMid??null,
  v61NeckMidHalfWidth:united.neckMidHalfWidthX??null,
  v61NeckMidHalfDepth:united.neckMidHalfDepthZ??null,
  v61CollarTopHalfWidth:raisedCollar.v61TopHalfWidthX??null,
  v61CollarTopHalfDepth:raisedCollar.v61TopHalfDepthZ??null,
  unifiedSkinNeckEdges:united.boundaryEdges||0,
  reusedFaceMaterial:!!united.faceSkinMaterialReused,
  actualCollarSource:garmentRoot?
   measureStudioGarmentCollar(clothes,{torsoTopY:torsoTop}).mesh:
   united.collarSource||null,
  actualCollarHeight:garmentRoot?
   measureStudioGarmentCollar(clothes,{torsoTopY:torsoTop}).y:
   united.collarY??null,
  unifiedNeckBottomHeight:united.neckBottomY??null,
  unifiedNeckColorSmoothed:!!united.neckColorSmoothed,
  unifiedNeckNormalsSmoothed:!!united.neckNormalsSmoothed,
  raisedInnerCollarApplied:!!raisedCollar.applied,
  raisedInnerCollarTopY:raisedCollar.topY??null,
  raisedInnerCollarBottomY:raisedCollar.baseY??null,
  visibleSkinNeckLength:raisedCollar.visibleSkinLength??null,
  separateNeckGeometryHidden:!!united.applied&&
   !bridge.visible&&(!contourNeck.mesh||!contourNeck.mesh.visible),
  originalFaceGeometryImmutable:!!united.sourceVertexPositionsUnchanged,
  actualCutEdgeSegments:contourNeck.segments||0,
  seamSampleFallbacks:contourNeck.fallbackCount||0,
  correctSkinNeckColor:contourNeck.skinColored||false,
  originalBluePipeHidden:!bridge.visible,
  contourNeckLength:contourNeck.neckHeight||null,
  sourceTrianglesPreserved:true,
  bustTrianglesRemoved:cut.removedTriangles,
  trimmedSculptBottomY:safeCutY,
  anatomicalJawCut:!!cut.anatomicalCurve,
  cutPlaneType:cut.cutPlaneType,
  v60NapeRise:cut.anatomicalSeamProfile?.backRise??null,
  lowerBustTapered:!!bustTaper?.applied,
  lowerBustTaperedVertices:bustTaper?.affectedVertices||0,
  sourceFaceUnchangedByBustTaper:!!bustTaper?.sourceGeometryUntouched,
  narrowUnderJawConnector:true,
  originalFaceGeometryPreserved:true,
  actualTorsoTopY:torsoTop,connectorBottomY:bottomY,connectorTopY:topY,
  segmentCount:count,neckHeight:topY-bottomY,headHeight,
  originalIndexedVertices:cut.originalVertexCount,
  untouchedFaceTriangles:cut.untouchedTriangles,
  newCutVertices:cut.newCutVertices,
  originalFaceNormalsPreserved:cut.sourceNormalsPreserved,
  smoothedFacialNormals:!!normalQuality?.applied,
  normalWeldGroups:normalQuality?.weldedGroups||0,
  normalVerticesUpdated:normalQuality?.alteredNormalVertices||0,
  originalFaceColoursPreserved:true,
  skinToneSource:facePigment.samples?'face-cheek-pigment':'face-material',
  matchedFaceMaterial:true,tunicInnerCollar:true,
  collarFabricColor:'#526a7e',transparentNeckEdge:true,
  faceSurfaceQuality:faceQuality,
  neckToHeadRatio:(topY-bottomY)/headHeight,
  collarOverlapMeters:torsoTop-bottomY,
  skullAndHairUnaffected:true,previewOnly:true};
}

/**
 * Real geometry-based neck clearance, for the PREVIEW only.
 * A tall imported cuirass can physically hide the eyes and mouth despite
 * a correctly attached head bone. Compress all chest metal in one world-Y
 * coordinate system, anchoring its lowest point (no floating breastplate),
 * until the top falls below the actual sculpted chin. Eye/face geometry and
 * shared battle armor GLBs are never modified.
 */
export function fitStudioCuirassBelowChin({faceMesh,wardrobeRoot,marginRatio=.035}={}){
 if(!faceMesh?.isMesh||!faceMesh.geometry?.getAttribute('position')||
    !wardrobeRoot?.traverse)return {applied:false,reason:'head-or-wardrobe-missing'};
 const chest=[];
 wardrobeRoot.traverse(mesh=>{
  if(mesh.isMesh&&!mesh.isSkinnedMesh&&mesh.visible&&
     mesh.userData?.equipmentClass==='armor'&&mesh.userData?.equipmentSlot==='chest'&&
     mesh.geometry?.getAttribute('position')?.count>0)chest.push(mesh);
 });
 if(!chest.length)return {applied:false,reason:'no-chest-armor',chestPieces:0};
 faceMesh.updateWorldMatrix(true,false);
 wardrobeRoot.updateWorldMatrix(true,true);
 // The v59 unified mesh extends into the shirt, so use the cached actual
 // HEAD sculpt (before added neck rings) when locating the mandible. Using
 // the new neckline as a chin marker would shrink the cuirass incorrectly.
 const faceGeometry=STUDIO_FACE_NECK_CACHE.get(faceMesh)?.clipped||faceMesh.geometry;
 if(!faceGeometry.boundingBox)faceGeometry.computeBoundingBox();
 const faceBounds=faceGeometry.boundingBox.clone().applyMatrix4(faceMesh.matrixWorld);
 const faceHeight=faceBounds.getSize(new THREE.Vector3()).y;
 if(faceHeight<.01)return {applied:false,reason:'head-bounds-invalid'};
 // Real facial mesh extends below the mandible at the cropped neck.
 // Use the lower fifth of head height as the jaw landmark, not the eye-line.
 const chinY=faceBounds.min.y+faceHeight*.20;
 const limitY=chinY-Math.max(.008,faceHeight*marginRatio);
 let highest=-Infinity,lowest=Infinity;
 const worldPoint=new THREE.Vector3();
 for(const mesh of chest){
  let saved=STUDIO_CHEST_ORIGINAL.get(mesh);
  if(!saved){
   const geometry=mesh.geometry.clone();
   mesh.geometry=geometry;
   saved={positions:geometry.getAttribute('position').array.slice()};
   STUDIO_CHEST_ORIGINAL.set(mesh,saved);
  }
  const pos=mesh.geometry.getAttribute('position');
  pos.array.set(saved.positions);pos.needsUpdate=true;
  mesh.geometry.computeBoundingBox();
  mesh.updateWorldMatrix(true,false);
  for(let i=0;i<pos.count;i++){
   worldPoint.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
   highest=Math.max(highest,worldPoint.y);
   lowest=Math.min(lowest,worldPoint.y);
  }
 }
 if(!Number.isFinite(highest)||highest-lowest<.01)
  return {applied:false,reason:'armor-bounds-invalid'};
 const required=highest>limitY+.0005;
 // An over-tall chestplate must not shrink to nothing. This guard protects
 // art assets whose entire chest is above the neck (a broken attachment).
 const targetRatio=THREE.MathUtils.clamp((limitY-lowest)/(highest-lowest),.35,1);
 if(required){
  for(const mesh of chest){
   const pos=mesh.geometry.getAttribute('position');
   const worldToLocal=mesh.matrixWorld.clone().invert();
   for(let i=0;i<pos.count;i++){
    worldPoint.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);
    worldPoint.y=lowest+(worldPoint.y-lowest)*targetRatio;
    worldPoint.applyMatrix4(worldToLocal);
    pos.setXYZ(i,worldPoint.x,worldPoint.y,worldPoint.z);
   }
   pos.needsUpdate=true;
   mesh.geometry.computeVertexNormals();
   mesh.geometry.computeBoundingBox();
   mesh.geometry.computeBoundingSphere();
  }
 }
 return {applied:true,chestPieces:chest.length,compressed:required,
  originalTopY:highest,correctedTopY:lowest+(highest-lowest)*targetRatio,
  chinY,clearanceMeters:chinY-(lowest+(highest-lowest)*targetRatio),
  compressionRatio:targetRatio,sourceGeometryPreserved:true,
  nonAccumulative:true,onlyStudioPreview:true};
}

export function refineHeroineCostumeSilhouette(wardrobeRoot,{gender='female',job='swordsman'}={}){
 if(!wardrobeRoot?.traverse)throw Error('Outfit root required');
 let taperedLegPieces=0,narrowedCuirass=0,hiddenLooseStuds=0,
   loweredTassets=0,skinnedTrousers=0,collarClearancePieces=0;
 wardrobeRoot.updateWorldMatrix(true,true);
 wardrobeRoot.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(mesh.visible&&mesh.isSkinnedMesh&&/_(?:ranger|peasant)_legs/i.test(mesh.name))
   skinnedTrousers++;
  const slot=mesh.userData?.equipmentSlot||'';
  if(mesh.userData?.equipmentClass==='armor'){
   // Men were left at the uncorrected oversized Quaternius plate fit.
   // Correct the visible *equipment* independently of rigged body shape.
   // Shields/weapons retain their original grip and collision envelope.
   const factor=gender==='female'?
    (slot==='chest'?.93:slot==='shoulder'?.91:
     ['thigh','knee','shin','boot-upper'].includes(slot)?.87:
     slot==='boot-foot'?.95:1):
    (slot==='chest'?.83:slot==='shoulder'?.77:
     ['thigh','knee','shin','boot-upper'].includes(slot)?.88:
     slot==='boot-foot'?.92:1);
   if(factor!==1){
    mesh.scale.x*=factor;
    mesh.scale.z*=factor;
    if(slot==='chest'){
     // Collar must sit below the chin and must not create a giant chest.
     mesh.scale.y*=gender==='male'?.90:.94;
     mesh.position.y-=gender==='male'?.018:.012;
     collarClearancePieces++;
    }
    if(slot==='chest'||slot==='shoulder')narrowedCuirass++;
    else taperedLegPieces++;
   }
  }
  if(/(?:neckguard|neck-plate|standing-collar|cuirass-collar)/i.test(mesh.name)
    &&!mesh.isSkinnedMesh){
   mesh.scale.y*=.81;mesh.position.y-=.014;collarClearancePieces++;
  }
  if(/cuirass-thigh-tasset/i.test(mesh.name)){
   // Half-width leather/steel panels instead of boxy vertical drainpipes.
   mesh.scale.x*=.82;mesh.scale.z*=.87;
   mesh.scale.y*=.86;loweredTassets++;
  }
  const deliberatelyFloating=job==='summoner'&&
   /(?:summon|orbit|floating|hover|magic-circle|halo|aura)/i.test(mesh.name);
  if(deliberatelyFloating)return;
  if(/(?:cuirass-fastener|armor-rivet|harness-pin|hand-sewn-hem-stud|mantle-clasp|cuirass-suspension-bead)/i.test(mesh.name)){
   mesh.visible=false;hiddenLooseStuds++;
   return;
  }
  // Imported plates may have unlabeled, isolated ball-shaped submeshes.
  // Avoid disabling complex plate shells or the sword's guard by checking
  // both near-spherical proportions and their actual armor slot.
  if(!['chest','shoulder'].includes(slot)||!mesh.geometry?.getAttribute('position')||
     /helmet|shield|weapon/i.test(mesh.name))return;
  mesh.geometry.computeBoundingBox();
  const b=mesh.geometry.boundingBox,local=b.getSize(new THREE.Vector3());
  const world=mesh.getWorldScale(new THREE.Vector3());
  const size=new THREE.Vector3(local.x*Math.abs(world.x),
   local.y*Math.abs(world.y),local.z*Math.abs(world.z));
  const min=Math.min(size.x,size.y,size.z),max=Math.max(size.x,size.y,size.z);
  if(min>.0015&&max<.064&&max/min<1.55){
   mesh.visible=false;hiddenLooseStuds++;
  }
 });
 return {gender,job,taperedLegPieces,narrowedCuirass,hiddenLooseStuds,
  loweredTassets,skinnedTrousers,collarClearancePieces,onlyStudioPreview:true,
  sourceGeometryUnmodified:true};
}

import {applyHeroineSkinMaterial} from './heroine-skin-material.js?v=51';
export function enhanceHeroineFaceSurface(face){
 return applyHeroineSkinMaterial(face);
}

export const REAL_BATTLE_WARDROBE=Object.freeze([
 {id:'job01',name:'剣士',label:'剣士・銀鋼鎧',heroJob:'swordsman'},
 {id:'job02',name:'格闘家',label:'格闘家・拳帯と稽古着',heroJob:'fighter'},
 {id:'job03',name:'魔法使い',label:'魔法使い・ローブ',heroJob:'mage'},
 {id:'job04',name:'弓使い',label:'弓使い・革装束と矢筒',heroJob:'archer'},
 {id:'job05',name:'盾戦士',label:'盾騎士・重鎧と盾',heroJob:'shield'},
 {id:'job06',name:'盗賊',label:'シーフ・軽装と短剣',heroJob:'thief'},
 {id:'job07',name:'忍者',label:'忍者・忍装束と二刀',heroJob:'ninja'},
 {id:'job08',name:'農民・職人',label:'農民・職人の作業着',heroJob:'farmer'},
 {id:'job09',name:'僧侶',label:'僧侶・修道服と杖',heroJob:'cleric'},
 {id:'job10',name:'召喚士',label:'召喚士・儀式服と杖',heroJob:'summoner'}
]);
/** Only actual, available job clips generate playable studio buttons. */
export function existingJobActions(jobs,selection='knight'){
 const job=realBattleJob(selection);
 return (jobs?.[job.name]||[]).filter(row=>
  row.available===true&&row.command&&row.asset&&row.clip)
  .map(row=>({id:row.command,label:row.command,clip:row.clip,asset:row.asset}));
}
export function effectCategoryForRegisteredMotion(command){
 if(/(?:魔法|詠唱|祈り|回復|召喚|スキル)/.test(command))return 'cast';
 if(/(?:斬|突き|射撃|正拳|蹴り|攻撃|連撃|二刀|ダイナマイト)/.test(command))return 'attack';
 if(/(?:防御|ガード|盾構え)/.test(command))return 'guard';
 if(/(?:ダッシュ|走行|走る)/.test(command))return 'run';
 if(/(?:歩行|忍び歩き|歩く)/.test(command))return 'walk';
 return 'idle';
}
export function realBattleJob(selection='knight'){
 return REAL_BATTLE_WARDROBE.find(j=>j.heroJob===selection)||
  REAL_BATTLE_WARDROBE.find(j=>j.id===selection)||
  REAL_BATTLE_WARDROBE[0];
}
const findHead=model=>{
 let head=null;model.traverse(node=>{
  if(node.isBone&&node.name.toLowerCase()==='head')head=node;
 });
 if(!head)throw Error('戦闘モデルに Head 関節がありません');
 return head;
};
/**
 * Mask ORIGINAL skinned head triangles, not the body or any armor meshes.
 * Keep the neck, hands, torso, skin indices, morphs and 65-bone animation.
 * Original GLTF geometry is cloned so changes never poison cached sources.
 */
export function hideBattleDonorFace(model){
 if(!model?.traverse)throw Error('Rigged character model required');
 model.updateMatrixWorld(true);
 const head=findHead(model),region=measureHeadLocalBounds(model,head);
 const size=region.bounds.getSize(new THREE.Vector3());
 // Include the chin / under-lip perimeter. The previous +18% cut left
 // a brown jaw and moustache-shaped strip over the new heroine face.
 const trimY=region.bounds.min.y-size.y*.025;
 // The original skinned donor FACE and NECK are one orange-tinted surface.
 // v58 removed the face but deliberately retained a thick naked neck stump,
 // which protruded above the blue uniform. Trimming just head vertices does
 // not remove neck-bone triangles. Remove the cervical region locally, but
 // preserve collarbone / torso bones and never touch hands or legs.
 const neckTrimY=region.bounds.min.y-size.y*.38;
 let removedTriangles=0,removedNeckTriangles=0,retainedTriangles=0,
   hiddenEyeMeshes=0,changedMeshes=0;
 const point=new THREE.Vector3(),sample=new THREE.Vector3();
 const headCenter=region.bounds.getCenter(new THREE.Vector3());
 let spineWeightedNeckVertices=0,removedCervicalBoundaryTriangles=0;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  if(/^(eyes|eyebrows)$/i.test(mesh.name)){
   mesh.visible=false;hiddenEyeMeshes++;return;
  }
  const geometry=mesh.geometry,position=geometry?.getAttribute('position'),
   joints=geometry?.getAttribute('skinIndex'),weights=geometry?.getAttribute('skinWeight');
  const index=mesh.skeleton?.bones.findIndex(b=>b===head);
  if(!position||!joints||!weights||index<0)return;
  const neckJoints=new Set(mesh.skeleton.bones.map((b,j)=>
    /^(?:neck(?:_\\d+)?)$/i.test(b.name)?j:-1).filter(j=>j>=0));
  const raw=geometry.index,triangleCount=(raw?raw.count:position.count)/3;
  if(triangleCount<1)return;
  const retained=[];
  const pointCache=new Map();
  const belongs=i=>{
   if(pointCache.has(i))return pointCache.get(i);
   let headWeight=0,neckWeight=0;
   for(let k=0;k<4;k++){
    const joint=joints.getComponent(i,k),weight=weights.getComponent(i,k);
    if(joint===index)headWeight+=weight;
    if(neckJoints.has(joint))neckWeight+=weight;
   }
   // Do NOT stop here when head/neck bone weights are small: the donor
   // mesh's remaining orange neck wedges are often weighted entirely to
   // Spine/Clavicle. Those vertices must still be tested geometrically.
   mesh.getVertexPosition(i,point);
   sample.copy(point).applyMatrix4(mesh.matrixWorld);
   head.worldToLocal(sample);
   const isHead=headWeight>=.10&&sample.y>trimY;
   // Adjacent donor polygons at the cervical base are weighted to spine /
   // clavicle rather than 'neck', so v58/v59 left orange triangular shards
   // piercing the neck beside the hair. A narrow geometric envelope covers
   // only the neck shaft, never shoulders, fingers or the lower chest.
   const centralCervical=sample.y>neckTrimY&&
     sample.y<trimY+size.y*.08&&
     Math.abs(sample.x-headCenter.x)<size.x*.365&&
     Math.abs(sample.z-headCenter.z)<size.z*.385;
   const isNeck=(headWeight>=.10||neckWeight>=.14||centralCervical)&&
     sample.y>neckTrimY;
   if(centralCervical&&headWeight<.10&&neckWeight<.14)
    spineWeightedNeckVertices++;
   const reason=isHead?1:isNeck?2:0;
   pointCache.set(i,reason);return reason;
  };
  for(let i=0;i<triangleCount;i++){
   const indices=[0,1,2].map(k=>raw?raw.getX(i*3+k):i*3+k);
   // Remove a whole facial triangle when two of its vertices lie on the
   // head bone above the cut. Do not leave original skin in the eye socket.
   const reasons=indices.map(belongs);
   const count=reasons.filter(Boolean).length;
   // Border triangles with one cervical vertex still protrude through the
   // newly unified neck as orange spikes. Mask them only when their other
   // vertices are also inside the tight central neck envelope.
   const cervical=(reasons.filter(r=>r===2).length);
   let maskBoundary=count===1&&cervical===1;
   if(maskBoundary){
    const trianglePos=indices.map(vertex=>{
     mesh.getVertexPosition(vertex,point);
     sample.copy(point).applyMatrix4(mesh.matrixWorld);
     return head.worldToLocal(sample.clone());
    });
    maskBoundary=trianglePos.every(v=>
     v.y>neckTrimY-size.y*.035&&
     v.y<trimY+size.y*.10&&
     Math.abs(v.x-headCenter.x)<size.x*.42&&
     Math.abs(v.z-headCenter.z)<size.z*.43);
   }
   if(count>=2||maskBoundary){
    removedTriangles++;
    if(cervical)removedNeckTriangles++;
    if(maskBoundary)removedCervicalBoundaryTriangles++;
    continue;
   }
   retained.push(...indices);retainedTriangles++;
  }
  if(retained.length!==triangleCount*3){
   const clone=geometry.clone();
   clone.setIndex(retained);
   mesh.geometry=clone;changedMeshes++;
  }
 });
 if(removedTriangles<1)throw Error('Original rigged face could not be isolated');
 // The existing battle facial accessories are not needed when the independent
 // artist face replaces their original eyes and lids.
 return {removedTriangles,removedNeckTriangles,
  removedCervicalBoundaryTriangles,spineWeightedNeckVertices,
  retainedTriangles,hiddenEyeMeshes,changedMeshes,
  preservedRig:true,regionSamples:region.samples,trimY,neckTrimY,
  headBounds:{min:region.bounds.min.toArray(),max:region.bounds.max.toArray()}};
}

export function attachIndependentFaceToBattleHead({faceRoot,faceMesh,characterModel,headBounds=null}){
 if(!faceRoot||!faceMesh?.geometry||!characterModel)
  throw Error('Face root, actual face mesh and rigged character are required');
 const bone=findHead(characterModel);
 const target=headBounds?
  new THREE.Box3(new THREE.Vector3(...headBounds.min),
   new THREE.Vector3(...headBounds.max)):
  measureHeadLocalBounds(characterModel,bone).bounds;
 faceMesh.geometry.computeBoundingBox();
 const source=faceMesh.geometry.boundingBox;
 const a=source.getSize(new THREE.Vector3()),b=target.getSize(new THREE.Vector3());
 const srcCenter=source.getCenter(new THREE.Vector3());
 const dstCenter=target.getCenter(new THREE.Vector3());
 if(Math.min(a.x,a.y,a.z)<.01||Math.min(b.x,b.y,b.z)<.01)
  throw Error('Head fitting bounds invalid');
 // A shallow donor head DEEPTH should not shrink its entire skull and
 // leave a tiny face below the armor collar. Fit by brow/temple width and
 // brow-to-chin height; keep depth as a separate post-fit diagnostic.
 const widthFit=b.x/a.x,heightFit=b.y/a.y,depthFit=b.z/a.z;
 const scale=Math.min(widthFit*1.04,heightFit*1.06);
 faceRoot.removeFromParent();
 bone.add(faceRoot);
 faceRoot.rotation.set(0,0,0);
 faceRoot.scale.setScalar(scale);
 faceRoot.position.copy(dstCenter).sub(srcCenter.clone().multiplyScalar(scale));
 faceRoot.userData.attachedToRealBattleHeadBone=true;
 faceRoot.userData.battleHeadScale=scale;
 return {bone:bone.name,scale,widthFit,heightFit,depthFit,
  sourceCenter:srcCenter.toArray(),targetCenter:dstCenter.toArray(),
  sourceSize:a.toArray(),targetSize:b.toArray(),
  attachedToRealHeadBone:true};
}

const motionByAction=Object.freeze({
 idle:'idle',walk:'walk',run:'run',attack:'attack',
 guard:'guard',cast:'skill',victory:'idle'
});

export async function createRealBattleOutfitStudio({scene,faceModel,getFaceModel=null,onStatus=()=>{},
 jobId='knight',outfitId='job',actionId='idle',gender='female'}={}){
 if(!['female','male'].includes(gender))throw Error('Unknown studio gender');
 if(!scene?.add||!faceModel?.root||!faceModel.face)
  throw Error('Real scene and independent face are required');
 const jobs=await loadJobMotionMap();
 let actor=null,outfit=null,vfx=null,headRoot=faceModel.root,face=faceModel.face;
 let currentJob=jobId,currentOutfit=outfitId,currentAction=actionId;
 let nativeCommand=null,nativeClip=null,bodyShapeId='average',ageBandId='twenties',bodyTypeId='normal';
 let hiddenBody=false,outfitShown=true,disposed=false,request=0,headReport=null,headFit=null,proportions=null,finishReport=null;
 let collarFitDirty=false;
 const chosenOutfit=()=>currentOutfit==='job'?
  realBattleJob(currentJob):realBattleJob(currentOutfit);
 async function install(){
  const serial=++request,job=realBattleJob(currentJob);
  const chosen=chosenOutfit();
  onStatus('戦闘用の実衣装を接続中：'+chosen.label);
  const fresh=await createCharacter({job:job.name,sex:gender,height:gender==='male'?1.77:1.66,
   jobs,faceQuality:'hero',faceId:gender==='male'?'hero-boy-01':'hero-girl-01'});
  let clothing;
  try{
   // Remove old face before the clothing library caches body geometry.
   const cut=hideBattleDonorFace(fresh.model);
   const skinSurface=enhanceStudioBodyMaterials(fresh.model);
   clothing=await buildRiggedJobOutfit({characterModel:fresh.model,
    parent:fresh.object3D,job:chosen.name,sex:gender,quality:'preview',
    preserveBody:false,rarity:'N',studioPreferSkinnedLegs:true,
    studioPreserveLegAnatomy:true});
   if(serial!==request||disposed){
    clothing.dispose();fresh.dispose();return;
   }
   clothing.setHairVisible(false);clothing.setHelmetVisible(false);
   finishReport=enhanceStudioCombatMaterials(clothing.root);
   const silhouetteReport=refineHeroineCostumeSilhouette(clothing.root,{gender,job:chosen.heroJob});
   finishReport={...finishReport,...silhouetteReport,skinSurface};
   // Only the independent artist face owns eye and lid rendering.
   fresh.face?.setAutoBlink?.(false);
   fresh.face?.holdBlink?.(0);
   for(const lid of fresh.face?.lids||[])lid.visible=false;
   if(actor){
    vfx?.dispose();vfx=null;
    headRoot.removeFromParent();
    outfit?.dispose();actor.dispose();actor.object3D.removeFromParent();
   }
   actor=fresh;outfit=clothing;headReport=cut;
   // The operator may have changed nose/eye/hair during garment loading.
   // Always graft the newest live face, never an already-disposed preview.
   const latestFace=getFaceModel?.()||faceModel;
   headRoot=latestFace.root;face=latestFace.face;
   enhanceHeroineFaceSurface(face);
   scene.add(actor.object3D);
   headFit=attachIndependentFaceToBattleHead({faceRoot:headRoot,
    faceMesh:face,characterModel:actor.model,
    headBounds:headReport.headBounds});
   proportions=fitStudioFaceAboveArmor({actorRoot:actor.object3D,
    faceRoot:headRoot,faceFit:headFit,
    bodyScale:gender==='male'?HERO_STUDIO_MALE_BODY_SCALE:HEROINE_STUDIO_BODY_SCALE});
   applyBodyShape();
   setBodyVisible(!hiddenBody);
   vfx=createHeroineBattleActionVfx({THREE,actorRoot:actor.object3D,
    camera:scene.userData.studioPreviewCamera});
   nativeCommand=null;nativeClip=null;
   await playAction(currentAction);
   collarFitDirty=true;
   onStatus('戦闘の既存衣装を反映：'+chosen.label+'。顔と髪は独立メッシュです。');
  }catch(error){
   clothing?.dispose();fresh.dispose();
   throw error;
  }
 }
 function availableActions(){return existingJobActions(jobs,currentJob)}
 async function playRegisteredCommand(command){
  const candidate=availableActions().find(row=>row.id===command);
  if(!actor||!candidate){
   onStatus('この職業には登録済みモーションがありません：'+command);
   return false;
  }
  try{
   const played=await actor.playCommand(candidate.id);
   if(!played)return false;
   nativeCommand=candidate.id;nativeClip=actor.diagnostics()?.clip||candidate.clip;
   currentAction=effectCategoryForRegisteredMotion(candidate.id);
   vfx?.trigger(currentAction,realBattleJob(currentJob).heroJob);
   onStatus('実モーション '+candidate.id+'（'+nativeClip+'）を再生しました');
   return true;
  }catch(error){
   onStatus('登録済みアクション再生エラー：'+String(error));
   return false;
  }
 }
 async function playAction(id){
  currentAction=motionByAction[id]?id:'idle';
  if(!actor)return false;
  try{
   const state=motionByAction[currentAction];
   const played=await actor.play(state);
   if(played){
    nativeCommand=null;nativeClip=actor.diagnostics()?.clip||null;
    vfx?.trigger(currentAction,realBattleJob(currentJob).heroJob);
   }
   if(!played&&state!=='idle')return actor.play('idle');
   return played;
  }catch(error){
   onStatus('モーション適用エラー：'+String(error));return false;
  }
 }
 function setBodyVisible(show){
  hiddenBody=!show;
  if(actor)syncStudioBodyOutfitVisibility(actor.model,outfit,
   {showBody:!hiddenBody,showOutfit:outfitShown});
 }
 function setOutfitVisible(show){
  outfitShown=!!show;
  if(actor)syncStudioBodyOutfitVisibility(actor.model,outfit,
   {showBody:!hiddenBody,showOutfit:outfitShown});
 }
 function applyBodyShape(){
  if(!actor?.object3D||!headFit)return;
  const demographic=resolveDemographicProfile(ageBandId,bodyTypeId);
  const age=demographic.age,body=demographic.body;
  const scale=gender==='male'?HERO_STUDIO_MALE_BODY_SCALE:HEROINE_STUDIO_BODY_SCALE;
  const original=actor.object3D.userData.originalStudioActorScale;
  if(!original)return;
  // Scale the actual skinned body, rigged clothing, and equipment together.
  // Age affects human height; build affects body width/depth only.
  // The head compensates for body scaling, while a child's head remains
  // slightly larger relative to its shorter body.
  const sx=scale*body.width,sy=scale*age.heightScale,sz=scale*body.depth;
  actor.object3D.scale.set(original[0]*sx,original[1]*sy,original[2]*sz);
  const buildMorph=applySkinnedBuildMorph(actor.object3D,bodyTypeId);
  const faceGain=age.headScale;
  headRoot.scale.set(headFit.scale/sx*faceGain,
   headFit.scale/sy*faceGain,headFit.scale/sz*faceGain);
  const headHeight=headFit.targetSize[1],headDepth=headFit.targetSize[2];
  headRoot.position.set(
   headFit.targetCenter[0]-headFit.sourceCenter[0]*headRoot.scale.x,
   headFit.targetCenter[1]-headFit.sourceCenter[1]*headRoot.scale.y+
    headHeight*HEROINE_STUDIO_HEAD_LIFT/sy,
   headFit.targetCenter[2]-headFit.sourceCenter[2]*headRoot.scale.z+
    headDepth*HEROINE_STUDIO_HEAD_FORWARD/sz
  );
  // Bare torso dictates both anatomical cuts. Clothes are fitted last.
  const headAlignment=alignStudioHeadToSkinnedTorso({
   faceRoot:headRoot,faceMesh:face,wardrobeRoot:actor.model});
  const neckContinuity=fitStudioNeckContinuity({
   faceRoot:headRoot,faceMesh:face,wardrobeRoot:actor.model,
   garmentRoot:outfit?.root});
  const neckClearance=fitStudioCuirassBelowChin({faceMesh:face,wardrobeRoot:outfit?.root});
  collarFitDirty=true;
  proportions={...proportions,headAlignment,neckContinuity,neckClearance,bodyShape:bodyShapeId,
   ageBand:ageBandId,bodyType:bodyTypeId,
   bodyWidth:body.width,bodyDepth:body.depth,bodyHeight:age.heightScale,
   headScale:age.headScale,buildMorph,skinnedBody:true,previewOnly:true};
 }
 function setDemographics(ageBand='twenties',bodyType='normal'){
  ageBandId=resolveAgeBand(ageBand).id;
  bodyTypeId=resolveBodyType(bodyType).id;
  bodyShapeId=['thin','ultraThin'].includes(bodyTypeId)?'slim':bodyTypeId==='fat'?'full':'average';
  applyBodyShape();
  return {ageBand:ageBandId,bodyType:bodyTypeId};
 }
 // Compatibility with the v46 cast menu.
 function setBodyShape(id='average'){
  resolveBodyShape(id);bodyShapeId=id;
  bodyTypeId=resolveBodyType(id).id;applyBodyShape();return bodyShapeId;
 }
 function attachFace(next){
  if(!next?.root||!next.face)throw Error('Updated face required');
  headRoot=next.root;face=next.face;
  enhanceHeroineFaceSurface(face);
  if(actor){
   headFit=attachIndependentFaceToBattleHead({
    faceRoot:headRoot,faceMesh:face,characterModel:actor.model,
    headBounds:headReport.headBounds});
   proportions=fitStudioFaceAboveArmor({actorRoot:actor.object3D,
    faceRoot:headRoot,faceFit:headFit,
    bodyScale:gender==='male'?HERO_STUDIO_MALE_BODY_SCALE:HEROINE_STUDIO_BODY_SCALE});
   applyBodyShape();
  }
  return headFit;
 }
 async function setSelection({jobId:nextJob,outfitId:nextOutfit}={}){
  if(nextJob){
   if(currentJob!==nextJob){currentAction='idle';nativeCommand=null;nativeClip=null;}
   currentJob=nextJob;
  }
  if(nextOutfit)currentOutfit=nextOutfit;
  await install();
 }
 function update(dt){
  if(disposed||!actor)return;
  actor.update(dt);outfit?.sync();
  if(collarFitDirty&&outfit){
   // First animation frame can move the spine from its bind pose.
   // Refit once after skeletal matrices settle, never on every render frame.
   const headAlignment=alignStudioHeadToSkinnedTorso({
    faceRoot:headRoot,faceMesh:face,wardrobeRoot:actor.model});
   const neckContinuity=fitStudioNeckContinuity({
    faceRoot:headRoot,faceMesh:face,wardrobeRoot:actor.model,
    garmentRoot:outfit.root});
   proportions={...proportions,headAlignment,neckContinuity,
    neckClearance:fitStudioCuirassBelowChin({
     faceMesh:face,wardrobeRoot:outfit.root})};
   collarFitDirty=false;
  }
  vfx?.update(dt);
 }
 function getState(){return {
  active:!!actor,gender,rigSource:'battle-character-and-real-65-bone-job-outfit',
  jobId:currentJob,outfitId:currentOutfit,actionId:currentAction,
  nativeCommand,nativeClip,availableActionCount:availableActions().length,
  garment:chosenOutfit().label,bodyShapeId,ageBand:ageBandId,bodyType:bodyTypeId,
  headReport,headFit,proportions,finishReport,
  sourceTrousers:outfit?.presentation?.().useSourceSkinnedLegs||false,
  retainedLegAnatomy:outfit?.diagnostics?.studioPreserveLegAnatomy||false,
  v63CoveredSkinMasked:outfit?.diagnostics?.v63CoveredSkinMasked||false,
  v63BareAnatomyRestorable:outfit?.diagnostics?.v63BareAnatomyRestorable||false,
  preservedLegRegions:outfit?.diagnostics?.preservedUnderGarmentLegRegions||[],
  vfx:vfx?.getState()||null,
  realOutfit:!!outfit,hasMotion:!!actor?.diagnostics()?.playing
 };}
 function dispose(){
  disposed=true;++request;
  headRoot.removeFromParent();
  vfx?.dispose();outfit?.dispose();actor?.dispose();actor?.object3D?.removeFromParent();
 }
 await install();
 return {getState,getActor:()=>actor?.object3D||null,
  getOutfit:()=>outfit?.root||null,update,attachFace,setBodyVisible,
  setOutfitVisible,playAction,playRegisteredCommand,getAvailableActions:availableActions,
  setSelection,setBodyShape,setDemographics,dispose};
}
