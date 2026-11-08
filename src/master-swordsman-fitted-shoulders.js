import * as THREE from 'three';

/**
 * Position *preview* shoulder equipment from measured character and tunic
 * bounds, not hardcoded detached spheres. A source 65-bone shoulder rig is
 * still required before combat animation use.
 */
export function measureSwordsmanShoulders(body,garment){
 if(!body||!garment)throw Error('Body and real tunic required');
 body.updateMatrixWorld(true,true);garment.updateMatrixWorld(true,true);
 const bb=new THREE.Box3().setFromObject(body),tb=new THREE.Box3().setFromObject(garment);
 if(bb.isEmpty()||tb.isEmpty())throw Error('Source bounds missing');
 const size=bb.getSize(new THREE.Vector3()),t=tb.getSize(new THREE.Vector3());
 if(size.y<1.2||size.y>2.2||t.y<.25)throw Error('Character size implausible');
 const center=bb.getCenter(new THREE.Vector3());
 const torsoWidth=Math.min(size.x*.75,t.x*.62,.77);
 const shoulderX=THREE.MathUtils.clamp(torsoWidth*.39,.19,.34);
 const shoulderY=THREE.MathUtils.clamp(bb.max.y-size.y*.265,
   bb.min.y+size.y*.63,bb.min.y+size.y*.87);
 const sleeveRadius=THREE.MathUtils.clamp(torsoWidth*.12,.055,.11);
 const centerZ=THREE.MathUtils.clamp(tb.getCenter(new THREE.Vector3()).z,
   bb.min.z-.05,bb.max.z+.06);
 return {left:new THREE.Vector3(center.x-shoulderX,shoulderY,centerZ),
  right:new THREE.Vector3(center.x+shoulderX,shoulderY,centerZ),
  shoulderRadius:sleeveRadius,headClearance:bb.max.y-shoulderY,
  reference:'actual-body-and-viking-tunic-bounds',rigged:false};
}
function bezierTube(name,points,radius,material){
 const curve=new THREE.CatmullRomCurve3(points);
 const m=new THREE.Mesh(new THREE.TubeGeometry(curve,22,radius,8,false),material);
 m.name=name;m.castShadow=true;m.receiveShadow=true;
 return m;
}
export function createFittedSwordsmanArmor({body,tunic,appearance}={}){
 if(!body||!tunic)throw Error('Source body and real tunic required');
 const fit=measureSwordsmanShoulders(body,tunic);
 const actor=new THREE.Group();actor.name='SWORDSMAN_SHOULDER_FITTED_STATIC_PREVIEW';
 const profile=appearance||{};
 const steel=new THREE.MeshPhysicalMaterial({color:profile.armorColor||'#889baa',
  metalness:.82,roughness:.31,clearcoat:.15,clearcoatRoughness:.4});
 const leather=new THREE.MeshStandardMaterial({color:'#4b372a',roughness:.82,metalness:.02});
 const trim=new THREE.MeshStandardMaterial({color:'#8f7253',metalness:.75,roughness:.48});
 const width=Math.min(.103,fit.shoulderRadius*1.11)*(profile.shoulderSize||.93);
 const armEnd=[];
 for(const sign of [-1,1]){
  const root=sign<0?fit.left:fit.right;
  const group=new THREE.Group();group.name=sign<0?'LeftShoulderMounted':'RightShoulderMounted';
  group.position.copy(root);actor.add(group);
  // A curved shoulder shell follows the upper arm/collar, no oversized
  // half-spheres hovering at a fixed, globally unrelated x-coordinate.
  const plate=new THREE.Mesh(
   new THREE.SphereGeometry(width,28,20,0,Math.PI*2,0,Math.PI*.47),
   steel);
  plate.name='MountedPauldronShell';
  plate.scale.set(1.13,.68,.96);
  plate.rotation.z=sign*.26;
  plate.position.set(sign*.012,.004,0);
  plate.castShadow=true;group.add(plate);
  const seam=new THREE.Mesh(new THREE.TorusGeometry(width*.88,.008,8,36,
    Math.PI*1.05),trim);
  seam.name='PauldronRim';seam.rotation.x=Math.PI*.5;seam.rotation.z=sign*.15;
  seam.position.set(sign*.011,-width*.06,.014);group.add(seam);
  // A leather attachment physically joins shell to chest; the connection is
  // visible at the top of the garment even when the camera rotates.
  const chest=root.clone().add(new THREE.Vector3(-sign*.125,-.12,.12));
  const collar=root.clone().add(new THREE.Vector3(-sign*.070,-.027,.09));
  actor.add(bezierTube('ShoulderToTorsoStrap',
   [root.clone().add(new THREE.Vector3(0,.01,.025)),collar,chest],.018,leather));
  const rivet=new THREE.Mesh(new THREE.SphereGeometry(.015,12,8),trim);
  rivet.position.set(0,.02,width*.86);rivet.name='ShoulderMountRivet';group.add(rivet);
  armEnd.push(root.clone());
 }
 // Keep fingers exposed, but cover the visually severed source sleeve/arm
 // boundary with real 3D tapered textile connectors. Still a preview only;
 // full shoulder/elbow skin weights are outstanding.
 const cloth=new THREE.MeshStandardMaterial({
  color:profile.clothColor||'#273d59',roughness:.93,metalness:0,side:THREE.DoubleSide});
 const sleeves=[];
 for(const sign of [-1,1]){
  const p=sign<0?fit.left:fit.right;
  const end=p.clone().add(new THREE.Vector3(sign*.145,-.43,.012));
  const direction=new THREE.Vector3().subVectors(end,p);
  const length=direction.length();
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.077,.048,length,28,5,true),cloth);
  mesh.name=sign<0?'ConnectedLeftSleeve':'ConnectedRightSleeve';
  mesh.position.copy(p).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  mesh.castShadow=true;mesh.receiveShadow=true;actor.add(mesh);sleeves.push(mesh);
 }
 const beltBox=new THREE.Box3().setFromObject(tunic);
 const bc=beltBox.getCenter(new THREE.Vector3());
 const buck=new THREE.Mesh(new THREE.BoxGeometry(.056,.046,.012),trim);
 buck.name='BeltHardware';buck.position.set(bc.x,bc.y-.23,beltBox.max.z+.03);
 actor.add(buck);
 const materials=[steel,leather,trim,cloth];
 return {object:actor,shoulders:fit,
  plates:actor.getObjectsByProperty?.('name','MountedPauldronShell')||null,
  sleeves,
  changeAppearance(profile){
   steel.color.set(profile.armorColor||'#889baa');
   cloth.color.set(profile.clothColor||'#273d59');
   for(const side of actor.children.filter(o=>o.name.includes('ShoulderMounted'))){
    side.scale.setScalar(profile.shoulderSize||.93);
   }
  },
  diagnostics:()=>({leftAnchor:fit.left.toArray(),rightAnchor:fit.right.toArray(),
   plateGroups:2,connectedSleeves:sleeves.length,attachmentStraps:2,
   measuredFromRealTunic:true,boneRigFitted:false}),
  dispose(){for(const m of materials)m.dispose();
   actor.traverse(o=>{if(o.isMesh)o.geometry?.dispose()})}
 };
}
