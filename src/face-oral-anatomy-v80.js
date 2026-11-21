import * as THREE from 'three';

/**
 * V80 local-space oral rig. The face owns a single, reusable oral cavity.
 * Each upper/lower arch follows the jaw aperture; the tongue moves with
 * the mandibular arch instead of being a painted rectangle or lip decal.
 * Geometry is only created once per editor model, never on an animation tick.
 */
export function createFaceOralAnatomy(face,{x=0,y=0,z=0,width=.12,height=.30,depth=.2}={}){
 if(!face?.add||!(width>0&&height>0&&depth>0))
  throw Error('Oral anatomy requires a 3D face and positive measurements');
 const root=new THREE.Group();
 root.name='V80_INTRAORAL_ANATOMY';
 root.position.set(x,y,z);
 root.visible=false;
 root.userData.anatomicalRig='maxillary-mandibular-arches-and-tongue';
 face.add(root);
 const enamel=new THREE.MeshPhysicalMaterial({
  color:0xece8db,roughness:.24,metalness:0,clearcoat:.35,
  clearcoatRoughness:.16,side:THREE.DoubleSide
 });
 const gum=new THREE.MeshStandardMaterial({
  color:0x94545d,roughness:.81,side:THREE.DoubleSide
 });
 const tongueMat=new THREE.MeshPhysicalMaterial({
  color:0xac626b,roughness:.48,metalness:0,clearcoat:.22,
  clearcoatRoughness:.3,side:THREE.DoubleSide
 });
 const grooveMat=new THREE.MeshStandardMaterial({color:0x88454e,roughness:.83});
 const sharedTooth=new THREE.SphereGeometry(1,12,10);
 const sharedGum=new THREE.SphereGeometry(1,16,10);
 const upper=new THREE.Group(),lower=new THREE.Group();
 upper.name='V80_UPPER_TEETH_ARCH';
 lower.name='V80_LOWER_TEETH_ARCH';
 root.add(upper,lower);
 const span=width*.84;
 const addArch=(parent,isUpper)=>{
  const gumRidge=new THREE.Mesh(sharedGum,gum);
  gumRidge.name=isUpper?'V80_UPPER_GINGIVA':'V80_LOWER_GINGIVA';
  gumRidge.scale.set(span*.51,height*.009,depth*.010);
  gumRidge.position.y=isUpper?height*.003:-height*.003;
  gumRidge.position.z=-depth*.004;
  parent.add(gumRidge);
  const count=12;
  for(let index=0;index<count;index++){
   const t=(index-(count-1)/2)/((count-1)/2);
   const axial=Math.abs(t);
   // Four incisors, two canines, premolars and first molars. Each
   // crown has its own tapered width/height, not one white solid bar.
   const isIncisor=axial<.37,isCanine=axial>=.37&&axial<.55;
   const toothWidth=span/count*(isIncisor?.88:isCanine?.75:.81);
   const toothHeight=height*(isIncisor?.012:isCanine?.014:.010);
   const tooth=new THREE.Mesh(sharedTooth,enamel);
   tooth.name=(isUpper?'V80_UPPER_TOOTH_':'V80_LOWER_TOOTH_')+
    String(index+1).padStart(2,'0');
   tooth.userData.colorRole='tooth';
   tooth.userData.toothClass=isIncisor?'incisor':isCanine?'canine':'premolar-molar';
   tooth.scale.set(toothWidth*.50,toothHeight,depth*(isIncisor?.007:.009));
   tooth.position.set(t*span*.50,
    (isUpper?-1:1)*height*.003,
    depth*(.006-.008*axial*axial));
   tooth.rotation.z=t*.10;
   parent.add(tooth);
  }
 };
 addArch(upper,true);addArch(lower,false);
 const tongue=new THREE.Group();
 tongue.name='V80_TONGUE_JAW_FOLLOW';
 const body=new THREE.Mesh(new THREE.SphereGeometry(1,22,14),tongueMat);
 body.name='V80_TONGUE_DORSUM';body.userData.colorRole='tongue';
 body.scale.set(width*.255,height*.018,depth*.028);
 body.position.z=depth*.012;tongue.add(body);
 const sulcus=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),grooveMat);
 sulcus.name='V80_TONGUE_MEDIAN_SULCUS';
 sulcus.scale.set(width*.012,height*.011,depth*.0025);
 sulcus.position.set(0,height*.002,depth*.039);
 tongue.add(sulcus);
 root.add(tongue);
 const update=({openness=0,jawDrop=openness,smile=0}={})=>{
  const open=THREE.MathUtils.clamp(Number(openness)||0,0,1);
  const jaw=THREE.MathUtils.clamp(Number(jawDrop)||0,0,1);
  const delta=height*.053*open;
  root.visible=open>.15;
  root.position.y=y-delta*.17;
  const dentalVisible=open>.24;
  upper.visible=dentalVisible;lower.visible=dentalVisible;
  tongue.visible=open>.42;
  upper.position.y=delta*.39;
  lower.position.y=-delta*.42-height*.004*jaw;
  // The lower arch hinges backward very slightly as it drops.
  lower.rotation.x=-jaw*.07;
  tongue.position.y=-delta*.28-height*.006*jaw;
  tongue.rotation.x=jaw*.13;
  const smileWidth=1+.10*Math.max(0,Number(smile)||0);
  upper.scale.x=smileWidth;lower.scale.x=smileWidth;
 };
 const dispose=()=>{
  root.removeFromParent();
  const geometries=new Set(),materials=new Set();
  root.traverse(o=>{
   if(!o.isMesh)return;
   geometries.add(o.geometry);
   for(const m of Array.isArray(o.material)?o.material:[o.material])
    materials.add(m);
  });
  geometries.forEach(g=>g.dispose());
  materials.forEach(m=>m.dispose());
 };
 return {root,upper,lower,tongue,update,dispose,
  report:Object.freeze({upperTeeth:12,lowerTeeth:12,
   tongueMeshCount:2,gingivae:2,mandibleFollowsJaw:true,
   geometryIndependentOfLipMakeup:true})};
}
