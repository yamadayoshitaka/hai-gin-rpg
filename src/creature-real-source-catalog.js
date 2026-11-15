/**
 * Authored links to already identified third-party REAL animal meshes.
 * These are remote CC BY source candidates, not files bundled into the game.
 * Model owner credit is retained for commercial attribution.
 * The renderer keeps the existing model if the remote host or CORS fails.
 */
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WEB_CREATURE_MESH_SOURCES} from './creature-web-mesh-catalog.js';
import {REAL_BODY_CANDIDATES} from './creature-real-body-candidates.js';
import {loadExternalCreature,prepareExternalGLTF} from './creature-external-runtime.js?v=wolf-actions-v3';
import {applyGreyFangWolfFinish} from './grey-fang-wolf-finish.js?v=wolf-actions-v3';
import {installGreyWolfActions} from './grey-wolf-action-runtime.js?v=wolf-actions-v3';

export const REAL_CREATURE_MESH_SOURCES=Object.freeze({
 'r-wolf':Object.freeze({
  name:'Wolf animated（リアル寄り・外部）',
  family:'canine',license:'CC BY 4.0',author:'victory_mirosya',
  sourceUrl:'https://sketchfab.com/3d-models/wolf-animated-79bd16a8c36a45c78ccd13b84b7ca99c',
  downloadUrl:'https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-050/79bd16a8c36a45c78ccd13b84b7ca99c.glb',
  licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  caution:'走行・歩行クリップは未確認。モーション移植が必要な可能性'
 }),
 'r-tiger':Object.freeze({
  name:'Running Tiger（リアル寄り・外部）',
  family:'feline',license:'CC BY 4.0',author:'Amil (francescolima74)',
  sourceUrl:'https://sketchfab.com/3d-models/running-tiger-fc2c7fd74dd04e39935803b884c77258',
  downloadUrl:'https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-101/fc2c7fd74dd04e39935803b884c77258.glb',
  licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  caution:'走行クリップあり。待機・攻撃は別途リターゲットが必要'
 }),
 'r-jaguar':Object.freeze({
  name:'Jaguar（リアル寄り・外部）',
  family:'feline',license:'CC BY 4.0',author:'Ear.Rodriguez',
  sourceUrl:'https://sketchfab.com/3d-models/none-91c61c329d2a4668816f81f08dfcd492',
  downloadUrl:'https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-005/91c61c329d2a4668816f81f08dfcd492.glb',
  licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  caution:'骨格アニメ付き、攻撃動作・適合は未確認'
 }),
 'r-eagle':Object.freeze({
  name:'American Bald Eagle（リアル寄り・外部）',
  family:'avian',license:'CC BY 4.0',author:'OscarWW',
  sourceUrl:'https://sketchfab.com/3d-models/american-bald-eagle-ae252eac5e2e4299be268aa0b320cd8a',
  downloadUrl:'https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-093/ae252eac5e2e4299be268aa0b320cd8a.glb',
  licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  caution:'未リグ。飛行・羽ばたきは未対応'
 }),
 'r-crocodile':Object.freeze({
  name:'Crocodile（リアル寄り・外部）',
  family:'reptile',license:'CC BY 4.0',author:'victory_mirosya',
  sourceUrl:'https://sketchfab.com/3d-models/crocodile-49c9823cddcd4d1fb2ecae8395a46bd0',
  downloadUrl:'https://huggingface.co/datasets/allenai/objaverse/resolve/main/glbs/000-066/49c9823cddcd4d1fb2ecae8395a46bd0.glb',
  licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  caution:'未リグ。ワニ以外の爬虫類へそのまま適用しない'
 }),
 ...WEB_CREATURE_MESH_SOURCES,
 ...REAL_BODY_CANDIDATES
});
export async function loadCreatureMeshSource(sourceId,registry,detail='high',{creatureId=null}={}){
 if(sourceId==='original-m020'){
  if(!['m020','summon_m020'].includes(creatureId))
   throw Error('オリジナル海竜GLBはm020専用です');
  const tier=detail==='source'?'source':detail==='low'?'low':'high';
  // The full-resolution original is loaded on demand; the Pages asset
  // relay redirects offloaded binaries to the matching Git commit.
  const url=new URL('../assets/creatures/original/m020/'+tier+'.glb',import.meta.url);
  const gltf=await new GLTFLoader().loadAsync(url.href);
  if(!gltf.scene||gltf.animations.length<7)
   throw Error('Original Leviathan GLB lacks geometry or seven real clips');
  let joints=0,meshes=0,skin=0;
  gltf.scene.traverse(n=>{
   if(n.isBone)joints++;
   if(n.isMesh){meshes++;if(n.isSkinnedMesh)skin++;}
  });
  if(joints<4||!skin||meshes<2)
   throw Error('Original Leviathan must retain its four-joint skinned body and jaw');
  const handle=prepareExternalGLTF(gltf,{
   id:'original-m020',name:'深海リヴァイアサン',targetHeight:2.4
  });
  handle.root.userData.creatureCandidateStatus='original-redesign-prototype';
  handle.root.userData.photorealCertified=false;
  handle.root.userData.creatureSourceStyle='marine-real-anatomy-draft';
  handle.root.userData.creatureMeshAttribution={
   author:'Hai-Gin original',license:'Project original',sourceId
  };
  return handle;
 }
 const real=REAL_CREATURE_MESH_SOURCES[sourceId];
 if(real){
  const gltf=await new GLTFLoader().loadAsync(real.downloadUrl);
  const handle=prepareExternalGLTF(gltf,{id:sourceId,name:real.name,targetHeight:2.4});
  handle.root.userData.creatureCandidateStatus=real.integration||'preview-only';
  handle.root.userData.creatureCandidateStyle=real.style||'source-photoreal';
  handle.root.userData.creatureMeshAttribution={
   author:real.author,license:real.license,licenseUrl:real.licenseUrl,
   sourceUrl:real.sourceUrl,sourceId
  };
  if(sourceId==='r-wolf'&&['m001','summon_m001','wolf'].includes(creatureId)){
   applyGreyFangWolfFinish(handle,{creatureId});
   installGreyWolfActions(handle);
  }
  return handle;
 }
 const entry=registry?.entries?.[sourceId];
 if(!entry||!/^q(?:00[1-9]|0[1-4][0-9]|050)$/.test(sourceId))
  throw Error('未登録のGLB: '+sourceId);
 return loadExternalCreature(entry,detail);
}
