import * as THREE from 'three';
export const OBJECT_CATALOG=Object.freeze({
 timber_bridge_001:{id:'timber_bridge_001',name:'木製の橋',category:'建造物',kind:'bridge',widthCells:15,depthCells:1,passable:true},
 stone_bridge_001:{id:'stone_bridge_001',name:'石橋',category:'建造物',kind:'bridge',widthCells:15,depthCells:3,passable:true},
 timber_bridge_broken_001:{id:'timber_bridge_broken_001',name:'壊れた木橋',category:'建造物',kind:'bridge',widthCells:15,depthCells:1,passable:false},
 stone_bridge_broken_001:{id:'stone_bridge_broken_001',name:'崩れた石橋',category:'建造物',kind:'bridge',widthCells:15,depthCells:3,passable:false},
});
export function createObjectById(id,{cellSize=2.2}={}){
 if(!OBJECT_CATALOG[id])throw Error('Unknown object: '+id);
 const broken=id.includes('_broken_'),stoneBridge=id.startsWith('stone_');
 const root=new THREE.Group();root.name=id;
 if(stoneBridge){
  const stone=new THREE.MeshStandardMaterial({color:0x9a9b98,roughness:1}),mortar=new THREE.MeshStandardMaterial({color:0x656866,roughness:1}),coping=new THREE.MeshStandardMaterial({color:0xb5b4aa,roughness:.95});
  const add=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m)};
  const L=15*cellSize,W=3*cellSize;
  // Three walkable tile lanes, fifteen tiles along the bridge.
  for(let x=0;x<15;x++)for(let z=0;z<3;z++){
   const px=(x-7)*cellSize,pz=(z-1)*cellSize;
   if(!broken||x<6||x>9){add(cellSize*.985,.24,cellSize*.985,px,0,pz,stone)}
   if(!broken||x<6||x>9)for(let k=0;k<3;k++)add(cellSize*.3,.018,.025,px+(k-1)*cellSize*.3,.13,pz+cellSize*.2,mortar);
  }
  for(const side of [-1,1]){
   const z=side*(W/2+.13);
   if(!broken){add(L,.6,.48,0,-.4,z,mortar);add(L,.2,.65,0,1.08,z,coping)}
   for(let x=0;x<15;x++)if(!broken||x<6||x>9){add(cellSize*.94,.72,.38,(x-7)*cellSize,.55,z,stone);if(broken)add(cellSize*.94,.2,.65,(x-7)*cellSize,1.08,z,coping)}
   for(let x=0;x<15;x+=3)if(!broken||x<6||x>9)add(.52,1.25,.52,(x-7)*cellSize,.53,z,coping);
  }
  // Visible masonry arch spandrels with three openings under the deck.
  for(const side of [-1,1])for(let x=0;x<15;x++){
   const px=(x-7)*cellSize,z=side*(W/2-.3),phase=(x%5-2)/2;
   const arch=Math.sqrt(Math.max(0,1-phase*phase));
   if(!broken||x<6||x>9)add(cellSize*.98,.65+1.1*(1-arch),.4,px,-.54-.55*(1-arch),z,stone);
  }
  for(const x of [-5,0,5])for(const side of [-1,1])add(.85,2.3,.85,x*cellSize,-1.4,side*(W/2-.45),mortar);
  if(broken)for(let i=0;i<13;i++){const x=((i*7)%17-8)*cellSize*.35,z=((i*5)%7-3)*cellSize*.4;const rubble=new THREE.Mesh(new THREE.DodecahedronGeometry(.2+(i%4)*.12,0),i%3?stone:mortar);rubble.position.set(x,-1.4-(i%3)*.2,z);rubble.rotation.set(i*.4,i*.7,i*.2);root.add(rubble)}
  root.userData.catalogId=id;root.userData.footprint={lengthCells:15,widthCells:3};root.userData.passable=!broken;return root;
 }

 const deck=new THREE.MeshStandardMaterial({color:0x8b6540,roughness:.92}),wood=new THREE.MeshStandardMaterial({color:0x4f3828,roughness:.95});
 const box=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m)};
 const length=15*cellSize;
 for(let i=0;i<15;i++)if(!broken||i<6||i>9)box(cellSize*.97,.16,cellSize*1.25,(i-7)*cellSize,0,0,deck);
 for(const side of [-1,1]){const z=side*cellSize*.58;
 if(!broken){box(length,.25,.23,0,-.3,side*cellSize*.42,wood);box(length,.16,.16,0,1.1,z,wood);box(length,.1,.13,0,.57,z,wood)}
 for(let i=0;i<15;i++)if(broken&&(i<6||i>9)){box(cellSize*.96,.25,.23,(i-7)*cellSize,-.3,side*cellSize*.42,wood);box(cellSize*.96,.16,.16,(i-7)*cellSize,1.1,z,wood);box(cellSize*.96,.1,.13,(i-7)*cellSize,.57,z,wood)}
 for(let i=0;i<15;i+=2)if(!broken||i<6||i>9)box(.18,1.2,.18,(i-7)*cellSize,.57,z,wood);
 for(const i of [-5,0,5])box(.34,2.7,.34,i*cellSize,-1.4,side*cellSize*.4,wood);
 }
 if(broken)for(let i=0;i<9;i++){const plank=new THREE.Mesh(new THREE.BoxGeometry(cellSize*.6,.13,.28),deck);plank.position.set(((i*7)%11-5)*cellSize*.35,-1.1-(i%3)*.14,((i*3)%5-2)*cellSize*.4);plank.rotation.y=i*.41;root.add(plank)}
 root.userData.catalogId=id;root.userData.passable=!broken;return root;
}
