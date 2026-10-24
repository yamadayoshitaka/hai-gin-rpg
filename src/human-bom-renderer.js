import {HUMAN_PARTS,expandHumanBom} from './human-bom.js';
import {makeMaterialFactory} from './material-catalog.js';
/** Character parts are original-size reusable meshes; pivots preserve walking animation. */
export function createHumanBomRig(THREE,host,{id='person',role='civilian',variant=0}={}){
 const bom=expandHumanBom(role),root=new THREE.Group();host.add(root);
 const material=makeMaterialFactory(THREE),geoCache=new Map();
 const geom=(key)=>{
  if(geoCache.has(key))return geoCache.get(key);
  const p=HUMAN_PARTS[key],[x,y,z]=p.size;
  const g=p.shape==='sphere'?new THREE.SphereGeometry(1,14,10):
   p.shape==='capsule'?new THREE.CapsuleGeometry(Math.min(x,z)/2,Math.max(.05,y-Math.min(x,z)),5,10):
   p.shape==='cylinder'?new THREE.CylinderGeometry(x/2,x/2,y,12):
   new THREE.BoxGeometry(x,y,z);
  geoCache.set(key,g);return g;
 };
 const leg=[-1,1].map(side=>{const g=new THREE.Group();g.position.set(side*.115,.88,0);root.add(g);return g});
 const arm=[-1,1].map(side=>{const g=new THREE.Group();g.position.set(side*.29,1.40,0);root.add(g);return g});
 const parents={body:root,legLeft:leg[0],legRight:leg[1],armLeft:arm[0],armRight:arm[1]};
 for(const p of bom.parts){
  const info=HUMAN_PARTS[p.partId],mat=material(p.materialId??info.material);
  const mesh=new THREE.Mesh(geom(p.partId),mat);
  mesh.position.set(...p.position);
  if(info.shape==='sphere')mesh.scale.set(info.size[0],info.size[1],info.size[2]);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.partId=p.partId;mesh.userData.componentId=id+':'+p.id;
  parents[p.attach].add(mesh);
 }
 // Match a human silhouette (1.55–1.9 metres), never the former 2.45m chibi height.
 root.scale.setScalar(bom.height/1.96);
 root.userData.bomId=role;root.userData.heightM=bom.height;
 const state={root,leg,arm,t:variant*.73,moving:false,bomId:role,heightM:bom.height};
 host.userData.chibi=state;
 return state;
}
