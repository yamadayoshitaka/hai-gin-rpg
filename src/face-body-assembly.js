/**
 * A detachable CC0 female body fitted to the *real* independent head.
 * No changes to source GLBs, face morphology, town or battle models.
 * The donor's original head is physically removed from cloned triangle
 * indices; a shader-only clippingPlane would not survive GLB export.
 */
import * as THREE from 'three';

const V=()=>new THREE.Vector3();
const finite=x=>Number.isFinite(x);
const bounds=root=>new THREE.Box3().setFromObject(root);
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

/**
 * Clip REAL mesh triangles at a neck plane, interpolating every PBR vertex
 * attribute at the intersection. Deleting any intersecting polygon in full
 * produced the severe zigzag collar seen in Chromium screenshots.
 *
 * Vertices are unshared on this export-only cloned geometry. Each face
 * retains its material group and all UV / normal / vertex-colour data.
 */
export function clipMeshGeometryAtWorldNeck(mesh,cutY,{keepBelow=true}={}){
 if(!mesh?.isMesh||!mesh.geometry?.getAttribute('position'))
  throw Error('Real triangle mesh required for neck cut');
 mesh.updateWorldMatrix(true,false);
 const geo=mesh.geometry,attrNames=Object.keys(geo.attributes);
 const originalIndex=geo.getIndex(),pos=geo.getAttribute('position');
 const triCount=originalIndex?originalIndex.count:pos.count;
 if(triCount%3!==0)throw Error('Triangle-only donor geometry required');
 const groups=geo.groups?.length?geo.groups:
  [{start:0,count:triCount,materialIndex:0}];
 const transformed=new Float64Array(pos.count),world=V();
 for(let i=0;i<pos.count;i++)
  transformed[i]=world.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).y;
 const attrs=Object.fromEntries(attrNames.map(name=>[name,geo.getAttribute(name)]));
 const output=Object.fromEntries(attrNames.map(name=>[name,[]]));
 const groupRanges=[],indexOut=[];
 let removed=0,kept=0,intersections=0,created=0;
 const readVertex=i=>{
  const values={};
  for(const [name,attr] of Object.entries(attrs)){
   const vals=[];
   for(let j=0;j<attr.itemSize;j++)vals.push(attr.getComponent(i,j));
   values[name]=vals;
  }
  return {y:transformed[i],values};
 };
 const inside=p=>keepBelow?p.y<=cutY+1e-8:p.y>=cutY-1e-8;
 const intersect=(left,right)=>{
  const t=Math.max(0,Math.min(1,(cutY-left.y)/(right.y-left.y)));
  const values={};
  for(const name of attrNames){
   const a=left.values[name],b=right.values[name];
   values[name]=a.map((v,j)=>v+(b[j]-v)*t);
  }
  intersections++;
  return {y:cutY,values};
 };
 const emit=point=>{
  for(const name of attrNames)output[name].push(...point.values[name]);
  indexOut.push(indexOut.length);
 };
 for(const group of groups){
  const begin=indexOut.length;
  for(let i=group.start;i+2<Math.min(triCount,group.start+group.count);i+=3){
   const triangle=[0,1,2].map(j=>readVertex(
    originalIndex?originalIndex.getX(i+j):i+j));
   let polygon=[];
   for(let j=0;j<3;j++){
    const from=triangle[j],to=triangle[(j+1)%3];
    const fromIn=inside(from),toIn=inside(to);
    if(fromIn&&toIn)polygon.push(to);
    else if(fromIn&&!toIn)polygon.push(intersect(from,to));
    else if(!fromIn&&toIn)polygon.push(intersect(from,to),to);
   }
   if(polygon.length<3){removed++;continue;}
   if(polygon.length!==3||triangle.some(v=>!inside(v)))removed++;
   for(let j=1;j+1<polygon.length;j++){
    emit(polygon[0]);emit(polygon[j]);emit(polygon[j+1]);
    kept++;created++;
   }
  }
  if(indexOut.length>begin)groupRanges.push({
   start:begin,count:indexOut.length-begin,
   materialIndex:group.materialIndex||0
  });
 }
 const clipped=new THREE.BufferGeometry();
 for(const name of attrNames){
  const original=attrs[name],numbers=output[name];
  // Vertex colors and UVs require interpolation, so use Float32Arrays.
  const buffer=new THREE.Float32BufferAttribute(numbers,original.itemSize);
  clipped.setAttribute(name,buffer);
 }
 clipped.setIndex(indexOut);clipped.clearGroups();
 for(const g of groupRanges)clipped.addGroup(g.start,g.count,g.materialIndex);
 clipped.computeBoundingBox();clipped.computeBoundingSphere();
 return {geometry:clipped,removedTriangles:removed,
  keptTriangles:kept,intersectionVertices:intersections,
  createdTriangles:created};
}
function keepBodyBelowNeck(root,cutY){
 root.updateWorldMatrix(true,true);
 let originalTriangles=0,keptTriangles=0,removedTriangles=0;
 let intersectionVertices=0,keptMeshes=0;
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
  const pos=mesh.geometry.getAttribute('position');
  const idx=mesh.geometry.getIndex();
  originalTriangles+=(idx?idx.count:pos.count)/3;
  const cut=clipMeshGeometryAtWorldNeck(mesh,cutY,{keepBelow:true});
  mesh.geometry=cut.geometry;
  mesh.material=Array.isArray(mesh.material)?
   mesh.material.map(m=>m?.clone()||m):mesh.material?.clone();
  mesh.visible=cut.keptTriangles>0;
  if(mesh.visible)keptMeshes++;
  keptTriangles+=cut.keptTriangles;removedTriangles+=cut.removedTriangles;
  intersectionVertices+=cut.intersectionVertices;
  mesh.userData.clippedDonorHead=true;
 });
 if(!keptMeshes||!removedTriangles)
  throw Error('Actual body head could not be trimmed');
 return {originalTriangles,keptTriangles,removedTriangles,keptMeshes,
  intersectionVertices,clipMethod:'interpolated-plane-triangles'};
}
/**
 * Head-local body surface: front+rear z at the actual imported body mesh.
 * Rows/columns are an acceleration index, not an ellipsoid approximation.
 */
