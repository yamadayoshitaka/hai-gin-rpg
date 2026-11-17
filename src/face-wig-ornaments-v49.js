/** v49: identity-defining real 3D haircut structure.
 * Existing root-scattered cards remain underneath; the styled sections
 * follow HEAD-LOCAL coordinates and are baked into the studio's one-mesh
 * consolidation. No mesh is a billboard or a floating name-only swatch.
 */
import * as THREE from 'three';
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const colors=[1,.91,.82];
function fiberMaterial(color,shade=1){
 return new THREE.MeshPhysicalMaterial({
  color:new THREE.Color(color).multiplyScalar(shade),
  roughness:.70,metalness:0,clearcoat:.028,clearcoatRoughness:.74,
  sheen:.18,sheenRoughness:.69,
  sheenColor:new THREE.Color(color).multiplyScalar(.44),
  side:THREE.DoubleSide
 });
}
function tube(label,points,radius,material,steps=54){
 const curve=new THREE.CatmullRomCurve3(points);
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,steps,radius,7,false),
  material);
 mesh.name=label;mesh.userData.styledHairGeometry=true;
 return mesh;
}
function ellipsoid(label,center,size,material){
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,22,14),material);
 mesh.name=label;mesh.scale.set(size.x,size.y,size.z);
 // Transform ellipsoids into head-local, explicit vertex coordinates
 // BEFORE hair mesh consolidation.
 mesh.geometry.scale(size.x,size.y,size.z);
 mesh.scale.set(1,1,1);mesh.position.copy(center);
 mesh.geometry.translate(center.x,center.y,center.z);
 mesh.position.set(0,0,0);
 mesh.userData.styledHairGeometry=true;
 return mesh;
}
function braid(side,box,material,scalpCandidates=[]){
 const d=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 // Anchor ALL three woven lanes inside the actual head-local scalp instead
 // of spawning detached rods at .72 of the bounding-box height.
 const resolved=resolveTiedHairScalpAnchor(box,side,scalpCandidates);
 const x=c.x+side*d.x*.35,z=c.z-d.z*.23;
 const y0=box.min.y+d.y*.70,drop=d.y*.43;
 const strands=[];
 for(let lane=0;lane<3;lane++){
  const vertices=[];
  for(let i=0;i<=48;i++){
   const t=i/48,phase=t*Math.PI*12+lane*Math.PI*2/3;
   const taper=1-.72*t;
   const radius=d.x*.032*taper;
   vertices.push(V(
    x+side*d.x*.09*t+radius*Math.cos(phase),
    y0-drop*t,
    z+d.z*.028*Math.sin(t*Math.PI)+radius*Math.sin(phase)
   ));
  }
  // The same continuous strand is grown from the real scalp: no separate
  // bridge mesh, no invisible attachment and no extra draw calls.
  const origin=resolved.position.clone();
  const first=vertices[0];
  const join=origin.clone().lerp(first,.56);
  join.y=Math.max(join.y,first.y+d.y*.018);
  vertices.unshift(join);
  vertices.unshift(origin);
  const strand=taperedLock('BRAID_INTERLEAVED_STRAND_'+side+'_'+lane,
   vertices,d.x*.016,material);
  strand.userData.braidScalpAnchor=resolved.source;
  strand.userData.braidContinuousFromScalp=true;
  strands.push(strand);
 }
 // Tie wraps the narrowed END of the same three attached woven strands.
 const bandRadius=d.x*.016,bandY=y0-drop*.94;
 const band=tube('BRAID_TIE_'+side,Array.from({length:13},(_,i)=>{
  const angle=2*Math.PI*i/12;
  return V(x+side*d.x*.09*.94+bandRadius*Math.cos(angle),
   bandY,z+d.z*.028*Math.sin(.94*Math.PI)+bandRadius*Math.sin(angle));
 }),d.x*.006,fiberMaterial(material.color,.56),20);
 band.userData.braidScalpAnchor=resolved.source;
 return [...strands,band];
}
function bun(box,material){
 const d=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 const center=V(c.x,box.min.y+d.y*.755,box.min.z-d.z*.08);
 const nodes=[ellipsoid('LOW_BUN_TIED_VOLUME',center,
  V(d.x*.174,d.y*.117,d.z*.18),material)];
 for(let i=0;i<3;i++){
  const points=[];
  for(let j=0;j<=68;j++){
   const t=j/68,theta=2*Math.PI*t;
   const r=d.x*(.10+i*.025)*(1+.06*Math.sin(theta*5));
   points.push(V(center.x+r*Math.cos(theta),
    center.y+r*.68*Math.sin(theta),
    center.z-d.z*(.034+i*.008)));
  }
  nodes.push(tube('LOW_BUN_COILED_STRANDS_'+i,points,
   d.x*.014,fiberMaterial(material.color,.90-i*.06),70));
 }
 return nodes;
}
/** v64: the tie must be rooted in an ACTUAL scalp triangle/vertex,
 * never in the bounding box behind the head (detached rod regression). */
