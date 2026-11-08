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
/**
 * The original Viking shirt's tube sleeves are exported in a near-horizontal
 * T pose while the Blender Studio actor has lower A-pose arms. This source
 * mismatch creates disconnected arms regardless of pauldron position.
 * Retarget ONLY a clone of the garment vertex buffer to the measured A pose;
 * keep all original triangles, UVs and photo material maps intact.
 */
export function bendSourceTunicSleeves(tunic,body,{angleRadians=.68}={}){
 if(!tunic?.isMesh||!body)throw Error('Real tunic and body mesh required');
 const fit=measureSwordsmanShoulders(body,tunic);
 tunic.updateWorldMatrix(true,false);
 const original=tunic.geometry;
 const preview=original.clone();
 const pos=preview.getAttribute('position');
 const world=tunic.matrixWorld.clone(),inverse=world.clone().invert();
 const w=new THREE.Vector3();
 let moved=0;
 for(let i=0;i<pos.count;i++){
  w.fromBufferAttribute(pos,i).applyMatrix4(world);
  const sign=w.x<fit.left.x?-1:w.x>fit.right.x?1:0;
  if(!sign)continue;
  const pivot=sign<0?fit.left:fit.right;
  const rad=Math.abs(w.x-pivot.x);
  // Avoid distorting front/back tunic torso, collar and waist.
  const vertical=THREE.MathUtils.smoothstep(w.y,pivot.y-.32,pivot.y-.12);
  const horizontal=THREE.MathUtils.smoothstep(rad,.012,.15);
  const weight=vertical*horizontal;
  if(weight<.015)continue;
  const ang=-sign*angleRadians*weight;
  const dx=w.x-pivot.x,dy=w.y-pivot.y;
  const x=pivot.x+dx*Math.cos(ang)-dy*Math.sin(ang);
  const y=pivot.y+dx*Math.sin(ang)+dy*Math.cos(ang);
  w.set(x,y,w.z).applyMatrix4(inverse);
  pos.setXYZ(i,w.x,w.y,w.z);moved++;
 }
 if(moved<30)throw Error('Viking tube sleeves not actually deformed to body A pose: '+moved);
 pos.needsUpdate=true;preview.computeVertexNormals();
 preview.computeBoundingBox();preview.computeBoundingSphere();
 tunic.geometry=preview;
 tunic.updateWorldMatrix(true,false);
 return Object.freeze({movedSourceVertices:moved,originalVertices:original.getAttribute('position').count,
  sourceTrianglesUnchanged:preview.getIndex()?.count===original.getIndex()?.count,
  originalCC0Unmodified:true,continuousPreviewOnly:true,angleRadians});
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
   new THREE.SphereGeometry(width,32,24,0,Math.PI*2,0,Math.PI*.58),
   steel);
  plate.name='MountedPauldronShell';
  plate.scale.set(1.06,.82,1.04);
  plate.rotation.z=sign*.26;
  plate.position.set(sign*.018,.026,.008);
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
  color:'#252a32',roughness:.87,metalness:0,side:THREE.DoubleSide});
 const sleeves=[];
 for(const sign of [-1,1]){
  const p=sign<0?fit.left:fit.right;
  // The original oversized cone fell loose under the shoulder like a cape.
  // Extend only the lower section of the actual textured tunic sleeve, with
  // cloth matching the existing DARK source fabric and exposed hands.
  const start=p.clone().add(new THREE.Vector3(sign*.090,-.13,.015));
  const end=p.clone().add(new THREE.Vector3(sign*.137,-.30,.018));
  const direction=new THREE.Vector3().subVectors(end,start);
  const length=direction.length();
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.048,.040,length,28,4,false),cloth);
  mesh.name=sign<0?'ConnectedLeftSleeve':'ConnectedRightSleeve';
  mesh.position.copy(start).add(end).multiplyScalar(.5);
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
   // Dark undersleeves are neutral extensions of the actual Viking sleeves,
   // not new blue capes floating alongside exposed forearms.
   cloth.color.set('#2c3036');
   const style=Number.isInteger(profile.armorStyle)?profile.armorStyle:1;
   const silhouette=[.74,.88,1,1.09][style]||.91;
   for(const side of actor.children.filter(o=>o.name.includes('ShoulderMounted'))){
    side.visible=style!==0;
    side.scale.setScalar((profile.shoulderSize||.93)*silhouette);
   }
  },
  diagnostics:()=>({leftAnchor:fit.left.toArray(),rightAnchor:fit.right.toArray(),
   plateGroups:2,connectedSleeves:sleeves.length,attachmentStraps:2,
   measuredFromRealTunic:true,boneRigFitted:false}),
  dispose(){for(const m of materials)m.dispose();
   actor.traverse(o=>{if(o.isMesh)o.geometry?.dispose()})}
 };
}
