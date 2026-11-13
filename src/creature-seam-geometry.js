/**
 * Instancing-safe organic seam topology: gum sockets for real fangs and
 * rolled, thickness-bearing garment hems. Every piece is welded into the
 * existing species/LOD/part buffer; no extra per-soldier draw calls.
 *
 * Teeth and claws are generated in their own articulated parent part.
 * Clothing follows the sleeve, collar or boot part that owns the joint.
 */
import * as THREE from 'three';

const vec=xs=>new THREE.Vector3(...xs);
const ensurePoint=(p,name)=>{
  if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))
    throw Error('Invalid seam '+name);
};
const detailAround=(detail)=>detail==='source'?18:detail==='low'?6:10;
function buildRings(points,uvs,around,rowCount){
 const indices=[];
 for(let row=0;row<rowCount-1;row++)
  for(let col=0;col<around;col++){
   const a=row*(around+1)+col,b=a+around+1;
   indices.push(a,b,a+1,a+1,b,b+1);
  }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 return geo;
}
/**
 * A gingival root socket follows the fang's growth axis. Its first ring is
 * slightly below the gumline; the rest flares above the root and tapers into
 * enamel. The actual tooth starts beneath the socket.
 */
export function createCreatureGumSocketGeometry({
  base,tip,radius,detail='high',
}={}){
 ensurePoint(base,'base');ensurePoint(tip,'tip');
 if(!Number.isFinite(radius)||radius<=0)throw Error('Invalid gum socket radius');
 const from=vec(base),to=vec(tip),axis=to.clone().sub(from);
 const length=axis.length();
 if(length<1e-5)throw Error('Invalid gum socket tooth length');
 axis.normalize();
 const guide=Math.abs(axis.y)>.90?new THREE.Vector3(1,0,0):
   new THREE.Vector3(0,1,0);
 const u=guide.addScaledVector(axis,-guide.dot(axis)).normalize();
 const v=new THREE.Vector3().crossVectors(axis,u).normalize();
 const extent=Math.min(radius*.82,length*.42),around=detailAround(detail);
 const rings=[[-.75,1.05],[-.22,1.24],[.24,1.16],[.60,.78]];
 const vertices=[],uvs=[];
 for(let row=0;row<rings.length;row++){
  const [height,radial]=rings[row],p=from.clone()
   .addScaledVector(axis,height*extent);
  for(let j=0;j<=around;j++){
   const angle=j/around*2*Math.PI;
   const q=p.clone()
    .addScaledVector(u,Math.cos(angle)*radius*radial)
    .addScaledVector(v,Math.sin(angle)*radius*radial);
   vertices.push(...q.toArray());uvs.push(j/around,row/(rings.length-1));
  }
 }
 const geo=buildRings(vertices,uvs,around,rings.length);
 geo.userData={kind:'buried-gingival-fang-root',detail,root:base.slice()};
 return geo;
}
/**
 * 3D turned fabric edge, not a flat stripe or loose separate sphere.
 * The inner lip is below the cloth plane and the outer lip folds around
 * that edge. Axis accepts a local sleeve/bone direction (not world Y).
 */
export function createCreatureFittedHemGeometry({
  center,axis=[0,1,0],radiusX,radiusZ,
  thickness=.012,width=.06,detail='high',
}={}){
 ensurePoint(center,'hem center');ensurePoint(axis,'hem axis');
 if(![radiusX,radiusZ,thickness,width].every(Number.isFinite)||
    radiusX<=0||radiusZ<=0||thickness<=0||width<=0)
   throw Error('Invalid fitted hem dimensions');
 const tangent=vec(axis);
 if(tangent.lengthSq()<.01)throw Error('Invalid fitted hem direction');
 tangent.normalize();
 const q=new THREE.Quaternion().setFromUnitVectors(
   new THREE.Vector3(0,1,0),tangent);
 const origin=vec(center),around=detailAround(detail)*2;
 const vertices=[],uvs=[];
 const rings=[
   [-width*.58,-thickness*.55],
   [-width*.34,thickness*.62],
   [-width*.04,thickness],
   [width*.34,thickness*.88],
   [width*.56,-thickness*.42],
 ];
 for(let row=0;row<rings.length;row++){
   const [height,bulge]=rings[row];
   for(let j=0;j<=around;j++){
     const angle=j/around*2*Math.PI;
     const p=new THREE.Vector3(
      Math.cos(angle)*(radiusX+bulge),
      height,
      Math.sin(angle)*(radiusZ+bulge)
     ).applyQuaternion(q).add(origin);
     vertices.push(...p.toArray());uvs.push(j/around,row/(rings.length-1));
   }
 }
 const geo=buildRings(vertices,uvs,around,rings.length);
 geo.userData={kind:'rolled-attached-fabric-hem',detail,center:center.slice()};
 return geo;
}
