import * as THREE from 'three';
export const OBJECT_CATALOG=Object.freeze({
 timber_bridge_001:{id:'timber_bridge_001',name:'木製の橋',category:'建造物',kind:'bridge',widthCells:15,depthCells:1,passable:true},
});
export function createObjectById(id,{cellSize=2.2}={}){
 if(id!=='timber_bridge_001')throw Error('Unknown object: '+id);
 const root=new THREE.Group();root.name=id;
 const deck=new THREE.MeshStandardMaterial({color:0x8b6540,roughness:.92}),wood=new THREE.MeshStandardMaterial({color:0x4f3828,roughness:.95});
 const box=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m)};
 const length=15*cellSize;
 for(let i=0;i<15;i++)box(cellSize*.97,.16,cellSize*1.25,(i-7)*cellSize,0,0,deck);
 for(const side of [-1,1]){const z=side*cellSize*.58;
 box(length,.25,.23,0,-.3,side*cellSize*.42,wood);
 box(length,.16,.16,0,1.1,z,wood);box(length,.1,.13,0,.57,z,wood);
 for(let i=0;i<15;i+=2)box(.18,1.2,.18,(i-7)*cellSize,.57,z,wood);
 for(const i of [-5,0,5])box(.34,2.7,.34,i*cellSize,-1.4,side*cellSize*.4,wood);
 }
 root.userData.catalogId=id;return root;
}
