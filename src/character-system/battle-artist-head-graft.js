/**
 * LIVE high-resolution head replacement for the real 65-bone combat rig.
 *
 * Not a metadata-only variant: the sculpted 785 KB realistic-head-animation
 * Blender GLB from the SAME heroine studio is actually loaded, sculpted,
 * and attached to each actor's animated Head bone. Its source GLB is shared.
 * The Quaternius donor FACE/NECK triangles are removed before wardrobe
 * occlusion and the rest of the donor skeleton, body, feet and grip survive.
 *
 * Loading failures are fatal to actor installation, never an invisible
 * success with the same old head. The battle screen exposes the exact count.
 */
import * as THREE from 'three';
import {fitBattleArtistFaceToHead,BATTLE_FACE_PROPORTION_VERSION}
 from './battle-head-proportion-fit.js?v=20261116-real-cranium-v2';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeIndependentFaceMaster} from '../independent-face-masters.js?v=68';
import {applyFaceColorMode} from '../face-feature-meshes.js?v=68';
import {FEMALE_V7_DEFAULTS,MALE_REFERENCE_DEFAULT} from '../face-v7-controls.js';
import {hideBattleDonorFace,attachIndependentFaceToBattleHead,enhanceHeroineFaceSurface}
 from '../heroine-battle-costume-bridge.js?v=70';
import {createFaceExpressionAnimator} from '../face-expression-animation-v48.js?v=68';
import {createScalpAnchoredWig} from '../face-scalp-wig.js?v=20261116-scalpfill1';

export const BATTLE_HEAD_MASTER_VERSION='real-sculpt-head-graft-v1';
export const BATTLE_HEAD_MASTER_ASSET='assets/master-sources/blender/realistic-head-animation.glb';
const masterLoader=new GLTFLoader();
const facePrototypes=new Map();
let headSourcePromise=null;
export function masterHeadSourceUrl(hostname=typeof location==='undefined'?'':location.hostname){
 const relative='./'+BATTLE_HEAD_MASTER_ASSET;
 // The Pages slim artifact intentionally excludes uncompressed authoring
 // source archives. Use the exact original Blender master from the repo,
 // as the already-working hero studio does.
 return String(hostname).endsWith('.github.io')?
  'https://raw.githubusercontent.com/yamadayoshitaka/hai-gin-rpg/main/'+BATTLE_HEAD_MASTER_ASSET:
  relative;
}
export function loadBattleHeadMaster(){
 if(!headSourcePromise){
  headSourcePromise=masterLoader.loadAsync(masterHeadSourceUrl())
   .then(gltf=>{if(!gltf?.scene)throw Error('3D master head GLB has no scene');return gltf.scene})
   .catch(e=>{headSourcePromise=null;throw Error('主人公の高精細頭部GLBを取得できません: '+e.message)});
 }
 return headSourcePromise;
}
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));

/**
 * The generic face catalogue's pale #ebc5b7 skin becomes nearly white under
 * the battlefield's intense hemisphere + sun lights (2.5 + 2.2).
 * This battle-only PBR finish matches the warmer exposed hands. The saved
 * creator face geometry, eye pigments, make-up, textures and hair are untouched.
 * Keep this independent of camera distance and rarity so LOD cannot bleach it.
 */
export const BATTLE_FACE_SKIN_TONE_VERSION='battle-skin-photometric-v3';
export const BATTLE_FACE_LIGHT_RESPONSE_VERSION='battle-face-light-response-v3';
let battleSkinAlbedoTexture=null;
/** The real realistic-head-animation.glb has UVs but an UNTEXTURED skin
 * preview material (baseColor 0.65/0.44/0.34). The old studio converter
 * discarded even that warm source pigment and substituted gray clay.
 * One shared sRGB albedo adds subdued multi-scale skin variation without
 * a second mesh, paid texture or per-soldier allocations.
 */
