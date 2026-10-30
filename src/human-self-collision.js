import {attachPhysicalBOM} from './world-physics-bom.js';

// Kinematic collision volumes follow the imported skeleton. Units are metres.
// This solver prevents hand/torso overlap by steering shoulder joints, then
// re-applying anatomical joint limits in the caller.
const SHAPES=[
 ['chest',['spine_02','spine_01'],.18],
 ['head',['head','head_01','neck_01'],.12],
 ['leftHand',['hand_l'],.075],
 ['rightHand',['hand_r'],.075],
 ['leftForearm',['lowerarm_l'],.095],
 ['rightForearm',['lowerarm_r'],.095],
 ['pelvis',['pelvis','hips'],.16],
 ['leftThigh',['thigh_l'],.105],
 ['rightThigh',['thigh_r'],.105]
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
  const pairs=[
   ['leftHand','chest','upperarm_l',1],
   ['rightHand','chest','upperarm_r',-1],
   ['leftForearm','chest','upperarm_l',1],
   ['rightForearm','chest','upperarm_r',-1],
   ['leftThigh','pelvis','thigh_l',1],
   ['rightThigh','pelvis','thigh_r',-1]
  ];
  for(const [side,bodyName,shoulderName,sign] of pairs){
   const hand=parts.get(side),chest=parts.get('chest'),shoulder=bones.get(shoulderName);
   if(!hand||!chest||!shoulder?.parent)continue;
   for(let attempt=0;attempt<3;attempt++){
    hand.proxy.getWorldPosition(a);chest.proxy.getWorldPosition(b);
    const delta=a.clone().sub(b),distance=delta.length();
    const required=hand.radius+chest.radius;
    if(distance>=required||distance<1e-6)break;
    contacts++;
    // Try both rotation directions and keep only a correction that increases separation.
    const initial=shoulder.quaternion.clone();
    const step=Math.min(.08,(required-distance)*.8);
    let bestDistance=distance,best=null;
    for(const direction of [1,-1]){
     shoulder.quaternion.copy(initial).multiply(turn.setFromAxisAngle(new THREE.Vector3(0,1,0),direction*step)).normalize();
     model.updateMatrixWorld(true);
     hand.proxy.getWorldPosition(a);chest.proxy.getWorldPosition(b);
     const candidate=a.distanceTo(b);
     if(candidate>bestDistance+1e-5){bestDistance=candidate;best=shoulder.quaternion.clone();}
    }
    shoulder.quaternion.copy(best||initial);
    if(!best)break;
    model.updateMatrixWorld(true);
   }
  }
  host.userData.humanCollisionDiagnostics={proxies:parts.size,contacts,solver:'limb-kinematic',pairs:pairs.length};
  return contacts;
 }
 return {tick,parts};
}
