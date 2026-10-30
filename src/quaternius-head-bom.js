import {attachPhysicalBOM,attachContactBond} from './world-physics-bom.js';
/** Quaternius anatomical head extraction from CC0 full-body humanoid.
 * Keep skinning and shared skeleton; source model provides facial UV, eyes and brows.
 * Head selection is derived from skin weights, not an arbitrary polygon/height cutoff.
 */
export function retainSkinnedHead(scene){
 let headTriangles=0;
 const kept=[];
 scene.traverse(node=>{
  if(!node.isMesh)return;
  if(node.name==='Eyes'||node.name==='Eyebrows'){kept.push(node);return;}
  if(!node.isSkinnedMesh){node.visible=false;return;}
  const skeleton=node.skeleton,boneIndex=skeleton.bones.findIndex(b=>/^(Head|head)$/i.test(b.name));
  const neckIndices=skeleton.bones.map((b,i)=>/neck/i.test(b.name)?i:-1).filter(i=>i>=0);
  if(boneIndex<0){node.visible=false;return;}
  const geo=node.geometry,si=geo.getAttribute('skinIndex'),sw=geo.getAttribute('skinWeight');
  if(!si||!sw){node.visible=false;return;}
  const index=geo.getIndex(),cnt=index?index.count:geo.getAttribute('position').count;
  const indices=[];
  const score=v=>{let weight=0;for(let k=0;k<4;k++)if(si.getComponent(v,k)===boneIndex||neckIndices.includes(si.getComponent(v,k)))weight+=sw.getComponent(v,k);return weight;};
  for(let t=0;t+2<cnt;t+=3){
   const a=index?index.getX(t):t,b=index?index.getX(t+1):t+1,c=index?index.getX(t+2):t+2;
   if([a,b,c].filter(i=>score(i)>.45).length>=2)indices.push(a,b,c);
  }
  if(!indices.length){node.visible=false;return;}
  const filtered=geo.clone();filtered.setIndex(indices);filtered.clearGroups();
  node.geometry=filtered;headTriangles+=indices.length/3;kept.push(node);
 });
 if(headTriangles<20)throw Error('No skinned facial polygons in humanoid source');
 return {headTriangles,visibleMeshes:kept.length};
}

