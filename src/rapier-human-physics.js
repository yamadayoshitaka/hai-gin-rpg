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
   // Reach both hands toward the direction of the forward fall (-Z).
   // The positions belong to the physical chain, not a visual-only pose.
   ['upperArm'+k,2.2,x*.32,1.34,-.19,.11],['forearm'+k,1.3,x*.37,1.22,-.43,.09],
   ['hand'+k,.5,x*.4,1.12,-.66,.125],['thigh'+k,7,x*.16,.73,0,.14],
   ['shin'+k,3.5,x*.16,.4,0,.11],['foot'+k,1,x*.16,.15,0,.145]]})
 ];
 // Anatomical pivot points shared by the rigid-body constraints.
 const jointAnchors={
  'pelvis:torso':[0,1.17,-.02],'torso:head':[0,1.65,0],
  ...Object.fromEntries(['L','R'].flatMap((k,i)=>{const x=i?1:-1;return [
   ['torso:upperArm'+k,[x*.255,1.40,0]],
   ['upperArm'+k+':forearm'+k,[x*.35,1.27,-.32]],
   ['forearm'+k+':hand'+k,[x*.39,1.16,-.57]],
   ['pelvis:thigh'+k,[x*.16,.87,0]],
   ['thigh'+k+':shin'+k,[x*.16,.53,0]],
   ['shin'+k+':foot'+k,[x*.16,.20,0]]
  ];}))
 };
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
  // Orient each collision hull toward -Z, matching the forward-reaching arm.
  const axisByPart={
   upperArm:[0,-.12,-.24],forearm:[0,-.12,-.24],hand:[0,-.10,-.17]
  };
  const axis=axisByPart[type];
  if(axis){
   const ay=axis[1],az=axis[2],norm=Math.hypot(ay,az);
   const c=ay/norm,sn=az/norm;
   for(let n=0;n<verts.length;n+=3){
    const vy=verts[n+1],vz=verts[n+2];
    verts[n+1]=c*vy-sn*vz;
    verts[n+2]=sn*vy+c*vz;
   }
  }
  const shape=R.ColliderDesc.convexHull(new Float32Array(verts));
  if(!shape)throw Error('Invalid convex collision mesh for '+id);
  world.createCollider(shape.setMass(m).setFriction(.95).setRestitution(0).setCollisionGroups((2<<16)|1),body);
  // Hand contact is built after the primary bodies so the finger joints
  // can reference the hand rigid body and transmit reaction forces.
  parts.set(id,{id,m,r,body,p:[x,y,z],bom:{lengthMM,radiusXMM,radiusZMM,volumeM3,massKg:m,densityKgM3:referenceMassKg/totalVolume,collision:'convexHull'}});
 }
 // Five articulated fingers per hand, with three physically connected
 // segments per digit. Each segment has a collider and a constrained joint.
 const fingerBodies=[];
 for(const k of ['L','R']){
  const palm=parts.get('hand'+k);
  const side=k==='L'?-1:1;
  const base=palm.body.translation();
  const specs=[
   {id:'thumb',offset:-.043,lengths:[.035,.025,.019],radius:.011},
   {id:'index',offset:-.023,lengths:[.040,.025,.019],radius:.009},
   {id:'middle',offset:0,lengths:[.045,.029,.021],radius:.009},
   {id:'ring',offset:.022,lengths:[.042,.027,.019],radius:.008},
   {id:'little',offset:.043,lengths:[.032,.021,.017],radius:.007}
  ];
  const palmCollider=R.ColliderDesc.cuboid(.043,.05,.013)
   .setTranslation(0,-.025,0).setFriction(.95)
   .setCollisionGroups((2<<16)|1);
  world.createCollider(palmCollider,palm.body);
  for(const spec of specs){
   let parent=palm.body;
   let previousCenter={x:base.x+side*spec.offset,y:base.y-.072,z:base.z};
   for(let index=0;index<spec.lengths.length;index++){
    const length=spec.lengths[index];
    const center={x:previousCenter.x,y:previousCenter.y-length/2,z:previousCenter.z};
    const finger=world.createRigidBody(R.RigidBodyDesc.dynamic()
     .setTranslation(center.x,center.y,center.z)
     .setLinearDamping(1.5).setAngularDamping(2.5));
    const mass=.015+length*.18;
    world.createCollider(R.ColliderDesc.capsule(Math.max(.004,length/2-spec.radius),spec.radius)
     .setMass(mass).setFriction(.95).setCollisionGroups((2<<16)|1),finger);
    const anchorWorld={x:center.x,y:previousCenter.y,z:center.z};
    const pt=parent.translation();
    const joint=R.JointData.spherical(
     {x:anchorWorld.x-pt.x,y:anchorWorld.y-pt.y,z:anchorWorld.z-pt.z},
     {x:anchorWorld.x-center.x,y:anchorWorld.y-center.y,z:anchorWorld.z-center.z});
    world.createImpulseJoint(joint,parent,finger,true);
    fingerBodies.push({hand:k,digit:spec.id,index,body:finger,mass});
    parent=finger;
    previousCenter={x:center.x,y:center.y-length/2,z:center.z};
   }
  }
 }
 const edges=[['pelvis','torso'],['torso','head']];
 for(const k of ['L','R'])edges.push(['torso','upperArm'+k],['upperArm'+k,'forearm'+k],['forearm'+k,'hand'+k],['pelvis','thigh'+k],['thigh'+k,'shin'+k],['shin'+k,'foot'+k]);
 // Stabilize contacts while preserving natural falling and joint freedom.
 world.integrationParameters.maxVelocityIterations=8;
 world.integrationParameters.maxPositionIterations=4;
 const links=[];
 for(const [a,b] of edges){
  const pa=parts.get(a),pb=parts.get(b),ta=pa.body.translation(),tb=pb.body.translation();
  const anchor=jointAnchors[a+':'+b];
  const mid=anchor?{x:anchor[0],y:anchor[1],z:anchor[2]}:{x:(ta.x+tb.x)/2,y:(ta.y+tb.y)/2,z:(ta.z+tb.z)/2};
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
 return {parts,links,fingerBodies,step,applyImpulse,engine:'rapier',world,dispose(){world.free();}};
}
