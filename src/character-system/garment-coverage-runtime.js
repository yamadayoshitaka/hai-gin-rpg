// Garment-first skin occlusion. The real equipped meshes decide which body
// regions are covered; the naked character is NOT allowed to render through
// trousers, boots or armor. Preserve exposed face, neck and finger skin.
// This module never performs a CSG cut per frame or mutates shared source GLBs.
const maskCache=new WeakMap();
const protectedBones=/^(?:head|neck(?:_\d+)?|hand_[lr]|(?:thumb|index|middle|ring|pinky)_(?:\d+|leaf).*_[lr])$/;
const garmentMaterial=/mi_(?:ranger|peasant)|(?:cloth|linen|damask|metal|leather)/i;
const garmentName=/(?:ranger|peasant)_(?:body|arms|legs|feet)/i;
const orderedRegions=['torso','upperarm','lowerarm','thigh','calf','foot'];
function category(boneName){
 const name=String(boneName||'').toLowerCase();
 if(protectedBones.test(name)||/^(?:eye|jaw|ear|finger)/.test(name))return 'exposed';
 if(/^foot_[lr]$|^ball_[lr]$|^toe/.test(name))return 'foot';
 if(/^calf_[lr]$/.test(name))return 'calf';
 if(/^thigh_[lr]$/.test(name))return 'thigh';
 if(/^upperarm_[lr]$|^clavicle_[lr]$/.test(name))return 'upperarm';
 if(/^lowerarm_[lr]$/.test(name))return 'lowerarm';
 if(/^pelvis$|^root$|^spine(?:_\d+)?$/.test(name))return 'torso';
 return 'unknown'; // unrecognised anatomy must NEVER be cut blindly
}
const hiddenZoneMap={
 body:['torso'],
 arms:['upperarm','lowerarm'],
 legs:['thigh','calf'],
 feet:['foot']
};
const clothZoneMap={
 'upper-sleeve':['upperarm'],
 'forearm-sleeve':['lowerarm'],
 'trouser-thigh':['thigh'],
 'trouser-calf':['calf']
};
const armorZoneMap={
 chest:['torso'],hip:['torso'],shoulder:['upperarm'],
 gauntlet:['lowerarm'],thigh:['thigh'],knee:['calf'],shin:['calf'],
 'boot-upper':['calf'],'boot-foot':['foot']
};
export function deriveGarmentCoverage({dressed,cloth=null,armor=null}={}){
 const covered=new Set(),sources=new Set();
 const add=(regions,origin)=>{if(!regions?.length)return;
  for(const region of regions)covered.add(region);
  sources.add(origin);
 };
 dressed?.traverse?.(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.visible||!garmentName.test(mesh.name))return;
  // Some Ranger arm meshes are exposed human skin, not sleeves. Only a
  // material/mesh representing real garment fabric establishes coverage.
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!mats.some(mat=>garmentMaterial.test(mat?.name||'')))return;
  const match=/(?:ranger|peasant)_(body|arms|legs|feet)/i.exec(mesh.name);
  if(match)add(hiddenZoneMap[match[1].toLowerCase()],'garment:'+match[1].toLowerCase());
 });
 for(const piece of cloth?.objects||[]){
  if(piece.visible===false)continue;
  const slot=piece.userData?.equipmentSlot;
  add(clothZoneMap[slot], 'cloth:'+slot);
 }
 for(const piece of armor?.objects||[]){
  if(piece.visible===false)continue;
  const slot=piece.userData?.equipmentSlot;
  add(armorZoneMap[slot], 'armor:'+slot);
 }
 // No guessed shoes: if no actual footwear mesh is equipped, keep skin feet.
 return Object.freeze({
  regions:Object.freeze([...covered].sort()),
  sources:Object.freeze([...sources].sort()),
  signature:orderedRegions.filter(name=>covered.has(name)).join('|')||'uncovered',
  footCovered:covered.has('foot'),
  seamPolicy:'preserve-exposed-rim',
  cutoff:'bone-weighted-triangle-mask'
 });
}
export function clipBodyToGarment(characterModel,coverage){
 const hidden=new Set(coverage?.regions||[]);
 const entries=[],measure={sourceTriangles:0,keptTriangles:0,removedTriangles:0,
  skinnedMeshes:0,regions:[...hidden],footCovered:hidden.has('foot')};
 if(!hidden.size)return {restore(){},diagnostics:measure};
 characterModel.traverse(mesh=>{
  // Face, eyes, lashes and hair are separate, small skinned meshes and must
  // remain untouched. The Superhero body skin has >4000 vertices.
  if(!mesh.isSkinnedMesh||!mesh.geometry?.index)return;
  const original=mesh.geometry,positions=original.getAttribute('position');
  if(!positions||positions.count<4000)return;
  const joints=original.getAttribute('skinIndex'),weights=original.getAttribute('skinWeight');
  if(!joints||!weights||!mesh.skeleton)return;
  const zones=mesh.skeleton.bones.map(b=>category(b.name));
  if(!zones.includes('exposed'))return; // cannot verify facial continuity
  let variants=maskCache.get(original);
  if(!variants){variants=new Map();maskCache.set(original,variants)}
  let record=variants.get(coverage.signature);
  if(!record){
   const cut=new Uint8Array(positions.count);
   for(let i=0;i<positions.count;i++){
    let exposedWeight=0,hiddenWeight=0;
    for(let j=0;j<4;j++){
     const index=joints.getComponent(i,j),weight=weights.getComponent(i,j);
     const zone=zones[index]||'unknown';
     if(zone==='exposed'||zone==='unknown'||!hidden.has(zone))exposedWeight+=weight;
     else hiddenWeight+=weight;
    }
    // Protect every finger/face/neck transition. A covered region needs a
    // decisive skinning majority before its geometry may be removed.
    cut[i]=hiddenWeight>=.56&&exposedWeight<.44?1:0;
   }
   const sourceIndices=original.index,kept=[];
   for(let i=0;i<sourceIndices.count;i+=3){
    const a=sourceIndices.getX(i),b=sourceIndices.getX(i+1),c=sourceIndices.getX(i+2);
    // Keep a boundary triangle if at least two of its vertices belong to
    // exposed skin. This preserves an underlap at sleeve/neck/boot openings.
    if(cut[a]+cut[b]+cut[c]<2)kept.push(a,b,c);
   }
   // A failed / incompatible mesh must not disappear completely.
   const sourceCount=sourceIndices.count/3,keptCount=kept.length/3;
   if(keptCount<150||keptCount>=sourceCount*.97) return;
   const masked=original.clone();masked.setIndex(kept);
   if(original.boundingSphere)masked.boundingSphere=original.boundingSphere.clone();
   record={geometry:masked,sourceCount,keptCount,refs:0};
   variants.set(coverage.signature,record);
  }
  record.refs++;
  mesh.geometry=record.geometry;
  entries.push({mesh,original,record,variants});
  measure.skinnedMeshes++;
  measure.sourceTriangles+=record.sourceCount;
  measure.keptTriangles+=record.keptCount;
 });
 measure.removedTriangles=measure.sourceTriangles-measure.keptTriangles;
 let released=false;
 return {restore(){
   if(released)return;
   released=true;
   for(const entry of entries){
    entry.mesh.geometry=entry.original;
    if(--entry.record.refs===0){
      entry.record.geometry.dispose();
      entry.variants.delete(coverage.signature);
      if(entry.variants.size===0)maskCache.delete(entry.original);
    }
   }
  },diagnostics:measure};
}
