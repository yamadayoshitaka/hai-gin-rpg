/** Quaternius modular outfit assembler. Static BOM in, skinned mesh visibility out.
 * Never changes physics, hit boxes, camera or avatar root transforms.
 */
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {resolveJobOutfit} from './visual-asset-catalog.js?v=107.0';
const ROOT='./assets/characters/quaternius-modular/parts/';
const cache=new Map();
const entries={
 Male:{
  body:{peasant:'Male_Peasant_Body',ranger:'Male_Ranger_Body'},
  arms:{peasant:'Male_Peasant_Arms',ranger:'Male_Ranger_Arms'},
  legs:{peasant:'Male_Peasant_Legs',ranger:'Male_Ranger_Legs'},
  feet:{peasant:'Male_Peasant_Feet',ranger:'Male_Ranger_Feet_Boots'},
  hood:{ranger:'Male_Ranger_Head_Hood'},
  pauldron:{ranger:'Male_Ranger_Acc_Pauldron'}
 },
 Female:{
  body:{peasant:'Female_Peasant_Body',ranger:'Female_Ranger_Body'},
  arms:{peasant:'Female_Peasant_Arms',ranger:'Female_Ranger_Arms'},
  legs:{peasant:'Female_Peasant_Legs',ranger:'Female_Ranger_Legs'},
  feet:{peasant:'Female_Peasant_Feet',ranger:'Female_Ranger_Feet'},
  hood:{ranger:'Female_Ranger_Head_Hood'},
  pauldron:{ranger:'Female_Ranger_Acc_Pauldrons'}
 }
};
function partCategory(name){
 const n=String(name||'').toLowerCase();
 if(/head_hood/.test(n))return 'hood';
 if(/acc_pauldron/.test(n))return 'pauldron';
 if(/_arms(?:_|$)|_bracer/.test(n))return 'arms';
 if(/_body(?:_|$)|_belt/.test(n))return 'body';
 if(/_legs(?:_|$)/.test(n))return 'legs';
 if(/_feet(?:_|$)|_boots/.test(n))return 'feet';
 return null;
}
// SkeletonUtils cannot safely clone a part whose skeleton bones live outside
// the glTF scene root. Such detached references become undefined and Three.js
// crashes inside skinning with "reading 'matrixWorld'".
function validSkinnedHierarchy(root){
 const descendants=new Set();
 root.traverse(node=>descendants.add(node));
 let skinned=0,invalid=0;
 root.traverse(node=>{
  if(!node.isSkinnedMesh)return;
  skinned++;
  const bones=node.skeleton?.bones;
  if(!Array.isArray(bones)||!bones.length||bones.some(b=>!b?.isBone||!descendants.has(b)))invalid++;
 });
 return {valid:skinned>0&&invalid===0,skinned,invalid};
}
function getPart(loader,id){
 if(!cache.has(id))cache.set(id,loader.loadAsync(ROOT+id+'.gltf').catch(err=>{cache.delete(id);throw err;}));
 return cache.get(id);
}
export async function attachModularOutfit({host,loader,THREE,job='traveler'}){
 const model=host?.children.find(x=>x.userData?.sourceModelId);
 if(!model)return false;
 const gender=model.userData.sourceModelId.startsWith('Female')?'Female':'Male';
 const spec=entries[gender];
 const originals=[];
 model.traverse(node=>{
  if(!node.isSkinnedMesh)return;
  const category=partCategory(node.name);
  if(category)originals.push({node,category});
 });
 const loaded=[];
 const all=Object.entries(spec).flatMap(([category,variants])=>Object.entries(variants).map(([variant,id])=>({category,variant,id})));
 const states=await Promise.allSettled(all.map(async entry=>{
  const source=(await getPart(loader,entry.id)).scene;
  // Validate the source before cloning: SkeletonUtils may otherwise create
  // a skin with null bone slots and trigger matrixWorld errors during render.
  const sourceSkin=validSkinnedHierarchy(source);
  if(!sourceSkin.valid)throw Error('Skipped detached/incomplete source skeleton: '+entry.id);
  const cloned=cloneSkinned(source);
  const clonedSkin=validSkinnedHierarchy(cloned);
  if(!clonedSkin.valid)throw Error('Skipped invalid cloned skeleton: '+entry.id);
  cloned.name='visual-bom-'+entry.id;
  cloned.userData.visualBomPart=true;
  cloned.traverse(n=>{
   if(n.isMesh){
    n.castShadow=true;n.receiveShadow=true;
    if(n.material?.color){
     n.material=n.material.clone();
     n.userData.bomBaseColor=n.material.color.clone();
    }
   }
  });
  // Only verified skinned meshes enter the render graph.
  model.add(cloned);
  loaded.push({...entry,model:cloned});
 }));
 if(!loaded.length){
  host.userData.modularFailure=states.filter(x=>x.status==='rejected').map(x=>String(x.reason)).slice(0,3);
  return false;
 }
 const select=(jobId,visualStyle)=>{
  const recipe=resolveJobOutfit(jobId),cloth=new THREE.Color(visualStyle?.cloth||'#748b9b'),accent=new THREE.Color(visualStyle?.accent||'#c6a88f');
  for(const original of originals){
   const type=original.category;
   const target=recipe[type];
   const replacement=loaded.find(x=>x.category===type&&x.variant===(type==='hood'||type==='pauldron'?'ranger':target));
   original.node.visible=!replacement&&(type!=='hood'||recipe.hood)&&(type!=='pauldron'||recipe.pauldron);
  }
  for(const item of loaded){
   const should=item.category==='hood'?recipe.hood:item.category==='pauldron'?recipe.pauldron:recipe[item.category]===item.variant;
   item.model.visible=Boolean(should);
   if(!should)continue;
   item.model.traverse(n=>{
    if(!n.isMesh||!n.material?.color||!n.userData.bomBaseColor)return;
    const color=/body|legs|arms|feet/i.test(n.name)?cloth:accent;
    n.material.color.copy(n.userData.bomBaseColor).lerp(color,.62);
   });
  }
  host.userData.modularJob=jobId;
  host.userData.modularPartCount=loaded.filter(x=>x.model.visible).length;
 };
 host.userData.setModularOutfit=select;
 select(job);
 host.userData.modularAvailability={loaded:loaded.length,requested:all.length};
 return true;
}
