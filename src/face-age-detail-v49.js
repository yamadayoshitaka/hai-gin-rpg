/** v49: anatomically fitted, light-reactive age folds.
 * Each wrinkle is 3D geometry following the original sculpted face,
 * with matching surface normals and narrow soft edges, never a 2D decal.
 * Age strength is monotonic and young faces receive no marks.
 */
import * as THREE from 'three';
import {createFastFaceSurfaceSampler} from './face-feature-meshes.js?v=50';
import {resolveAgeBand} from './character-demographics-v47.js?v=50';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const makeLine=(name,points,sampler,box,opacity)=>{
 const d=box.getSize(new THREE.Vector3()),cx=(box.max.x+box.min.x)*.5;
 const vertices=[],indices=[],colors=[];
 const c=new THREE.Color(0x654d4d);
 for(let i=0;i<points.length;i++){
  const [nx,ny]=points[i],x=cx+nx*d.x,y=box.min.y+ny*d.y;
  const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
  const dx=(next[0]-prev[0])*d.x,dy=(next[1]-prev[1])*d.y;
  const magnitude=Math.hypot(dx,dy)||1;
  const acrossX=-dy/magnitude,acrossY=dx/magnitude;
  const fade=Math.sin(Math.PI*i/(points.length-1))**.72;
  for(const sign of [-1,1]){
   const spread=d.x*.0017*fade*sign;
   const xx=x+acrossX*spread,yy=y+acrossY*spread;
   const zz=sampler.query(xx,yy);
   const base=sampler.query(x,y);
   vertices.push(xx,yy,(zz??base??box.max.z)+d.z*.00065);
   const light=sign<0?.89:1.02;
   colors.push(c.r*light,c.g*light,c.b*light);
  }
  if(i>0){const k=(i-1)*2;indices.push(k,k+1,k+2,k+2,k+1,k+3);}
 }
 if(!indices.length)return null;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:.92,metalness:0,
  side:THREE.DoubleSide,transparent:true,opacity,
  depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1
 });
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name=name;mesh.renderOrder=4;
 mesh.userData.colorRole='ageCrease';
 mesh.userData.realFaceSurfaceAttached=true;
 mesh.userData.ageShadeNo2DDecal=true;
 return mesh;
};
const segment=(fn,count=26)=>Array.from({length:count},(_,i)=>{
 const t=i/(count-1);return fn(t);
});
export function attachAgeDetails(face,ageBand='twenties'){
 if(!face?.isMesh)return {count:0,intensity:0};
 const age=resolveAgeBand(ageBand);
 const strength=age.wrinkles;
 if(strength<.10)return {count:0,intensity:strength};
 const geometry=face.geometry;geometry.computeBoundingBox();
 const box=geometry.boundingBox;
 const sampler=createFastFaceSurfaceSampler(geometry);
 const lines=[];
 // Upper forehead horizontal furrows, with a mild, human irregularity.
 const n=ageBand==='forties'?1:ageBand==='sixties'?2:3;
 for(let j=0;j<n;j++)lines.push(['FOREHEAD_'+j,segment(t=>{
  const x=(t-.5)*1.05;
  return [x,.763+.029*j+.004*Math.sin(Math.PI*t*2+.9*j)];
 })]);
 // One crow's foot cluster and under-eye crease on both sides.
 for(const side of [-1,1]){
  for(let j=0;j<3;j++)lines.push(['CROWS_'+side+'_'+j,segment(t=>[
   side*(.42+.19*t),.690+(j-1)*.015+(t-.45)*(.022+j*.007)
  ],18)]);
  lines.push(['LOWER_LID_'+side,segment(t=>[
   side*(.22+.29*t),.633-.027*Math.sin(Math.PI*t)
  ])]);
  lines.push(['NASOLABIAL_'+side,segment(t=>[
   side*(.135+.15*t+.02*Math.sin(t*Math.PI)),
   .566-.15*t
  ])]);
  lines.push(['MOUTH_CORNER_'+side,segment(t=>[
   side*(.235+.040*t),.478-.068*t
  ],18)]);
  if(strength>.55)lines.push(['NECK_'+side,segment(t=>[
   side*(.14+.16*t),.235-.07*Math.sin(Math.PI*t)
  ],18)]);
 }
 let count=0,vertices=0;
 for(const [name,pts] of lines){
  const mesh=makeLine('V49_AGE_'+name,pts,sampler,box,
    clamp(strength*.29,.04,.30));
  if(!mesh)continue;
  face.add(mesh);count++;vertices+=mesh.geometry.getAttribute('position').count;
 }
 face.userData.v49AgeDetails={ageBand,strength,count,vertices,source:'actual-sculpted-face'};
 return {...face.userData.v49AgeDetails};
}
