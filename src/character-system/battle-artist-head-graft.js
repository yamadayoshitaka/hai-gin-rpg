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
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {makeIndependentFaceMaster} from '../independent-face-masters.js?v=68';
import {applyFaceColorMode} from '../face-feature-meshes.js?v=68';
import {FEMALE_V7_DEFAULTS,MALE_REFERENCE_DEFAULT} from '../face-v7-controls.js';
import {hideBattleDonorFace,attachIndependentFaceToBattleHead}
 from '../heroine-battle-costume-bridge.js?v=70';
import {createFaceExpressionAnimator} from '../face-expression-animation-v48.js?v=68';

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
function buildArtistMaster(source,recipe){
 const controls=artistControls(recipe);
 const args=recipe.sex==='female'?{femaleControls:controls}:{maleControls:controls};
 const result=makeIndependentFaceMaster(source,recipe.sex,args);
 applyFaceColorMode(result.face,'color',{
  contactColor:recipe.sex==='male'?'#514139':
   ['#514139','#467fa7','#5c886b','#927953','#7e858d'][recipe.faceIndex%5],
  makeupType:recipe.sex==='female'?(recipe.faceIndex%3):0
 });
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
export function attachBattleArtistHead({character,recipe,source,animatedFace=false}={}){
 if(!character?.model?.traverse||!recipe||!source?.traverse)
  throw Error('Live rigged actor, hero recipe and actual head GLB required');
 const special=!!animatedFace;
 const key=[recipe.sex,recipe.ageBand,recipe.bodyType,recipe.faceIndex].join('|');
 let master,prototypeReused=false;
 if(special){
  master=buildArtistMaster(source,recipe);
 }else{
  let prototype=facePrototypes.get(key);
  if(!prototype){
   prototype=buildArtistMaster(source,recipe);
   facePrototypes.set(key,prototype);
  }else prototypeReused=true;
  const root=prototype.root.clone(true);
  master={root,face:findSculptFace(root,recipe.sex),
   parts:root.getObjectByName(prototype.parts.name)};
 }
 const cut=hideBattleDonorFace(character.model);
 const fit=attachIndependentFaceToBattleHead({
  faceRoot:master.root,faceMesh:master.face,
  characterModel:character.model,headBounds:cut.headBounds
 });
 if(!fit.attachedToRealHeadBone||cut.removedTriangles<=0)
  throw Error('Head-bone skin swap could not be validated');
 // Cosmetic meshes are near-only; the actual adult sculpt, eye volumes and
 // irises remain at every distance. Far variants are still real new heads,
 // never the previous character GLTF face.
 const cosmetic=[];
 master.root.traverse(o=>{
  if(!o.isMesh)return;
  if(/(?:LASH|EYESHADOW|EYELINER|BLUSH|FRECKLE|WRINKLE|AGE_)/i.test(o.name))
   cosmetic.push(o);
 });
 let near=true,expression=null;
 if(special){
  expression=createFaceExpressionAnimator(master,{autoBlink:true,speaking:false});
 }
 function setNearDetail(value){
  const desired=!!value;
  if(desired===near)return;
  near=desired;
  for(const part of cosmetic)part.visible=desired;
 }
 const result={
  version:BATTLE_HEAD_MASTER_VERSION,attached:true,
  realGeometry:master.face.geometry,
  headRoot:master.root,face:master.face,
  sourceAsset:BATTLE_HEAD_MASTER_ASSET,
  removedDonorTriangles:cut.removedTriangles,
  headFit:fit,nearDetail:true,cosmeticMeshes:cosmetic.length,
  reusedSculptGeometry:prototypeReused,
  expressions:!!expression,
  setNearDetail(value){setNearDetail(value);result.nearDetail=near;},
  update(dt){if(result.nearDetail)expression?.update(dt);},
  dispose(){expression?.dispose();master.root.removeFromParent();}
 };
 character.object3D.userData.battleHeadMaster={
  version:result.version,source:result.sourceAsset,
  originalHeadRemoved:cut.removedTriangles,
  artistHeadAttached:true,
  headBone:fit.bone,
  faceTriangles:master.face.geometry.index?
   master.face.geometry.index.count/3:master.face.geometry.getAttribute('position').count/3
 };
 return result;
}
export function battleHeadMasterStats(actors=[]){
 const human=actors.filter(a=>!a.monsterSpec);
 return Object.freeze({
  version:BATTLE_HEAD_MASTER_VERSION,total:human.length,
  attached:human.filter(a=>a.masterHead?.attached).length,
  nearDetail:human.filter(a=>a.masterHead?.nearDetail).length,
  originalHeadTrianglesRemoved:human.reduce((n,a)=>n+(a.masterHead?.removedDonorTriangles||0),0),
  failures:human.filter(a=>a.character&&!a.masterHead).map(a=>({id:a.id,reason:a.masterHeadError||'not installed'})),
  actualNewHeadMesh:true,sourceAsset:BATTLE_HEAD_MASTER_ASSET
 });
}