export function buildBodyDepthCollision(bodyRoot,headMesh,{clearance=.006}={}){
 bodyRoot.updateWorldMatrix(true,true);
 headMesh.updateWorldMatrix(true,false);
 const headInverse=headMesh.matrixWorld.clone().invert();
 const raw=[];
 const local=V(),vertices=[V(),V(),V()];
 const b=bodyRoot.userData.attachmentBodyBounds;
 const headBox=headMesh.geometry.boundingBox;
 const yy0=headBox.min.y-(headBox.max.y-headBox.min.y)*1.25;
 const yy1=headBox.min.y+(headBox.max.y-headBox.min.y)*.57;
 bodyRoot.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible||!mesh.geometry?.getAttribute('position'))return;
  const geo=mesh.geometry,attr=geo.getAttribute('position'),idx=geo.getIndex();
  const count=idx?idx.count:attr.count;
  const toLocal=headInverse.clone().multiply(mesh.matrixWorld);
  for(let i=0;i+2<count;i+=3){
   for(let j=0;j<3;j++){
    const k=idx?idx.getX(i+j):i+j;
    vertices[j].fromBufferAttribute(attr,k).applyMatrix4(toLocal);
   }
   const mid=(vertices[0].y+vertices[1].y+vertices[2].y)/3;
   if(mid<yy0||mid>yy1)continue;
   raw.push(...vertices.flatMap(p=>[p.x,p.y,p.z]));
  }
 });
 const cols=32,rows=64,grid=Array.from({length:cols*rows},()=>[]);
 const headWidth=headBox.max.x-headBox.min.x;
 const minX=headBox.min.x-headWidth*.70,maxX=headBox.max.x+headWidth*.70;
 const dx=maxX-minX,dy=yy1-yy0;
 const indexAt=(x,y)=>clamp(Math.floor((x-minX)/dx*cols),0,cols-1)+
  cols*clamp(Math.floor((y-yy0)/dy*rows),0,rows-1);
 for(let tri=0;tri<raw.length/9;tri++){
  const a=tri*9;
  const xs=[raw[a],raw[a+3],raw[a+6]],ys=[raw[a+1],raw[a+4],raw[a+7]];
  const det=(ys[1]-ys[2])*(xs[0]-xs[2])+(xs[2]-xs[1])*(ys[0]-ys[2]);
  if(Math.abs(det)<1e-12)continue;
  const loX=clamp(Math.floor((Math.min(...xs)-minX)/dx*cols),0,cols-1);
  const hiX=clamp(Math.floor((Math.max(...xs)-minX)/dx*cols),0,cols-1);
  const loY=clamp(Math.floor((Math.min(...ys)-yy0)/dy*rows),0,rows-1);
  const hiY=clamp(Math.floor((Math.max(...ys)-yy0)/dy*rows),0,rows-1);
  for(let y=loY;y<=hiY;y++)for(let x=loX;x<=hiX;x++)
   grid[x+cols*y].push(a);
 }
 const query=(x,y)=>{
  if(x<minX||x>maxX||y<yy0||y>yy1)return null;
  let front=-Infinity,rear=Infinity;
  for(const a of grid[indexAt(x,y)]){
   const x0=raw[a],y0=raw[a+1],z0=raw[a+2];
   const x1=raw[a+3],y1=raw[a+4],z1=raw[a+5];
   const x2=raw[a+6],y2=raw[a+7],z2=raw[a+8];
   const det=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2);
   const u=((y1-y2)*(x-x2)+(x2-x1)*(y-y2))/det;
   const v=((y2-y0)*(x-x2)+(x0-x2)*(y-y2))/det;
   const w=1-u-v;
   if(u<-.000003||v<-.000003||w<-.000003)continue;
   const z=u*z0+v*z1+w*z2;
   front=Math.max(front,z);rear=Math.min(rear,z);
  }
  return finite(front)&&finite(rear)?{front,rear}:null;
 };
 let contacts=0,frontContacts=0,rearContacts=0;
 // A strand from the FRONT temple must never escape through the rear torso:
 // the old nearest-depth projection put visible locks inside the shoulder.
 // The caller supplies its scalp-origin side; omitted side is legacy nearest.
 const resolve=(point,{side='nearest',surfaceOffset=0}={})=>{
  const depth=query(point.x,point.y);
  if(!depth)return false;
  const margin=clearance+clamp(Number(surfaceOffset)||0,0,clearance*3);
  if(side==='front'){
   if(point.z>=depth.front+margin)return false;
   point.z=depth.front+margin;contacts++;frontContacts++;return true;
  }
  if(side==='rear'){
   if(point.z<=depth.rear-margin)return false;
   point.z=depth.rear-margin;contacts++;rearContacts++;return true;
  }
  if(point.z>=depth.front+margin||point.z<=depth.rear-margin)return false;
  const frontDistance=Math.abs(depth.front-point.z);
  const rearDistance=Math.abs(point.z-depth.rear);
  point.z=frontDistance<=rearDistance?
   depth.front+margin:depth.rear-margin;
  contacts++;return true;
 };
 return {
  query,resolve,
  getReport:()=>({kind:'actual-imported-body-triangle-depth',
   collisionTriangleCount:raw.length/9,gridCells:grid.length,
   contactCorrections:contacts,frontSideCorrections:frontContacts,
   rearSideCorrections:rearContacts,skinOverlapRepair:clearance,
   underlyingBodyBounds:!!b})
 };
}

