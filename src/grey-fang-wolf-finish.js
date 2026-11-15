/**
 * Non-destructive grey-wolf monster finish layered on the real CC BY wolf GLB.
 * Preserve textured geometry, native skeleton, UVs and all source animations.
 * The overlay is small and instance-local, never modifies the source GLB.
 */
import * as THREE from 'three';

const FORM={
 m001:{name:'Grey Fang Wolf King',iris:0xffab51,mark:0xd98d59,
  hair:[0x555b61,0x353d45,0x85888b],tufts:46,teeth:1.18,glow:0.58},
 summon_m001:{name:'Summoned Grey Fang Wolf King',iris:0x8fdfff,
  mark:0x89bacc,hair:[0x646e7c,0x3b4a57,0x9eabb1],tufts:35,teeth:1.10,glow:0.74},
 wolf:{name:'Summon Wolf',iris:0x80c9ed,mark:0x71899e,
  hair:[0x68717b,0x404a53,0x8b9399],tufts:22,teeth:1.06,glow:0.35}
};
const temp=new THREE.Vector3();
const normalized=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function anchorBone(root,pattern){
 const bones=[];root.traverse(o=>{if(o.isBone&&pattern.test(normalized(o.name)))bones.push(o);});
 return bones[0]||null;
}
function localOf(root,node){
 if(!node)return null;
 root.updateMatrixWorld(true);
 node.getWorldPosition(temp);return root.worldToLocal(temp.clone());
}
function attach(root,mesh,point,bone){
 root.add(mesh);mesh.position.copy(point);
 root.updateMatrixWorld(true);
 if(bone){bone.updateWorldMatrix(true,false);bone.attach(mesh);}
 mesh.castShadow=false;mesh.receiveShadow=false;
 return mesh;
}
function shaftBetween(a,b,r1,r2,mat){
 const dir=new THREE.Vector3().subVectors(b,a),length=dir.length();
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r2,r1,length,6,1),mat);
 mesh.position.copy(a).addScaledVector(dir,.5);
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
 return mesh;
}
function seed01(i){const x=Math.sin(i*91.139+13.21)*43758.5453;return x-Math.floor(x);}
function setSourceCoat(root,form){
 const seen=new Map();
 root.traverse(node=>{
  if(!node.isMesh||!node.material)return;
  const recolor=material=>{
   if(!material?.color||material.transparent)return material;
   const n=normalized(node.name+' '+material.name);
   if(/eye|pupil|iris|teeth|tongue|nose|mouth|claw/.test(n))return material;
   if(seen.has(material))return seen.get(material);
   const copy=material.clone();
   // Preserve the artist's bitmap, normals and UVs; modest muted cold-grey tint.
   copy.color.multiplyScalar(form==='m001'?.88:form==='summon_m001'?.97:.95);
   copy.roughness=Math.min(.98,Math.max(.80,copy.roughness??.9));
   copy.userData={...copy.userData,greyFangWolfFinish:true};
   seen.set(material,copy);return copy;
  };
  node.material=Array.isArray(node.material)?node.material.map(recolor):recolor(node.material);
 });
}
export function applyGreyFangWolfFinish(handle,{creatureId='m001'}={}){
 const root=handle?.root,settings=FORM[creatureId];
 if(!root||!settings||root.userData?.greyFangWolfFinish)return handle;
 root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root);
 if(bounds.isEmpty())return handle;
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const H=Math.max(.2,size.y),depth=Math.max(size.x,size.z);
 // Only explicit canid anatomy is decorated. Other r-wolf previews remain intact.
 const headBone=anchorBone(root,/head|skull/);
 const neckBone=anchorBone(root,/neck|chest|spine0?2/);
 const headBoneCenter=localOf(root,headBone);
 const neckBoneCenter=localOf(root,neckBone);
 const forward=new THREE.Vector3(0,0,1);
 if(headBoneCenter&&neckBoneCenter){
  forward.subVectors(headBoneCenter,neckBoneCenter).setY(0);
  if(forward.lengthSq()<.004)forward.set(0,0,1);
  forward.normalize();
 }else if(size.x>size.z*1.20)forward.set(1,0,0);
 const sideways=new THREE.Vector3(forward.z,0,-forward.x).normalize();
 const head=headBoneCenter||center.clone().addScaledVector(forward,depth*.32)
  .add(new THREE.Vector3(0,H*.19,0));
 const shoulder=neckBoneCenter||center.clone().addScaledVector(forward,depth*.10)
  .add(new THREE.Vector3(0,H*.08,0));
 const step=(v,f,l,y=0)=>v.clone().addScaledVector(forward,f)
  .addScaledVector(sideways,l).add(new THREE.Vector3(0,y,0));
 const overlay=new THREE.Group();overlay.name='grey-fang-wolf-finish-'+creatureId;
 root.add(overlay);
 const maneMats=settings.hair.map(color=>new THREE.MeshStandardMaterial({
  color,roughness:.99,metalness:0,side:THREE.DoubleSide
 }));
 const teethMat=new THREE.MeshStandardMaterial({color:0xcfc9b9,roughness:.69});
 const eyeMat=new THREE.MeshStandardMaterial({color:settings.iris,
  emissive:settings.iris,emissiveIntensity:settings.glow,
  roughness:.27,metalness:0});
 const runeMat=new THREE.MeshStandardMaterial({color:settings.mark,
  emissive:settings.mark,emissiveIntensity:creatureId==='m001'?.19:.31,
  roughness:.81,metalness:0});
 // Clumps lie around the shoulder/neck: embedded roots avoid floating armor.
 for(let i=0;i<settings.tufts;i++){
  const t=i/settings.tufts,a=t*Math.PI*2;
  const r=H*(.105+seed01(i)*.033);
  const p=step(shoulder,(seed01(i+39)-.5)*H*.13,Math.cos(a)*r,
    Math.sin(a)*r*.93);
  const tip=p.clone().addScaledVector(forward,-H*(.035+seed01(i+5)*.05))
   .addScaledVector(sideways,Math.cos(a)*H*.035)
   .add(new THREE.Vector3(0,Math.sin(a)*H*.025,0));
  const shaft=shaftBetween(p,tip,H*(.005+seed01(i+12)*.003),.0006,
   maneMats[i%maneMats.length]);
  // shaftBetween creates local shaft center; its bone anchor follows motion.
  const local=shaft.position.clone();shaft.position.set(0,0,0);
  attach(root,shaft,local,neckBone);
  overlay.userData.maneStrands=(overlay.userData.maneStrands||0)+1;
 }
 // Eye and fang additions are restrained to avoid a cartoon wolf.
 // Use the head bone only: without a reliable animated head, do not place
 // cosmetic facial geometry that could float away during an action.
 if(headBone){
  const eyeY=H*.055, eyeWidth=H*.071;
  for(const side of [-1,1]){
   const eye= new THREE.Mesh(new THREE.SphereGeometry(H*.012,10,7),eyeMat);
   const eyePosition=step(head,H*.062,side*eyeWidth,eyeY);
   eye.scale.set(.76,.72,.45);
   attach(root,eye,eyePosition,headBone);
   const fang=new THREE.Mesh(new THREE.ConeGeometry(H*.016*settings.teeth,
    H*.075*settings.teeth,8),teethMat);
   const fangPos=step(head,H*.20,side*H*.049,-H*.064);
   fang.rotation.z=side*.19;
   attach(root,fang,fangPos,headBone);
  }
 }
 // Short worn rune scars across the shoulder. Their size intentionally
 // follows the physical wolf, not the huge summon world-scale.
 for(const side of [-1,1])for(let j=0;j<(creatureId==='wolf'?1:3);j++){
  const p=step(shoulder,-H*(.07+j*.034),side*H*.13,H*(.035-j*.025));
  const q=p.clone().addScaledVector(forward,-H*.051)
   .add(new THREE.Vector3(0,-H*.025,0));
  const scar=shaftBetween(p,q,H*.0032,H*.0024,runeMat);
  const at=scar.position.clone();scar.position.set(0,0,0);
  attach(root,scar,at,neckBone);
 }
 setSourceCoat(root,creatureId);
 root.userData.greyFangWolfFinish={
  creatureId,kind:settings.name,baseSource:'r-wolf',
  materialsPreserved:true,originalSkeletonPreserved:true,
  nativeAnimationsPreserved:true,maneStrands:settings.tufts,
  eyesAndFangsAttached:!!headBone,scars:true
 };
 return handle;
}
