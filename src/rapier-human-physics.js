// Rapier-backed articulated rigid bodies for the action-test preview.
// World coordinates are Y-up; motor torque is zero in the dead state.
const RAPIER_URL='https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js';
export async function createRapierHuman(){
 const R=await import(RAPIER_URL);
 await R.init();
 const world=new R.World({x:0,y:-9.81,z:0});
 const ground=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,-.12,0));
 // Group 1: terrain, group 2: body parts. Body parts collide with terrain,
 // but not each other; joint-connected spheres otherwise fight constraints.
 world.createCollider(R.ColliderDesc.cuboid(40,.12,40).setFriction(.85).setCollisionGroups((1<<16)|2),ground);
 const defs=[
  ['pelvis',11,0,1,0,.18],['torso',30,0,1.4,0,.23],['head',5,0,1.8,0,.14],
  ...['L','R'].flatMap((k,i)=>{const x=i?1:-1;return [
   ['upperArm'+k,2.2,x*.35,1.4,0,.11],['forearm'+k,1.3,x*.52,1.13,0,.09],
   ['hand'+k,.5,x*.65,.9,0,.125],['thigh'+k,7,x*.16,.73,0,.14],
   ['shin'+k,3.5,x*.16,.4,0,.11],['foot'+k,1,x*.16,.15,0,.145]]})
 ];
 const parts=new Map();
 const referenceMassKg=70;
 const rawVolumes=defs.map(([id,m])=>{const key=id.replace(/[LR]$/,'');const sizes={pelvis:[260,195,165],torso:[430,225,145],head:[250,110,105],upperArm:[290,78,76],forearm:[255,65,60],hand:[170,47,25],thigh:[400,108,103],shin:[360,76,73],foot:[245,58,105]};const [h,rx,rz]=sizes[key];return Math.PI*(rx/1000)*(rz/1000)*(h/1000);});
 const totalVolume=rawVolumes.reduce((a,b)=>a+b,0);
 for(const [index,[id,legacyMass,x,y,z,r]] of defs.entries()){
  const m=referenceMassKg*rawVolumes[index]/totalVolume;
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x,y,z).setLinearDamping(1.2).setAngularDamping(2.5));
  // Longer limbs need a physical extent, not a single ball at the joint.
  // A Y-aligned capsule is a conservative approximation; arms are rotated
  // into the horizontal rest direction before their joints are created.
  // Each anatomical BOM part owns a convex collision MESH. The vertices
  // describe the part's volume in local coordinates; no sphere/capsule
  // approximation is used for these dynamic body colliders.
  // Anatomical BOM: centerline length and cross-sectional radii are in mm.
  // Convert once to metres for Rapier. These values are calibration data,
  // not a claim that they have been traced from the imported skinned mesh.
  const anatomicalMM={
   pelvis:[260,195,165],torso:[430,225,145],head:[250,110,105],
   upperArm:[290,78,76],forearm:[255,65,60],hand:[170,47,25],
   thigh:[400,108,103],shin:[360,76,73],foot:[245,58,105]
  };
  const type=id.replace(/[LR]$/,'');
  const [lengthMM,radiusXMM,radiusZMM]=anatomicalMM[type];
  const height=lengthMM/1000;
  const width=radiusXMM/1000;
  const depth=radiusZMM/1000;
  const verts=[];
  for(const y of [-height/2,height/2]){
   for(let i=0;i<16;i++){
    const a=i*Math.PI/8;
    verts.push(Math.cos(a)*width,y,Math.sin(a)*depth);
   }
  }
  // An elliptical-prism hull volume determines the mass distribution.
  // Scale densities to the character's 70 kg reference body weight.
  const volumeM3=Math.PI*width*depth*height;
  const shape=R.ColliderDesc.convexHull(new Float32Array(verts));
  if(!shape)throw Error('Invalid convex collision mesh for '+id);
  world.createCollider(shape.setMass(m).setFriction(.95).setRestitution(0).setCollisionGroups((2<<16)|1),body);
  parts.set(id,{id,m,r,body,p:[x,y,z],bom:{lengthMM,radiusXMM,radiusZMM,volumeM3,massKg:m,densityKgM3:referenceMassKg/totalVolume,collision:'convexHull'}});
 }
 const edges=[['pelvis','torso'],['torso','head']];
 for(const k of ['L','R'])edges.push(['torso','upperArm'+k],['upperArm'+k,'forearm'+k],['forearm'+k,'hand'+k],['pelvis','thigh'+k],['thigh'+k,'shin'+k],['shin'+k,'foot'+k]);
 // Stabilize contacts while preserving natural falling and joint freedom.
 world.integrationParameters.maxVelocityIterations=8;
 world.integrationParameters.maxPositionIterations=4;
 const links=[];
 for(const [a,b] of edges){
  const pa=parts.get(a),pb=parts.get(b),ta=pa.body.translation(),tb=pb.body.translation();
  const mid={x:(ta.x+tb.x)/2,y:(ta.y+tb.y)/2,z:(ta.z+tb.z)/2};
  const joint=R.JointData.spherical({x:mid.x-ta.x,y:mid.y-ta.y,z:mid.z-ta.z},{x:mid.x-tb.x,y:mid.y-tb.y,z:mid.z-tb.z});
  world.createImpulseJoint(joint,pa.body,pb.body,true);
  links.push({a,b});
 }
 let accumulator=0;
 function step(dt){
  accumulator+=Math.min(.05,Math.max(0,dt));
  let count=0;
  while(accumulator>=1/120&&count++<6){world.timestep=1/120;world.step();accumulator-=1/120;}
  for(const p of parts.values()){const v=p.body.translation();p.p=[v.x,v.y,v.z];}
 }
 function applyImpulse(id,x,y,z=0){const p=parts.get(id);if(!p)return false;p.body.applyImpulse({x,y,z},true);return true;}
 return {parts,links,step,applyImpulse,engine:'rapier',world,dispose(){world.free();}};
}
