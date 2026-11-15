/**
 * CC0 animal/insect source reconstruction pilots.
 * Uses GLBs already checked into assets/creatures/quaternius50. The imported
 * creature is the real underlying model; the bestiary palette and its
 * element-specific collar/carapace objects are re-fitted on that source.
 *
 * This is a gallery quality review, NOT silent combat replacement. The
 * Quaternius source meshes are stylized, not photogrammetric animals.
 * Only anatomically comparable models are listed; unlike the 50-entry CC0
 * catalog, an unrelated "Demon" must never be substituted for a beetle.
 */
import * as THREE from 'three';
import {loadExternalCreature} from './creature-external-runtime.js';

export const SPECIES_SOURCE_REBUILD_PILOTS=Object.freeze({
 m001:Object.freeze({donor:'q022',name:'dog-to-wolf',family:'beast',
  anatomy:'quadruped-canine',feature:'collar'}),
 m007:Object.freeze({donor:'q020',name:'cat-to-sabertooth',family:'feline',
  anatomy:'quadruped-feline',feature:'collar'}),
 m011:Object.freeze({donor:'q048',name:'pigeon-to-eagle',family:'avian',
  anatomy:'bird-two-wings',feature:'breastplate'}),
 m021:Object.freeze({donor:'q037',name:'armabee-to-beetle',family:'insect',
  anatomy:'six-legged-insect-approximation',feature:'carapace'}),
 m046:Object.freeze({donor:'q024',name:'blob-to-slime',family:'aquatic',
  anatomy:'amorphous',feature:'crest'}),
 m047:Object.freeze({donor:'q049',name:'squid-to-octopus',family:'aquatic',
  anatomy:'tentacled-invertebrate-approximation',feature:'mantle'}),
});
export const SPECIES_SOURCE_PILOT_IDS=Object.freeze(
 Object.keys(SPECIES_SOURCE_REBUILD_PILOTS));
export const isSpeciesSourcePilot=spec=>
 Object.hasOwn(SPECIES_SOURCE_REBUILD_PILOTS,typeof spec==='string'?spec:spec?.id);
function sourceMaterial(spec,kind){
 const map={metalness:.57,roughness:.49};
 return new THREE.MeshStandardMaterial({
  color:new THREE.Color(kind==='cloth'?spec.colors.base:spec.colors.accent),
  metalness:kind==='cloth'?.05:map.metalness,
  roughness:kind==='cloth'?.86:map.roughness
 });
}
function costumeGeometry(kind,bounds){
 const size=bounds.getSize(new THREE.Vector3());
 if(kind==='collar'){
  const radius=Math.max(.12,Math.min(size.x,size.y)*.25);
  return new THREE.TorusGeometry(radius,.045,8,30);
 }
 if(kind==='carapace')return new THREE.SphereGeometry(1,20,14);
 if(kind==='mantle')return new THREE.SphereGeometry(1,16,12);
 if(kind==='crest')return new THREE.IcosahedronGeometry(1,2);
 return new THREE.SphereGeometry(1,14,10);
}
/** Only actual licensed, committed GLBs are used. Source identity,
 * animations and scale remain traceable for QA and future retargeting. */