export function getBattleSkinAlbedoTexture(){
 if(battleSkinAlbedoTexture)return battleSkinAlbedoTexture;
 const size=256,data=new Uint8Array(size*size*4);
 const hash=(x,y)=>{
  let a=Math.imul(x+1327,374761393)^Math.imul(y+97,668265263);
  a=Math.imul(a^(a>>>13),1274126177);
  return ((a^(a>>>16))>>>0)/4294967296;
 };
 const noise=(x,y,step)=>{
  const ix=Math.floor(x/step),iy=Math.floor(y/step);
  const fx=x/step-ix,fy=y/step-iy;
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);
  return (a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v-.5;
 };
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const broad=noise(x,y,48),fine=noise(x,y,8),pores=hash(x,y)-.5;
  const tint=broad*17+fine*8+pores*2.4;
  const i=(y*size+x)*4;
  data[i]=Math.max(0,Math.min(255,Math.round(248+tint)));
  data[i+1]=Math.max(0,Math.min(255,Math.round(240+tint*.87)));
  data[i+2]=Math.max(0,Math.min(255,Math.round(231+tint*.92)));
  data[i+3]=255;
 }
 const tex=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.magFilter=THREE.LinearFilter;
 tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;
 tex.needsUpdate=true;
 tex.name='battle-original-uv-warm-skin-albedo-v1';
 battleSkinAlbedoTexture=tex;
 return tex;
}

/** Soft-shoulder the overbright PBR highlights under the battlefield sun.
 * Keep 86% of the original diffuse light: the previous 58% shader combined
 * with dark copper albedo made ordinary humans look black. This affects only
 * the real face skin mesh, not lashes, iris, makeup, or armor.
 * Shared across instances, zero per-frame work.
 */