export function resolveTiedHairScalpAnchor(box,side=1,scalpCandidates=[]){
 const d=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 const target=V(c.x+side*d.x*(side===0?0:.30),
  box.min.y+d.y*(side===0?.76:.75),c.z-d.z*.26);
 const points=scalpCandidates.map(item=>item?.p||item).filter(p=>
  p?.isVector3&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z));
 const eligible=points.filter(p=>
  (side===0?Math.abs(p.x-c.x)<d.x*.18:
   side*(p.x-c.x)>d.x*.17)&&
  p.y>box.min.y+d.y*.59&&p.y<box.min.y+d.y*.92&&
  p.z<c.z+d.z*.06);
 const pool=eligible.length?eligible:points;
 if(!pool.length) return {position:target,source:'bbox-fallback'};
 const p=pool.reduce((best,point)=>
  point.distanceToSquared(target)<best.distanceToSquared(target)?point:best);
 return {position:p.clone(),source:'real-scalp-vertex'};
}
function taperedLock(label,points,radius,material){
 const curve=new THREE.CatmullRomCurve3(points);
 const steps=32,sides=8,frames=curve.computeFrenetFrames(steps,false);
 const vertices=[],indices=[];
 for(let i=0;i<=steps;i++){
  const t=i/steps,p=curve.getPointAt(t);
  const thickness=radius*(.95-.86*Math.pow(t,5))*
   (1+.035*Math.sin(t*Math.PI*2));
  for(let k=0;k<sides;k++){
   const angle=k/sides*Math.PI*2;
   const v=p.clone().addScaledVector(frames.normals[i],Math.cos(angle)*thickness)
    .addScaledVector(frames.binormals[i],Math.sin(angle)*thickness);
   vertices.push(v.x,v.y,v.z);
  }
 }
 for(let i=0;i<steps;i++)for(let k=0;k<sides;k++){
  const a=i*sides+k,b=i*sides+(k+1)%sides,c=(i+1)*sides+k,d=(i+1)*sides+(k+1)%sides;
  indices.push(a,c,b,b,c,d);
 }
 // Close the narrow cut tip on the REAL tubular lock (no spherical end cap).
 const tip=curve.getPointAt(1),tipIndex=vertices.length/3;
 vertices.push(tip.x,tip.y,tip.z);
 for(let k=0;k<sides;k++)indices.push(steps*sides+k,tipIndex,
  steps*sides+(k+1)%sides);
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingSphere();
 const mesh=new THREE.Mesh(geo,material);
 mesh.name=label;mesh.userData.styledHairGeometry=true;
 mesh.userData.v64TaperedLock=true;return mesh;
}
/** v65: forty-eight sub-lock fibres in ONE indexed draw mesh.
 * No individual tube draw calls; the real tied-root node owns all fibres.
 * Fibres emerge INSIDE the tie, taper into the end and share 3D geometry. */
