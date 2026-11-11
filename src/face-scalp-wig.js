import * as THREE from 'three';

/**
 * Mobile-preview wig made of real scalp-rooted 3D lock ribbons.
 * Roots come from the OWNED sculpted head vertices, not a floating cap.
 * Hair points use damped constrained motion and face/body collision proxies.
 * No donor GLB, character body or battle model is altered.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fract=x=>x-Math.floor(x);
const f3=(x,y,z)=>new THREE.Vector3(x,y,z);
const projectCapsule=(p,a,b,r)=>{
 const along=b.clone().sub(a),den=along.lengthSq();
 const t=den?clamp(p.clone().sub(a).dot(along)/den,0,1):0;
 const closest=a.clone().addScaledVector(along,t);
 const diff=p.clone().sub(closest),len=diff.length();
 if(len>=r)return false;
 if(len<1e-8)diff.set(0,0,1);
 else diff.multiplyScalar(1/len);
 p.copy(closest).addScaledVector(diff,r);
 return true;
};
function actualScalpCandidates(geo,box){
 const pos=geo.getAttribute('position'),normal=geo.getAttribute('normal');
 const d=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
 const primary=[],fallback=[];
 for(let i=0;i<pos.count;i++){
  const p=f3(pos.getX(i),pos.getY(i),pos.getZ(i));
  const yn=(p.y-box.min.y)/d.y,zn=(p.z-center.z)/d.z;
  if(yn<.76||yn>.997)continue;
  const n=normal?f3(normal.getX(i),normal.getY(i),normal.getZ(i)).normalize():
   p.clone().sub(center).normalize();
  // Hairline is above the brow; keep front roots clear of eyeballs.
  if(zn>.18&&yn<.835)continue;
  fallback.push({p,n,index:i});
  if(n.y>.08||yn>.88)primary.push({p,n,index:i});
 }
 const candidates=primary.length>16?primary:fallback;
 if(candidates.length<12)throw Error('Scalp has too few real head vertices');
 return candidates;
}
function scalpShell(geo,box,color){
 const src=geo.getAttribute('position'),idx=geo.index;
 const n=idx?idx.count:src.count,d=box.getSize(new THREE.Vector3());
 const normals=geo.getAttribute('normal'),verts=[];
 const yThreshold=box.min.y+d.y*.825;
 const sample=i=>f3(src.getX(i),src.getY(i),src.getZ(i));
 for(let i=0;i+2<n;i+=3){
  const ids=[0,1,2].map(k=>idx?idx.getX(i+k):i+k);
  const p=ids.map(sample);
  if(p.some(x=>x.y<yThreshold))continue;
  const mid=p[0].clone().add(p[1]).add(p[2]).multiplyScalar(1/3);
  // The scalp shell uses the donor topology, with a tiny offset only.
  for(let j=0;j<3;j++){
   const v=p[j].clone(),ii=ids[j];
   const normal=normals?f3(normals.getX(ii),normals.getY(ii),normals.getZ(ii)):
    v.clone().sub(mid).normalize();
   v.addScaledVector(normal,d.x*.0015);
   verts.push(v.x,v.y,v.z);
  }
 }
 const material=new THREE.MeshStandardMaterial({
  color,roughness:.84,metalness:0,side:THREE.DoubleSide
 });
 const buffer=new THREE.BufferGeometry();
 buffer.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 if(verts.length)buffer.computeVertexNormals();
 const mesh=new THREE.Mesh(buffer,material);
 mesh.name='REAL_SCALP_TRIANGLE_HAIR_CAP';
 mesh.userData.scalpSource='sculpted-real-head-triangles';
 return mesh;
}
/**
 * @param {THREE.Mesh} head  owned sculpted female head
 * @param {{count?:number,color?:number,externalColliders?:Array}} options
 */