/** Reusable hairline module. No spherical cap or helmet-shaped overlay. */
export function attachFittedHeadHair(THREE,headBone,{seed=0,palette=[],style=null}={}) {
 if(!headBone||style==='bald')return null;
 const colors=palette.length?palette:[0x30211b,0x7c4427,0x4e3b32];
 const material=new THREE.MeshStandardMaterial({color:colors[seed%colors.length],roughness:.97,metalness:0,side:THREE.DoubleSide});
 const root=new THREE.Group();root.name='bom-scalp-groom-wig';headBone.add(root);
 const styles={short:.032,layered:.085,bob:.115,long:.20,swept:.075};
 const length=styles[style]??styles.layered;
 // A fitted upper scalp cap, not a sphere extending down over the face.
 const cap=new THREE.Mesh(new THREE.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI*.49),material);
 cap.name='wig-fitted-scalp';cap.scale.set(.109,.120,.107);cap.position.set(0,.058,-.008);
 cap.castShadow=true;root.add(cap);
 attachPhysicalBOM(cap,{material:'skin',mode:'kinematic',size:[.218,.12,.214],collision:{enabled:true,shape:'mesh'}});
 cap.userData.contactMaterial='silicone';
 attachContactBond(THREE,cap,headBone,{strengthN:200});
 // Material-driven grooming: each strand has density, diameter, bending
 // stiffness and root orientation. Gravity bends the free segment; roots stay fixed.
 // The equilibrium curve is baked once, so mobile GPUs do not simulate 3600
 // separate rigid bodies every frame.
 const physics={densityKgM3:1300,diameterM:.000075,gravityMSS:9.81,bendingStiffness:.38,windStrength:0};
 const count=3600,segments=7;
 const geometry=new THREE.CylinderGeometry(.0004,.00115,1,4,1,false);
 const hairs=new THREE.InstancedMesh(geometry,material,count*segments);
 hairs.name='wig-gravity-curved-hairs';hairs.frustumCulled=false;
 const dummy=new THREE.Object3D(),axis=new THREE.Vector3(0,1,0);
 const restMatrices=new Float32Array(count*segments*16);
 let state=(seed>>>0)||1;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const massPerMetre=physics.densityKgM3*Math.PI*(physics.diameterM*.5)**2;
 const down=new THREE.Vector3(0,-1,0);
 for(let i=0;i<count;i++){
  const u=random(),v=random(),theta=Math.acos(1-u*(1-Math.cos(Math.PI*.475))),phi=v*Math.PI*2;
  const sin=Math.sin(theta),cos=Math.cos(theta);
  const rootPoint=new THREE.Vector3(.109*sin*Math.cos(phi),.058+.120*cos,.106*sin*Math.sin(phi)-.008);
  const front=Math.sin(phi)>0;
  const strandLength=length*(.80+random()*.28)*(front?.62:1);
  // Hair is rooted to the wig cap. Root direction follows its tangent, while
  // gravity bends the free length downward; a head-envelope constraint keeps
  // the strand outside the scalp rather than forming a radial umbrella.
  const radial=new THREE.Vector3(Math.cos(phi),0,Math.sin(phi));
  const tangent=new THREE.Vector3(radial.x*.18+(style==='swept'?.13:0),-.98,radial.z*.18).normalize();
  const weight=massPerMetre*strandLength*physics.gravityMSS;
  const bend=Math.min(.92,Math.max(.52,weight/(weight+physics.bendingStiffness*.00000006)));
  const pointAt=t=>{
   const downward=strandLength*t*(.78+.22*bend);
   const spread=.003+strandLength*t*.11*(1-bend);
   const point=rootPoint.clone().addScaledVector(tangent,downward).addScaledVector(radial,spread);
   // Keep hairs just outside the fitted head surface where they pass it.
   const yy=(point.y-.058)/.120;
   if(yy>-.72&&yy<1){
    const minRadius=Math.sqrt(Math.max(0,1-yy*yy));
    const dx=point.x/.109,dz=(point.z+.008)/.107;
    const radius=Math.hypot(dx,dz);
    if(radius<minRadius+.018){
     const correction=(minRadius+.018)/Math.max(.001,radius);
     point.x*=correction;point.z=(point.z+.008)*correction-.008;
    }
   }
   return point;
  };
  let previous=pointAt(0);
  for(let j=0;j<segments;j++){
   const next=pointAt((j+1)/segments),delta=next.clone().sub(previous);
   dummy.position.copy(previous).add(next).multiplyScalar(.5);
   dummy.quaternion.setFromUnitVectors(axis,delta.clone().normalize());
   dummy.scale.set(1,delta.length(),1);
   dummy.updateMatrix();hairs.setMatrixAt(i*segments+j,dummy.matrix);
   dummy.matrix.toArray(restMatrices,(i*segments+j)*16);
   previous=next;
  }
 }
 hairs.instanceMatrix.needsUpdate=true;root.add(hairs);
 root.userData.hairPhysics=physics;
 root.userData.setPhysics=changes=>{Object.assign(physics,changes);return {...physics};};
 root.userData.setColor=hex=>{material.color.set(hex);material.needsUpdate=true;};
 root.userData.componentType='head-hairline';
 root.userData.selectedStyle=style;
 root.userData.wigParts={scalp:1,strands:count,geometry:'gravity-draped-head-envelope'};
 // Spring-damper integration in head-local coordinates. Head acceleration creates
 // inertial lag; restoring stiffness and damping settle the hair at rest.
 const displacement=new THREE.Vector3(),velocity=new THREE.Vector3();
 const lastHead=new THREE.Vector3(),lastVelocity=new THREE.Vector3();
 const headNow=new THREE.Vector3(),headVelocity=new THREE.Vector3(),acceleration=new THREE.Vector3();
 const rest=new THREE.Matrix4(),shift=new THREE.Matrix4(),windVector=new THREE.Vector3();
 let lastTime=null,frames=0;
 root.userData.updateWind=(time,wind={})=>{
  if(!Number.isFinite(time))return;
  headBone.updateWorldMatrix(true,false);
  headBone.getWorldPosition(headNow);
  if(lastTime===null){lastTime=time;lastHead.copy(headNow);return;}
  const dt=Math.min(.05,Math.max(.001,time-lastTime));
  if(time-lastTime<.012)return;
  headVelocity.copy(headNow).sub(lastHead).divideScalar(dt);
  acceleration.copy(headVelocity).sub(lastVelocity).divideScalar(dt);
  acceleration.clampLength(0,35);
  lastHead.copy(headNow);lastVelocity.copy(headVelocity);lastTime=time;
  const invHeadQ=headBone.getWorldQuaternion(new THREE.Quaternion()).invert();
  acceleration.applyQuaternion(invHeadQ);
  windVector.set(Number(wind.x)||0,0,Number(wind.z)||0).clampLength(0,8);
  // In-place walk/run clips animate the skeleton without translating its world
  // position. Reconstruct the missing gait acceleration from the clip clock.
  const gait=wind.action==='run'?1:wind.action==='walk'?.52:0;
  const period=Number(wind.period)>0?Number(wind.period):(gait===1?.63:.88);
  const phase=2*Math.PI*(Number.isFinite(Number(wind.phaseTime))?Number(wind.phaseTime):time)/period;
  const gaitAcceleration=new THREE.Vector3(
   Math.sin(phase)*gait*5,
   Math.cos(phase*2)*gait*9,
   Math.sin(phase+.8)*gait*3
  );
  const stiffness=24+physics.bendingStiffness*40,damping=9;
  const force=acceleration.add(gaitAcceleration).multiplyScalar(-.025).addScaledVector(windVector,.04)
   .addScaledVector(displacement,-stiffness).addScaledVector(velocity,-damping);
  velocity.addScaledVector(force,dt);
  displacement.addScaledVector(velocity,dt).clampLength(0,.035);
  if((++frames%3)!==0)return;
  // Roots stay attached. Tip displacement grows quadratically along each strand.
  for(let i=0;i<count;i++){
   for(let j=0;j<segments;j++){
    const index=i*segments+j;
    rest.fromArray(restMatrices,index*16);
    const fraction=(j+.5)/segments;
    shift.makeTranslation(displacement.x*fraction*fraction,displacement.y*fraction*fraction,displacement.z*fraction*fraction);
    shift.multiply(rest);
    hairs.setMatrixAt(index,shift);
   }
  }
  hairs.instanceMatrix.needsUpdate=true;
 };
 root.userData.hairMotion=()=>({lagMeters:displacement.length(),velocityMetersPerSecond:velocity.length()});
 return root;
}

