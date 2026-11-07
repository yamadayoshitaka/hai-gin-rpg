/** Compact 3D polygon ribbons: coat hairs remain visible in silhouette.
 * Geometry is immutable during animations; attach to torso, cheek or tail
 * groups and let their existing animations move the entire patch. No alpha
 * blending, individual mesh per strand, or per-frame CPU work.
 */
import * as THREE from 'three';
export function buildCanineFurRibbonGeometry(guides){
 if(!Array.isArray(guides))throw Error('Canine fur guides must be an array');
 const pos=[],uv=[],indices=[];
 for(const guide of guides){
  if(!guide||!Array.isArray(guide.root)||!Array.isArray(guide.mid)||
    !Array.isArray(guide.tip)||!Array.isArray(guide.normal)||
    !Number.isFinite(guide.width)||guide.width<=0)
    throw Error('Invalid fur guide');
  const a=new THREE.Vector3(...guide.root),
    b=new THREE.Vector3(...guide.mid),
    c=new THREE.Vector3(...guide.tip),
    normal=new THREE.Vector3(...guide.normal).normalize();
  const dir=c.clone().sub(a).normalize();
  const tangent=new THREE.Vector3().crossVectors(normal,dir);
  if(tangent.lengthSq()<.00001){
   tangent.set(1,0,0).addScaledVector(dir,-dir.x);
  }
  tangent.normalize();
  // Tapered blade of five vertices / three triangles.
  // The midpoint is slightly elevated so each hair casts a real contour.
  const x=a.clone().addScaledVector(tangent,-guide.width*.5);
  const y=a.clone().addScaledVector(tangent,guide.width*.5);
  const m=b.clone().addScaledVector(normal,guide.width*.13);
  const x2=m.clone().addScaledVector(tangent,-guide.width*.31);
  const y2=m.clone().addScaledVector(tangent,guide.width*.31);
  const points=[x,y,x2,y2,c];
  const index=pos.length/3;
  for(const v of points)pos.push(v.x,v.y,v.z);
  uv.push(0,0,1,0,.19,.6,.81,.6,.5,1);
  indices.push(index,index+2,index+1,index+1,index+2,index+3,
    index+2,index+4,index+3);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 geometry.userData={kind:'canine-fur-ribbons',strands:guides.length};
 return geometry;
}
