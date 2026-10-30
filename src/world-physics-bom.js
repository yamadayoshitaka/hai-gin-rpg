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
/** Representative effective contact properties, not universal constants.
 * Hardness is approximate Shore A for elastomers, otherwise Mohs or qualitative
 * engineering index; do not compare values across different scales.
 */
export const CONTACT_MATERIALS=Object.freeze({
 rubber:{density:1100,hardness:65,hardnessScale:'Shore A',youngModulusPa:7e6,friction:.9,restitution:.55},
 water:{density:1000,hardness:0,hardnessScale:'fluid',bulkModulusPa:2.2e9,friction:.02,restitution:0},
 wood:{density:650,hardness:3,hardnessScale:'Mohs approximate',youngModulusPa:10e9,friction:.65,restitution:.12},
 stone:{density:2600,hardness:6,hardnessScale:'Mohs approximate',youngModulusPa:45e9,friction:.8,restitution:.03},
 skin:{density:1050,hardness:25,hardnessScale:'Shore 00 approximate',youngModulusPa:2e5,friction:.65,restitution:.04},
 bone:{density:1900,hardness:4,hardnessScale:'Mohs approximate',youngModulusPa:17e9,friction:.6,restitution:.04},
 hair:{density:1300,hardness:0,hardnessScale:'fiber bending model',youngModulusPa:4e9,friction:.3,restitution:.02},
 silicone:{density:1100,hardness:20,hardnessScale:'Shore A',youngModulusPa:1e6,friction:.85,restitution:.08},
 cloth:{density:450,hardness:0,hardnessScale:'fabric bending model',youngModulusPa:1e7,friction:.5,restitution:.02},
 steel:{density:7850,hardness:4,hardnessScale:'Mohs approximate',youngModulusPa:200e9,friction:.55,restitution:.08}
});
/** Adhesion is a constraint, not collision response. Parent-relative transform
 * keeps an attached wig or equipment at its contact pose without tunneling.
 */
export function attachContactBond(THREE,child,parent,{strengthN=200,contactOffset=[0,0,0]}={}){
 if(!child||!parent)throw new TypeError('Bond requires two objects');
 parent.updateWorldMatrix(true,false);child.updateWorldMatrix(true,false);
 const relative=new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(child.matrixWorld);
 child.userData=child.userData||{};
 child.userData.contactBond={parent,strengthN,contactOffset:[...contactOffset],relative};
 return child.userData.contactBond;
}
export function enforceContactBond(child){
 const bond=child?.userData?.contactBond;
 if(!bond?.parent||!child.parent)return false;
 bond.parent.updateWorldMatrix(true,false);
 child.parent.updateWorldMatrix(true,false);
 const local=new child.matrix.constructor().copy(child.parent.matrixWorld).invert()
  .multiply(bond.parent.matrixWorld).multiply(bond.relative);
 local.decompose(child.position,child.quaternion,child.scale);
 child.updateMatrix();
 return true;
}
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

/** Semi-implicit Euler rigid-body step for explicitly dynamic objects.
 * Existing authored animation and building transforms are not overridden.
 * World-space AABB resolution supports static floors, walls and furniture.
 */
