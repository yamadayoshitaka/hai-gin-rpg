/**
 * Age detail is part of the OWNED face surface, never a detached
 * billboard/crease strip. The master already sculpts broad sag/age folds;
 * these sub-millimetre ridges add the final skin relief in local geometry.
 * Independent wrinkle cards used a frontmost-Z fallback and floated at
 * eye/mouth openings, especially after an expression changed the face.
 */
import * as THREE from 'three';
import {resolveAgeBand} from './character-demographics-v47.js?v=80-nine-age-bands';
const bell=(x,center,width)=>Math.exp(-.5*((x-center)/width)**2);
export function attachAgeDetails(face,ageBand='twenties'){
 if(!face?.isMesh||!face.geometry?.getAttribute('position'))
  return {count:0,vertices:0,intensity:0,surfaceIntegrated:false};
 const age=resolveAgeBand(ageBand),strength=age.wrinkles;
 if(strength<.10){
  face.userData.v49AgeDetails={ageBand:age.id,strength,
   count:0,vertices:0,surfaceIntegrated:true,detachedMeshCount:0};
  return {...face.userData.v49AgeDetails,intensity:strength};
 }
 const geometry=face.geometry,position=geometry.getAttribute('position');
 geometry.computeBoundingBox();
 const box=geometry.boundingBox;
 const size=box.getSize(new THREE.Vector3());
 const width=Math.max(1e-8,size.x),height=Math.max(1e-8,size.y);
 const depth=Math.max(1e-8,size.z),center=(box.min.x+box.max.x)*.5;
 let affected=0,maxOffset=0;
 for(let i=0;i<position.count;i++){
  const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
  const nx=Math.abs((x-center)/(width*.5));
  const ny=(y-box.min.y)/height;
  const nz=(z-box.min.z)/depth;
  // Back skull, neck, inner eye sockets and open-mouth voids never
  // receive age creases. A continuous field cannot detach or float.
  const front=THREE.MathUtils.smoothstep(nz,.53,.75);
  const forehead=[.758,.794,.825].reduce((sum,at,index)=>
   sum+bell(ny,at,.009)*(0.58+index*.12),0)*
   bell(nx,.23,.35);
  const crow=bell(nx,.40,.080)*bell(ny,.676,.065)*
   (0.65+0.35*Math.cos((ny-.682)*90));
  const nasolabial=bell(nx,.17+.065*(.60-ny),.056)*
   bell(ny,.51,.079);
  const mouthCorner=bell(nx,.15,.045)*bell(ny,.468,.045);
  const fold=forehead*.70+crow*.40+nasolabial*.95+
   mouthCorner*.31;
  const displacement=-depth*strength*.0072*front*fold;
  if(Math.abs(displacement)<1e-8)continue;
  position.setZ(i,z+displacement);
  affected++;maxOffset=Math.max(maxOffset,Math.abs(displacement));
 }
 if(affected){
  position.needsUpdate=true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
 }
 const count=age.id==='forties'?6:age.id==='fifties'?9:age.id==='sixties'?12:15;
 face.userData.v49AgeDetails={
  ageBand:age.id,strength,count,vertices:affected,
  source:'actual-sculpted-face',surfaceIntegrated:true,
  detachedMeshCount:0,maximumDisplacement:maxOffset,
  v76RealSkinToneWrinkles:true,noDarkAppliedLines:true,
  youngFaceProtected:true
 };
 return {...face.userData.v49AgeDetails,intensity:strength};
}
