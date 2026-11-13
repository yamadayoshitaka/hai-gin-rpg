/** v49: identity-defining real 3D haircut structure.
 * Existing root-scattered cards remain underneath; the styled sections
 * follow HEAD-LOCAL coordinates and are baked into the studio's one-mesh
 * consolidation. No mesh is a billboard or a floating name-only swatch.
 */
import * as THREE from 'three';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const colors=[1,.91,.82];
function fiberMaterial(color,shade=1){
 return new THREE.MeshPhysicalMaterial({
  color:new THREE.Color(color).multiplyScalar(shade),
  roughness:.51,metalness:0,clearcoat:.08,clearcoatRoughness:.38,
  side:THREE.DoubleSide
 });
}
function tube(label,points,radius,material,steps=54){
 const curve=new THREE.CatmullRomCurve3(points);
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,steps,radius,7,false),
  material);
 mesh.name=label;mesh.userData.styledHairGeometry=true;
 return mesh;
}
function ellipsoid(label,center,size,material){
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,22,14),material);
 mesh.name=label;mesh.scale.set(size.x,size.y,size.z);
 // Transform ellipsoids into head-local, explicit vertex coordinates
 // BEFORE hair mesh consolidation.
 mesh.geometry.scale(size.x,size.y,size.z);
 mesh.scale.set(1,1,1);mesh.position.copy(center);
 mesh.geometry.translate(center.x,center.y,center.z);
 mesh.position.set(0,0,0);
 mesh.userData.styledHairGeometry=true;
 return mesh;
}
function braid(side,box,material){
 const d=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 const x=c.x+side*d.x*.39,z=c.z+d.z*.07;
 const y0=box.min.y+d.y*.72,drop=d.y*.49;
 const strands=[];
 for(let lane=0;lane<3;lane++){
  const vertices=[];
  for(let i=0;i<=48;i++){
   const t=i/48,phase=t*Math.PI*12+lane*Math.PI*2/3;
   const taper=1-.71*t;
   const radius=d.x*.036*taper;
   vertices.push(V(
    x+side*d.x*.12*t+radius*Math.cos(phase),
    y0-drop*t,
    z+d.z*.035*Math.sin(t*Math.PI)+radius*Math.sin(phase)
   ));
  }
  strands.push(tube('BRAID_INTERLEAVED_STRAND_'+side+'_'+lane,
   vertices,d.x*.016,material,62));
 }
 // A tied band finishes each plait; no separate gravity-simulated string.
 const band=tube('BRAID_TIE_'+side,Array.from({length:13},(_,i)=>{
  const angle=2*Math.PI*i/12;
  return V(x+side*d.x*.12+d.x*.025*Math.cos(angle),
   y0-drop*.96,z+d.x*.025*Math.sin(angle));
 }),d.x*.006,fiberMaterial(material.color,.56),20);
 return [...strands,band];
}
function bun(box,material){
 const d=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 const center=V(c.x,box.min.y+d.y*.755,box.min.z-d.z*.08);
 const nodes=[ellipsoid('LOW_BUN_TIED_VOLUME',center,
  V(d.x*.174,d.y*.117,d.z*.18),material)];
 for(let i=0;i<3;i++){
  const points=[];
  for(let j=0;j<=68;j++){
   const t=j/68,theta=2*Math.PI*t;
   const r=d.x*(.10+i*.025)*(1+.06*Math.sin(theta*5));
   points.push(V(center.x+r*Math.cos(theta),
    center.y+r*.68*Math.sin(theta),
    center.z-d.z*(.034+i*.008)));
  }
  nodes.push(tube('LOW_BUN_COILED_STRANDS_'+i,points,
   d.x*.014,fiberMaterial(material.color,.90-i*.06),70));
 }
 return nodes;
}
function ponytail(box,material,side=1,half=false){
 const d=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 const origin=V(c.x+side*d.x*(side===0?0:.31),
  box.min.y+d.y*(half?.78:.74),box.min.z-d.z*.078);
 const nodes=[ellipsoid('PONYTAIL_TIED_ROOT',origin,
  V(d.x*.065,d.y*.033,d.z*.045),fiberMaterial(material.color,.75))];
 for(let k=0;k<7;k++){
  const angle=(k/7)*Math.PI*2,
    len=half?.36:.54;
  const radius=d.x*(.031+.01*Math.sin(k*2));
  const pts=[
   origin.clone().add(V(radius*Math.cos(angle),d.y*.010,radius*Math.sin(angle))),
   origin.clone().add(V(side*d.x*.035+radius*Math.cos(angle),-d.y*.12,-d.z*.065)),
   origin.clone().add(V(side*d.x*.12+radius*Math.cos(angle)*.85,-d.y*len*.68,-d.z*.035)),
   origin.clone().add(V(side*d.x*.15+radius*Math.cos(angle)*.40,-d.y*len,-d.z*.018))
  ];
  nodes.push(tube('PONYTAIL_FALLING_LOCK_'+k,pts,
   d.x*.022,fiberMaterial(material.color,.9+(k%3)*.045),38));
 }
 return nodes;
}
export function makeStyleSpecificHair(styleId,box,hairColor){
 const mat=fiberMaterial(hairColor,.94);
 let type='none',meshes=[];
 if(styleId==='female-low-bun'){
  type='coiled-low-bun';meshes=bun(box,mat);
 }else if(styleId==='female-twin-braids'){
  type='two-interwoven-plaits';meshes=[...braid(-1,box,mat),...braid(1,box,mat)];
 }else if(styleId==='female-side-ponytail'){
  type='side-ponytail';meshes=ponytail(box,mat,-1);
 }else if(styleId==='female-half-up'){
  type='half-up';meshes=ponytail(box,mat,0,true);
 }else if(styleId==='male-long-tied'){
  type='low-tied-men';meshes=ponytail(box,mat,0,false);
 }
 for(const m of meshes){
  m.userData.hairStyleId=styleId;
  m.userData.styledHairType=type;
  m.userData.salonRootAnchored=true;
 }
 return {type,meshes,triangleCount:meshes.reduce((n,m)=>n+(m.geometry.index?.count||0)/3,0)};
}
