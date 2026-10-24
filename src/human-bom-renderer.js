const HUMAN_GEOMETRIES=new WeakMap();
import {HUMAN_PARTS,expandHumanBom} from './human-bom.js';
import {makeMaterialFactory} from './material-catalog.js';
import {createAnimeMaterialFactory} from './anime-materials.js';
import {HUMAN_JOINT_BOM} from './human-bom.js';
/** Character parts are original-size reusable meshes; pivots preserve walking animation. */
export function createHumanBomRig(THREE,host,{id='person',role='civilian',variant=0}={}){
 const bom=expandHumanBom(role),root=new THREE.Group();host.add(root);
 const baseMaterial=makeMaterialFactory(THREE),toAnime=createAnimeMaterialFactory(THREE);
 const material=id=>toAnime(baseMaterial(id));
 const geoCache=HUMAN_GEOMETRIES.get(THREE)??new Map();
 HUMAN_GEOMETRIES.set(THREE,geoCache);
 const geom=(key)=>{
  if(geoCache.has(key))return geoCache.get(key);
  const p=HUMAN_PARTS[key],[x,y,z]=p.size;
  const g=p.shape==='sphere'?new THREE.SphereGeometry(1,24,16):
   p.shape==='capsule'?new THREE.CapsuleGeometry(Math.min(x,z)/2,Math.max(.05,y-Math.min(x,z)),10,18):
   p.shape==='cylinder'?new THREE.CylinderGeometry(x/2,x/2,y,20):
   new THREE.SphereGeometry(1,20,12);
  geoCache.set(key,g);return g;
 };
 const leg=[-1,1].map(side=>{const g=new THREE.Group();g.position.set(side*.115,.88,0);root.add(g);return g});
 const arm=[-1,1].map(side=>{const g=new THREE.Group();g.position.set(side*.29,1.40,0);root.add(g);return g});
 // Additional articulated joints are children of the upper limb pivots.
 const knee=leg.map(g=>{const k=new THREE.Group();k.position.set(0,-.39,0);g.add(k);return k});
 const elbow=arm.map(g=>{const e=new THREE.Group();e.position.set(0,-.32,0);g.add(e);return e});
 const wrist=elbow.map(e=>{const w=new THREE.Group();w.position.set(0,-.29,0);e.add(w);return w});
 const ankle=knee.map(k=>{const a=new THREE.Group();a.position.set(0,-.39,0);k.add(a);return a});
 const neck=new THREE.Group();neck.position.set(0,1.52,0);root.add(neck);
 const spine=new THREE.Group();spine.position.set(0,.98,0);root.add(spine);
 // Reparent torso, shoulders and neck as one anatomical kinematic chain.
 arm.forEach((group,i)=>{spine.add(group);group.position.set((i===0?-1:1)*.29,.42,0);});
 spine.add(neck);neck.position.set(0,.54,0);
 const headPivot=new THREE.Group();headPivot.position.set(0,.13,0);neck.add(headPivot);
 const fingers=arm.map((_,i)=>{const group=new THREE.Group();group.position.set(0,-.08,.035);wrist[i].add(group);return group});
 const parents={body:root,head:neck,legLeft:leg[0],legRight:leg[1],armLeft:arm[0],armRight:arm[1]};
 const addPart=(partId,parent,position,materialId,componentId)=>{
  const info=HUMAN_PARTS[partId],mesh=new THREE.Mesh(geom(partId),material(materialId??info.material));
  mesh.position.set(...position);
  if(info.shape==='sphere'||info.shape==='box')mesh.scale.set(...info.size);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.partId=partId;mesh.userData.componentId=componentId;parent.add(mesh);return mesh;
 };
 for(const p of bom.parts){
  let parent=parents[p.attach],position=p.position;
  if(['torso','breastplate','cape'].includes(p.partId)){parent=spine;position=[p.position[0],p.position[1]-.98,p.position[2]];}
  if(p.partId==='shin'){parent=knee[p.attach==='legLeft'?0:1];position=[0,-.18,0];}
  if(p.partId==='boot'){parent=ankle[p.attach==='legLeft'?0:1];position=[0,-.055,.06];}
  if(p.partId==='forearm'){parent=elbow[p.attach==='armLeft'?0:1];position=[0,-.15,0];}
  if(p.partId==='hand'){parent=wrist[p.attach==='armLeft'?0:1];position=[0,-.075,0];}
  if(['head','hair','eye','nose','ear','brow','mouth'].includes(p.partId)){
   parent=headPivot;position=[p.position[0],p.position[1]-1.65,p.position[2]];
  }
  addPart(p.partId,parent,position,p.materialId,id+':'+p.id);
 }
 // Details are also catalog items, not independently constructed faces.
 const facialDetails=[
  ['nose',0,1.752,.13,'skin'],['mouth',0,1.707,.123,'lip'],
  ['brow',-.046,1.82,.121,'hair'],['brow',.046,1.82,.121,'hair'],
  ['ear',-.114,1.77,0,'skin'],['ear',.114,1.77,0,'skin']
 ];
 facialDetails.forEach(([key,x,y,z,finish],i)=>addPart(key,headPivot,[x,y-1.65,z],finish,id+':face:'+i));
 const joints={hip:root,spine,neck,head:headPivot,shoulders:arm,elbows:elbow,wrists:wrist,fingers,hips:leg,knees:knee,ankles:ankle};
 // Match a human silhouette (1.55–1.9 metres), never the former 2.45m chibi height.
 root.scale.setScalar(bom.height/1.96);
 root.userData.bomId=role;root.userData.heightM=bom.height;root.userData.jointBom=HUMAN_JOINT_BOM;
 const state={root,leg,arm,joints,t:variant*.73,moving:false,running:false,velocity:0,bomId:role,heightM:bom.height,restPose:{height:bom.height}};
 root.userData.jointCount=Object.values(joints).reduce((n,j)=>n+(Array.isArray(j)?j.length:1),0);
 host.userData.chibi=state;
 return state;
}
