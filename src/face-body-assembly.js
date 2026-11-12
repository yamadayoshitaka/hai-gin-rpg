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

function keepBodyBelowNeck(root,cutY){
 root.updateWorldMatrix(true,true);
 let originalTriangles=0,keptTriangles=0,removedTriangles=0;
 let keptMeshes=0;
 const origin=V();
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
  const geometry=mesh.geometry;
  const pos=geometry.getAttribute('position'),index=geometry.getIndex();
  const originalCount=index?index.count:pos.count;
  if(originalCount%3)throw Error('Triangle body geometry required');
  originalTriangles+=originalCount/3;
  const heights=new Float64Array(pos.count);
  for(let i=0;i<pos.count;i++)
   heights[i]=origin.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld).y;
  const groups=geometry.groups?.length?geometry.groups:
   [{start:0,count:originalCount,materialIndex:0}];
  const kept=[],newGroups=[];
  for(const group of groups){
   const start=kept.length;
   const end=Math.min(originalCount,group.start+group.count);
   for(let i=group.start;i+2<end;i+=3){
    const i0=index?index.getX(i):i;
    const i1=index?index.getX(i+1):i+1;
    const i2=index?index.getX(i+2):i+2;
    // The independent head overlaps the seam and masks crossing triangles.
    if(Math.max(heights[i0],heights[i1],heights[i2])>cutY){
     removedTriangles++;continue;
    }
    kept.push(i0,i1,i2);keptTriangles++;
   }
   if(kept.length>start)newGroups.push({start,count:kept.length-start,
    materialIndex:group.materialIndex||0});
  }
  const changed=geometry.clone();
  changed.setIndex(kept);
  changed.clearGroups();
  for(const group of newGroups)changed.addGroup(group.start,group.count,group.materialIndex);
  changed.computeBoundingBox();changed.computeBoundingSphere();
  mesh.geometry=changed;
  mesh.material=Array.isArray(mesh.material)?
   mesh.material.map(m=>m?.clone()||m):mesh.material?.clone();
  mesh.visible=kept.length>0;
  if(mesh.visible)keptMeshes++;
  mesh.userData.clippedDonorHead=true;
 });
 if(!keptMeshes||!removedTriangles)throw Error('Actual body head could not be trimmed');
 return {originalTriangles,keptTriangles,removedTriangles,keptMeshes};
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
 let contacts=0;
 const resolve=point=>{
  const depth=query(point.x,point.y);
  if(!depth||point.z>=depth.front+clearance||
    point.z<=depth.rear-clearance)return false;
  // A naturally falling lock must escape to whichever side of the real
  // torso it is closest to, rather than passing through the chest.
  const frontDistance=Math.abs(depth.front-point.z);
  const rearDistance=Math.abs(point.z-depth.rear);
  point.z=frontDistance<rearDistance?
   depth.front+clearance:depth.rear-clearance;
  contacts++;return true;
 };
 return {
  query,resolve,
  getReport:()=>({kind:'actual-imported-body-triangle-depth',
   collisionTriangleCount:raw.length/9,gridCells:grid.length,
   contactCorrections:contacts,skinOverlapRepair:clearance,
   underlyingBodyBounds:!!b})
 };
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
 const shift=new THREE.Vector3(
  headCenter.x-bodyCenter.x,
  headBox.max.y-bodyBox.max.y,
  headCenter.z-bodyCenter.z
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
   let tone=skinColor;
   if(ny<.23)tone=bootsColor;
   else if(ny<.49)tone=pantsColor;
   else if(ny<.825&&nx<.67)
    tone=ny>.66&&ny<.77&&nx<.53?armourColor:clothColor;
   else if(ny>.73&&ny<.84&&nx>=.48&&nx<.84)
    tone=armourColor;
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