export function stepWorldPhysics(THREE,root,dt,{gravity=WORLD_PHYSICS.gravity,substeps=2}={}){
 const seconds=Math.max(0,Math.min(.05,Number(dt)||0));
 if(!seconds)return {moved:0,contacts:0};
 const nodes=[];root.traverse(node=>{if(node.isMesh&&node.visible&&node.userData?.physicsBOM?.collision?.enabled)nodes.push(node);});
 const dynamics=nodes.filter(node=>node.userData.physicsBOM.mode==='dynamic');
 const obstacles=nodes.filter(node=>node.userData.physicsBOM.mode==='static');
 const tempBox=new THREE.Box3(),otherBox=new THREE.Box3(),delta=new THREE.Vector3();
 let contacts=0;
 for(const node of dynamics){
  const bom=node.userData.physicsBOM;
  if(!node.parent||bom.mass<=0)continue;
  const velocity=node.userData.physicsVelocity||(node.userData.physicsVelocity=new THREE.Vector3());
  for(let step=0;step<Math.max(1,Math.min(8,substeps));step++){
   const h=seconds/Math.max(1,Math.min(8,substeps));
   velocity.addScaledVector(new THREE.Vector3(...gravity),h*(bom.gravityScale??1));
   for(const force of bom.forces||[]){
    if(force.type==='constant')velocity.addScaledVector(new THREE.Vector3(...force.vector),h/bom.mass);
    if(force.type==='drag')velocity.addScaledVector(velocity,-Math.min(1,h*Math.max(0,force.coefficient)));
   }
   for(const joint of bom.constraints||[]){
    if(!joint.target?.getWorldPosition)continue;
    const target=joint.target.getWorldPosition(new THREE.Vector3());
    const current=node.getWorldPosition(new THREE.Vector3());
    const offset=target.sub(current),distance=offset.length();
    if(distance<1e-6)continue;
    const extension=distance-joint.restLength;
    const direction=offset.multiplyScalar(1/distance);
    const spring=extension*joint.stiffness-velocity.dot(direction)*joint.damping;
    velocity.addScaledVector(direction,spring*h/bom.mass);
   }
   velocity.multiplyScalar(Math.max(0,1-(bom.linearDamping??bom.drag??.02)*h));
   const start=node.position.clone();
   node.position.addScaledVector(velocity,h);
   node.updateWorldMatrix(true,false);
   tempBox.setFromObject(node,true);
   for(const other of obstacles){
    const otherBom=other.userData.physicsBOM;
    if(!(bom.collision.mask&otherBom.collision.layer)||!(otherBom.collision.mask&bom.collision.layer))continue;
    if(bom.collision.trigger||otherBom.collision.trigger)continue;
    otherBox.setFromObject(other,true);
    if(!tempBox.intersectsBox(otherBox))continue;
    const overlap=[
     Math.min(tempBox.max.x-otherBox.min.x,otherBox.max.x-tempBox.min.x),
     Math.min(tempBox.max.y-otherBox.min.y,otherBox.max.y-tempBox.min.y),
     Math.min(tempBox.max.z-otherBox.min.z,otherBox.max.z-tempBox.min.z)
    ];
    const axis=overlap.indexOf(Math.min(...overlap));
    const key=['x','y','z'][axis];
    const sign=tempBox.getCenter(delta)[key]>=otherBox.getCenter(new THREE.Vector3())[key]?1:-1;
    // Convert world-space correction to parent-local displacement.
    const worldCorrection=new THREE.Vector3();worldCorrection[key]=sign*(overlap[axis]+.0001);
    const inv=new THREE.Matrix4().copy(node.parent.matrixWorld).invert();
    const localCorrection=worldCorrection.clone().applyMatrix3(new THREE.Matrix3().setFromMatrix4(inv));
    node.position.add(localCorrection);
    velocity[key]=velocity[key]*(-Math.min(1,Math.max(0,bom.restitution)));
    if(key==='y') {velocity.x*=Math.max(0,1-bom.friction*h*8);velocity.z*=Math.max(0,1-bom.friction*h*8);}
    node.updateWorldMatrix(true,false);tempBox.setFromObject(node,true);contacts++;
   }
   if(!Number.isFinite(node.position.x+node.position.y+node.position.z))node.position.copy(start);
  }
 }
 return {moved:dynamics.length,contacts};
}

/** Data-driven force and constraint contract. No per-object animation scripts.
 * Forces are expressed in world-space Newtons, impulses in N*s.
 * Spring connections express hair, fabric, joints and equipment attachments.
 */
export function configurePhysicalBehavior(object,recipe={}){
 const bom=object?.userData?.physicsBOM||attachPhysicalBOM(object,recipe);
 bom.forces=(recipe.forces||[]).map(f=>({type:f.type||'constant',vector:(f.vector||[0,0,0]).slice(0,3),coefficient:Number(f.coefficient)||0}));
 bom.constraints=(recipe.constraints||[]).map(c=>({
  type:c.type||'distance',target:c.target||null,restLength:Math.max(0,Number(c.restLength)||0),
  stiffness:Math.max(0,Number(c.stiffness)||0),damping:Math.max(0,Number(c.damping)||0)
 }));
 bom.linearDamping=Math.max(0,Number(recipe.linearDamping)||0);
 bom.gravityScale=Number.isFinite(recipe.gravityScale)?recipe.gravityScale:1;
 return bom;
}
export function applyPhysicalImpulse(object,impulse){
 const bom=object?.userData?.physicsBOM;
 if(!bom||bom.mode!=='dynamic'||bom.mass<=0)return false;
 const velocity=object.userData.physicsVelocity||(object.userData.physicsVelocity={x:0,y:0,z:0});
 for(const axis of ['x','y','z'])velocity[axis]+=(Number(impulse?.[axis])||0)/bom.mass;
 return true;
}
