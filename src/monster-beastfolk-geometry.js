/**
 * Animal-first beastfolk preview. The actual ORIGINAL animal cranium,
 * eyelids, muzzle, lower jaw, canines, ear/facial fur, original tail, and
 * all four original paws come from createMonsterModel(spec).
 *
 * Only the torso/shoulders/upper limbs are reassembled into an animated
 * biped, like a canonical character model. This is not a human head with
 * generic dog ears, nor an extra replacement GLB. The wolf original stays
 * separately selectable and unchanged.
 */
import * as THREE from 'three';
import {createMonsterModel,disposeMonsterSculpture}
 from './monster-geometry.js?v=4.5.18';
import {startMonsterAction,animateMonsterModel}
 from './monster-animation.js?v=4.5.18';
import {beastfolkRecipeFor,isBeastfolkPrototype}
 from './monster-beastfolk-manifest.js';

function createHumanlikeFrame(THREE,model,name,x=0,y=0,z=0,parent=model){
 const g=new THREE.Group();
 g.name='beastfolk-'+name;g.position.set(x,y,z);parent.add(g);
 return g;
}
export function createBeastfolkMonsterModel(spec,{detail='high'}={}){
 const recipe=beastfolkRecipeFor(spec);
 if(!recipe||!isBeastfolkPrototype(spec?.id))
  throw Error('This beastfolk prototype requires m001, m002 or m003');
 if(!['low','high','source'].includes(detail))throw Error('Unknown beastfolk LOD');

 // Create the original sculpt as a donor. It is the ONLY source of the
 // head (eyes, jaws, muzzle, ear and winter fur), tail and species paws.
 const animal=createMonsterModel(spec,{detail});
 const src=animal.userData.pivots||{};
 const head=src.head,jaw=src.jaw,tail=src.tail;
 if(!head||!jaw||!tail){
  disposeMonsterSculpture(animal);
  throw Error('Original canine skull/jaw/tail must exist');
 }
 const headAnchor=head.position.clone();
 const jawOffset=jaw.position.clone().sub(headAnchor);
 const donorGroups=[head,jaw,tail];
 for(const end of ['frontL','frontR','rearL','rearR']){
  const part=src['lower'+end];
  if(part)donorGroups.push(part);
 }
 // Materials on transplanted source parts remain ref-counted and alive.
 // Remove them from the quadruped first, then dispose only UNUSED body.
 for(const donor of donorGroups)donor.removeFromParent();
 const sourceFaceControls=animal.userData.facialControls??null;
 disposeMonsterSculpture(animal);

 const root=new THREE.Group();
 root.name='beastfolk-original-'+spec.id;
 root.userData.beastfolkSource=spec.id;
 root.userData.beastfolkRecipe=recipe;
 root.userData.detail=detail;
 root.userData.speciesId=spec.id;
 root.userData.surfaceFamily=spec.family;
 root.userData.homeScale=1;
 root.userData.facialControls=sourceFaceControls;
 const pivots={};
 const meshes=[],materials=[],geometries=[];
 const low=detail==='low',segs=low?10:detail==='high'?18:28;
 const material=(color,rough=.84,metal=0)=>{
  const m=new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal,
    side:THREE.DoubleSide});materials.push(m);return m;
 };
 // Body fur derives from the same animal's natural palette. No smooth,
 // uncovered flesh: paws and muzzle come from the original source model.
 const fur=material(recipe.coat),ruff=material(recipe.ruff);
 const cloth=material(recipe.cloth,.88),plate=material(recipe.armor,.52,.36);
 const dark=material(0x302e2e,.92),claw=material(0xc9c4b3,.68);
 const add=(parent,geo,mat,name,position=[0,0,0],rotation=null)=>{
  const mesh=new THREE.Mesh(geo,mat);
  mesh.name='beastfolk-'+spec.id+'-'+name;
  mesh.position.set(...position);
  if(rotation)mesh.rotation.set(...rotation);
  mesh.castShadow=true;mesh.receiveShadow=true;
  parent.add(mesh);meshes.push(mesh);geometries.push(geo);
  return mesh;
 };
 const sphere=(frame,mat,name,xyz,dim)=>{
  const geom=new THREE.SphereGeometry(1,segs,low?9:15);
  const m=add(frame,geom,mat,name,xyz);m.scale.set(...dim);return m;
 };
 const cylinder=(frame,mat,name,xyz,top,bottom,length)=>{
  const geo=new THREE.CylinderGeometry(top,bottom,length,segs,low?1:3);
  return add(frame,geo,mat,name,xyz);
 };
 const spike=(frame,mat,name,xyz,length,radius,rotateX=0)=>{
  const geo=new THREE.ConeGeometry(radius,length,low?5:9,2);
  return add(frame,geo,mat,name,xyz,[rotateX,0,0]);
 };
 const b=recipe.bodyBulk,leg=recipe.legLength;
 const torso=createHumanlikeFrame(THREE,root,'torso',0,1.57,0);
 pivots.torso=torso;
 sphere(torso,fur,'ribcage',[0,.055,0],[.41*b,.47,.275*b]);
 sphere(torso,ruff,'cervical-ruff',[0,.45,-.005],[.33*b,.16,.29*b]);
 sphere(torso,fur,'abdomen',[0,-.32,0],[.34*b,.33,.245*b]);
 const pelvis=createHumanlikeFrame(THREE,root,'pelvis',0,1.04,0);
 pivots.pelvis=pelvis;
 sphere(pelvis,fur,'hips',[0,0,-.005],[.335*b,.245,.27*b]);
 // Species-fitted lightweight vest over the source animal pelt. The face,
 // throat, forearms, hands and lower legs remain clearly furred.
 for(const side of [-1,1]){
  const vest=sphere(torso,cloth,'vest-panel-'+side,[side*.195*b,.09,.248*b],
    [.18*b,.36,.085]);vest.rotation.z=side*.07;
  sphere(torso,plate,'vest-shoulder-binding-'+side,
   [side*.345*b,.32,.205*b],[.075,.18,.075]);
 }
 const waist=add(torso,new THREE.TorusGeometry(.302*b,.022,low?6:9,segs),
  dark,'waist-belt',[0,-.42,0],[Math.PI*.5,0,0]);
 waist.scale.y=.81;
 sphere(torso,plate,'belt-buckle',[0,-.42,.264*b],[.072,.065,.035]);
 for(const side of [-1,1]){
  // Separate shoulder, elbow, wrist, hip, knee and hock articulations.
  // Upper arms/legs rotate on walking; hands and source claws follow.
  const label=side<0?'L':'R',x=side*.46*b;
  const upper=createHumanlikeFrame(THREE,root,'arm'+label,x,1.84,0);
  pivots['arm'+label]=upper;
  sphere(upper,fur,'shoulder-'+label,[0,-.06,0],[.175*b,.185,.19]);
  cylinder(upper,fur,'upper-arm-'+label,[0,-.265,0],.145*b,.115,.42);
  const fore=createHumanlikeFrame(THREE,root,'forearm'+label,0,-.46,.035,upper);
  pivots['lowerArm'+label]=fore;
  cylinder(fore,fur,'forearm-'+label,[0,-.22,0],.116,.09,.39);
  sphere(fore,ruff,'wrist-fur-'+label,[0,-.405,0],[.13,.10,.14]);
  const palm=createHumanlikeFrame(THREE,root,'hand'+label,0,-.45,.10,fore);
  const donorPaw=src['lowerfront'+label];
  if(donorPaw){
    donorPaw.position.set(0,0,0);donorPaw.rotation.set(0,0,0);
    donorPaw.scale.setScalar(.55);
    donorPaw.userData.originalCaninePaw=true;
    palm.add(donorPaw);
    pivots['lowerfront'+label]=donorPaw;
  }else{
    sphere(palm,fur,'hand-'+label,[0,0,0],[.14,.13,.16]);
    for(let i=0;i<4;i++)
      spike(palm,claw,'hand-claw-'+label+'-'+i,
       [(i-1.5)*.068,-.10,.19],.075,.017,Math.PI*.48);
  }
  const hip=createHumanlikeFrame(THREE,root,'leg'+label,side*.22*b,1.025,0);
  pivots['leg'+label]=hip;
  sphere(hip,fur,'thigh-'+label,[0,-.215,0],[.205*b,.36*leg,.215]);
  const knee=createHumanlikeFrame(THREE,root,'knee'+label,0,-.50,.045,hip);
  pivots['lowerLeg'+label]=knee;
  sphere(knee,ruff,'kneecap-'+label,[0,.055,.045],[.135,.13,.145]);
  cylinder(knee,fur,'shin-'+label,[0,-.22,-.015],.132,.09,.43*leg);
  const foot=createHumanlikeFrame(THREE,root,'foot'+label,0,-.43,.13,knee);
  sphere(foot,fur,'hock-'+label,[0,0,0],[.15,.115,.20]);
  const rearPaw=src['lowerrear'+label];
  if(rearPaw){
    rearPaw.position.set(0,.07,.12);rearPaw.rotation.set(0,0,0);
    rearPaw.scale.setScalar(.55);
    rearPaw.userData.originalCaninePaw=true;
    foot.add(rearPaw);
    pivots['lowerrear'+label]=rearPaw;
  }
  for(let i=0;i<4;i++){
    sphere(foot,fur,'toe-'+label+'-'+i,
      [(i-1.5)*.074,-.045,.28],[.045,.051,.088]);
    spike(foot,claw,'toe-claw-'+label+'-'+i,
      [(i-1.5)*.074,-.065,.36],.065,.017,Math.PI*.48);
  }
  // Two protective shoulder plates follow the animated upper arm.
  sphere(upper,plate,'shoulder-pad-'+label,
    [side*.025,-.045,-.015],[.19*b,.13,.20]);
 }
 // Mount the ACTUAL animal head, jaw, ears, and fur on the new spine.
 // Preserve their precise old relative offsets (the muzzle must meet jaw).
 const neck=createHumanlikeFrame(THREE,root,'neck',0,2.17,.055);
 neck.scale.setScalar(recipe.headScale);
 head.position.set(0,0,0);
 jaw.position.copy(jawOffset);
 neck.add(head,jaw);
 head.userData.originalCanineHead=true;
 jaw.userData.originalCanineJaw=true;
 pivots.head=neck;
 pivots.jaw=jaw;
 // Keep original source eyelids along with the animal face.
 for(const [key,part] of Object.entries(src))
  if(key.startsWith('eyelid')&&part&&part.parent)pivots[key]=part;
 const rear=createHumanlikeFrame(THREE,root,'tail-root',0,1.25,-.26);
 tail.position.set(0,0,0);tail.rotation.set(0,0,0);
 tail.scale.setScalar(.86);
 tail.userData.originalCanineTail=true;
 rear.add(tail);pivots.tail=tail;
 root.userData.pivots=pivots;
 root.userData.beastfolkOriginalParts=Object.freeze({
  head:true,jaw:true,tail:true,sourcePaws:donorGroups.length-3
 });
 root.userData.beastfolkOwnedMeshes=meshes;
 root.userData.beastfolkOwnedGeometries=geometries;
 root.userData.beastfolkOwnedMaterials=materials;
 root.updateMatrixWorld(true);
 startMonsterAction(root,'idle',0);
 return root;
}
export function disposeBeastfolkMonsterModel(root){
 if(!root)return;
 for(const geometry of root.userData.beastfolkOwnedGeometries||[])
  geometry.dispose();
 for(const mat of root.userData.beastfolkOwnedMaterials||[])mat.dispose();
 // release source wolf's original jaw/head/fur/claw photo resources via
 // the existing monster cache refcount; no shared bestiary GLB is edited.
 disposeMonsterSculpture(root);
}
export {startMonsterAction,animateMonsterModel};
