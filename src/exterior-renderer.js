import {townBuildingPosition} from './starter-town.js';
/** Typed exterior objects -> Three.js view, independent of building identity. */
export function renderExterior({THREE,scene,building,layout,obstacle}){
 const [x,z,w,d,h,variant,yaw]=building.grid;
 const root=new THREE.Group();const [townX,townZ]=townBuildingPosition(building);root.position.set(townX,0,townZ);root.rotation.y=yaw;scene.add(root);
 const colors={foundation:0x898077,stone:0xb2aea1,plaster:0xd9cab0,door:0x70492e,roof:0x805849,'royal-roof':0x4f637b,'temple-roof':0x657068,window:0x9fc6d2,sign:0xa17b4e,banner:0x903d50,gold:0xcaa75e};
 const materials=new Map();
 const mat=(key)=>{if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:colors[key]??0x79634e,roughness:.83,metalness:key==='gold'?.3:0,side:THREE.DoubleSide}));return materials.get(key)};
 const meshBox=(parent,size,pos,key)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat(key));m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
 const [width,depth,height]=layout.size;
 for(const o of layout.objects){
  const key=o.material;let mesh;
  if(o.type==='roof-slope'){
   const half=width/2+.5,edge=depth/2+.6,rise=o.roofRise;
   const v=new Float32Array([0,height+rise,-edge,o.side*half,height,-edge,0,height+rise,edge,o.side*half,height,-edge,o.side*half,height,edge,0,height+rise,edge]);
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(v,3));g.computeVertexNormals();
   mesh=new THREE.Mesh(g,mat(key));root.add(mesh);
  }else if(o.type==='tower'){
   mesh=meshBox(root,o.size,[o.position[0],o.size[1]/2,o.position[2]],key);
   const cap=new THREE.Mesh(new THREE.ConeGeometry(o.size[0]*.77,2.3,8),mat('royal-roof'));cap.position.set(o.position[0],o.size[1]+1,o.position[2]);root.add(cap);
  }else if(o.type==='spire'){
   mesh=new THREE.Mesh(new THREE.ConeGeometry(o.size[0],o.size[1],8),mat(key));mesh.position.set(...o.position);root.add(mesh);
  }else{
   mesh=meshBox(root,o.size,o.position,key);
  }
  mesh.userData.entityKey=o.id;mesh.userData.definition=o;
 }
 obstacle(root.position.x,root.position.z,width+.4,depth+.4);
 return {root,layout,kind:building.kind,width,depth,height};
}
