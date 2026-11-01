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
  if(node.name==='Eyebrows'){node.visible=false;return;}
  if(node.name==='Eyes'){kept.push(node);return;}
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
   // Keep only triangles fully influenced by the head/neck skeleton;
   // partial face/body triangles can form opaque sheets across the eyes.
   if([a,b,c].every(i=>score(i)>.45))indices.push(a,b,c);
  }
  if(!indices.length){node.visible=false;return;}
  const filtered=geo.clone();filtered.setIndex(indices);filtered.clearGroups();
  node.geometry=filtered;headTriangles+=indices.length/3;kept.push(node);
 });
 if(headTriangles<20)throw Error('No skinned facial polygons in humanoid source');
 return {headTriangles,visibleMeshes:kept.length};
}

/** Reusable hairline module. No spherical cap or helmet-shaped overlay. */
export function attachFittedHeadHair(THREE,headBone,{seed=0,palette=[],style=null,headScene=null}={}) {
 if(!headBone||style==='bald')return null;
 const colors=palette.length?palette:[0x30211b,0x7c4427,0x4e3b32];
 const root=new THREE.Group();root.name='bom-scalp-groom-wig';headBone.add(root);
 const baseColor=new THREE.Color(colors[seed%colors.length]);
 // Fit roots to the donor's actual skinned head, never a fixed-radius helmet.
 const triangles=[];
 const surface=[];
 if(headScene){
  headScene.updateMatrixWorld(true);
  headBone.updateWorldMatrix(true,false);
  const inverse=headBone.matrixWorld.clone().invert();
  headScene.traverse(mesh=>{
   if(!mesh.isSkinnedMesh||!mesh.visible||!mesh.geometry?.getAttribute('position'))return;
   const geo=mesh.geometry,pos=geo.getAttribute('position'),si=geo.getAttribute('skinIndex'),sw=geo.getAttribute('skinWeight');
   if(!si||!sw)return;
   const boneIndex=mesh.skeleton?.bones?.findIndex(b=>b===headBone||/^(head|head_01)$/i.test(b.name))??-1;
   if(boneIndex<0)return;
   const weight=i=>{let w=0;for(let j=0;j<4;j++)if(si.getComponent(i,j)===boneIndex)w+=sw.getComponent(i,j);return w;};
   const indices=geo.getIndex(),total=indices?indices.count:pos.count;
   const fetch=i=>{const v=new THREE.Vector3();mesh.getVertexPosition(i,v);return v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);};
   for(let k=0;k+2<total;k+=3){
    const ids=[0,1,2].map(j=>indices?indices.getX(k+j):k+j);
    if(ids.some(i=>weight(i)<.85))continue;
    const points=ids.map(fetch);
    if(points.some(p=>!Number.isFinite(p.x+p.y+p.z)||Math.abs(p.x)>.25||Math.abs(p.y)>.35||Math.abs(p.z)>.25))continue;
    const normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
    const area=normal.length()*.5;
    if(area<1e-9)continue;
    triangles.push({points,normal:normal.normalize(),area});
    surface.push(...points);
   }
  });
 }
 const ys=surface.map(p=>p.y).sort((a,b)=>a-b);
 const top=ys.length?ys[ys.length-1]:.20,bottom=ys.length?ys[0]:0;
 const crownCut=top-(top-bottom)*.32;
 const upper=surface.filter(p=>p.y>=crownCut);
 const centerX=upper.length?upper.reduce((v,p)=>v+p.x,0)/upper.length:0;
 const centerZ=upper.length?upper.reduce((v,p)=>v+p.z,0)/upper.length:0;
 const crownTriangles=triangles.filter(t=>t.points.every(p=>p.y>=crownCut)&&t.normal.y>-.15);
 let totalArea=0;
 for(const tri of crownTriangles){totalArea+=tri.area;tri.cumulative=totalArea;}
 // No opaque sphere: hair grows directly from the sampled head surface.
 // Tapered curved hair cards follow a groomed scalp tangent. No straight
 // cylinders, ear-shaped blobs or cards over the eyes.
 const count=10000,segments=3;
 let state=(seed>>>0)||1;
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const lengths={short:.038,layered:.075,bob:.112,long:.19,swept:.083};
 const maxLength=lengths[style]??.068;
 const vertices=[],normals=[],uv=[],indices=[],strandGroups=[];
 const groupCount=160;
 const groupPhase=new Float32Array(groupCount),groupVelocity=new Float32Array(groupCount);
 for(let i=0;i<count;i++){
  // Area-uniform roots across the full crown, including its centre.
  const theta=Math.acos(1-rand()*(1-Math.cos(Math.PI*.48)));
  const phi=rand()*Math.PI*2;
  const radial=new THREE.Vector3(Math.cos(phi),0,Math.sin(phi));
  let sampled=null,surfaceNormal=null;
  if(totalArea>0){
   const target=rand()*totalArea;
   let low=0,high=crownTriangles.length-1;
   while(low<high){const mid=(low+high)>>1;if(crownTriangles[mid].cumulative<target)low=mid+1;else high=mid;}
   const tri=crownTriangles[low],u=Math.sqrt(rand()),v=rand();
   sampled=tri.points[0].clone().multiplyScalar(1-u).addScaledVector(tri.points[1],u*(1-v)).addScaledVector(tri.points[2],u*v);
   surfaceNormal=tri.normal.clone();
  }
  const rootPoint=sampled?sampled.clone().addScaledVector(surfaceNormal,.003):new THREE.Vector3(.105*Math.sin(theta)*radial.x,.08+.13*Math.cos(theta),-.006+.105*Math.sin(theta)*radial.z);
  if(sampled){radial.set(sampled.x-centerX,0,sampled.z-centerZ).normalize();if(radial.lengthSq()<.001)radial.set(Math.cos(phi),0,Math.sin(phi));}
  const front=radial.z>0.05;
  // The face-facing hemisphere is only a short hairline, never long bangs.
  // Crown hair flows along the scalp; only the lower perimeter forms short bangs.
  const crown=theta<.85,fringe=front&&theta>1.12;
  const length=crown?(.022+.015*rand()):fringe?(.010+.010*rand()):(.018+.016*rand());
  // Hair-scale strips: roughly 0.12–0.22 mm half-width, no giant cards.
  const width=.00012+.00010*rand(),sweep=(rand()-.5)*.006;
  const side=new THREE.Vector3(-radial.z,0,radial.x);
  const start=vertices.length/3;
  strandGroups.push(Math.min(groupCount-1,Math.floor((phi/(Math.PI*2))*16)+16*Math.min(9,Math.floor(theta/(Math.PI*.48)*10))));
  for(let j=0;j<=segments;j++){
   const t=j/segments;
   const p=rootPoint.clone()
    .addScaledVector(surfaceNormal||radial,.001+Math.sin(t*Math.PI*.7)*.006)
    .addScaledVector(side,sweep*t*t)
    .addScaledVector(radial,length*t*(crown?.82:.58))
    .add(new THREE.Vector3(0,-length*t*(crown?.12:fringe?.28:.38),0));
   // Keep all cards outside the scalp and forehead.
   // Root coordinates are already sampled from the anatomical surface.
   const w=width*Math.pow(1-t,1.15)+.00012;
   for(const sign of [-1,1]){
    const v=p.clone().addScaledVector(side,sign*w);
    vertices.push(v.x,v.y,v.z);normals.push(radial.x,Math.max(.1,Math.cos(theta)),radial.z);uv.push(sign<0?0:1,t);
   }
   if(j<segments){const k=start+j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);
 geo.computeVertexNormals();
 const cardMat=new THREE.MeshStandardMaterial({color:baseColor,roughness:.77,metalness:.02,side:THREE.DoubleSide});
 const cards=new THREE.Mesh(geo,cardMat);cards.name='groom-tapered-hair-cards';cards.castShadow=true;root.add(cards);
 root.userData.setColor=hex=>{cardMat.color.set(hex)};
 // Simulate 160 spring-damped guide bundles; all 10,000 rendered strands follow them.
 const rest=geo.getAttribute('position').array.slice();
 const position=geo.getAttribute('position');
 let previousTime=null;
 root.userData.updateWind=(time,{action='idle',windX=0,windZ=0,...wind}={})=>{
  if(!Number.isFinite(time))return;
  if(previousTime===null){previousTime=time;return;}
  const dt=Math.min(.05,Math.max(0,time-previousTime));previousTime=time;
  if(dt<=0)return;
  const movement=/run|sprint|dash/i.test(action)?1:/walk|jog/i.test(action)?.45:0;
  const gust=Number(wind.strength??wind.speed??0)||0;
  for(let g=0;g<groupCount;g++){
   const target=Math.sin(time*1.6+g*.37)*(.014+Math.min(.04,Math.abs(gust)*.006))+movement*Math.sin(time*9+g*.19)*.025;
   groupVelocity[g]+=(target-groupPhase[g])*24*dt;
   groupVelocity[g]*=Math.exp(-8*dt);
   groupPhase[g]+=groupVelocity[g]*dt;
  }
  for(let i=0;i<count;i++){
   const phase=groupPhase[strandGroups[i]],start=i*(segments+1)*2;
   for(let j=1;j<=segments;j++){
    const t=j/segments,offset=phase*t*t*.12;
    for(let side=0;side<2;side++){
     const v=(start+j*2+side)*3;
     position.array[v]=rest[v]+offset;
     position.array[v+2]=rest[v+2]+offset*.45;
    }
   }
  }
  position.needsUpdate=true;
 };
 root.userData.hairMotion=()=>({guideBundles:groupCount,strands:count,physics:'spring-damper'});
 root.userData.hairDiagnostics={geometry:'triangle-area-crown-v1334',strands:count,sampledHeadVertices:surface.length,scalpTriangles:crownTriangles.length,faceOcclusionStrands:0,style:style||'layered'};
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
