/**
 * Subtractive, species-instance-only head geometry under the fitted wig.
 *
 * The female actor carries a real skinned head AND a separate wig base. Adding
 * fibre ribbons cannot fix the scalp/helmet intersection: concealed cranium
 * triangles must not render. Work only on cloned mesh geometries and retain
 * the ORIGINAL shared GLB buffers, skeleton, morphs, materials and face.
 *
 * A triangle is culled ONLY when all 3 skinned vertices:
 *  - belong substantially to the actual Head bone
 *  - sit inside the crown hemisphere (or dragon scalp armour)
 *  - are above the face/ear/hairline exclusion plane.
 * Partly covered triangles remain, preventing facial holes or cut ears.
 */
import * as THREE from 'three';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const forbidden=/(?:hair|wig|helmet|headgear|hat|eyebrow|eyelash|iris|cornea|eye|teeth|mouth|tongue)/i;

/** Returns a reversible local-geometry cut; never changes global donor assets. */
export function cutFemaleSummonScalpUnderCover({
 model,headBone,groomFrame,scalp,kind='wig'
}={}){
 if(!model||!headBone?.isBone||!groomFrame||
  groomFrame.parent!==headBone||!scalp?.fitted||
  !['wig','scales'].includes(kind))return null;
 const {center,radius}=scalp;
 if(!Array.isArray(center)||!Array.isArray(radius)||
  [...center,...radius].some(x=>!Number.isFinite(x))||
  radius.some(x=>x<=0))return null;
 model.updateMatrixWorld(true,true);
 groomFrame.updateWorldMatrix(true,false);
 const inverse=groomFrame.matrixWorld.clone().invert();
 const [cx,cy,cz]=center,[rx,ry,rz]=radius;
 const cuts=[],scratch=new THREE.Vector3();
 let removedTriangles=0,preservedTriangles=0;
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.skeleton||!mesh.geometry||
   forbidden.test(mesh.name))return;
  for(let ancestor=mesh;ancestor;ancestor=ancestor.parent){
   if(ancestor.visible===false)return;
   if(ancestor===model)break;
  }
  const source=mesh.geometry,pos=source.getAttribute('position'),
   bi=source.getAttribute('skinIndex'),bw=source.getAttribute('skinWeight');
  if(!pos||!bi||!bw)return;
  const headIndex=mesh.skeleton.bones.findIndex(b=>b===headBone);
  if(headIndex<0)return;
  const index=source.getIndex(),total=index?.count??pos.count;
  if(total<24||total%3!==0)return;
  const cache=new Map();
  function isCovered(i){
   if(cache.has(i))return cache.get(i);
   let w=0;
   for(let slot=0;slot<4;slot++){
    if(bi.getComponent(i,slot)===headIndex)w+=bw.getComponent(i,slot);
   }
   if(w<.73){cache.set(i,false);return false;}
   mesh.getVertexPosition(i,scratch);
   scratch.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
   const dx=(scratch.x-cx)/rx,dy=(scratch.y-cy)/ry,
    dz=(scratch.z-cz)/rz;
   const dist=Math.hypot(dx,dy,dz);
   const phi=Math.atan2(dz,dx),front=Math.max(0,Math.sin(phi));
   const theta=Math.acos(clamp(dy,-1,1));
   // Safety margin under the wig edge: front/temple facial skin survives.
   const hairline=1.68-.34*front;
   const maxTheta=kind==='wig'?hairline-.19:Math.min(1.36,hairline-.27);
   const safeForehead=dz>.50&&dy<.66;
   const cover=Number.isFinite(dist)&&dist>.57&&dist<1.52&&
    theta<maxTheta&&dy>.13&&!safeForehead;
   cache.set(i,cover);return cover;
  }
  // Preserve Three.js multi-material groups and their original assignments.
  // Merely replacing the index without reindexing groups recolours the head.
  const groups=source.groups.length?source.groups:
   [{start:0,count:total,materialIndex:0}];
  const output=[],newGroups=[];
  let removed=0,kept=0;
  for(const group of groups){
   const start=output.length,end=Math.min(total,group.start+group.count);
   for(let t=group.start;t+2<end;t+=3){
    const a=index?index.getX(t):t,
     bb=index?index.getX(t+1):t+1,
     c=index?index.getX(t+2):t+2;
    if(isCovered(a)&&isCovered(bb)&&isCovered(c)){removed++;continue;}
    output.push(a,bb,c);kept++;
   }
   if(output.length>start)newGroups.push({
    start,count:output.length-start,materialIndex:group.materialIndex
   });
  }
  // Guard against unstable rig weights or a wrongly selected body.
  // A whole facial mesh should NEVER disappear.
  if(removed<8||kept<8||removed/(removed+kept)>.72)return;
  const geometry=source.clone();
  geometry.setIndex(output);
  geometry.clearGroups();
  for(const group of newGroups)geometry.addGroup(
   group.start,group.count,group.materialIndex);
  geometry.setDrawRange(0,output.length);
  geometry.userData={...geometry.userData,
   femaleSummonScalpCut:true,cutKind:kind,
   removedCraniumTriangles:removed,preservedFacialTriangles:kept};
  mesh.geometry=geometry;
  cuts.push({mesh,original:source,geometry});
  removedTriangles+=removed;preservedTriangles+=kept;
 });
 if(!cuts.length)return null;
 let disposed=false;
 return {kind,meshCount:cuts.length,removedTriangles,preservedTriangles,
  sourcePreserved:true,
  dispose(){
   if(disposed)return;
   disposed=true;
   for(const {mesh,original,geometry} of cuts){
    if(mesh.geometry===geometry)mesh.geometry=original;
    geometry.dispose();
   }
  }
 };
}
