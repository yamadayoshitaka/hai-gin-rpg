/** Shared geometry-subdivision tool for high-density source masters and
 * independent medium-distance GPU instance mesh. Interpolates source UV,
 * normal and vertex colour; does not add new anatomical parts. */
import * as THREE from 'three';
export function subdivideDedicatedSource(geometry,{maxTriangles=1600000}={}){
 if(!geometry?.isBufferGeometry)return geometry;
 const position=geometry.getAttribute('position');
 const indices=geometry.getIndex();
 const triCount=Math.floor((indices?.count||position?.count||0)/3);
 if(!position||triCount===0||triCount*4>maxTriangles)return geometry;
 const attrs=['position','normal','uv','color'].filter(k=>geometry.getAttribute(k));
 const source=Object.fromEntries(attrs.map(k=>[k,geometry.getAttribute(k)]));
 const buffers=Object.fromEntries(attrs.map(k=>[k,[]]));
 const vertex=(a,b,t)=>{
  const v={};
  for(const key of attrs){
   const attr=source[key],components=attr.itemSize,componentsArray=[];
   for(let i=0;i<components;i++){
    const x=attr.getComponent(a,i),y=attr.getComponent(b,i);
    componentsArray.push(x+(y-x)*t);
   }
   if(key==='normal'){
    const n=Math.hypot(...componentsArray)||1;
    for(let i=0;i<componentsArray.length;i++)componentsArray[i]/=n;
   }
   v[key]=componentsArray;
  }
  return v;
 };
 const srcVertex=i=>vertex(i,i,0);
 const emit=(x,y,z)=>{
  for(const key of attrs)buffers[key].push(...x[key],...y[key],...z[key]);
 };
 const index=i=>indices?indices.getX(i):i;
 for(let i=0;i<triCount;i++){
  const a=srcVertex(index(i*3)),b=srcVertex(index(i*3+1)),
   c=srcVertex(index(i*3+2));
  const midpoint=(x,y)=>{
   const o={};
   for(const key of attrs){
    const components=x[key].map((v,j)=>(v+y[key][j])*.5);
    if(key==='normal'){
     const n=Math.hypot(...components)||1;
     for(let j=0;j<components.length;j++)components[j]/=n;
    }
    o[key]=components;
   }
   return o;
  };
  const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
  emit(a,ab,ca);emit(ab,b,bc);emit(ca,bc,c);emit(ab,bc,ca);
 }
 const newGeo=new THREE.BufferGeometry();
 for(const key of attrs)
  newGeo.setAttribute(key,new THREE.Float32BufferAttribute(buffers[key],source[key].itemSize));
 if(!source.normal)newGeo.computeVertexNormals();
 newGeo.computeBoundingBox();newGeo.computeBoundingSphere();
 newGeo.userData={...geometry.userData,masterSourceRefinement:true,
  originalTriangles:triCount,refinedTriangles:triCount*4};
 return newGeo;
}
