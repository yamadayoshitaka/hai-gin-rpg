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
   ['hand'+k,.5,x*.65,.9,0,.065],['thigh'+k,7,x*.16,.73,0,.14],
   ['shin'+k,3.5,x*.16,.4,0,.11],['foot'+k,1,x*.16,.15,0,.09]]})
 ];
 const parts=new Map();
 for(const [id,m,x,y,z,r] of defs){
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x,y,z).setLinearDamping(1.2).setAngularDamping(2.5));
  // Longer limbs need a physical extent, not a single ball at the joint.
  // A Y-aligned capsule is a conservative approximation; arms are rotated
  // into the horizontal rest direction before their joints are created.
  const limb=/^(upperArm|forearm|thigh|shin)/.test(id);
  const length=/^upperArm/.test(id)?.28:/^forearm/.test(id)?.24:/^thigh/.test(id)?.32:/^shin/.test(id)?.28:0;
  const shape=limb?R.ColliderDesc.capsule(length/2,r):R.ColliderDesc.ball(r);
  world.createCollider(shape.setMass(m).setFriction(.95).setRestitution(0).setCollisionGroups((2<<16)|1),body);
  parts.set(id,{id,m,r,body,p:[x,y,z]});
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
