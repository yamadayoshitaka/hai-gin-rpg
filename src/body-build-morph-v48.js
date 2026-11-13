/** v48: Preview-only proportional abdomen/waist deformation on REAL skinned body.
 * We always copy from original bind-pose geometry; toggling normal/fat/thin
 * can never accumulate distortion and NEVER edits the shared source GLB.
 */
import {resolveBodyType} from './character-demographics-v47.js?v=48';
const ORIGINAL=new WeakMap();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gaussian=(x,c,w)=>Math.exp(-Math.pow((x-c)/w,2));
export function applySkinnedBuildMorph(actorRoot,bodyType='normal'){
 const body=resolveBodyType(bodyType);
 if(!actorRoot?.traverse)return Object.freeze({bodyType:body.id,meshes:0,vertices:0});
 let meshes=0,vertices=0;
 actorRoot.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.geometry?.getAttribute('position'))return;
  // Never deform the head/eyes, hair, rigid equipment, or magic effects.
  if(/head|face|eye|lash|hair|helmet|shield|sword|blade|staff|weapon|vfx/i.test(mesh.name))return;
  const position=mesh.geometry.getAttribute('position');
  if(position.count<150)return;
  let source=ORIGINAL.get(mesh);
  if(!source){
   const geometry=mesh.geometry.clone();
   mesh.geometry=geometry;
   geometry.computeBoundingBox();
   source={original:position.array.slice(),box:geometry.boundingBox.clone()};
   ORIGINAL.set(mesh,source);
  }
  const target=mesh.geometry.getAttribute('position');
  const box=source.box;
  const h=Math.max(.000001,box.max.y-box.min.y),
   w=Math.max(.000001,box.max.x-box.min.x),
   depth=Math.max(.000001,box.max.z-box.min.z);
  const cx=(box.max.x+box.min.x)/2,cz=(box.max.z+box.min.z)/2;
  // Body-only morph: broader waist and outward abdominal curvature,
  // not a second visible ball/sphere added on top of the shirt.
  for(let i=0;i<target.count;i++){
   const x=source.original[i*3],y=source.original[i*3+1],z=source.original[i*3+2];
   const ny=clamp((y-box.min.y)/h,0,1);
   const waist=gaussian(ny,.51,.25),belly=gaussian(ny,.45,.19);
   const circumference=1+body.abdomen*(.19*waist+.115*belly);
   const front=Math.max(0,(z-cz)/depth);
   target.setXYZ(i,cx+(x-cx)*circumference,y,
    cz+(z-cz)*(1+body.abdomen*.15*belly)+depth*body.abdomen*.07*belly*front);
  }
  target.needsUpdate=true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingBox();
  mesh.geometry.computeBoundingSphere();
  meshes++;vertices+=target.count;
 });
 return Object.freeze({bodyType:body.id,meshes,vertices,
  geometryFromSource:true,accumulative:false,bellyMorph:body.abdomen});
}
