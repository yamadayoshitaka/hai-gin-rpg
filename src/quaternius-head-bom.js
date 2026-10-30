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
 const material=new THREE.MeshStandardMaterial({color:colors[seed%colors.length],roughness:.83,metalness:0,side:THREE.DoubleSide});
 const root=new THREE.Group();root.name='bom-scalp-groom-wig';headBone.add(root);
 const styles={short:.032,layered:.085,bob:.115,long:.20,swept:.075};
 const length=styles[style]??styles.layered;
 // A fitted upper scalp cap, not a sphere extending down over the face.
 const cap=new THREE.Mesh(new THREE.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI*.49),material);
 cap.name='wig-fitted-scalp';cap.scale.set(.108,.119,.105);cap.position.set(0,.058,-.008);
 cap.castShadow=true;root.add(cap);
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
 let state=(seed>>>0)||1;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 const massPerMetre=physics.densityKgM3*Math.PI*(physics.diameterM*.5)**2;
 const down=new THREE.Vector3(0,-1,0);
 for(let i=0;i<count;i++){
  const u=random(),v=random(),theta=Math.acos(1-u*(1-Math.cos(Math.PI*.475))),phi=v*Math.PI*2;
  const sin=Math.sin(theta),cos=Math.cos(theta);
  const rootPoint=new THREE.Vector3(.109*sin*Math.cos(phi),.058+.120*cos,.106*sin*Math.sin(phi)-.008);
  const front=Math.sin(phi)>0;
  const strandLength=length*(.75+random()*.35)*(front?.45:1);
  const tangent=new THREE.Vector3(Math.cos(phi)*(.4+sin*.4)+(style==='swept'?.6:0),-.28,Math.sin(phi)*(.4+sin*.4)).normalize();
  // Weight grows with length; stiffness opposes bending. Clamped for stability.
  const weight=massPerMetre*strandLength*physics.gravityMSS;
  const bend=Math.min(.96,Math.max(.28,weight/(weight+physics.bendingStiffness*.00000018)));
  const pointAt=t=>{
   const blend=bend*t*t;
   const dir=tangent.clone().multiplyScalar(1-blend).addScaledVector(down,blend).normalize();
   return rootPoint.clone().addScaledVector(tangent,strandLength*t*(1-blend*.5)).addScaledVector(down,strandLength*t*blend*.5);
  };
  let previous=pointAt(0);
  for(let j=0;j<segments;j++){
   const next=pointAt((j+1)/segments),delta=next.clone().sub(previous);
   dummy.position.copy(previous).add(next).multiplyScalar(.5);
   dummy.quaternion.setFromUnitVectors(axis,delta.clone().normalize());
   dummy.scale.set(1,delta.length(),1);
   dummy.updateMatrix();hairs.setMatrixAt(i*segments+j,dummy.matrix);
   previous=next;
  }
 }
 hairs.instanceMatrix.needsUpdate=true;root.add(hairs);
 root.userData.hairPhysics=physics;
 root.userData.setPhysics=changes=>{Object.assign(physics,changes);return {...physics};};
 root.userData.setColor=hex=>{material.color.set(hex);material.needsUpdate=true;};
 root.userData.componentType='head-hairline';
 root.userData.selectedStyle=style;
 root.userData.wigParts={scalp:1,strands:count,geometry:'fitted-scalp-gravity-curves'};
 root.userData.updateWind=()=>{};
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