export function installBattleFaceLightResponse(material){
 if(!material?.isMeshStandardMaterial)return {applied:false,reason:'not-standard-pbr'};
 if(material.userData?.battleFaceLightResponseVersion===BATTLE_FACE_LIGHT_RESPONSE_VERSION)
  return {applied:true,reused:true};
 const beforeCompile=material.onBeforeCompile.bind(material);
 const previousProgramKey=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=function(shader,renderer){
  beforeCompile(shader,renderer);
  const marker='#include <opaque_fragment>';
  if(!shader.fragmentShader?.includes(marker))
   throw Error('Battle face PBR light gate: expected opaque_fragment not found');
  shader.fragmentShader=shader.fragmentShader.replace(marker,
   'outgoingLight = (outgoingLight * 0.86) / (vec3(1.0) + 0.40 * max(outgoingLight - vec3(0.68), vec3(0.0)));\n'+marker);
 };
 material.customProgramCacheKey=()=>previousProgramKey()+'|'+BATTLE_FACE_LIGHT_RESPONSE_VERSION;
 material.userData.battleFaceLightResponseVersion=BATTLE_FACE_LIGHT_RESPONSE_VERSION;
 material.userData.battleFaceLightResponseScale=.86;
 material.needsUpdate=true;
 return {applied:true,version:BATTLE_FACE_LIGHT_RESPONSE_VERSION,scale:.86};
}
export function correctBattleFaceSkinTone(face,{sex='male'}={}){
 if(!face?.isMesh||!face.material||face.userData?.faceColorMode!=='color')
  throw Error('A colorized, real battle face mesh is required');
 const material=Array.isArray(face.material)?face.material[0]:face.material;
 if(!material?.color||!material.isMeshStandardMaterial)
  throw Error('Battle face must retain its actual PBR skin material');
 // Repeated QA/reconfigure calls must retain the first shared albedo.
 if(material.userData?.battleSkinToneVersion===BATTLE_FACE_SKIN_TONE_VERSION)
  return {corrected:true,reused:true,skinHex:face.userData?.battleSkinToneHex};
 // Never replace imported photo/painted material maps. The actual battle
 // sculpt is untextured but has original UVs, so it receives a tiny shared map.
 if(material.map)return {corrected:false,reason:'textured-skin-preserved'};
 // Older battle-only overrides hard-coded dark copper skin for *everyone*,
 // then dimmed it to 58% in the fragment shader. With a camera closeup,
 // even fair-skinned creator presets appeared almost black. Restore the
 // original warm studio palette and compress only pathological highlights.
 const skinHex=sex==='female'?0xeac9b8:0xe2bda9;
 material.color.setHex(skinHex);
 if(face.geometry?.getAttribute('uv'))material.map=getBattleSkinAlbedoTexture();
 material.metalness=0;
 material.roughness=.86;
 if('clearcoat' in material)material.clearcoat=.012;
 if('sheen' in material)material.sheen=.025;
 if('specularIntensity' in material)material.specularIntensity=.48;
 material.toneMapped=true;
 installBattleFaceLightResponse(material);
 material.needsUpdate=true;
 // Keep eyelids contiguous with the new cheek/forehead tone. Do NOT recolour
 // eyelashes, iris, sclera, lips, blusher or other cosmetic colour roles.
 face.traverse(node=>{
  if(node===face||!node.isMesh||node.userData?.colorRole!=='eyelid')return;
  const mats=Array.isArray(node.material)?node.material:[node.material];
  for(const m of mats)if(m?.color&&!m.map){
   m.color.setHex(skinHex);
   m.metalness=0;
   m.roughness=.86;
   installBattleFaceLightResponse(m);
   m.needsUpdate=true;
  }
 });
 // Combat's bright hemisphere/sun stack overexposed sclera relative to
 // the newly corrected skin. Tone the EXISTING orbital patch as well, with
 // the same shader key, no extra geometry/texture/draw or per-frame CPU.
 const scleraMaterials=new Set();
 face.traverse(node=>{
  if(!node.isMesh||!/(?:SCLERA|ORBITAL_EYEBALL)/i.test(node.name))return;
  for(const eyeMaterial of Array.isArray(node.material)?node.material:[node.material]){
   if(!eyeMaterial?.isMeshStandardMaterial||scleraMaterials.has(eyeMaterial))continue;
   scleraMaterials.add(eyeMaterial);
   eyeMaterial.roughness=Math.max(.42,eyeMaterial.roughness);
   if('clearcoat' in eyeMaterial)eyeMaterial.clearcoat=Math.min(.16,eyeMaterial.clearcoat);
   installBattleFaceLightResponse(eyeMaterial);
   eyeMaterial.needsUpdate=true;
  }
 });
 face.userData.battleScleraPhotometricMaterials=scleraMaterials.size;
 material.userData.battleSkinToneVersion=BATTLE_FACE_SKIN_TONE_VERSION;
 face.userData.battleSkinToneHex='#'+skinHex.toString(16).padStart(6,'0');
 face.userData.battleSkinToneVersion=BATTLE_FACE_SKIN_TONE_VERSION;
 face.userData.battleAlbedoMap=material.map?.name||'source-map-preserved';
 return {corrected:true,skinHex:face.userData.battleSkinToneHex,
  skinMaterial:material.name,materialMapPreserved:true};
}
function artistControls(recipe){
 const fp=recipe.faceProfile||{},f=recipe.faceIndex||0;
 const base=recipe.sex==='female'?FEMALE_V7_DEFAULTS:MALE_REFERENCE_DEFAULT;
 return {
  ...base,ageBand:recipe.ageBand,bodyType:recipe.bodyType,
  eyeWidth:clamp(Number(fp.eyeSize)||1,.70,1.45),
  eyeHeight:clamp((Number(fp.eyeSize)||1)*(.95+f%4*.028),.65,1.45),
  eyeSpacing:clamp(Number(fp.eyeSpacing)||1.10,.65,1.35),
  jawSharpness:clamp(recipe.sex==='female'?4.3+f*.10:3.3+f*.13,0,10),
  noseBridgeSharpness:clamp(2.2+(f%4)*.28,0,5),
  noseTipLift:clamp((f%5-2)*.12,-2,2),
  faceMorph:clamp((f%5-2)*.065,-.6,.6),
  lashLength:recipe.sex==='female'?1.4:1,
  beardDensity:recipe.sex==='male'&&['sixties','seventies','eightyPlus'].includes(recipe.ageBand)?0.20:0
 };
}
function buildArtistMaster(source,recipe,pattern=null){
 // The saved artist/heroine generator owns the SAME controls and v32
 // geometry parts for both views. A generic soldier uses the catalog's
 // deterministic job/age/gender pattern, never a random donor face.
 const controls=pattern?.faceControls||artistControls(recipe);
 const args=recipe.sex==='female'?
  {femaleControls:controls,partSelection:pattern?.partIds||null}:
  {maleControls:controls,partSelection:pattern?.partIds||null};
 const result=makeIndependentFaceMaster(source,recipe.sex,args);
 applyFaceColorMode(result.face,'color',{
  contactColor:pattern?.contactColor||
   (recipe.sex==='male'?'#514139':
    ['#514139','#467fa7','#5c886b','#927953','#7e858d'][recipe.faceIndex%5]),
  makeupType:pattern?.makeupType??(recipe.sex==='female'?(recipe.faceIndex%3):0)
 });
 // This is the same PBR skin finish used by the artist's actual hero preview,
 // not the flat clay material of the source-head geometry.
 enhanceHeroineFaceSurface(result.face);
 // The face editor is allowed to be bright; combat light cannot bleach skin.
 correctBattleFaceSkinTone(result.face,{sex:recipe.sex});
 return result;
}
function findSculptFace(root,sex){
 const name=sex.toUpperCase()+'_INDEPENDENT_CLAY_FACE';
 let found=null;
 root.traverse(o=>{if(o.isMesh&&o.name===name)found=o;});
 if(!found)throw Error('Real sculpt head missing from cloned master '+name);
 return found;
}
/** The atlas is shared for ordinary troops (no hundreds of duplicate meshes);
 * player/strategist faces own independent geometry for blink/lip expression.
 */
