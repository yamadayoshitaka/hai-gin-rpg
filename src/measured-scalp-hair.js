import {MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';
// Hair grows from the imported, skinned head surface; no synthetic spherical helmet.
// 100k logical roots; render a capped, deterministic LOD as curved line segments.
export const HAIR_CATEGORIES=Object.freeze({
 short:{back:.022,side:.017,front:.014},bob:{back:.19,side:.16,front:.075},
 medium:{back:.27,side:.22,front:.09},long:{back:.43,side:.36,front:.11},
 wolf:{back:.32,side:.13,front:.08},ponytail:{back:.45,side:.13,front:.07},
 swept:{back:.042,side:.033,front:.026},spiky:{back:.035,side:.030,front:.025},
 curly:{back:.20,side:.17,front:.08},braid:{back:.39,side:.22,front:.08}
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fract=x=>x-Math.floor(x);
const hash=x=>fract(Math.sin(x*127.1+13.7)*43758.5453);
export function attachMeasuredHair(THREE,model,{style='short',color='#30211b',logicalCount=100000,renderCount=6000}={}){
 if(/^(bald|none|shaved|skinhead)$/i.test(String(style))){const old=[];model.traverse(n=>{if(n.isMesh&&/hair|scalp|wig/i.test(n.name)){old.push([n,n.visible]);n.visible=false;}});return {ok:true,update(){},dispose(){old.forEach(([n,v])=>n.visible=v);},stats:{style,logicalCount:0,renderedStrands:0,scalpTriangles:0}};}
 model.updateWorldMatrix(true,true);
 const bones=[];model.traverse(n=>{if(n.isBone&&/head/i.test(n.name)&&!/end|hair/i.test(n.name))bones.push(n);});
 const head=bones[0];if(!head)return {ok:false,reason:'head bone missing'};
 head.updateWorldMatrix(true,false);
 const inv=head.matrixWorld.clone().invert(),temp=new THREE.Vector3();
 const candidate=[];
 model.traverse(mesh=>{
  if(!mesh.isMesh||/hair|wig|eye|brow|lash|teeth|mouth|tongue|cloth|armor|helmet/i.test(mesh.name))return;
  const pos=mesh.geometry?.getAttribute('position'),idx=mesh.geometry?.index;
  if(!pos||pos.count<20)return;
  const boneIndices=mesh.isSkinnedMesh?mesh.skeleton?.bones.map((b,i)=>/head/i.test(b.name)&&!/end|hair/i.test(b.name)?i:-1).filter(i=>i>=0):[];
  const skinI=mesh.geometry.getAttribute('skinIndex'),skinW=mesh.geometry.getAttribute('skinWeight');
  const isHeadName=/head|face|skin/i.test(mesh.name);
  if(!isHeadName&&(!boneIndices||!boneIndices.length))return;
  const qualifies=i=>{
   if(!skinI||!skinW)return isHeadName;
   let weight=0;
   for(let j=0;j<4;j++)if(boneIndices.includes(skinI.getComponent(i,j)))weight+=skinW.getComponent(i,j);
   return weight>.50 || (isHeadName&&!boneIndices.length);
  };
  const point=i=>{
   if(mesh.isSkinnedMesh&&mesh.getVertexPosition)mesh.getVertexPosition(i,temp);
   else temp.fromBufferAttribute(pos,i);
   return temp.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(inv);
  };
  const faces=Math.floor((idx?idx.count:pos.count)/3);
  const stride=Math.max(1,Math.floor(faces/10000));
  for(let f=0;f<faces;f+=stride){
   const ids=[0,1,2].map(k=>idx?idx.getX(f*3+k):f*3+k);
   if(!ids.every(qualifies))continue;
   const v=ids.map(point);
   if(v.every(p=>Number.isFinite(p.x+p.y+p.z)))candidate.push(v);
  }
 });
 if(candidate.length<12)return {ok:false,reason:'insufficient head triangles',triangles:candidate.length};
 const vertices=candidate.flat(),ys=vertices.map(v=>v.y).sort((a,b)=>a-b);
 const quant=(a,p)=>a[Math.floor((a.length-1)*p)];
 const top=quant(ys,.99),bottom=quant(ys,.10),height=top-bottom;
 if(!(height>.08&&height<.6))return {ok:false,reason:'invalid head height',height};
 // Scalp is the upper head only: exclude facial triangles, eyes, ears and neck.
 const scalp=candidate.filter(v=>v.every(p=>p.y>top-height*.38));
 if(scalp.length<8)return {ok:false,reason:'no scalp triangles',scalp:scalp.length};
 const points=scalp.flat(),xs=points.map(p=>p.x).sort((a,b)=>a-b),zs=points.map(p=>p.z).sort((a,b)=>a-b);
 const cx=(quant(xs,.05)+quant(xs,.95))/2,cz=(quant(zs,.05)+quant(zs,.95))/2;
 const rx=(quant(xs,.95)-quant(xs,.05))/2,rz=(quant(zs,.95)-quant(zs,.05))/2;
 if(!(rx>.025&&rz>.025))return {ok:false,reason:'invalid scalp bounds',rx,rz};
 const lengths=HAIR_CATEGORIES[style]||HAIR_CATEGORIES.short;
 // Three.js official area-weighted surface sampler (same principle as Blender surface roots).
 const scalpGeometry=new THREE.BufferGeometry();
 scalpGeometry.setAttribute('position',new THREE.Float32BufferAttribute(scalp.flatMap(tri=>tri.flatMap(p=>[p.x,p.y,p.z])),3));
 scalpGeometry.computeVertexNormals();
 const sampler=new MeshSurfaceSampler(new THREE.Mesh(scalpGeometry)).setRandomGenerator((()=>{let state=19473;return ()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};})()).build();
 const rootData=new Float32Array(logicalCount*3),lengthData=new Float32Array(logicalCount);
 const sampled=new THREE.Vector3(),normal=new THREE.Vector3();
 const sampleRoot=()=>{sampler.sample(sampled,normal);return sampled;};
 for(let i=0;i<logicalCount;i++){
  const p=sampleRoot(),j=i*3;
  rootData[j]=p.x;rootData[j+1]=p.y;rootData[j+2]=p.z;
  // Fringe remains above eyebrows; rear and sides grow to their selected length.
  const front=(p.z-cz)/rz,side=Math.abs((p.x-cx)/rx);
  const target=front>.32?lengths.front:side>.68?lengths.side:lengths.back;
  lengthData[i]=target*(.82+.18*hash(i*4.9));
 }
 // The underlying scalp shell is built from the SAME imported triangles.
 // A small normal offset prevents z-fighting while keeping the exact silhouette.
 // Preserve the actual skin surface; do not overlay an opaque helmet shell.
 // Build a head-surface lookup from the sampled scalp, preserving actual curvature.
 // Project strand points to actual scalp triangles, not the nearest vertex.
 const scalpFaces=scalp.map(v=>{
  const e0=v[1].clone().sub(v[0]),e1=v[2].clone().sub(v[0]);
  const n=e0.clone().cross(e1).normalize();
  return {a:v[0],b:v[1],c:v[2],n};
 });
 const cellSize=.025,grid=new Map();
 for(let i=0;i<scalpFaces.length;i++){
  const f=scalpFaces[i],min=f.a.clone().min(f.b).min(f.c),max=f.a.clone().max(f.b).max(f.c);
  for(let x=Math.floor(min.x/cellSize);x<=Math.floor(max.x/cellSize);x++)
   for(let y=Math.floor(min.y/cellSize);y<=Math.floor(max.y/cellSize);y++)
    for(let z=Math.floor(min.z/cellSize);z<=Math.floor(max.z/cellSize);z++){
     const k=[x,y,z].join(',');if(!grid.has(k))grid.set(k,[]);grid.get(k).push(i);
    }
 }
 const triangle=new THREE.Triangle(),query=new THREE.Vector3(),hit=new THREE.Vector3();
 const closestSurface=(x,y,z)=>{
  query.set(x,y,z);
  let best=null,dist=Infinity;
  const near=new Set(),ix=Math.floor(x/cellSize),iy=Math.floor(y/cellSize),iz=Math.floor(z/cellSize);
  for(let radius=0;radius<=2&&!near.size;radius++)for(let dx=-radius;dx<=radius;dx++)for(let dy=-radius;dy<=radius;dy++)for(let dz=-radius;dz<=radius;dz++)for(const id of grid.get([ix+dx,iy+dy,iz+dz].join(','))||[])near.add(id);
  for(const id of near.size?near:scalpFaces.map((_,i)=>i)){
   const f=scalpFaces[id];triangle.set(f.a,f.b,f.c);
   triangle.closestPointToPoint(query,hit);
   const d=hit.distanceToSquared(query);
   if(d<dist){dist=d;best=hit.clone();}
  }
  return best||query.clone();
 };
 // Integrate short hair as continuous, locally tangent steps on the scalp.
 // Reject distant projections: a nearest triangle on the opposite side is not
 // a valid continuation of the same strand.
 const segments=8,drawCount=Math.min(renderCount,logicalCount);
 const positions=new Float32Array(drawCount*segments*6);
 const indexMap=new Uint32Array(drawCount);
 const paths=new Float32Array(drawCount*(segments+1)*3);
 const shortStyle=/^(short|swept|spiky)$/.test(style);
 const scalpMid=new THREE.Vector3(cx,top-height*.28,cz);
 const normalAt=p=>p.clone().sub(scalpMid).normalize();
 for(let i=0;i<drawCount;i++){
  const id=Math.floor(i*logicalCount/drawCount);indexMap[i]=id;
  const j=id*3,root=new THREE.Vector3(rootData[j],rootData[j+1],rootData[j+2]);
  const length=lengthData[id],radialX=(root.x-cx)/rx,radialZ=(root.z-cz)/rz;
  const front=radialZ>.32,side=Math.sign(radialX||hash(id)-.5);
  const attached=Math.min(length,shortStyle?length:.04);
  const step=attached/segments;
  let current=root.clone(),normal=normalAt(root);
  let flow=new THREE.Vector3(front?side*.35:radialX*.18,-1,front?-.12:radialZ*.1);
  flow.addScaledVector(normal,-flow.dot(normal)).normalize();
  for(let k=0;k<=segments;k++){
   const offset=(i*(segments+1)+k)*3;
   paths[offset]=current.x+normal.x*.0005;
   paths[offset+1]=current.y+normal.y*.0005;
   paths[offset+2]=current.z+normal.z*.0005;
   if(k===segments)break;
   const proposed=current.clone().addScaledVector(flow,step);
   const fitted=closestSurface(proposed.x,proposed.y,proposed.z);
   // Prevent jumping across gaps, ear contours, or distant scalp islands.
   const delta=fitted.distanceTo(current);
   const next=delta>step*2.2?proposed:fitted;
   if(delta>step*2.2 && shortStyle){
    // Keep short strands at their last valid surface location.
    continue;
   }
   current.copy(next);
   normal=normalAt(current);
   flow.addScaledVector(normal,-flow.dot(normal)).normalize();
  }
  if(!shortStyle && length>attached){
   const end=(i*(segments+1)+segments)*3;
   const free=length-attached;
   // Long hair exits tangentially, then falls with gravity; no outward arch.
   for(let k=1;k<=segments;k++){
    const t=k/segments,off=(i*(segments+1)+k)*3;
    const anchored=paths.slice(off,off+3);
    const weight=t*t;
    paths[off]=anchored[0]*(1-weight)+(paths[end]+flow.x*free*t*.18)*weight;
    paths[off+1]=anchored[1]*(1-weight)+(paths[end+1]-free*t)*weight;
    paths[off+2]=anchored[2]*(1-weight)+(paths[end+2]+flow.z*free*t*.18)*weight;
   }
  }
 }
 const update=(time=0)=>{
  for(let i=0;i<drawCount;i++){
   const id=indexMap[i];
   for(let k=0;k<segments;k++){
    const a=(i*(segments+1)+k)*3,b=a+3,o=(i*segments+k)*6;
    const sway=Math.sin(time*1.4+id*.23)*.0015;
    const factor=shortStyle?0:(k/segments)**2;
    positions[o]=paths[a]+sway*factor;positions[o+1]=paths[a+1];positions[o+2]=paths[a+2];
    positions[o+3]=paths[b]+sway*(shortStyle?0:((k+1)/segments)**2);positions[o+4]=paths[b+1];positions[o+5]=paths[b+2];
   }
  }
  geometry.attributes.position.needsUpdate=true;
 };
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const mat=new THREE.LineBasicMaterial({color,transparent:true,opacity:.92,depthWrite:true});
 const lines=new THREE.LineSegments(geometry,mat);lines.name='measured-scalp-hair';
 head.add(lines);update();
 const old=[];model.traverse(n=>{if(n!==lines&&n.isMesh&&/hair|scalp|wig/i.test(n.name)){old.push([n,n.visible]);n.visible=false;}});
 const result={ok:true,head,lines,rootData,lengthData,update,dispose(){lines.parent?.remove(lines);geometry.dispose();scalpGeometry.dispose();mat.dispose();old.forEach(([n,v])=>n.visible=v);},stats:{logicalCount,renderedStrands:drawCount,sampler:'three-mesh-surface-sampler',scalpTriangles:scalp.length,scalpCapTriangles:0,rx,rz,style}};
 return result;
}
