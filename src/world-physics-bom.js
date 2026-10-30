/** Shared world-unit physics BOM. Units: metres, kilograms, seconds, newtons.
 * Pure data and lightweight collision queries; integration with motion controllers
 * is required before contacts can prevent interpenetration.
 */
export const WORLD_PHYSICS=Object.freeze({gravity:[0,-9.81,0],units:'m-kg-s',fixedStep:1/60});
export const MATERIALS=Object.freeze({
 air:{density:1.225,friction:0,restitution:0,stiffness:0},
 water:{density:1000,friction:.1,restitution:0,stiffness:0},
 hair:{density:1300,friction:.3,restitution:.05,stiffness:.25},
 skin:{density:1050,friction:.65,restitution:.05,stiffness:.6},
 cloth:{density:450,friction:.5,restitution:.05,stiffness:.2},
 leather:{density:860,friction:.65,restitution:.1,stiffness:.6},
 wood:{density:650,friction:.7,restitution:.12,stiffness:.85},
 stone:{density:2600,friction:.8,restitution:.02,stiffness:1},
 steel:{density:7850,friction:.55,restitution:.08,stiffness:1}
});
const finite=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
export function createPhysicalBOM(data={}){
 const material=data.material in MATERIALS?data.material:'wood';
 const mat=MATERIALS[material];
 const size=(Array.isArray(data.size)?data.size:[1,1,1]).map(n=>Math.max(.001,finite(n,1)));
 const volume=Math.max(0,finite(data.volume,size[0]*size[1]*size[2]));
 const mass=Math.max(0,finite(data.mass,mat.density*volume));
 const mode=['static','dynamic','kinematic','soft'].includes(data.mode)?data.mode:'static';
 return {material,mode,size,volume,mass,weightN:mass*Math.abs(WORLD_PHYSICS.gravity[1]),
  friction:finite(data.friction,mat.friction),restitution:finite(data.restitution,mat.restitution),
  stiffness:finite(data.stiffness,mat.stiffness),centerOfMass:data.centerOfMass||[0,0,0],
  collision:{enabled:data.collision?.enabled!==false,shape:data.collision?.shape||'box',
   layer:data.collision?.layer??1,mask:data.collision?.mask??0xffffffff,
   trigger:!!data.collision?.trigger}};
}
export function attachPhysicalBOM(object,data={}){
 if(!object)throw new TypeError('Physical object required');
 object.userData=object.userData||{};
 object.userData.physicsBOM=createPhysicalBOM(data);
 return object.userData.physicsBOM;
}
/** Broad-phase world-space AABB intersection, respecting collision layers. */
export function intersectsPhysicalObjects(THREE,a,b){
 const pa=a?.userData?.physicsBOM,pb=b?.userData?.physicsBOM;
 if(!pa?.collision.enabled||!pb?.collision.enabled)return false;
 if(!(pa.collision.mask&pb.collision.layer)||!(pb.collision.mask&pa.collision.layer))return false;
 a.updateWorldMatrix?.(true,true);b.updateWorldMatrix?.(true,true);
 return new THREE.Box3().setFromObject(a,true).intersectsBox(new THREE.Box3().setFromObject(b,true));
}
/** Assign shared physical data to each eligible object, retaining existing BOM. */
export function registerScenePhysics(root,{classify=()=>({})}={}){
 let registered=0;
 root.traverse(node=>{
  if(!node.isMesh&&!node.isSkinnedMesh)return;
  if(node.userData?.physicsBOM)return;
  const config=classify(node)||{};
  attachPhysicalBOM(node,config);
  registered++;
 });
 return registered;
}
