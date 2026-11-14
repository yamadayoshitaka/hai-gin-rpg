/**
 * Inspect a loaded, production-rigged studio actor before using it as the
 * body underneath a humanoid monster/summon costume.
 *
 * THIS NEVER swaps characters in the live game. It verifies real bone
 * objects, skin weights, target attachments and animation tracks; a passing
 * package manifest alone is not enough to prove a 3D model is usable.
 *
 * Scene and animations are supplied by a future isolated GLTF loader.
 * Deliberately zero modifications to the imported actor GLB / shared rigs.
 */
const SLOTS=Object.freeze([
 'head','neck','spine','hips','upperArmL','upperArmR',
 'lowerArmL','lowerArmR','thighL','thighR','calfL','calfR'
]);
const MOTIONS=Object.freeze(['idle','walk','run','attack','hit','dead']);
const number=x=>typeof x==='number'&&Number.isFinite(x);
const norm=x=>String(x??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const included=(root,bone)=>{for(let p=bone;p;p=p.parent)if(p===root)return true;return false;};

/**
 * @returns {{ready:boolean,errors:string[],skinnedMeshes:number,
 * bindings:object|null,sourceUnmodified:boolean,motionNames:string[]}}
 */
export function inspectStudioSkinnedActor(scene,pkg,{animations=[]}={}){
 const errors=[];
 if(!scene?.isObject3D||!pkg?.bones||typeof pkg.bones!=='object')
  return {ready:false,errors:['missing-actor-or-bone-contract'],
   skinnedMeshes:0,bindings:null,sourceUnmodified:true,motionNames:[]};
 const bonesByName=new Map(),skinMeshes=[];
 scene.traverse(node=>{
  if(node.isBone){
   const name=norm(node.name);
   if(!bonesByName.has(name))bonesByName.set(name,node);
  }
  if(node.isSkinnedMesh)skinMeshes.push(node);
 });
 if(!skinMeshes.length)errors.push('no-skinned-geometry');
 const bindings={};
 for(const key of SLOTS){
  const expected=pkg.bones[key];
  const matched=typeof expected==='string'?bonesByName.get(norm(expected)):null;
  if(!matched||!included(scene,matched))errors.push('missing-anchor:'+key);
  else bindings[key]=matched;
 }
 if(Object.keys(bindings).length===SLOTS.length&&
  new Set(Object.values(bindings)).size!==SLOTS.length)
  errors.push('shared-anatomical-anchors');
 const ownedBones=new Set();
 scene.traverse(node=>{if(node.isBone)ownedBones.add(node);});
 for(const mesh of skinMeshes){
  const skeleton=mesh.skeleton,boneList=skeleton?.bones;
  if(!Array.isArray(boneList)||!boneList.length||
   boneList.some(b=>!ownedBones.has(b)))errors.push('detached-skinned-skeleton');
  const geo=mesh.geometry,indices=geo?.getAttribute?.('skinIndex'),
   weights=geo?.getAttribute?.('skinWeight'),pos=geo?.getAttribute?.('position');
  if(!indices||!weights||!pos||indices.count!==pos.count||
   weights.count!==pos.count){
   errors.push('missing-skinning-attributes');continue;
  }
  let bad=false;
  const stride=Math.max(1,Math.floor(pos.count/128));
  for(let i=0;i<pos.count;i+=stride){
   let total=0;
   for(let k=0;k<4;k++){
    const weight=weights.getComponent(i,k),index=indices.getComponent(i,k);
    if(!number(weight)||weight<0||!Number.isInteger(index)||
     index<0||index>=(boneList?.length??0)){bad=true;break;}
    total+=weight;
   }
   if(bad||total<.98||total>1.02){bad=true;break;}
  }
  if(bad)errors.push('invalid-skinning-weights');
 }
 scene.updateWorldMatrix(true,true);
 const worldPoint=bone=>{
  const v=bone?.position?.clone?.();
  if(!v)return null;
  bone.getWorldPosition(v);
  return v;
 };
 if(bindings.head&&bindings.hips&&bindings.spine&&
    bindings.thighL&&bindings.thighR&&bindings.calfL&&bindings.calfR){
  const head=worldPoint(bindings.head),hips=worldPoint(bindings.hips),
   spine=worldPoint(bindings.spine);
  const calves=[worldPoint(bindings.calfL),worldPoint(bindings.calfR)];
  if(!head||!hips||!spine||calves.some(x=>!x)||
     ![head.y,hips.y,spine.y,...calves.map(x=>x.y)].every(number)||
     head.y<=spine.y+.10||spine.y<=hips.y+.05||
     calves.some(c=>c.y>=hips.y-.10)){
   errors.push('inverted-or-invalid-anatomical-height');
  }
 }
 const clipNames=[];
 for(const motion of MOTIONS){
  const assigned=pkg.motions?.[motion];
  const clip=Array.isArray(animations)?
   animations.find(c=>c?.name===assigned):null;
  if(!clip||!Array.isArray(clip.tracks)||clip.tracks.length===0){
   errors.push('missing-motion:'+motion);
   continue;
  }
  clipNames.push(assigned);
  // All exported game motions must address the actual bound skeleton, not
  // a loose editor dummy / foreign skeleton or an empty animation track.
  const assignedBoneNames=new Set(
   Object.values(bindings).map(b=>norm(b.name)));
  const usesRealBone=clip.tracks.some(track=>{
   const token=String(track?.name??'').split(/[.\[\]\/]/)[0];
   return assignedBoneNames.has(norm(token));
  });
  if(!usesRealBone)errors.push('unbound-motion:'+motion);
 }
 return {ready:errors.length===0,errors:[...new Set(errors)],
  skinnedMeshes:skinMeshes.length,
  bindings:Object.keys(bindings).length?bindings:null,
  sourceUnmodified:true,motionNames:clipNames};
}