export function createScalpAnchoredWig(head,{count=196,color=0xc8a36a,externalColliders=[]}={}){
 if(!head?.isMesh||!head.geometry?.getAttribute('position'))
  throw Error('Real sculpted 3D head required for scalp-rooted wig');
 head.geometry.computeBoundingBox();head.geometry.computeVertexNormals();
 const box=head.geometry.boundingBox.clone(),d=box.getSize(new THREE.Vector3());
 const center=box.getCenter(new THREE.Vector3());
 const candidates=actualScalpCandidates(head.geometry,box);
 const root=new THREE.Group();root.name='FEMALE_SCALP_ANCHORED_LONG_WIG';
 root.userData.hairOnRealHead=true;
 const cap=scalpShell(head.geometry,box,color);root.add(cap);
 const lockCount=clamp(Math.round(count),48,320),segments=11;
 const strands=[];
 const rootLift=d.x*.0045;
 // Shoulder/chest proxy geometry is in the SAME coordinates as the head.
 // Future full-body rigs can supply exact external capsules.
 const colliders=[
  {name:'left-shoulder',a:f3(center.x-d.x*.25,box.min.y+d.y*.225,center.z),
   b:f3(center.x-d.x*.49,box.min.y+d.y*.165,center.z),r:d.x*.092},
  {name:'right-shoulder',a:f3(center.x+d.x*.25,box.min.y+d.y*.225,center.z),
   b:f3(center.x+d.x*.49,box.min.y+d.y*.165,center.z),r:d.x*.092},
  {name:'chest',a:f3(center.x,box.min.y+d.y*.075,center.z),
   b:f3(center.x,box.min.y+d.y*.32,center.z),r:d.x*.25}
 ];
 for(const extra of externalColliders){
  if(extra?.a&&extra?.b&&Number.isFinite(extra.r)&&extra.r>0)
   colliders.push({name:extra.name||'external-body',
    a:new THREE.Vector3(...extra.a),b:new THREE.Vector3(...extra.b),r:extra.r});
 }
 const vertexCount=lockCount*(segments+1)*4;
 const vertices=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3);
 const indices=[];
 const rootColor=new THREE.Color(color),tips=new THREE.Color(0xe0bc83);
 for(let i=0;i<lockCount;i++){
  const seed=candidates[Math.floor(fract(i*.61803398875+.37)*candidates.length)];
  const wigRoot=seed.p.clone().addScaledVector(seed.n,rootLift);
  const fore=wigRoot.z>center.z+d.z*.13;
  const side=Math.sign(wigRoot.x-center.x)||1;
  const fringe=fore&&wigRoot.y>box.min.y+d.y*.875&&i%4<2;
  const length=d.y*(fringe?.18:.48+fract(i*.381966)*.23);
  const rest=[],points=[],vel=[];
  const tangent=seed.n.clone().multiplyScalar(fringe?.05:.095);
  const out=fringe?d.z*.085:d.z*.07;
  for(let j=0;j<=segments;j++){
   const t=j/segments;
   const p=wigRoot.clone()
    .addScaledVector(tangent,t)
    .add(f3(side*d.x*.035*t*t,-length*t,
     (fore?1:-1)*out*t*(.5+t)));
   rest.push(p);points.push(p.clone());vel.push(new THREE.Vector3());
  }
  strands.push({root:wigRoot,rest,points,vel,fringe,side,seedIndex:seed.index});
  const base=i*(segments+1)*4;
  for(let j=0;j<=segments;j++){
   const t=j/segments,shaded=rootColor.clone().lerp(tips,.3+.48*t)
    .multiplyScalar(.89+.18*fract(i*.3719));
   for(let k=0;k<4;k++){
    const at=(base+j*4+k)*3;
    colors[at]=shaded.r;colors[at+1]=shaded.g;colors[at+2]=shaded.b;
   }
  }
  for(let j=0;j<segments;j++){
   const a=base+j*4,b=base+(j+1)*4;
   for(const off of [0,2]){
    indices.push(a+off,a+off+1,b+off,b+off,a+off+1,b+off+1);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 const attr=new THREE.BufferAttribute(vertices,3);
 attr.setUsage(THREE.DynamicDrawUsage);
 geo.setAttribute('position',attr);
 geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
 geo.setIndex(indices);
 const mat=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:.78,metalness:0,
  side:THREE.DoubleSide
 });
 const locks=new THREE.Mesh(geo,mat);
 locks.name='REAL_ROOTED_SWEPT_HAIR_LOCKS';
 locks.userData.rootedOnRealScalp=true;
 locks.userData.lockCount=lockCount;
 root.add(locks);
 const half=d.x*.008;
 let collisions=0,faceContacts=0,bodyContacts=0,accumulator=0,elapsed=0;
 // Conservative, real-head-derived frontal collider. In addition to
 // an ellipsoid it uses the actual sculpted vertices for the scalp roots.
 const headCenter=f3(center.x,box.min.y+d.y*.635,center.z);
 const rx=d.x*.455,ry=d.y*.322,rz=d.z*.46;
 function resolveCollision(p){
  const q=f3((p.x-headCenter.x)/rx,(p.y-headCenter.y)/ry,
   (p.z-headCenter.z)/rz);
  const len=q.length();
  if(len<1&&p.y>box.min.y+d.y*.36){
   const normal=q.lengthSq()>1e-8?q.normalize():f3(0,0,1);
   p.set(headCenter.x+normal.x*rx*1.015,
    headCenter.y+normal.y*ry*1.015,
    headCenter.z+normal.z*rz*1.015);
   collisions++;faceContacts++;
  }
  for(const c of colliders){
   if(projectCapsule(p,c.a,c.b,c.r+d.x*.006)){
    collisions++;bodyContacts++;
   }
  }
 }
 function writeGeometry(){
  for(let i=0;i<strands.length;i++){
   const strand=strands[i];
   for(let j=0;j<=segments;j++){
    const p=strand.points[j],t=j/segments;
    const width=half*(1-.86*t)*(.78+.34*fract(i*.35));
    for(let k=0;k<4;k++){
     const at=(i*(segments+1)*4+j*4+k)*3;
     // Two crossed hair ribbons: visible at frontal and side angles.
     vertices[at]=p.x+width*(k===0?-1:k===1?1:0);
     vertices[at+1]=p.y;
     vertices[at+2]=p.z+width*(k===2?-1:k===3?1:0);
    }
   }
  }
  attr.needsUpdate=true;
  geo.computeVertexNormals();geo.computeBoundingSphere();
 }
 function update(dt=.016){
  accumulator+=Math.min(Math.max(0,dt),.05);
  if(accumulator<1/30)return;
  const step=Math.min(accumulator,.05);accumulator=0;elapsed+=step;
  for(let i=0;i<strands.length;i++){
   const s=strands[i];
   s.points[0].copy(s.root);
   for(let j=1;j<=segments;j++){
    const p=s.points[j],v=s.vel[j],goal=s.rest[j];
    const wind=Math.sin(elapsed*1.45+i*.37+j*.20)*d.x*.0012*(j/segments);
    v.multiplyScalar(.82).addScaledVector(goal.clone().sub(p),step*13);
    v.y-=step*d.y*.07;
    p.addScaledVector(v,step);
    p.x+=wind;
    resolveCollision(p);
    const prev=s.points[j-1],target=s.rest[j].distanceTo(s.rest[j-1]);
    const gap=p.clone().sub(prev),length=gap.length();
    if(length>target*1.055&&length>0)
     p.copy(prev).addScaledVector(gap,target*1.055/length);
    resolveCollision(p);
   }
  }
  writeGeometry();
 }
 writeGeometry();
 root.userData.wigReport={
  style:'long-golden-layered-fringe',rooted:true,rootCount:lockCount,
  pointCount:lockCount*(segments+1),realScalpCandidateCount:candidates.length,
  collisionTypes:['head','face','neck','shoulder','chest',...externalColliders.map(c=>c.name||'body')],
  meshCount:2,physicsHz:30
 };
 return {root,update,dispose(){
  root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 },getReport(){
  return {...root.userData.wigReport,collisionEvents:collisions,
   faceContactEvents:faceContacts,bodyContactEvents:bodyContacts};
 },getRootSamples(){
  return strands.slice(0,10).map(s=>({vertexIndex:s.seedIndex,point:s.root.toArray()}));
 }};
}
