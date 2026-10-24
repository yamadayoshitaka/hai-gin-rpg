import {createBomRenderer} from './bom-renderer.js';
import {OBJECT_BOMS} from './bom-catalog.js';
/**
 * Renderer adapter: declarative interior object DTO -> Three.js meshes.
 * No knowledge of building name or usage. It only reads the object's model key.
 */
export function renderInteriorLayouts({THREE,layouts,floorGroups,levels,mobile=false}){
 const materialCache=new Map();
 const mat=(hex,emissive=0)=>{
  const key=hex+':'+emissive;
  if(materialCache.has(key))return materialCache.get(key);
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#'+hex.toString(16).padStart(6,'0');ctx.fillRect(0,0,128,128);
  const wood=[0x765437,0x40332c,0xa19076].includes(hex);
  for(let i=0;i<90;i++){
   const v=(i*73+31)%128;
   ctx.fillStyle=i%3?'#ffffff12':'#00000016';
   if(wood)ctx.fillRect(0,v,128,(i%4)+1);
   else ctx.fillRect((i*47)%128,(i*31)%128,(i%7)+2,(i%6)+2);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:wood?.028:.012,
   roughness:hex===0x838b92?.42:.82,metalness:hex===0x838b92?.7:.04,emissive:emissive||0});
  materialCache.set(key,material);return material;
 };
 const oak=mat(0x765437),dark=mat(0x40332c),metal=mat(0x838b92),gold=mat(0xc79a55),red=mat(0x833d47),stone=mat(0xa79d90),glass=mat(0xeed9a1,0x573917),cloth=mat(0xa19076);
 const box=(g,w,h,d,x,y,z,m)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh};
 const make=(key,g)=>{
  const b=(w,h,d,x,y,z,m=oak)=>box(g,w,h,d,x,y,z,m);
  switch(key){
   case 'throne':b(3.3,.75,2.2,0,.6,0,gold);b(3.1,3.8,.45,0,2.3,-.85,red);b(.55,1.2,2.4,-1.65,1.1,0,gold);b(.55,1.2,2.4,1.65,1.1,0,gold);break;
   case 'altar':b(5.4,1.5,2,0,.75,0,stone);b(2.4,.25,1.1,0,1.65,0,gold);break;
   case 'pew':b(4.8,.4,1.7,0,.75,0,oak);b(4.8,1.3,.25,0,1.05,-.7,oak);break;
   case 'counter':b(5.7,1.35,1.7,0,.68,0,oak);b(6,.18,2.05,0,1.45,0,gold);break;
   case 'desk':b(3.7,.20,2.3,0,1.4,0,oak);for(const x of [-1.5,1.5])for(const z of [-.9,.9])b(.23,1.25,.23,x,.65,z,dark);break;
   case 'table_low':b(3.4,.22,2.6,0,1.05,0,oak);for(const x of [-1.3,1.3])for(const z of [-1,1])b(.22,1.05,.22,x,.52,z,dark);break;
   case 'chair_A_wood':b(1.2,.14,1.1,0,.65,0,oak);b(1.2,1.55,.17,0,1.1,-.46,dark);break;
   case 'bed_single_A':b(3.5,.5,2.6,0,.42,0,oak);b(3.2,.32,2.3,0,.88,0,cloth);b(1.0,.27,1.8,-1,.99,0,glass);break;
   case 'shelf_A_big':case 'cabinet_medium':for(const y of [.5,1.5,2.5])b(3.2,.2,1.25,0,y,0,oak);for(const x of [-1.5,1.5])b(.15,3.1,1.3,x,1.55,0,dark);break;
   case 'barrel':{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(.65,.63,1.5,10),oak);mesh.position.y=.75;mesh.castShadow=true;g.add(mesh);break;}
   case 'chest':b(1.9,.9,1.15,0,.48,0,oak);b(1.9,.2,1.15,0,1,0,gold);break;
   case 'lamp_standing':b(.2,3,.2,0,1.5,0,gold);b(.85,.65,.85,0,3.15,0,glass);break;
   case 'weapon-rack':b(3.1,2,.3,0,1.45,0,dark);for(const x of [-1.1,0,1.1])b(.13,2.1,.15,x,1.9,.25,metal);break;
   case 'armor-stand':b(.22,2.6,.22,0,1.3,0,dark);b(1.6,1.5,.85,0,1.8,0,metal);break;
   case 'fireplace':b(4,3.5,.65,0,1.75,-.4,stone);b(2.7,1.4,.75,0,.75,0,dark);b(1.4,.7,.25,0,.45,.48,red);break;
   case 'banner':b(2.3,3,.13,0,2.7,0,red);b(2.8,.14,.2,0,4.25,0,gold);break;
   case 'piano':b(4.5,2.1,2.1,0,1.1,0,dark);b(3.9,.12,.8,0,1.05,1.05,glass);break;
   case 'carpet':b(7,.04,13,0,.10,0,red);break;
   case 'guard':b(1.25,2.2,.85,0,1.35,0,metal);b(.9,.9,.75,0,2.92,0,gold);break;
   case 'king':b(1.5,2.1,1.0,0,1.25,0,red);b(1,1,.85,0,2.8,0,cloth);b(1.3,.3,1,0,3.32,0,gold);break;
   default:b(1,.9,1,0,.45,0,oak);
  }
 };
 const bomRenderer=createBomRenderer(THREE);
 const records=[];
 for(const layout of layouts??[]){
  const level=(layout.floor??1)-1;
  const floor=floorGroups[level],collision=levels[level]?.furniture;
  if(!floor)continue;
  for(const object of layout.objects??[]){
   if(!Array.isArray(object.position)||object.position.length!==3)continue;
   const group=new THREE.Group();group.position.set(...object.position);
   group.userData.entityKey=object.id;
   group.userData.roleKeys=[...(object.roles??[])];
   group.userData.definition=object;
   if(object.model==='carpet'){
    const [width,depth]=object.size??[7,13];
    const carpetMat=mat(object.color??0x833d47);
    const edgeMat=mat(0xc3a16e);
    box(group,width,.035,depth,0,.055,0,carpetMat);
    // Woven border makes each rug read as a textured furnishing rather than a flat slab.
    for(const side of [-1,1]){
     box(group,.065,.042,depth-.17,side*(width/2-.18),.08,0,edgeMat);
     box(group,width-.17,.042,.065,0,.08,side*(depth/2-.18),edgeMat);
    }
    group.traverse(child=>{if(child.isMesh){child.castShadow=false;child.receiveShadow=true;}});
   }else if(OBJECT_BOMS[object.model??object.modelKey])bomRenderer.render(object.model??object.modelKey,group,{id:object.id});
   else make(object.model??object.modelKey??'generic',group);
   floor.add(group);
   if(object.collision&&collision){
    const radius=object.model==='throne'?3.6:object.model==='counter'?5.6:object.model==='pew'?4.6:object.model==='table_low'?3.1:2.3;
    collision.push({x:object.position[0],z:object.position[2],w:radius,d:radius});
   }
   records.push({id:object.id,floor:layout.floor,entity:group,definition:object});
  }
 }
 return records;
}