export function attachBattleArtistHead({character,recipe,source,pattern=null,animatedFace=false}={}){
 if(!character?.model?.traverse||!recipe||!source?.traverse)
  throw Error('Live rigged actor, hero recipe and actual head GLB required');
 const special=!!animatedFace;
 const key=[recipe.sex,recipe.ageBand,recipe.bodyType,recipe.faceIndex,
  pattern?.source||'legacy',JSON.stringify(pattern?.partIds||{}),
  JSON.stringify(pattern?.faceControls||{})].join('|');
 let master,prototypeReused=false;
 if(special){
  master=buildArtistMaster(source,recipe,pattern);
 }else{
  let prototype=facePrototypes.get(key);
  if(!prototype){
   prototype=buildArtistMaster(source,recipe,pattern);
   facePrototypes.set(key,prototype);
  }else prototypeReused=true;
  const root=prototype.root.clone(true);
  master={root,face:findSculptFace(root,recipe.sex),
   parts:root.getObjectByName(prototype.parts.name)};
 }
 const cut=hideBattleDonorFace(character.model);
 // The old Quaternius controller created detachable eyelids on the SAME
 // Head bone. They can appear in front of a real new eye even after the
 // old skinned face triangle is deleted. Use only studio eyelids/blinks.
 character.face?.setAutoBlink?.(false);
 character.face?.holdBlink?.(0);
 for(const donorLid of character.face?.lids||[])donorLid.visible=false;
 const donorFit=attachIndependentFaceToBattleHead({
  faceRoot:master.root,faceMesh:master.face,
  characterModel:character.model,headBounds:cut.headBounds
 });
 if(!donorFit.attachedToRealHeadBone||cut.removedTriangles<=0)
  throw Error('Head-bone skin swap could not be validated');
 // Mandatory second stage: the donor fitter ignored the GLB mesh node's
 // 0.9 scale/-0.207m translation and mistook its neck skirt for the skull.
 // Use true transformed cranial bounds instead of artificially shrinking it.
 const proportionFit=fitBattleArtistFaceToHead({
  faceRoot:master.root,faceMesh:master.face,headBounds:cut.headBounds
 });
 const fit={...donorFit,...proportionFit};
 if(!proportionFit.sourceMeshTransformApplied||
    !proportionFit.shoulderWidthExcludedFromFit||
    !proportionFit.cervicalSkirtExcludedFromHeightFit||
    proportionFit.widthRatio<.88||
    proportionFit.cranialHeightRatio<.88)
  throw Error('3D顔と骨格の大きさが適合していません');
 // Cosmetic meshes are near-only; the actual adult sculpt, eye volumes and
 // irises remain at every distance. Far variants are still real new heads,
 // never the previous character GLTF face.
 const cosmetic=[];
 master.root.traverse(o=>{
  if(!o.isMesh)return;
  if(/(?:LASH|EYESHADOW|EYELINER|BLUSH|FRECKLE|WRINKLE|AGE_)/i.test(o.name))
   cosmetic.push({node:o,initialVisible:o.visible});
 });
 let near=true,expression=null;
 if(special){
  expression=createFaceExpressionAnimator(master,{autoBlink:true,speaking:false});
 }
 function setNearDetail(value){
  const desired=!!value;
  if(desired===near)return;
  near=desired;
  // Eyeliner outlines must remain at middle/far distances; removing them
  // made the skin look like a blank white clay mask even with correct tint.
  // Keep only tiny lashes/wrinkles/freckles range-gated for GPU efficiency.
  for(const part of cosmetic)
   part.node.visible=part.initialVisible&&(desired||/EYELINER/i.test(part.node.name));
 }
 const result={
  version:BATTLE_HEAD_MASTER_VERSION,attached:true,
  realGeometry:master.face.geometry,
  headRoot:master.root,face:master.face,
  sourceAsset:BATTLE_HEAD_MASTER_ASSET,
  generatorPattern:pattern?.version||'none',
  patternSource:pattern?.source||'legacy',
  skinTone:master.face.userData.battleSkinToneHex||null,
  skinToneVersion:master.face.userData.battleSkinToneVersion||null,
  skinLightResponseVersion:master.face.material?.userData?.battleFaceLightResponseVersion||null,
  hairPatternId:pattern?.hairStyleId||null,
  removedDonorTriangles:cut.removedTriangles,
  headFit:fit,cranialFit:proportionFit,nearDetail:true,cosmeticMeshes:cosmetic.length,
  reusedSculptGeometry:prototypeReused,
  expressions:!!expression,
  setNearDetail(value){setNearDetail(value);result.nearDetail=near;},
  update(dt){if(result.nearDetail)expression?.update(dt);},
  dispose(){expression?.dispose();master.root.removeFromParent();}
 };
 character.object3D.userData.battleHeadMaster={
  version:result.version,source:result.sourceAsset,
  skinTone:result.skinTone,skinToneVersion:result.skinToneVersion,
  skinLightResponseVersion:result.skinLightResponseVersion,
  cranialFitVersion:result.cranialFit.version,
  cranialHeadWidthRatio:result.cranialFit.widthRatio,
  cranialHeadHeightRatio:result.cranialFit.cranialHeightRatio,
  originalHeadRemoved:cut.removedTriangles,
  artistHeadAttached:true,
  headBone:fit.bone,
  faceTriangles:master.face.geometry.index?
   master.face.geometry.index.count/3:master.face.geometry.getAttribute('position').count/3
 };
 return result;
}

