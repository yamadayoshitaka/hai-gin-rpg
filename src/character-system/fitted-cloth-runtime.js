// Separate cloth objects per limb segment. Each attaches to one reference bone,
// avoiding the stretched/punctured appearance of automatic inverse-distance
// vertex weights on a long cylinder spanning a knee or elbow.
import * as THREE from 'three';
import {resolveClothRadius} from './outfit-clearance-policy.js';

export function attachFittedCloth({dressed,style,textures,radialSegments=96,heightSegments=32,adaptiveFit=true}){
  const bones=new Map();dressed.traverse(o=>{if(o.isBone)bones.set(o.name.toLowerCase(),o)});
  dressed.updateMatrixWorld(true);
  const pos=name=>{const bone=bones.get(name);return bone?.getWorldPosition(new THREE.Vector3())};
  const objects=[],materials=[];
  const fittedRadii=[];
  // The imported body and its original clothing are skinned. Measure their
  // deformed sleeves/legs against each *individual* limb axis so a newly
  // constructed sleeve never starts inside the source garment. The battle
  // variant uses its calibrated defaults to avoid per-soldier vertex scans.
  const scanned=new Map();
  function envelope(section){
    if(!adaptiveFit)return [];
    if(scanned.has(section))return scanned.get(section);
    const points=[],p=new THREE.Vector3();
    dressed.traverse(mesh=>{
      if(!mesh.isSkinnedMesh||!mesh.geometry?.attributes?.position)return;
      if(!new RegExp(section==='arms'?'arms':'legs','i').test(mesh.name))return;
      mesh.updateMatrixWorld(true);
      const count=mesh.geometry.attributes.position.count;
      for(let i=0;i<count;i++){
        mesh.getVertexPosition(i,p).applyMatrix4(mesh.matrixWorld);
        if(Number.isFinite(p.x+p.y+p.z))points.push(p.clone());
      }
    });
    scanned.set(section,points);return points;
  }
  function safeRadius(section,a,b,at,fallback){
    const points=envelope(section);
    if(!points.length)return resolveClothRadius(fallback);
    const axis=b.clone().sub(a),length=axis.length();
    if(length<.03)return resolveClothRadius(fallback);
    axis.multiplyScalar(1/length);
    const samples=[],diff=new THREE.Vector3(),radial=new THREE.Vector3();
    for(const pt of points){
      diff.copy(pt).sub(a);
      const t=diff.dot(axis)/length;
      if(Math.abs(t-at)>.18)continue;
      radial.copy(diff).addScaledVector(axis,-diff.dot(axis));
      const distance=radial.length();
      // Reject points on the torso or the opposite limb; we fit the *limb*,
      // not the largest nearby object in the imported scene.
      if(distance>.015&&distance<fallback*1.75)samples.push(distance);
    }
    return resolveClothRadius(fallback,samples);
  }
  // Macro linen weave was rendered as a black checkered net at limb scale.
  // Keep photographed fibers but use the softened albedo and tiny relief.
  const type=style.armor?'linen-fine':style.fabric==='linen'?'linen-fine':style.fabric;
  const material=new THREE.MeshStandardMaterial({map:textures[type]||textures.linen,
    bumpMap:textures[type]||textures.linen,bumpScale:.00035,
    color:new THREE.Color(style.armor?0x74869d:style.tint).lerp(new THREE.Color(0xffffff),style.armor?.18:.37),
    roughness:.83,metalness:style.armor?.19:0,side:THREE.DoubleSide});
  materials.push(material);
  function segment(slot,side,bone1,bone2,topRadius,bottomRadius,portion=1){
    const a=pos(bone1),b=pos(bone2);if(!a||!b)return;
    const finish=a.clone().lerp(b,portion),delta=a.clone().sub(finish),length=delta.length();
    if(length<.025)return;
    const section=slot.includes('sleeve')?'arms':'legs';
    const top=safeRadius(section,a,finish,.17,topRadius);
    const bottom=safeRadius(section,a,finish,.83,bottomRadius);
    fittedRadii.push({slot,side,top:+top.toFixed(4),bottom:+bottom.toFixed(4),adaptive:adaptiveFit});
    const geo=new THREE.CylinderGeometry(top,bottom,length*1.035,radialSegments,heightSegments,false);
    // Minute woven ridges are actual vertices; they stay below the photo
    // texture's texture displacement and do not turn into faceted cylinders.
    const position=geo.getAttribute('position');
    for(let i=0;i<position.count;i++){
      const y=position.getY(i),t=y/length+.5;
      const theta=Math.atan2(position.getX(i),position.getZ(i));
      const wrinkle=1+.004*Math.sin(12*theta+16*t)+.003*Math.sin(23*theta-18*t);
      position.setX(i,position.getX(i)*wrinkle);
      position.setZ(i,position.getZ(i)*wrinkle);
    }
    geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,material);
    mesh.name=`cloth-${slot}-${side}`;
    const worldMid=a.clone().add(finish).multiplyScalar(.5);
    const worldRotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    mesh.position.copy(dressed.worldToLocal(worldMid));
    mesh.quaternion.copy(dressed.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldRotation));
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
    mesh.userData={equipmentClass:'garment',equipmentSlot:slot,side};
    dressed.add(mesh);dressed.updateMatrixWorld(true);
    bones.get(bone1).attach(mesh);objects.push(mesh);
  }
  for(const side of ['l','r']){
    const upper=`upperarm_${side}`,elbow=`lowerarm_${side}`,hand=`hand_${side}`;
    segment('upper-sleeve',side,upper,elbow,style.armor?.073:.070,style.armor?.061:.055,style.sleeve==='short'?.53:1);
    if(style.sleeve!=='short')segment('forearm-sleeve',side,elbow,hand,style.armor?.058:.056,style.armor?.045:.039);
    if(style.leggings||style.armor){
      segment('trouser-thigh',side,`thigh_${side}`,`calf_${side}`,.108,.082);
      segment('trouser-calf',side,`calf_${side}`,`foot_${side}`,.085,.055);
    }
  }
  return {objects,materials,diagnostics:{clothPieces:objects.length,clothTriangles:objects.reduce((n,o)=>n+(o.geometry.index?.count||0)/3,0),fittedRadii}};
}
