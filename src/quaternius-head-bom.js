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
export function attachFittedHeadHair(THREE,headBone,{seed=0,palette=[],style=null}={}) {
 if(!headBone||style==='bald')return null;
 const colors=palette.length?palette:[0x30211b,0x7c4427,0x4e3b32];
 const root=new THREE.Group();root.name='bom-scalp-groom-wig';headBone.add(root);
 const baseColor=new THREE.Color(colors[seed%colors.length]);
 const scalpMat=new THREE.MeshStandardMaterial({color:baseColor,roughness:.88,metalness:0});
 const scalp=new THREE.Mesh(new THREE.SphereGeometry(1,40,24,0,Math.PI*2,0,Math.PI*.36),scalpMat);
 scalp.name='groom-scalp';scalp.scale.set(.124,.139,.124);scalp.position.set(0,.066,-.006);scalp.castShadow=true;root.add(scalp);
 // Tapered curved hair cards follow a groomed scalp tangent. No straight
 // cylinders, ear-shaped blobs or cards over the eyes.
 const count=10000,segments=3;
 let state=(seed>>>0)||1;
 const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const lengths={short:.038,layered:.075,bob:.112,long:.19,swept:.083};
 const maxLength=lengths[style]??.068;
 const vertices=[],normals=[],uv=[],indices=[];
 for(let i=0;i<count;i++){
  // Area-uniform roots across the full crown, including its centre.
  const theta=Math.acos(1-rand()*(1-Math.cos(Math.PI*.36)));
  const phi=rand()*Math.PI*2;
  const radial=new THREE.Vector3(Math.cos(phi),0,Math.sin(phi));
  const rootPoint=new THREE.Vector3(.125*Math.sin(theta)*radial.x,.066+.14*Math.cos(theta),-.006+.125*Math.sin(theta)*radial.z);
  const front=radial.z>0.05;
  // The face-facing hemisphere is only a short hairline, never long bangs.
  const length=maxLength*(.48+.42*rand())*(front?.18:1);
  // Hair-scale strips: roughly 0.12–0.22 mm half-width, no giant cards.
  const width=.00012+.00010*rand(),sweep=(rand()-.5)*.006;
  const side=new THREE.Vector3(-radial.z,0,radial.x);
  const start=vertices.length/3;
  for(let j=0;j<=segments;j++){
   const t=j/segments;
   const p=rootPoint.clone()
    .addScaledVector(radial,.001+Math.sin(t*Math.PI*.7)*.004)
    .addScaledVector(side,sweep*t*t)
    .add(new THREE.Vector3(0,-length*t,0));
   // Keep all cards outside the scalp and forehead.
   const envelope=new THREE.Vector3(p.x/.127,(p.y-.066)/.142,(p.z+.006)/.127);
   const n=envelope.length();
   if(n<1.012&&n>.00001)p.addScaledVector(envelope.normalize(),(1.012-n)*.13);
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
 root.userData.setColor=hex=>{scalpMat.color.set(hex);cardMat.color.set(hex)};
 root.userData.hairMotion=()=>({lagMeters:0,velocityMetersPerSecond:0});
 root.userData.hairDiagnostics={geometry:'dense-10000-fine-crown-strands',strands:count,faceOcclusionStrands:0,style:style||'layered'};
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