/** Independent facial components on a head-bone local coordinate frame.
 * Existing skinned face remains the anatomical base; the parts can be swapped.
 */
export function attachFaceParts(THREE,headBone,options={}){
 if(!headBone)return null;
 const config={
  eyes:{size:1,color:'#654a32',spacing:.061,...options.eyes},
  nose:{width:1,height:1,projection:1,...options.nose},
  mouth:{width:1,fullness:1,color:'#8b4c46',...options.mouth},
  ears:{size:1,...options.ears}
 };
 const group=new THREE.Group();group.name='bom-face-components';headBone.add(group);
 const skin=new THREE.MeshStandardMaterial({color:options.skinColor||'#a77960',roughness:.92});
 const iris=new THREE.MeshStandardMaterial({color:config.eyes.color,roughness:.4});
 const lip=new THREE.MeshStandardMaterial({color:config.mouth.color,roughness:.9});
 const add=(name,geo,mat,pos,scale)=>{
  const mesh=new THREE.Mesh(geo,mat);mesh.name=name;
  mesh.position.set(...pos);mesh.scale.set(...scale);group.add(mesh);return mesh;
 };
 const ball=new THREE.SphereGeometry(1,12,10);
 for(const side of [-1,1]){
  add('eye-'+(side<0?'left':'right'),ball,iris,[side*config.eyes.spacing,.053,.098],[.013*config.eyes.size,.009*config.eyes.size,.004]);
  add('ear-'+(side<0?'left':'right'),ball,skin,[side*.116,.025,0],[.012*config.ears.size,.026*config.ears.size,.013]);
 }
 add('nose',new THREE.ConeGeometry(.014, .032,10),skin,[0,.018,.113],[config.nose.width,config.nose.height,config.nose.projection]);
 add('mouth',ball,lip,[0,-.026,.102],[.025*config.mouth.width,.004*config.mouth.fullness,.004]);
 group.userData.parts=config;
 group.userData.componentType='face-bom';
 return group;
}
