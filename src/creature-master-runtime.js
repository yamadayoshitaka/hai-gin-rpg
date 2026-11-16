/**
 * Real, on-demand high-poly 3D reconstruction from the game's own anatomical
 * definitions. Produces Object3D, not 2D pictures or pretend GLB file paths.
 *
 * Source master -> near/high -> mid/high (optimization pending) -> far/low.
 * The 50 bestiary subjects retain their actual species construction and
 * photo PBR maps; source density comes from monster-shape-kit.js.
 * Humanlike entries retain the live canonical skinned GLB and outfit layer.
 */
import * as THREE from 'three';
import {MONSTER_BY_ID} from './monster-catalog.js';
import {createMonsterModel,disposeMonsterSculpture} from './monster-geometry.js?v=m001-small-face-mane-v8-20261116';
import {startMonsterAction,animateMonsterModel} from './monster-animation.js?v=beast-fox-face-v4-20261116';
import {createCosplayedHumanoidMonster} from './monster-character-cosplay.js';
import {femaleSummonCosplayFor} from './female-summon-forms.js';
import {buildCombatObjectGeometry} from './combat-creature-geometry.js';
import {CREATURE_MASTER_BY_ID,MASTER_RENDER_TIERS} from './creature-master-library.js';
import {subdivideDedicatedSource} from './creature-source-subdivision.js';
export {subdivideDedicatedSource} from './creature-source-subdivision.js';

const SUPPORTED_ACTIONS=new Set(['idle','walk','run','attack','roar','hit','defeat']);
const DEFAULT_FEMALE_SPEC=Object.freeze({
 size:1,variant:0,colors:Object.freeze({
  base:'#aa9c8f',highlight:'#d8cdbb',accent:'#d0b084'
 })
});
function elementLightenedSpec(base){
 // Create a distinct colour phenotype while preserving the exact same
 // anatomy, joints, and monster ID for the generated summon. Never mutate
 // the canonical frozen catalog definition or shared original material.
 const lighten=(hex,accent,factor)=>{
  const c=new THREE.Color(hex);
  c.lerp(new THREE.Color(accent),factor);
  return '#'+c.getHexString();
 };
 return {...base,colors:{
  base:lighten(base.colors.base,base.colors.highlight,.19),
  highlight:lighten(base.colors.highlight,'#f8f3e4',.15),
  accent:lighten(base.colors.accent,'#e4f5f7',.14)
 }};
}
/**
 * Subdivide only the *original dedicated summon mesh* for detailed sculpt
 * export. This is independent of the combat InstancedMesh geometry. UV,
 * vertex colours and normal vectors interpolate; no extra white geometry,
 * duplicated donor shell or separate floating appendages are introduced.
 * A limit protects the phone preview if the source is already very large.
 *
 * Subdivision provides editing resolution, NOT new anatomical information.
 */

function fromDedicatedMeshes(id,tier){
 const detail=tier==='far'||tier==='mid'?'low':'high';
 const chunks=buildCombatObjectGeometry(id,{detail});
 const root=new THREE.Group();root.name=id+'-dedicated-original-master';
 let refined=0;
 for(const [part,geo] of Object.entries(chunks)){
  const geometry=tier==='master'||tier==='mid'?subdivideDedicatedSource(geo,{maxTriangles:tier==='mid'?90000:1600000}):geo;
  if(geometry!==geo){geo.dispose();refined++;}
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
   color:0xffffff,vertexColors:!!geometry.getAttribute('color'),
   side:THREE.DoubleSide,roughness:part.startsWith('wing')?.71:.76,metalness:.06
  }));
  mesh.name=part;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 }
 root.userData.dedicatedRefinedParts=refined;
 root.userData.isMasterDedicated=true;
 root.userData.pivots=Object.fromEntries(root.children.map(child=>[child.name,child]));
 root.userData.homeScale=1;
 return root;
}
export function measureMasterMesh(root){
 const stats={meshes:0,triangles:0,vertices:0,bones:0,
  materials:0,textureMaps:0,skinnedMeshes:0};
 const mats=new Set(),tex=new Set();
 root?.traverse(node=>{
  if(node.isBone)stats.bones++;
  if(!node.isMesh)return;
  stats.meshes++;
  if(node.isSkinnedMesh)stats.skinnedMeshes++;
  const g=node.geometry;
  if(g?.isBufferGeometry){
   stats.vertices+=g.getAttribute('position')?.count||0;
   stats.triangles+=Math.floor((g.getIndex()?.count||
    g.getAttribute('position')?.count||0)/3);
  }
  for(const mat of (Array.isArray(node.material)?node.material:[node.material])){
   if(!mat)continue;
   mats.add(mat);
   for(const name of ['map','normalMap','roughnessMap','metalnessMap','aoMap',
    'emissiveMap','alphaMap'])
    if(mat[name]?.isTexture)tex.add(mat[name]);
  }
 });
 stats.materials=mats.size;stats.textureMaps=tex.size;
 return Object.freeze(stats);
}
/**
 * Each ID creates a separate, verifiable 3D scene tree. 108 assets exist as
 * generator configurations, not as 108 pre-exported binary GLBs.
 * Caller must wait on ready before claiming the canonical human is visible.
 */