export async function loadSpeciesSourceComposite(spec,registry,{
 detail='high'
}={}){
 const recipe=SPECIES_SOURCE_REBUILD_PILOTS[spec?.id];
 if(!recipe||recipe.family!==spec.family)
  throw Error('No compatible reviewed animal source for '+spec?.id);
 const donor=registry?.entries?.[recipe.donor];
 if(!donor||donor.license!=='CC0-1.0'||!donor.models?.high||
    !donor.models.high.includes('/'+recipe.donor+'/'))
  throw Error('Missing committed CC0 source '+recipe.donor);
 const handle=await loadExternalCreature(donor,detail);
 const owned=[];
 try{
  const root=handle.root;
  root.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(root);
  if(bounds.isEmpty())throw Error('Empty imported species source');
  const size=bounds.getSize(new THREE.Vector3());
  const center=bounds.getCenter(new THREE.Vector3());
  if(Math.min(size.x,size.y,size.z)<=0)
   throw Error('Invalid source body bounds');
  // The imported CC0 animal is the underlying geometry. Reapply the
  // existing monster's fur/scales/element identity to per-instance cloned
  // PBR materials while retaining the donor's UVs, albedo/normal maps and
  // native animation/skeleton. Never tint eyes or transparent wing membranes.
  let pigmentedMeshes=0;
  const clonedMaterials=new Map();
  root.traverse(node=>{
   if(!node.isMesh||!node.material)return;
   const sourceName=(node.name||'')+' '+(node.material.name||'');
   if(/iris|pupil|eyeball|eyes|cornea|teeth|tooth|mouth|wing|feather/i.test(sourceName))
    return;
   const tint=material=>{
    if(!material?.color)return material;
    if(clonedMaterials.has(material))return clonedMaterials.get(material);
    const copy=material.clone();
    copy.color.lerp(new THREE.Color(spec.colors.base),.30);
    if(Number.isFinite(copy.roughness))copy.roughness=
     Math.max(spec.family==='insect'?.47:.66,copy.roughness);
    copy.userData={...copy.userData,
     speciesSourcePigmentId:spec.id,sourceMaterialUnmodified:true};
    clonedMaterials.set(material,copy);
    return copy;
   };
   node.material=Array.isArray(node.material)?
    node.material.map(tint):tint(node.material);
   node.userData.speciesSourcePigmented=true;
   pigmentedMeshes++;
  });
  // Retain the species' existing colors/elements as PBR accessory material
  // instead of discarding its identity when the new animal base is loaded.
  const shell=sourceMaterial(spec,recipe.feature==='collar'?'cloth':'metal');
  const geometry=costumeGeometry(recipe.feature,bounds);
  const piece=new THREE.Mesh(geometry,shell);
  piece.name='monster-outfit-source-'+spec.id+'-'+recipe.feature;
  piece.castShadow=true;piece.receiveShadow=true;
  piece.userData.speciesId=spec.id;
  piece.userData.fromExistingMonsterPalette=true;
  const y=recipe.feature==='crest'?center.y+size.y*.35:
    recipe.feature==='carapace'?center.y+size.y*.18:
    recipe.feature==='breastplate'?center.y:
    recipe.feature==='mantle'?center.y+size.y*.15:center.y+size.y*.1;
  piece.position.set(center.x,y,center.z+
   (recipe.feature==='collar'?size.z*.23:0));
  if(recipe.feature==='collar'){
   piece.rotation.x=.15;
   piece.scale.set(1,1,1);
  }else if(recipe.feature==='carapace'){
   piece.scale.set(size.x*.32,size.y*.055,size.z*.34);
  }else if(recipe.feature==='mantle'){
   piece.scale.set(size.x*.23,size.y*.11,size.z*.20);
  }else if(recipe.feature==='crest'){
   piece.scale.setScalar(Math.min(size.x,size.y)*.12);
  }else piece.scale.set(size.x*.21,size.y*.22,size.z*.07);
  root.add(piece);owned.push({geometry,material:shell});
  // The source GLB's animating upper body is preferred for an accessory
  // attachment; Object3D.attach retains world alignment across reparenting.
  const bones=[];
  root.traverse(o=>{
   if(o.isBone&&/(?:spine|chest|thorax|body|neck)/i.test(o.name))
    bones.push(o);
  });
  const target=bones.find(o=>/chest|thorax/i.test(o.name))||
   bones.find(o=>/spine|body/i.test(o.name))||null;
  if(target){
   root.updateMatrixWorld(true);
   target.attach(piece);
  }
  root.userData.speciesId=spec.id;
  root.userData.sourceComposite={
   kind:'licensed-species-source-with-native-costume',
   donor:recipe.donor,donorName:donor.name,sourceName:recipe.name,
   license:'CC0-1.0',originalSpeciesId:spec.id,
   anatomy:recipe.anatomy,material:'catalog-colors-PBR',
   overlay:piece.name,anchor:target?.name||'source-root',
   pigmentedMeshes,donorMaterialsPreserved:true,
   visuallyApproved:false,gameReplacementEnabled:false,
   stillStylized:true
  };
  return {
   root,clips:handle.clips,
   play:handle.play,update:handle.update,
   sourceComposite:root.userData.sourceComposite,
   dispose(){for(const item of owned){
    item.geometry.dispose();item.material.dispose();
   }handle.dispose();}
  };
 }catch(error){handle.dispose();throw error;}
}