/**
 * Head-only studio hair at CLOSE camera distances. Constructed only for the
 * nearest N screen-space characters; far and intermediate units retain the
 * existing optimized fitted GLB hair with exactly the same gender/age
 * identity. Studio groom is a ONE-TIME static construction, not a CPU
 * hair-physics simulation on all 100 actors.
 */
/**
 * The Blender head mesh includes a broad neck/shoulder skirt below the
 * cranium. A scalp groom computed from the ENTIRE bounds produces a huge
 * synthetic wig cap that floats beside or above the actual skull.
 * Hair positions stay in the original head mesh's LOCAL coordinates,
 * but scalp candidates are derived only from the upper true cranial
 * triangles, so the wig is fitted against the same head as the studio.
 */
export function cranialScalpSurface(face,{cranialFraction=.65}={}){
 if(!face?.isMesh||!face.geometry?.getAttribute('position'))
  throw Error('Real sculpted face required for cranial wig fitting');
 if(cranialFraction<.58||cranialFraction>.78)throw Error('Invalid cranial fraction');
 const geometry=face.geometry;
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,vertices=geometry.getAttribute('position');
 // Size the scalp from the real upper skull but retain its rear hairline.
 // The old double cutoff removed all roots below ~84% of the full head.
 const height=box.max.y-box.min.y;
 const upperCutoff=box.min.y+height*(1-cranialFraction);
 const lowerCutoff=box.min.y+height*.18;
 const skull=new THREE.Box3().makeEmpty();
 const point=new THREE.Vector3();
 for(let i=0;i<vertices.count;i++){
  point.fromBufferAttribute(vertices,i);
  if(point.y>=upperCutoff)skull.expandByPoint(point);
 }
 if(skull.isEmpty())throw Error('Real upper skull bounds not found');
 const xPadding=(skull.max.x-skull.min.x)*.045;
 const zPadding=(skull.max.z-skull.min.z)*.08;
 const usable=i=>vertices.getY(i)>=lowerCutoff&&
  vertices.getX(i)>=skull.min.x-xPadding&&
  vertices.getX(i)<=skull.max.x+xPadding&&
  vertices.getZ(i)>=skull.min.z-zPadding&&
  vertices.getZ(i)<=skull.max.z+zPadding;
 const sourceIndex=geometry.getIndex(),triangles=sourceIndex?
  sourceIndex.count/3:vertices.count/3;
 const positions=[];
 for(let triangle=0;triangle<triangles;triangle++){
  const ids=[0,1,2].map(i=>sourceIndex?
   sourceIndex.getX(triangle*3+i):triangle*3+i);
  // Reject shoulder/bust triangles without discarding legitimate nape roots.
  if(ids.some(i=>!usable(i)))continue;
  for(const id of ids)positions.push(vertices.getX(id),vertices.getY(id),vertices.getZ(id));
 }
 if(positions.length<900)throw Error('No usable real scalp triangle surface');
 const cropped=new THREE.BufferGeometry();
 cropped.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 cropped.computeVertexNormals();
 cropped.computeBoundingBox();
 const proxy=new THREE.Mesh(cropped,face.material);
 proxy.name='CRANIAL_SCALP_HAIR_SAMPLING_PROXY';
 return {
  proxy,geometry:cropped,
  triangles:positions.length/9,
  cutoffY:lowerCutoff,upperCutoffY:upperCutoff,
  originalHeadHeight:box.max.y-box.min.y,
  croppedHeadHeight:cropped.boundingBox.max.y-cropped.boundingBox.min.y
 };
}
export function equipBattleStudioHair(artistHead,pattern,{hero=false,quality='near'}={}){
 if(!artistHead?.attached||!artistHead.face?.geometry||!pattern?.hairStyleId)
  throw Error('Physical artist head and compatible v43 hair pattern required');
 if(!['near','middle'].includes(quality))throw Error('Invalid battle hair LOD');
 if(artistHead.studioWig&&artistHead.studioWigQuality===quality&&
  artistHead.studioWigStyleId===pattern.hairStyleId)return artistHead.studioWig;
 // Keep the old visible hair until a complete replacement has baked.
 const previousWig=artistHead.studioWig||null;
 const count=quality==='middle'?112:hero?360:168;
 const scalp=cranialScalpSurface(artistHead.face,{
  cranialFraction:artistHead.cranialFit?.cranialFraction??.65
 });
 let wig;
 try{
  wig=createScalpAnchoredWig(scalp.proxy,{
   count,styleId:pattern.hairStyleId,color:pattern.hairColor,
   gender:pattern.sex,lengthScale:pattern.hairLengthScale,
   volumeProfile:pattern.hairVolume||'natural',
   fineFringeMultiplier:quality==='middle'?1.25:hero?2:1.25,
   visualFiberMultiplier:1,normalLayerCount:quality==='middle'?1:2,
   staticGroom:true,normalLayeredSingleMesh:true,
   battleStableCoverage:true
  });
 }finally{
  // Hair is static; all cap and strand triangles have been baked into
  // independent geometry. Never keep another copy of the head on the GPU.
  scalp.geometry.dispose();
 }
 artistHead.studioWigCranialScalpTriangles=scalp.triangles;
 artistHead.studioWigCranialHeightRatio=
  +(scalp.croppedHeadHeight/scalp.originalHeadHeight).toFixed(3);
 // Atomic swap: a failed near/middle bake never leaves a bald character.
 artistHead.face.add(wig.root);
 if(previousWig){
  previousWig.root.removeFromParent();
  previousWig.dispose();
 }
 artistHead.studioWig=wig;
 artistHead.studioWigStyleId=pattern.hairStyleId;
 artistHead.studioWigQuality=quality;
 artistHead.studioWigCount=count;
 artistHead.studioHairSource='heroine-real-scalp-generator';
 return wig;
}
export function releaseBattleStudioHair(artistHead){
 if(!artistHead?.studioWig)return false;
 artistHead.studioWig.root.removeFromParent();
 artistHead.studioWig.dispose();
 artistHead.studioWig=null;artistHead.studioHairSource=null;
 artistHead.studioWigQuality=null;
 return true;
}
export function battleHeadMasterStats(actors=[]){
 const human=actors.filter(a=>!a.monsterSpec);
 return Object.freeze({
  version:BATTLE_HEAD_MASTER_VERSION,total:human.length,
  attached:human.filter(a=>a.masterHead?.attached).length,
  nearDetail:human.filter(a=>a.masterHead?.nearDetail).length,
  generatorPatterns:human.filter(a=>!!a.studioPattern?.version).length,
  savedGeneratorPatterns:human.filter(a=>a.studioPattern?.source==='saved-heroine-editor').length,
  fullStudioWigs:human.filter(a=>!!a.masterHead?.studioWig).length,
  studioHairSources:[...new Set(human.map(a=>a.masterHead?.studioHairSource).filter(Boolean))],
  cranialScalpWigs:human.filter(a=>a.masterHead?.studioWigCranialScalpTriangles>0&&a.masterHead?.studioWig).length,
  faceLightCorrected:human.filter(a=>a.masterHead?.skinLightResponseVersion===BATTLE_FACE_LIGHT_RESPONSE_VERSION).length,
  faceMaterialFailures:human.filter(a=>a.masterHead?.attached&&(
   !a.masterHead.face?.visible||
   a.masterHead.face.material?.userData?.battleFaceLightResponseVersion!==BATTLE_FACE_LIGHT_RESPONSE_VERSION||
   a.masterHead.face.material?.roughness<.8||
   a.masterHead.face.userData?.faceColorMode!=='color'
  )).map(a=>({id:a.id,problem:'battle-face-pbr-incomplete'})),
  exemplarSkinMaterial:human.filter(a=>a.masterHead?.attached).slice(0,4).map(a=>({
   id:a.id,sex:a.sex||a.masterRecipe?.sex,
   mesh:a.masterHead.face?.name,
   pbr:a.masterHead.face?.material?.type,
   color:a.masterHead.face?.material?.color?.getHexString?.(),
   vertexColors:a.masterHead.face?.material?.vertexColors,
   poreTexture:!!a.masterHead.face?.material?.bumpMap,
   albedoMap:a.masterHead.face?.material?.map?.name||null,
   lightResponse:a.masterHead.skinLightResponseVersion,
   faceVisible:a.masterHead.face?.visible,
   eyeOutlineVisible:a.masterHead.face?.children?.filter(n=>/EYELINER/i.test(n.name)).some(n=>n.visible)
  })),
  cranialFits:human.filter(a=>a.masterHead?.cranialFit?.version===BATTLE_FACE_PROPORTION_VERSION).length,
  undersizedHeads:human.filter(a=>a.masterHead?.attached&&
    (a.masterHead?.cranialFit?.widthRatio<.94||
     a.masterHead?.cranialFit?.cranialHeightRatio<.94))
   .map(a=>({id:a.id,job:a.job?.name,
    width:a.masterHead?.cranialFit?.widthRatio,
    height:a.masterHead?.cranialFit?.cranialHeightRatio})),
  headProportionSamples:human.filter(a=>a.masterHead?.cranialFit).slice(0,10)
   .map(a=>({id:a.id,job:a.job?.name,
    widthRatio:a.masterHead.cranialFit.widthRatio,
    heightRatio:a.masterHead.cranialFit.cranialHeightRatio,
    scale:a.masterHead.cranialFit.scale,
    priorScale:a.masterHead.cranialFit.previousScale,
    sourceMeshTransformApplied:true,
    sourceShoulderToSkullWidthRatio:a.masterHead.cranialFit.sourceShoulderToSkullWidthRatio})),
  originalHeadTrianglesRemoved:human.reduce((n,a)=>n+(a.masterHead?.removedDonorTriangles||0),0),
  failures:human.filter(a=>a.character&&!a.masterHead).map(a=>({id:a.id,reason:a.masterHeadError||'not installed'})),
  actualNewHeadMesh:true,sourceAsset:BATTLE_HEAD_MASTER_ASSET
 });
}