export function createCreatureMaster(id,{tier='master'}={}){
 const entry=CREATURE_MASTER_BY_ID[id];
 if(!entry)throw Error('Unknown master creature ID: '+id);
 if(!MASTER_RENDER_TIERS[tier])throw Error('Unknown master tier: '+tier);
 const detail=entry.protected?'high':MASTER_RENDER_TIERS[tier].geometry;
 let root,cosplayHandle=null,mode='source-sculpt',ready=Promise.resolve();
 if(entry.engine==='canonical-human-rig'){
  const spec=MONSTER_BY_ID[entry.baseId];
  cosplayHandle=createCosplayedHumanoidMonster(spec,{
   detail:'high',withoutFallback:false
  });
  root=cosplayHandle.root;ready=cosplayHandle.ready;
  mode='canonical-character-rig';
 }else if(entry.engine==='canonical-female-rig'){
  const profile=femaleSummonCosplayFor(id);
  if(!profile)throw Error('Missing original dedicated summon profile: '+id);
  cosplayHandle=createCosplayedHumanoidMonster({
   ...DEFAULT_FEMALE_SPEC,id,name:entry.name,family:entry.family
  },{detail:'high',profileOverride:profile,withoutFallback:true});
  root=cosplayHandle.root;ready=cosplayHandle.ready;
  mode='canonical-dedicated-female-rig';
 }else if(entry.kind==='dedicated'){
  root=fromDedicatedMeshes(id,tier);
  mode='source-dedicated-sculpt';
 }else{
  const base=MONSTER_BY_ID[entry.baseId];
  const spec=entry.kind==='summon'?elementLightenedSpec(base):base;
  root=createMonsterModel(spec,{detail});
  mode='source-bestiary-sculpt';
 }
 root.name='CreatureMaster_'+id+'_'+tier;
 root.userData.masterId=id;
 root.userData.masterTier=tier;
 root.userData.masterEngine=mode;
 root.userData.masterPreviewOnly=true;
 root.userData.photorealCertified=false;
 root.userData.gameOptimized=tier==='far';
 if(entry.kind==='summon')root.userData.variant='summon';
 let disposed=false,action='idle',actionAt=0;
 const start=(next,time=0)=>{
  if(disposed)return;
  action=SUPPORTED_ACTIONS.has(next)?next:'idle';
  actionAt=time;
  if(cosplayHandle)cosplayHandle.start(action,time);
  else if(!root.userData.isMasterDedicated)startMonsterAction(root,action,time);
 };
 start('idle',0);
 const update=time=>{
  if(disposed)return;
  if(cosplayHandle){cosplayHandle.update(time);return;}
  if(root.userData.isMasterDedicated){
   // Separate originals are static source meshes with individual wing,
   // tail and leg objects. This demonstration is not an exported GLB clip.
   for(const child of root.children){
    const name=child.name.toLowerCase(),elapsed=Math.max(0,time-actionAt);
    const locomotion=action==='walk'||action==='run';
    const fast=action==='run'?2:1;
    if(/wing/.test(name))child.rotation.z=Math.sin(time*3.1*fast)*.09;
    else if(/tail/.test(name))child.rotation.y=Math.sin(time*2.2)*.075;
    else if(/leg|arm/.test(name))
     child.rotation.x=locomotion?Math.sin(time*5.8*fast+
       (name.includes('l')?Math.PI:0))*.13:0;
    if(action==='defeat')child.rotation.x=0;
   }
   return;
  }
  animateMonsterModel(root,time);
 };
 const dispose=()=>{
  if(disposed)return;disposed=true;
  if(cosplayHandle){cosplayHandle.dispose();return;}
  if(root.userData.isMasterDedicated){
   root.traverse(node=>{if(node.isMesh){node.geometry?.dispose();
    if(Array.isArray(node.material))node.material.forEach(m=>m.dispose());
    else node.material?.dispose();
   }});
   root.parent?.remove(root);
  }else disposeMonsterSculpture(root);
 };
 return {entry,root,tier,mode,ready,start,update,dispose,
  stats:()=>measureMasterMesh(root),
  exportKind:'source-mesh-and-materials',
  // No fake motion baked into the GLB exporter: animation plays in runtime.
  animationExportReady:false
 };
}
