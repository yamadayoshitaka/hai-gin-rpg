import {attachPhysicalBOM} from './world-physics-bom.js';

// Kinematic collision volumes follow the imported skeleton. Units are metres.
// This solver prevents hand/torso overlap by steering shoulder joints, then
// re-applying anatomical joint limits in the caller.
const SHAPES=[
 ['chest',['spine_02','spine_01'],.18],
 ['head',['head','head_01','neck_01'],.12],
 ['leftHand',['hand_l'],.075],
 ['rightHand',['hand_r'],.075]
];
export function createHumanSelfCollision({THREE,model,host,bones}){
 const parts=new Map();
 for(const [name,aliases,radius] of SHAPES){
  const bone=aliases.map(alias=>bones.get(alias)).find(Boolean);
  if(!bone)continue;
  const proxy=new THREE.Object3D();
  proxy.name='collision-'+name;
  bone.add(proxy);
  attachPhysicalBOM(proxy,{material:'skin',mode:'kinematic',mass:0,size:[radius*2,radius*2,radius*2],collision:{enabled:true,shape:'sphere',layer:2,mask:0xffffffff}});
  proxy.userData.radius=radius;
  parts.set(name,{bone,proxy,radius});
 }
 const a=new THREE.Vector3(),b=new THREE.Vector3(),axis=new THREE.Vector3();
 const parentQ=new THREE.Quaternion(),turn=new THREE.Quaternion();
 function tick(){
  let contacts=0;
  model.updateMatrixWorld(true);
  for(const [side,shoulderName] of [['leftHand','upperarm_l'],['rightHand','upperarm_r']]){
   const hand=parts.get(side),chest=parts.get('chest'),shoulder=bones.get(shoulderName);
   if(!hand||!chest||!shoulder?.parent)continue;
   for(let attempt=0;attempt<3;attempt++){
    hand.proxy.getWorldPosition(a);chest.proxy.getWorldPosition(b);
    const delta=a.clone().sub(b),distance=delta.length();
    const required=hand.radius+chest.radius;
    if(distance>=required||distance<1e-6)break;
    contacts++;
    // Rotate the shoulder around its local up axis, away from the torso.
    shoulder.parent.getWorldQuaternion(parentQ);
    axis.set(0,1,0).applyQuaternion(parentQ).normalize();
    const sign=side==='leftHand'?1:-1;
    turn.setFromAxisAngle(new THREE.Vector3(0,1,0),sign*Math.min(.12,(required-distance)*1.6));
    shoulder.quaternion.premultiply(turn).normalize();
    model.updateMatrixWorld(true);
   }
  }
  host.userData.humanCollisionDiagnostics={proxies:parts.size,contacts,solver:'shoulder-kinematic'};
  return contacts;
 }
 return {tick,parts};
}
