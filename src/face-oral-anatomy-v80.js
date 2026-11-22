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
  color:0xdedbd1,roughness:.30,metalness:0,clearcoat:.18,
  clearcoatRoughness:.27
 });
 const gums=new THREE.MeshStandardMaterial({
  color:0x87525a,roughness:.80,metalness:0
 });
 const tongueMat=new THREE.MeshPhysicalMaterial({
  color:0x9b5760,roughness:.59,metalness:0,clearcoat:.12,
  clearcoatRoughness:.39
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
 const crownGeometry=new THREE.SphereGeometry(1,14,10);
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
   const crown=new THREE.Mesh(crownGeometry,enamel);
   crown.name=(isUpper?'V80_UPPER_TOOTH_':'V80_LOWER_TOOTH_')+
    String(i+1).padStart(2,'0');
   crown.userData.colorRole='tooth';
   crown.userData.toothClass=family;
   crown.userData.anatomicalCrown='rounded-short-v81';
   crown.userData.archParameter=t;
   // The flat, wide maxillary incisors must not look like needles.
   const horizontal=width*(incisor?.054:canine?.049:.051);
   // A narrower mouth also needs narrower, SHORT dental crowns;
   // retaining old crown height creates fang-like teeth in V88.
   const vertical=Math.min(height*(incisor?.0050:canine?.0054:.0042),horizontal*.87);
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
  upper.visible=teethVisible;lower.visible=teethVisible;
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
   v81FlattenedTongue:true,v82CavityBehindFace:true
  })};
}
