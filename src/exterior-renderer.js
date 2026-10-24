import {makeMaterialFactory} from './material-catalog.js';
import {createRoofTileData,ROOF_PARTS} from './roof-module-data.js';
import {createFacadePanelData,FACADE_PARTS} from './exterior-panel-data.js';
import {createWallFinishLibrary} from './wall-finishes.js';
import {createBomRenderer} from './bom-renderer.js';
import {townBuildingPosition} from './starter-town.js';
/** Typed exterior objects -> Three.js view, independent of building identity. */
export function renderExterior({THREE,scene,building,layout,obstacle}){
 const [x,z,w,d,h,variant,yaw]=building.grid;
 const root=new THREE.Group();const [townX,townZ]=townBuildingPosition(building);root.position.set(townX,0,townZ);root.rotation.y=yaw;scene.add(root);
 const colors={foundation:0x898077,stone:0xb2aea1,plaster:0xd9cab0,door:0x70492e,roof:0x805849,'royal-roof':0x4f637b,'temple-roof':0x657068,window:0x9fc6d2,sign:0xa17b4e,banner:0x903d50,gold:0xcaa75e};
 const materials=new Map();
 const mat=(key)=>{if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:colors[key]??0x79634e,roughness:.83,metalness:key==='gold'?.3:0,side:THREE.DoubleSide}));return materials.get(key)};
 const meshBox=(parent,size,pos,key)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat(key));m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
 const bom=createBomRenderer(THREE);
 const surfaceMaterial=makeMaterialFactory(THREE);
 const [width,depth,height]=layout.size;
 for(const o of layout.objects){
  const key=o.material;let mesh;
  if(o.type==='box'&&o.id==='body'){
   const finish=createWallFinishLibrary(THREE).material(building.kind==='manor'?'castle':building.kind==='church'?'church':'home');
   const data=createFacadePanelData({id:building.id,width:o.size[0],height:o.size[1],depth:o.size[2],material:key});
   const assembly=new THREE.Group(),dummy=new THREE.Object3D();
   for(const [partId,part] of Object.entries(FACADE_PARTS)){
    const instances=data.filter(item=>item.partId===partId);
    if(!instances.length)continue;
    const meshGroup=new THREE.InstancedMesh(new THREE.BoxGeometry(...part.size),finish,instances.length);
    instances.forEach((item,i)=>{
     dummy.position.set(...item.position);
     dummy.rotation.set(0,item.rotationY,0);
     dummy.updateMatrix();meshGroup.setMatrixAt(i,dummy.matrix);
    });
    meshGroup.instanceMatrix.needsUpdate=true;
    meshGroup.castShadow=true;meshGroup.receiveShadow=true;
    meshGroup.userData.partId=partId;
    assembly.add(meshGroup);
   }
   assembly.userData.bomId=building.id+':facade';
   root.add(assembly);mesh=assembly;
  }else if(o.type==='roof-slope'){
   const half=width/2+.5,edge=depth/2+.6,rise=o.roofRise;
   const v=new Float32Array([0,height+rise,-edge,o.side*half,height,-edge,0,height+rise,edge,o.side*half,height,-edge,o.side*half,height,edge,0,height+rise,edge]);
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(v,3));g.computeVertexNormals();
   mesh=new THREE.Mesh(g,mat(key));root.add(mesh);
   const roofMaterial=key==='royal-roof'?'royal':key==='temple-roof'?'chapel':'slate';
   const tiles=createRoofTileData({id:building.id+':roof',width,depth,height,rise,side:o.side,materialId:roofMaterial});
   const tilePart=ROOF_PARTS[roofMaterial];
   const instanced=new THREE.InstancedMesh(new THREE.BoxGeometry(...tilePart.size),surfaceMaterial(tilePart.material),tiles.length);
   const dummy=new THREE.Object3D();
   tiles.forEach((tile,i)=>{
    dummy.position.set(...tile.position);
    dummy.rotation.set(0,0,tile.rotationZ);dummy.updateMatrix();
    instanced.setMatrixAt(i,dummy.matrix);
   });
   instanced.instanceMatrix.needsUpdate=true;
   instanced.castShadow=true;instanced.receiveShadow=true;
   instanced.userData.bomId=building.id+':roof:'+o.side;
   root.add(instanced);
  }else if(o.type==='gate-arch'){
   const [gw,gh,gd]=o.size,[gx,gy,gz]=o.position;
   const pillar=(gw-4.6)/2;
   mesh=meshBox(root,[pillar,gh,gd],[gx-gw/2+pillar/2,gh/2,gz],key);
   meshBox(root,[pillar,gh,gd],[gx+gw/2-pillar/2,gh/2,gz],key);
   meshBox(root,[gw,gh*.22,gd],[gx,gh*.89,gz],key);
   const crown=new THREE.Mesh(new THREE.ConeGeometry(gw*.36,2.1,4),mat('royal-roof'));
   crown.position.set(gx,gh+1,gz);crown.rotation.y=Math.PI/4;root.add(crown);
  }else if(o.type==='gate'){
   mesh=meshBox(root,o.size,[o.position[0],o.size[1]/2,o.position[2]],key);
   for(const side of [-1,1])meshBox(root,[.15,o.size[1],.23],[o.position[0]+side*o.size[0]*.3,o.size[1]/2,o.position[2]+.23],'gold');
  }else if(o.type==='tower'){
   mesh=meshBox(root,o.size,[o.position[0],o.size[1]/2,o.position[2]],key);
   const cap=new THREE.Mesh(new THREE.ConeGeometry(o.size[0]*.77,2.3,8),mat('royal-roof'));cap.position.set(o.position[0],o.size[1]+1,o.position[2]);root.add(cap);
  }else if(o.type==='spire'){
   mesh=new THREE.Mesh(new THREE.ConeGeometry(o.size[0],o.size[1],8),mat(key));mesh.position.set(...o.position);root.add(mesh);
  }else{
   mesh=meshBox(root,o.size,o.position,key);
  }
  mesh.userData.entityKey=o.id;mesh.userData.definition=o;
  const trimBom=o.type==='window'?'window-ornament':o.type==='door'?'door-ornament':o.type==='sign'?'shop-ornament':null;
  if(trimBom)bom.render(trimBom,root,{id:building.id+':'+o.id+':trim',position:o.position});
 }
 obstacle(root.position.x,root.position.z,width+.4,depth+.4);
 return {root,layout,kind:building.kind,width,depth,height};
}