/** Keep actual head/neck, but remove the donor head GLB's SHOULDER BUST.
 * Rendering that bust alongside the real body caused a broad skin-coloured
 * cape/second torso. The uncropped scalp source must be cloned BEFORE this
 * operation so independent wigs remain rooted on the same real head.
 */
export function removeHeadBustBelowNeck(face,cutY){
 if(!face?.isMesh||!Number.isFinite(cutY))
  throw Error('Real head and neck-cut plane required');
 const clip=clipMeshGeometryAtWorldNeck(face,cutY,{keepBelow:false});
 if(clip.removedTriangles===0||clip.keptTriangles<10)
  throw Error('Head bust could not be cropped without damaging the face');
 face.geometry=clip.geometry;
 face.userData.bustRemovedAtNeck=true;
 face.userData.bustTrianglesRemoved=clip.removedTriangles;
 face.userData.neckIntersectionVertices=clip.intersectionVertices;
 return {removedTriangles:clip.removedTriangles,
  remainingTriangles:clip.keptTriangles,
  cutY,intersectionVertices:clip.intersectionVertices,
  clipMethod:'interpolated-plane-triangles'};
}
/**
 * Seal the two open cut rings of the *displayed* real head and body.
 * The donor bust must be cropped above shoulder flaps; otherwise the
 * leftover head skin appears as white, disconnected collar triangles.
 * A short skin-coloured, double-sided, capped neck volume overlaps both
 * real mesh cuts. It is owned by the face and survives GLB export.
 * This does not pretend to retopologize the source body.
 */
