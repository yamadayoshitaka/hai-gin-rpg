// Separate cloth objects per limb segment. Each attaches to one reference bone,
// avoiding the stretched/punctured appearance of automatic inverse-distance
// vertex weights on a long cylinder spanning a knee or elbow.
import * as THREE from 'three';

export function attachFittedCloth({dressed,style,textures}){
  const bones=new Map();dressed.traverse(o=>{if(o.isBone)bones.set(o.name.toLowerCase(),o)});
  dressed.updateMatrixWorld(true);
  const pos=name=>{const bone=bones.get(name);return bone?.getWorldPosition(new THREE.Vector3())};
  const objects=[],materials=[];
  const type=style.armor?'linen':style.fabric;
  const material=new THREE.MeshStandardMaterial({map:textures[type]||textures.linen,
    bumpMap:textures[type]||textures.linen,bumpScale:.002,
    color:new THREE.Color(style.armor?0x59616c:style.tint).lerp(new THREE.Color(0xffffff),.58),
    roughness:.83,metalness:style.armor?.19:0,side:THREE.DoubleSide});
  materials.push(material);
  function segment(slot,side,bone1,bone2,topRadius,bottomRadius,portion=1){
    const a=pos(bone1),b=pos(bone2);if(!a||!b)return;
    const finish=a.clone().lerp(b,portion),delta=a.clone().sub(finish),length=delta.length();
    if(length<.025)return;
    const geo=new THREE.CylinderGeometry(topRadius,bottomRadius,length*1.045,96,32,false);
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
  return {objects,materials,diagnostics:{clothPieces:objects.length,clothTriangles:objects.reduce((n,o)=>n+(o.geometry.index?.count||0)/3,0)}};
}
