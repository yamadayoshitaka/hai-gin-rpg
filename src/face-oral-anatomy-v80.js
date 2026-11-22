import * as THREE from 'three';

/**
 * Anatomical V81 oral preview: a small dental arcade and a flattened,
 * floor-of-mouth tongue, not the old forward-facing vampire fangs/ball.
 *
 * 12 independent crowns per arch are kept for editable/exportable meshes.
 * Dental crowns point into the oral cavity, are short, and posterior teeth
 * recede in Z along an elliptical dental arc. Rest state is completely hidden.
 * Mouth aperture is determined by the lip rig, not by a static tooth plate.
 */
export function createFaceOralAnatomy(face,{x=0,y=0,z=0,width=.12,height=.30,depth=.2}={}){
 if(!face?.add||![width,height,depth].every(v=>Number.isFinite(v)&&v>0))
  throw Error('3D face and positive oral measurements required');
 const root=new THREE.Group();
 root.name='V80_INTRAORAL_ANATOMY';
 root.position.set(x,y,z);
 root.visible=false;
 root.userData.anatomicalRig='elliptical-dental-arcade-with-hinged-mandible-v81';
 face.add(root);

 const enamel=new THREE.MeshPhysicalMaterial({
  color:0xe3ded4,roughness:.27,metalness:0,clearcoat:.34,
   clearcoatRoughness:.17,ior:1.52
 });
 const gums=new THREE.MeshStandardMaterial({
  color:0x94636a,roughness:.67,metalness:0
 });
 const tongueMat=new THREE.MeshPhysicalMaterial({
  color:0xa65f66,roughness:.46,metalness:0,clearcoat:.28,
   clearcoatRoughness:.24
 });
 const midlineMat=new THREE.MeshStandardMaterial({
  color:0x8d4d56,roughness:.79
 });
 // A recessed three-dimensional oral vestibule visible only through the
 // actual head-mesh aperture. It is not a black panel over the face.
 const throatMat=new THREE.MeshStandardMaterial({
  color:0x432a30,roughness:.91,metalness:0,side:THREE.FrontSide
 });
 const throat=new THREE.Mesh(new THREE.SphereGeometry(1,36,20),throatMat);
 throat.name='V82_RECESSED_ORAL_VESTIBULE';
 throat.scale.set(width*.51,height*.049,depth*.085);
 throat.position.set(0,-height*.005,-depth*.066);
 throat.userData.v82BehindHeadAperture=true;
 root.add(throat);
 // The central incisors are broad, gently rounded enamel crowns rather
 // than spherical beads. All corners are bevelled in real mesh geometry,
 // and rear premolars keep the more bulbous molar anatomy.
 const roundedIncisor=new THREE.BoxGeometry(2,2,2,4,4,3);
 const crownPositions=roundedIncisor.getAttribute('position');
 const roundRadius=.25,inner=1-roundRadius;
 for(let i=0;i<crownPositions.count;i++){
  const x=crownPositions.getX(i),y=crownPositions.getY(i),z=crownPositions.getZ(i);
  const ox=THREE.MathUtils.clamp(x,-inner,inner);
  const oy=THREE.MathUtils.clamp(y,-inner,inner);
  const oz=THREE.MathUtils.clamp(z,-inner,inner);
  const dx=x-ox,dy=y-oy,dz=z-oz;
  const distance=Math.hypot(dx,dy,dz)||1;
  crownPositions.setXYZ(i,
   ox+dx/distance*roundRadius,oy+dy/distance*roundRadius,
   oz+dz/distance*roundRadius);
 }
 crownPositions.needsUpdate=true;
 roundedIncisor.computeVertexNormals();
 const roundedMolar=new THREE.SphereGeometry(1,20,14);
 const gumGeometry=new THREE.SphereGeometry(1,22,12);
 const upper=new THREE.Group(),lower=new THREE.Group();
 upper.name='V80_UPPER_TEETH_ARCH';
 lower.name='V80_LOWER_TEETH_ARCH';
 root.add(upper,lower);

 const arches=[];
 const addArch=(parent,isUpper)=>{
  const row=[];
  // The half-width includes the anterior teeth; lateral teeth wrap toward
  // the throat and should NOT form a white picket fence in frontal view.
  const spread=width*.42;
  const gingiva=new THREE.Mesh(gumGeometry,gums);
  gingiva.name=isUpper?'V80_UPPER_GINGIVA':'V80_LOWER_GINGIVA';
  gingiva.scale.set(width*.37,height*.0021,depth*.014);
  gingiva.position.set(0,isUpper?height*.003:-height*.003,-depth*.018);
  parent.add(gingiva);
  for(let i=0;i<12;i++){
   const t=(i-5.5)/5.5,axial=Math.abs(t);
   const incisor=axial<.39,canine=axial>=.39&&axial<.60;
   const family=incisor?'incisor':canine?'canine':'premolar-molar';
   const crown=new THREE.Mesh(incisor||canine?roundedIncisor:roundedMolar,enamel);
   crown.name=(isUpper?'V80_UPPER_TOOTH_':'V80_LOWER_TOOTH_')+
    String(i+1).padStart(2,'0');
   crown.userData.colorRole='tooth';
   crown.userData.toothClass=family;
   crown.userData.anatomicalCrown='rounded-short-v81';
    crown.userData.v90NaturalEnamelCrown=incisor?'rounded-box-incisor':
     canine?'rounded-canine':'rounded-molar';
   crown.userData.archParameter=t;
   // The flat, wide maxillary incisors must not look like needles.
   // Keep central teeth separated: the former crowns overlapped by ~30%,
   // making the enamel look like two large deformed blocks.
   const horizontal=width*(incisor?.037:canine?.034:.038);
   // A narrower mouth also needs narrower, SHORT dental crowns;
   // retaining old crown height creates fang-like teeth in V88.
   // Scale crown height to the real aperture; long vertical enamel blocks
   // previously protruded beyond the native rim as rabbit-like teeth.
   const vertical=Math.min(height*(incisor?.0038:canine?.0036:.0032),horizontal*.67);
   crown.scale.set(horizontal,vertical,depth*.0050);
   crown.position.set(t*spread,
    (isUpper?-1:1)*height*.0014,
    -depth*(.009+.045*axial*axial));
   crown.rotation.z=t*.055;
   parent.add(crown);row.push(crown);
  }
  return row;
 };
 arches.push(addArch(upper,true),addArch(lower,false));

 const tongue=new THREE.Group();
 tongue.name='V80_TONGUE_JAW_FOLLOW';
 const dorsum=new THREE.Mesh(new THREE.SphereGeometry(1,28,16),tongueMat);
 dorsum.name='V80_TONGUE_DORSUM';
 dorsum.userData.colorRole='tongue';
 dorsum.userData.anatomicalShape='low-flattened-tongue-body';
 // A horizontal dorsum inside the mandibular arch, NOT a pink floating ball.
 // The tongue narrows and flattens with the real oral aperture.
 dorsum.scale.set(width*.235,Math.min(height*.0053,width*.069),depth*.064);
 dorsum.position.set(0,-height*.016,-depth*.033);
 tongue.add(dorsum);
 const sulcus=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),midlineMat);
 sulcus.name='V80_TONGUE_MEDIAN_SULCUS';
 sulcus.scale.set(width*.007,height*.0012,depth*.021);
 sulcus.position.set(0,-height*.0107,-depth*.013);
 tongue.add(sulcus);
 root.add(tongue);

 const update=({openness=0,jawDrop=openness,smile=0}={})=>{
  const open=THREE.MathUtils.clamp(Number(openness)||0,0,1);
  const jaw=THREE.MathUtils.clamp(Number(jawDrop)||0,0,1);
  const smileLift=THREE.MathUtils.clamp(Number(smile)||0,0,1);
  const delta=height*.053*open;
  root.visible=open>.095;
  // The maxillary arch is rigid. Mandibular arch and tongue follow the
  // same hinge, with tiny recession during large open-jaw poses.
  upper.position.y=delta*.36+height*.002;
  lower.position.y=-delta*.52-height*.001;
  lower.position.z=-depth*.005*jaw;
  lower.rotation.x=-jaw*.09;
  upper.scale.x=1+smileLift*.095;lower.scale.x=1+smileLift*.095;
  tongue.position.y=-delta*.31;
  tongue.position.z=-depth*.008*jaw;
  tongue.rotation.x=jaw*.09;
  const teethVisible=open>.16;
  upper.visible=teethVisible;
  // Large laughs expose the upper arch, not two dangling rows of fangs.
  lower.visible=teethVisible&&open<.43;
  tongue.visible=open>.31;
  throat.visible=open>.08;
  // Lateral molars are inside the cheek, not visible through the lips.
  for(const row of arches)for(const tooth of row){
   const axial=Math.abs(tooth.userData.archParameter);
   tooth.visible=teethVisible&&axial<.79;
  }
 };
 const dispose=()=>{
  root.removeFromParent();
  const geos=new Set(),mats=new Set();
  root.traverse(o=>{
   if(!o.isMesh)return;
   geos.add(o.geometry);
   const items=Array.isArray(o.material)?o.material:[o.material];
   for(const mat of items)mats.add(mat);
  });
  geos.forEach(g=>g.dispose());
  mats.forEach(m=>m.dispose());
 };
 return {root,upper,lower,tongue,update,dispose,
  report:Object.freeze({
   upperTeeth:12,lowerTeeth:12,tongueMeshCount:2,gingivae:2,
   mandibleFollowsJaw:true,geometryIndependentOfLipMakeup:true,
   v81ShortBluntCrowns:true,v81RecessedDentalArcade:true,
   v92SeparatedIncisorCrowns:true,v92LaughLowerTeethOccluded:true,
   v81FlattenedTongue:true,v82CavityBehindFace:true
  })};
}
