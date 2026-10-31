// Rapier-backed articulated rigid bodies for the action-test preview.
// World coordinates are Y-up; motor torque is zero in the dead state.
const RAPIER_URL='https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.17.3/rapier.es.js';
export async function createRapierHuman(){
 const R=await import(RAPIER_URL);
 await R.init();
 const world=new R.World({x:0,y:-9.81,z:0});
 const ground=world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0,-.12,0));
 // Group 1: terrain, group 2: body parts. Nonadjacent body parts must
 // collide; directly connected bodies exclude contacts at their joints.
 const groundCollider=world.createCollider(R.ColliderDesc.cuboid(40,.12,40).setFriction(.85).setCollisionGroups((1<<16)|2),ground);
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
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x,y,z).setLinearDamping(.65).setAngularDamping(1.8));
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
  const soleCollider=type==='foot'?world.createCollider(R.ColliderDesc.cuboid(.082,.022,.145).setTranslation(0,-.123,-.035).setFriction(1.35).setCollisionGroups((2<<16)|1),body):null;
  // Hand contact is built after the primary bodies so the finger joints
  // can reference the hand rigid body and transmit reaction forces.
  parts.set(id,{id,m,r,body,soleCollider,p:[x,y,z],bom:{lengthMM,radiusXMM,radiusZMM,volumeM3,massKg:m,densityKgM3:referenceMassKg/totalVolume,collision:'convexHull'}});
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
    const fingerJoint=world.createImpulseJoint(joint,parent,finger,true);
    // Adjacent finger bones share a pivot; they must not push each other apart.
    fingerJoint.setContactsEnabled?.(false);
    fingerBodies.push({hand:k,digit:spec.id,index,body:finger,mass});
    parent=finger;
    previousCenter={x:center.x,y:center.y-length/2,z:center.z};
   }
  }
 }
 const edges=[['pelvis','torso'],['torso','head']];
 for(const k of ['L','R'])edges.push(['torso','upperArm'+k],['upperArm'+k,'forearm'+k],['forearm'+k,'hand'+k],['pelvis','thigh'+k],['thigh'+k,'shin'+k],['shin'+k,'foot'+k]);
 // Stabilize contacts while preserving natural falling and joint freedom.
 world.integrationParameters.maxVelocityIterations=16;
 world.integrationParameters.maxPositionIterations=8;
 const links=[];
 for(const [a,b] of edges){
  const pa=parts.get(a),pb=parts.get(b),ta=pa.body.translation(),tb=pb.body.translation();
  const anchor=jointAnchors[a+':'+b];
  const mid=anchor?{x:anchor[0],y:anchor[1],z:anchor[2]}:{x:(ta.x+tb.x)/2,y:(ta.y+tb.y)/2,z:(ta.z+tb.z)/2};
  const pivotA={x:mid.x-ta.x,y:mid.y-ta.y,z:mid.z-ta.z};
  const pivotB={x:mid.x-tb.x,y:mid.y-tb.y,z:mid.z-tb.z};
  const isHinge=(/^(upperArm|thigh)[LR]$/.test(a)&&/^(forearm|shin)[LR]$/.test(b)) || (/^pelvis$/.test(a)&&/^thigh[LR]$/.test(b)) || (/^shin[LR]$/.test(a)&&/^foot[LR]$/.test(b));
  const joint=isHinge
   ? R.JointData.revolute(pivotA,pivotB,{x:1,y:0,z:0})
   : a==='pelvis'&&b==='torso' ? R.JointData.fixed(pivotA,{x:0,y:0,z:0,w:1},pivotB,{x:0,y:0,z:0,w:1}) : R.JointData.spherical(pivotA,pivotB);
  if(isHinge&&typeof joint.setLimits==='function'){
   const range=a==='pelvis'?[-.75,.75]:a.startsWith('shin')?[-.55,.55]:[-.08,2.55];
   joint.setLimits(range[0],range[1]);
  }
  const physicalJoint=world.createImpulseJoint(joint,pa.body,pb.body,true);
  // Prevent joint-vs-contact feedback oscillation for directly linked parts.
  physicalJoint.setContactsEnabled?.(false);
  links.push({a,b,joint:physicalJoint,hinge:isHinge});
 }
 let accumulator=0;
 let fallen=false;
 let fallFrames=0;
 let motorRamp=0;
 function step(dt){
  accumulator+=Math.min(.05,Math.max(0,dt));
  let count=0;
  while(accumulator>=1/120&&count++<6){world.timestep=1/120;world.step();accumulator-=1/120;}
  for(const p of parts.values()){const v=p.body.translation();p.p=[v.x,v.y,v.z];}
 }
 // Joint-space muscle actuation. All support forces must pass through
 // joints and ground contact, never through an invisible world-space tether.
 function drive(action,dt){
  if(action==='dead'||action==='getup')return;
  const targets={
   idle:{hip:0,knee:0,shoulder:0,elbow:.12},
   guard:{hip:.18,knee:.30,shoulder:-.4,elbow:.65},
   walk:{hip:.32,knee:.28,shoulder:.22,elbow:.2},
   run:{hip:.48,knee:.42,shoulder:.35,elbow:.3},
   attack:{hip:.12,knee:.24,shoulder:-.75,elbow:.7}
  };
  const pose=targets[action]||targets.idle;
  motorRamp=Math.min(1,motorRamp+Math.min(dt,.05)/1.2);
  const t=performance.now()/1000;
  // Support polygon and center of mass are calculated from the physical
  // bodies. The ground solver supplies normal/friction forces at each sole.
  const soles=['footL','footR'].map(id=>parts.get(id)).filter(Boolean);
  // Use the sole collider's lower surface, not the foot center, for contact.
  // Rapier contact-pair query, rather than height-based sole approximation.
  const planted=soles.filter(p=>{
   let touching=false;
   world.contactPair(groundCollider,p.soleCollider,(manifold)=>{if(manifold.numContacts()>0)touching=true;});
   return touching;
  });
  const total=Array.from(parts.values()).reduce((v,p)=>v+p.m,0);
  const com=Array.from(parts.values()).reduce((v,p)=>{
   const q=p.body.translation();v.x+=q.x*p.m/total;v.z+=q.z*p.m/total;return v;
  },{x:0,z:0});
  const pelvisHeight=parts.get('pelvis').body.translation().y;
  const torsoHeight=parts.get('torso').body.translation().y;
  // A fall is a separate physical state; continuing upright motors after
  // sitting down causes the observed endless leg thrashing.
  if(pelvisHeight<.68||torsoHeight<.98)fallFrames++;
  else fallFrames=0;
  if(fallFrames>=8)fallen=true;
  if(fallen){
   for(const link of links)if(link.hinge)link.joint.configureMotorPosition?.(0,0,0);
   world.userDataBalance={contacts:planted.length,com,fallen:true,pelvisHeight,torsoHeight};
   return;
  }
  let balance={contacts:planted.length,com,support:null,offset:{x:0,z:0},fallen:false};
  if(planted.length){
   const positions=planted.map(p=>p.body.translation());
   const minX=Math.min(...positions.map(p=>p.x))-.09;
   const maxX=Math.max(...positions.map(p=>p.x))+.09;
   const minZ=Math.min(...positions.map(p=>p.z))-.16;
   const maxZ=Math.max(...positions.map(p=>p.z))+.16;
   const center={x:(minX+maxX)/2,z:(minZ+maxZ)/2};
   const dx=com.x-center.x,dz=com.z-center.z;
   balance={contacts:planted.length,com,support:{minX,maxX,minZ,maxZ},offset:{x:dx,z:dz}};
   // Change ankle/hip motor targets, rather than applying an external
   // upward force or a world-anchored torque to the upper body.
   for(const link of links){
    if(!link.hinge)continue;
    if(link.a.startsWith('shin'))link.balanceTarget=Math.max(-.24,Math.min(.24,-dz*1.6));
    if(link.a==='pelvis')link.balanceTarget=Math.max(-.24,Math.min(.24,-dz*.9));
   }
  }
  const bodyAxis=(()=>{
   const a=parts.get('pelvis').body.translation(),b=parts.get('torso').body.translation();
   return {x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
  })();
  balance.bodyAxis=bodyAxis;
  // Record actual stance geometry and actuator state for root-cause diagnosis.
  balance.geometry={
   pelvis:parts.get('pelvis').body.translation(),
   torso:parts.get('torso').body.translation(),
   feet:soles.map(p=>({id:p.id,position:p.body.translation(),rotation:p.body.rotation(),contact:planted.includes(p)})),
   comZ:com.z,
   supportZ:balance.support?[(balance.support.minZ),(balance.support.maxZ)]:null,
   fallen,
   motorRamp
  };
  balance.solePositions=soles.map(p=>({id:p.id,...p.body.translation(),vy:p.body.linvel().y}));
  balance.jointAngles=links.filter(l=>l.hinge).map(l=>({
   joint:l.a+'-'+l.b,angle:typeof l.joint.angle==='function'?l.joint.angle():null,
   target:l.balanceTarget||0
  }));
  // Foot-ground balance: transfer equal and opposite muscular torques
  // between planted feet and their shins. No world-space lift or tether.
  if(planted.length){
   const center=planted.reduce((v,p)=>{const q=p.body.translation();v.x+=q.x/planted.length;v.z+=q.z/planted.length;return v;},{x:0,z:0});
   const pelvisBody=parts.get('pelvis').body;
   const pv=pelvisBody.linvel();
   const errorX=com.x-center.x+pv.x*.18;
   const errorZ=com.z-center.z+pv.z*.18;
   const clamp=(v,max)=>Math.max(-max,Math.min(max,v));
   const pitch=clamp(errorZ*24,12),roll=clamp(-errorX*24,12);
   for(const foot of planted){
    const shin=parts.get('shin'+foot.id.slice(-1));
    if(!shin)continue;
    const torque={x:pitch/planted.length,y:0,z:roll/planted.length};
    foot.body.addTorque(torque,true);
    shin.body.addTorque({x:-torque.x,y:0,z:-torque.z},true);
   }
   balance.footTorque={pitch,roll};
   balance.velocity={x:pv.x,z:pv.z};
  }
  world.userDataBalance=balance;
  for(const link of links){
   if(!link.joint||!link.hinge)continue;
   const knee=link.a.startsWith('thigh');
   const elbow=link.a.startsWith('upperArm');
   const hip=link.a==='pelvis';
   const ankle=link.a.startsWith('shin');
   const side=link.a.endsWith('L')?0:Math.PI;
   const gait=(action==='walk'||action==='run')?Math.sin(t*(action==='run'?10:6)+side):0;
   const target=hip?pose.hip+gait*.08+(link.balanceTarget||0):knee?pose.knee+Math.max(0,gait)*.10:ankle?0-gait*.04+(link.balanceTarget||0):elbow?pose.elbow:0;
   // Rapier motor uses an angular spring; contact reaction propagates to
   // adjacent rigid bodies through the impulse joint.
   // Gains are in physical joint units; the former ~30 stiffness was
   // insufficient for the roughly 70 kg articulated body.
   // Ramp motor authority in from zero; avoid the initial full-strength
   // impulse that abruptly pitches the entire chain backward.
   const stiffness=(hip?90:ankle?75:knee?110:elbow?22:16)*motorRamp;
   const damping=(hip?28:ankle?24:knee?32:elbow?12:10)*motorRamp;
   const limitedTarget=Math.max(-.18,Math.min(.18,target));
   link.joint.configureMotorPosition?.(limitedTarget,stiffness,damping);
  }
 }
 function applyImpulse(id,x,y,z=0){const p=parts.get(id);if(!p)return false;p.body.applyImpulse({x,y,z},true);return true;}
 return {parts,links,fingerBodies,step,drive,getBalanceDiagnostics:()=>world.userDataBalance||null,applyImpulse,engine:'rapier',world,dispose(){world.free();}};
}