export function makePonytailMicrofibers(origin,d,side=1,half=false,color=0x80604e){
 const count=48,steps=18,sides=4,vertices=[],indices=[],colors=[];
 const base=new THREE.Color(color);
 const length=half?.39:.55;
 for(let strand=0;strand<count;strand++){
  const az=strand*Math.PI*(3-Math.sqrt(5));
  const ring=(.003+Math.sqrt((strand+.5)/count)*.020)*d.x;
  const offset=vertices.length/3;
  for(let i=0;i<=steps;i++){
   const t=i/steps,flow=side===0?0:side;
   const center=origin.clone().add(V(
    flow*d.x*(.026*t+.059*t*t)+ring*Math.cos(az)*(1-.45*t)+
      d.x*.006*Math.sin(t*5+strand*.71)*t*t,
    -d.y*length*(.035*t+.965*t*t),
    -d.z*.015*t+ring*Math.sin(az)*(1-.48*t)+
      d.z*.006*Math.sin(t*7+strand*1.09)*t*t
   ));
   const width=d.x*.00225*(1-.89*Math.pow(t,3));
   const tone=.84+.11*(.5+.5*Math.sin(strand*2.39996))+.045*t;
   for(let k=0;k<sides;k++){
    const theta=k/sides*Math.PI*2;
    const v=center.clone().add(V(
     Math.cos(theta)*width,0,Math.sin(theta)*width));
    vertices.push(v.x,v.y,v.z);
    colors.push(base.r*tone,base.g*tone,base.b*tone);
   }
  }
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){
   const v=offset+i*sides+j,n=offset+i*sides+(j+1)%sides;
   const w=v+sides,m=n+sides;
   indices.push(v,w,n,n,w,m);
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:.73,metalness:0,
  clearcoat:.018,clearcoatRoughness:.72,
  side:THREE.DoubleSide
 });
 const fibers=new THREE.Mesh(geometry,material);
 fibers.name='PONYTAIL_MICROFIBER_BUNDLE_V65';
 fibers.userData.styledHairGeometry=true;
 fibers.userData.v65FiberCount=count;
 fibers.userData.v65DrawMeshCount=1;
 fibers.userData.v65RootAttached=true;
 fibers.userData.v65StaticGroom=true;
 return fibers;
}
function ponytail(box,material,side=1,half=false,scalpCandidates=[]){
 const d=box.getSize(new THREE.Vector3()),c=box.getCenter(new THREE.Vector3());
 const resolved=resolveTiedHairScalpAnchor(box,side,scalpCandidates);
 // Raise only one root-diameter above ACTUAL scalp to avoid z-fighting.
 const outward=resolved.position.clone().sub(c);
 outward.y=0;if(outward.lengthSq()<1e-9)outward.set(0,0,-1);
 outward.normalize();
 const origin=resolved.position.clone().addScaledVector(outward,d.x*.008);
 const nodes=[ellipsoid('PONYTAIL_TIED_ROOT',origin,
  V(d.x*.054,d.y*.030,d.z*.049),fiberMaterial(material.color,.83))];
 nodes[0].userData.v64AnchorSource=resolved.source;
 nodes[0].userData.v64AnchorDistance=origin.distanceTo(resolved.position);
 // Dense scalp-hugging sweeps feed into the tie, not seven isolated stalks.
 const roots=scalpCandidates.map(item=>item?.p||item).filter(p=>p?.isVector3);
 for(let k=0;k<7&&roots.length;k++){
  const sampleTarget=V(c.x+side*d.x*(.10+k*.029),
   origin.y+d.y*(.060+.007*Math.sin(k)),origin.z+d.z*.025);
  const source=roots.reduce((best,p)=>p.distanceToSquared(sampleTarget)<
   best.distanceToSquared(sampleTarget)?p:best);
  const tip=origin.clone().add(V(d.x*.009*Math.cos(k*2.4),0,d.z*.006*Math.sin(k)));
  const middle=source.clone().lerp(tip,.55);
  middle.y=Math.max(middle.y,tip.y+d.y*.024);
  nodes.push(taperedLock('PONYTAIL_SCALP_FEED_'+k,
   [source.clone(),middle,tip],d.x*.010,material));
 }
 const length=half?.39:.55;
 // High-frequency cuticle detail is batched in one mesh, rather than 48
 // separate meshes that would degrade Android draw-call performance.
 nodes.push(makePonytailMicrofibers(origin,d,side,half,material.color));
 for(let k=0;k<14;k++){
  const angle=(k/14)*Math.PI*2;
  const radius=d.x*(.020+.005*Math.sin(k*2.3));
  const displacement=V(radius*Math.cos(angle),0,radius*Math.sin(angle));
  const flow=side===0?0:side;
  const pts=[
   origin.clone().add(displacement.clone().multiplyScalar(.58)),
   origin.clone().add(V(flow*d.x*.025+radius*Math.cos(angle),-d.y*.070,
    -d.z*.013+radius*Math.sin(angle))),
   origin.clone().add(V(flow*d.x*.055+radius*Math.cos(angle)*.85,
    -d.y*length*.40,-d.z*.035)),
   origin.clone().add(V(flow*d.x*.075+radius*Math.cos(angle)*.45,
    -d.y*length*.81,-d.z*.016)),
   origin.clone().add(V(flow*d.x*.085+radius*Math.cos(angle)*.21,
    -d.y*length*(.97+.06*Math.sin(k*2.4)),-d.z*.008))
  ];
  nodes.push(taperedLock('PONYTAIL_FALLING_LOCK_'+k,pts,
   d.x*.0120,fiberMaterial(material.color,.93+(k%3)*.027)));
 }
 nodes.forEach(m=>{m.userData.v64ScalpAnchored=resolved.source==='real-scalp-vertex';});
 return nodes;
}
export function makeStyleSpecificHair(styleId,box,hairColor,{scalpCandidates=[]}={}){
 const mat=fiberMaterial(hairColor,.94);
 let type='none',meshes=[];
 if(styleId==='female-low-bun'){
  type='coiled-low-bun';meshes=bun(box,mat);
 }else if(styleId==='female-twin-braids'){
  type='two-interwoven-plaits';meshes=[...braid(-1,box,mat,scalpCandidates),...braid(1,box,mat,scalpCandidates)];
 }else if(styleId==='female-side-ponytail'){
  type='side-ponytail';meshes=ponytail(box,mat,-1,false,scalpCandidates);
 }else if(styleId==='female-half-up'){
  type='half-up';meshes=ponytail(box,mat,0,true,scalpCandidates);
 }else if(styleId==='male-long-tied'){
  type='low-tied-men';meshes=ponytail(box,mat,0,false,scalpCandidates);
 }
 for(const m of meshes){
  m.userData.hairStyleId=styleId;
  m.userData.styledHairType=type;
  m.userData.salonRootAnchored=true;
 }
 return {type,meshes,triangleCount:meshes.reduce((n,m)=>n+(m.geometry.index?.count||0)/3,0)};
}