export function createSealedNeckBridge(face,attachment,{headCutY,bodyCutY}={}){
 if(!face?.isMesh||!attachment?.root||
  !Number.isFinite(headCutY)||!Number.isFinite(bodyCutY))
  throw Error('Cropped head, real torso and neck-cut heights required');
 const geo=face.geometry,pos=geo.getAttribute('position');
 geo.computeBoundingBox();
 const box=geo.boundingBox,h=box.max.y-box.min.y;
 // clipMeshGeometryAtWorldNeck cuts against WORLD Y. The actual imported
 // Blender mesh may have a nonidentity node transform: never compare its
 // local vertex Y to a world Y, which produced an empty neck-ring sample.
 face.updateWorldMatrix(true,false);
 const inverse=face.matrixWorld.clone().invert();
 const headLocalCut=new THREE.Vector3(0,headCutY,0).applyMatrix4(inverse).y;
 const bodyLocalCut=new THREE.Vector3(0,bodyCutY,0).applyMatrix4(inverse).y;
 // Intersect both visible cuts, and extend the bridging geometry into
 // BOTH meshes. Previous versions sampled higher unrelated neck triangles,
 // producing a narrow band that stopped short of the actual open collar.
 const topY=headLocalCut+h*.018;
 const bottomY=bodyLocalCut-h*.045;
 if(topY<=bottomY)throw Error('Neck overlap has invalid local-space order');
 const near=[],cutRing=[],all=[];
 for(let i=0;i<pos.count;i++){
  const y=pos.getY(i),point=[pos.getX(i),pos.getZ(i)];
  all.push({dy:Math.abs(y-headLocalCut),point});
  if(Math.abs(y-headLocalCut)<=h*.0065)cutRing.push(point);
  if(Math.abs(y-headLocalCut)<=h*.038)near.push(point);
 }
 // Clip-generated vertices ON the actual neck cut are preferable to
 // nearby face/shoulder triangles, especially from a low-polygon donor.
 if(cutRing.length>=12)near.splice(0,near.length,...cutRing);
 if(near.length<12){
  all.sort((a,b)=>a.dy-b.dy);
  for(const v of all.slice(0,Math.min(128,all.length)))near.push(v.point);
 }
 if(near.length<12)throw Error('Real neck mesh missing enough vertices');
 const extent=(values,q)=>{
  const sorted=values.slice().sort((a,b)=>a-b);
  return sorted[Math.min(sorted.length-1,Math.floor(q*(sorted.length-1)))];
 };
 const xs=near.map(p=>p[0]),zs=near.map(p=>p[1]);
 const cx=(extent(xs,.06)+extent(xs,.94))*.5,
  cz=(extent(zs,.06)+extent(zs,.94))*.5;
 const rx=clamp((extent(xs,.96)-extent(xs,.04))*.52,h*.060,h*.20);
 const rz=clamp((extent(zs,.96)-extent(zs,.04))*.52,h*.050,h*.19);
 // Fit the BOTTOM ring to actual torso's clipped vertex contour as well as
 // the head's top contour. The old constant-radius tube did not touch the
 // body and looked like a separate white neck insert in profile.
 const torsoContour=[],world=new THREE.Vector3(),local=new THREE.Vector3();
 attachment.root.updateWorldMatrix(true,true);
 attachment.root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible||!mesh.geometry?.getAttribute('position'))return;
  const a=mesh.geometry.getAttribute('position');
  const stride=Math.max(1,Math.floor(a.count/32000));
  for(let n=0;n<a.count;n+=stride){
   world.fromBufferAttribute(a,n).applyMatrix4(mesh.matrixWorld);
   // The donor body was clipped precisely at bodyCutY; contour
   // triangles at that exact plane give the real rim, not chest offsets.
   if(Math.abs(world.y-bodyCutY)>h*.013)continue;
   local.copy(world).applyMatrix4(inverse);
   if(Math.abs(local.x-cx)>rx*2.3||
      Math.abs(local.z-cz)>rz*2.3)continue;
   torsoContour.push([local.x,local.z]);
  }
 });
 const ringFor=(points,angle,baseX,baseZ)=>{
  let best=null,bestScore=Infinity;
  for(const item of points){
   const dx=(item[0]-cx)/(rx||1),dz=(item[1]-cz)/(rz||1);
   const length=Math.hypot(dx,dz);
   if(length<.42||length>2.1)continue;
   const a=Math.atan2(dz,dx),dist=Math.abs(Math.atan2(
    Math.sin(a-angle),Math.cos(a-angle)));
   const score=dist+Math.abs(length-1)*.15;
   if(score<bestScore){bestScore=score;best=item;}
  }
  return best&&bestScore<.75?
   [THREE.MathUtils.lerp(baseX,best[0],.94),
    THREE.MathUtils.lerp(baseZ,best[1],.94)]:[baseX,baseZ];
 };
 const segments=48,levels=5,verts=[],uv=[],indices=[];
 const headRing=[],bodyRing=[];
 for(let i=0;i<=segments;i++){
  const angle=i/segments*Math.PI*2;
  const x=cx+rx*Math.cos(angle),z=cz+rz*Math.sin(angle);
  headRing.push(ringFor(near,angle,x,z));
  bodyRing.push(ringFor(torsoContour,angle,x,z));
 }
 for(let j=0;j<=levels;j++){
  const t=j/levels,fade=t*t*(3-2*t);
  const y=topY+(bottomY-topY)*t;
  for(let i=0;i<=segments;i++){
   const upper=headRing[i],lower=bodyRing[i];
   const xx=THREE.MathUtils.lerp(upper[0],lower[0],fade);
   const zz=THREE.MathUtils.lerp(upper[1],lower[1],fade);
   // Slightly expand into the ring of existing real polygons to prevent
   // gaps through which the background was still visible from the side.
   const overlap=1.075;
   verts.push(cx+(xx-cx)*overlap,y,cz+(zz-cz)*overlap);
   uv.push(i/segments,t);
  }
 }
 for(let j=0;j<levels;j++)for(let i=0;i<segments;i++){
  const a=j*(segments+1)+i,b=a+segments+1;
  indices.push(a,b,a+1,a+1,b,b+1);
 }
 // The caps remove the open, visible hole when looking down from the top.
 for(const [ring,capY,flip] of [[0,topY,false],[levels,bottomY,true]]){
  const center=verts.length/3;verts.push(cx,capY,cz);uv.push(.5,.5);
  for(let i=0;i<segments;i++){
   const a=ring*(segments+1)+i,b=a+1;
   if(flip)indices.push(center,b,a);else indices.push(center,a,b);
  }
 }
 const neckGeo=new THREE.BufferGeometry();
 neckGeo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 neckGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 neckGeo.setIndex(indices);neckGeo.computeVertexNormals();
 const skin=new THREE.MeshStandardMaterial({
  color:0xebc5b7,roughness:.82,metalness:0,side:THREE.DoubleSide
 });
 const seal=new THREE.Mesh(neckGeo,skin);
 seal.name='REAL_HEAD_BODY_CLOSED_NECK_SEAL';
 seal.userData.neckBridge=true;
 seal.userData.fromOriginalHeadContour=true;
 seal.userData.realBodyConnection=true;
 seal.userData.capEnds=true;
 face.add(seal);
 attachment.report.neckSealed=true;
 attachment.report.neckBridgeTriangles=indices.length/3;
 attachment.report.neckBridgeBodyContourSamples=torsoContour.length;
 attachment.report.neckBridgeUsesBodyContour=torsoContour.length>=12;
 attachment.report.neckBridgeUsesExactHeadCut=cutRing.length>=12;
 attachment.report.neckBridgeHeadCutSamples=cutRing.length;
 attachment.report.neckBridgeRingOverlap=1.075;
 attachment.report.neckBridgeUpperInsideActualHead=true;
 attachment.report.neckBridgeLowerInsideActualBody=true;
 attachment.report.neckBridgeHeadCutY=headCutY;
 attachment.report.neckBridgeBodyCutY=bodyCutY;
 return seal;
}
// The bounds centroid includes nose, chest and hips and is NOT the neck
// centre. Top-down previews need the two actual neck cross-sections aligned.
function measuredNeckCenter(root,planeY,halfWindow,maxSideDistance,baseline){
 const points=[],world=V();
 root.updateWorldMatrix(true,true);
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
  const position=mesh.geometry.getAttribute('position');
  for(let i=0;i<position.count;i++){
   world.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
   if(Math.abs(world.y-planeY)>halfWindow||
      Math.abs(world.x-baseline.x)>maxSideDistance)continue;
   points.push([world.x,world.z]);
  }
 });
 if(points.length<18)return null;
 const percentile=(values,p)=>{
  values.sort((a,b)=>a-b);
  return values[Math.max(0,Math.min(values.length-1,
   Math.floor(p*(values.length-1))))];
 };
 // The mid-extent of the collar ring, not a nose-biased arithmetic mean.
 const xs=points.map(v=>v[0]),zs=points.map(v=>v[1]);
 return {x:(percentile(xs,.10)+percentile(xs,.90))*.5,
  z:(percentile(zs,.10)+percentile(zs,.90))*.5,
  samples:points.length};
}
export function attachIndependentHeadToBody(headModel,bodySource,{
 outfitSource=null,characterId='hero-girl-01',armor='#c9cbd3',cloth='#263958'
}={}){
 if(!headModel?.root||!headModel?.face||!bodySource?.traverse)
  throw Error('Real independent head and source body required');
 const headRoot=headModel.root,head=headModel.face;
 headRoot.updateWorldMatrix(true,true);bodySource.updateWorldMatrix(true,true);
 const headBox=bounds(head),bodyBox=bounds(bodySource);
 const height=headBox.max.y-headBox.min.y;
 if(height<.20||height>.90)throw Error('Head units invalid');
 const sourceSize=bodyBox.getSize(V());
 if(sourceSize.y<1||sourceSize.y>2.5)
  throw Error('Body source must be a real human-scale GLB');
 const bodyCenter=bodyBox.getCenter(V()),headCenter=headBox.getCenter(V());
 const headNeck=measuredNeckCenter(head,headBox.max.y-height*.76,
  height*.060,height*.36,headCenter);
 const bodyNeck=measuredNeckCenter(bodySource,bodyBox.max.y-height*.76,
  height*.060,height*.36,bodyCenter);
 const shift=new THREE.Vector3(
  (headNeck?.x??headCenter.x)-(bodyNeck?.x??bodyCenter.x),
  headBox.max.y-bodyBox.max.y,
  (headNeck?.z??headCenter.z)-(bodyNeck?.z??bodyCenter.z)
 );
 const attachment=new THREE.Group();
 attachment.name='HEROINE_REAL_BODY_ATTACHMENT';
 attachment.userData.characterId=characterId;
 attachment.userData.sourceBody='realistic-body-female.glb';
 const actualBody=bodySource.clone(true);
 actualBody.name='CC0_CLIPPED_FEMALE_BODY';
 attachment.add(actualBody);
 // Avoid overlaying the unfitted Viking donor outfit: its duplicate
 // arms and floating sleeves expose the naked source torso. Instead apply
 // cloth/metal colors to the *same physical body surface* (reversible).
 // True armour remeshing remains a separate art-production task.
 attachment.position.copy(shift);
 headRoot.add(attachment);
 headRoot.updateWorldMatrix(true,true);
 const cutY=headBox.max.y-height*.76;
 const clipped=keepBodyBelowNeck(actualBody,cutY);
 attachment.userData.attachmentBodyBounds=bodyBox.clone();
 const bodyMinY=bodyBox.min.y+shift.y,size=bodyBox.getSize(V());
 const worldX=bodyCenter.x+shift.x;
 const originalMaterials=new Map(),outfitMaterials=new Map();
 const clothColor=new THREE.Color(cloth),armourColor=new THREE.Color(armor);
 const skinColor=new THREE.Color('#edcbbf');
 const pantsColor=new THREE.Color('#202f4b');
 const bootsColor=new THREE.Color('#564736');
 actualBody.updateWorldMatrix(true,true);
 actualBody.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.visible)return;
  const geo=mesh.geometry,positions=geo.getAttribute('position');
  const colors=[],vertex=V();
  for(let i=0;i<positions.count;i++){
   vertex.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);
   const ny=(vertex.y-bodyMinY)/size.y;
   const nx=Math.abs((vertex.x-worldX)/(size.x*.5));
   // Smooth PBR colour transitions across source mesh triangles.
   // The old boolean thresholds created a zigzag, white-to-blue sawtooth
   // neckline on the coarse donor torso polygon topology.
   const sm=THREE.MathUtils.smoothstep;
   const pants=sm(ny,.13,.22)*(1-sm(ny,.45,.55));
   const boots=1-sm(ny,.16,.25);
   const torso=sm(ny,.47,.57)*(1-sm(ny,.815,.89))*
    (1-sm(nx,.60,.78));
   const chest=sm(ny,.65,.70)*(1-sm(ny,.765,.835))*
    (1-sm(nx,.43,.63));
   const shoulder=sm(ny,.70,.78)*(1-sm(ny,.82,.87))*
    sm(nx,.47,.59)*(1-sm(nx,.82,.96));
   const tone=skinColor.clone().lerp(pantsColor,pants)
    .lerp(clothColor,torso)
    .lerp(armourColor,Math.max(chest,shoulder))
    .lerp(bootsColor,boots);
   colors.push(tone.r,tone.g,tone.b);
  }
  // The body mesh is a clone. Its original geometry and UV source survive.
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  originalMaterials.set(mesh,mesh.material);
  const colored=Array.isArray(mesh.material)?
   mesh.material.map(m=>m?.clone()||m):mesh.material?.clone();
  for(const mat of Array.isArray(colored)?colored:[colored]){
   if(!mat)continue;
   mat.color?.set(0xffffff);mat.map=null;
   mat.vertexColors=true;mat.roughness=.70;mat.needsUpdate=true;
  }
  outfitMaterials.set(mesh,colored);
 });
 const setOutfitVisible=enabled=>{
  for(const [mesh,material] of originalMaterials)
   mesh.material=enabled?outfitMaterials.get(mesh):material;
 };
 setOutfitVisible(true);
 const bodySampler=buildBodyDepthCollision(attachment,head,{clearance:height*.009});
 const report={
  connectedCharacterId:characterId,
  bodySource:'realistic-body-female.glb',
  sourceBodyHeight:sourceSize.y,
  neckSeamY:cutY,
  neckOverlap:headBox.max.y-height-cutY,
  alignmentMode:headNeck&&bodyNeck?'real-neck-cross-sections':'fallback-bounds',
  neckAxisDelta:{x:shift.x,z:shift.z},
  neckAxisHeadSamples:headNeck?.samples||0,
  neckAxisBodySamples:bodyNeck?.samples||0,
  donorHeadTrianglesRemoved:clipped.removedTriangles,
  donorBodyTrianglesRetained:clipped.keptTriangles,
  hasRealBody:true,
  outfitSource:'provisional fitted navy/silver body-surface palette',
  noDuplicateOutfitLimbs:true,
  bodyCollider:bodySampler.getReport()
 };
 attachment.userData.report=report;
 return {root:attachment,body:actualBody,report,bodyCollider:bodySampler,
  setOutfitVisible,
  dispose(){
   attachment.removeFromParent();
   attachment.traverse(mesh=>{
    if(!mesh.isMesh)return;
    mesh.geometry?.dispose();
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    mats.forEach(m=>m?.dispose?.());
   });
  }};
}
