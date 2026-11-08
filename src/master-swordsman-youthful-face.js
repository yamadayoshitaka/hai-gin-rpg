import * as THREE from 'three';

const clamp=x=>Math.max(0,Math.min(1,x));
const bell=(x,c,w)=>Math.exp(-.5*((x-c)/w)**2);
const smooth=(a,b,x)=>{const q=clamp((x-a)/(b-a));return q*q*(3-2*q)};

/**
 * Directly reshapes the existing Blender Studio face vertices. It is not a
 * 2D portrait / retouch or a replacement model. The archived CC0 source GLB
 * and its seven existing expression-independent morph channels stay intact.
 *
 * This adjusts jaw/chin/nose/lip proportions subtly to make five authored
 * protagonist candidates read younger. A full artistic facial sculpt and
 * photoreal texture pass is still required.
 */
export function prepareYouthfulFace(headRoot){
 if(!headRoot)throw Error('Real Blender face root required');
 let faceMesh=null,best=0;
 headRoot.traverse(o=>{
  if(!o.isMesh||/iris|sclera|eyelid|pupil/i.test(o.name))return;
  const n=o.geometry?.getAttribute('position')?.count||0;
  if(n>best){faceMesh=o;best=n;}
 });
 if(!faceMesh||best<1100)throw Error('Actual CC0 head topology required');
 const original=faceMesh.geometry;
 const preview=original.clone();
 faceMesh.geometry=preview;
 preview.computeBoundingBox();
 const box=preview.boundingBox;
 const size=box.getSize(new THREE.Vector3());
 const cx=(box.max.x+box.min.x)/2;
 const p=preview.getAttribute('position');
 const base=p.array.slice();
 let modified=0, last=0;
 function apply(weight){
  const amount=clamp(Number(weight)||0);
  let changes=0;
  for(let i=0;i<p.count;i++){
   const x0=base[i*3],y0=base[i*3+1],z0=base[i*3+2];
   const xn=(x0-cx)/Math.max(.001,size.x*.5);
   const yn=(y0-box.min.y)/Math.max(.001,size.y);
   const zn=(z0-box.min.z)/Math.max(.001,size.z);
   const jaw=smooth(.58,.13,yn);
   const chin=smooth(.33,.12,yn)*bell(xn,0,.68);
   const front=smooth(.49,.77,zn);
   const nose=bell(xn,0,.24)*bell(yn,.61,.13)*front;
   const lips=bell(xn,0,.38)*bell(yn,.40,.07)*front;
   const xx=x0-(x0-cx)*.085*jaw*amount;
   const yy=y0+size.y*.020*chin*amount;
   const zz=z0-size.z*(.037*nose+.018*lips)*amount;
   p.setXYZ(i,xx,yy,zz);
   if(Math.abs(xx-x0)+Math.abs(yy-y0)+Math.abs(zz-z0)>.00005)changes++;
  }
  p.needsUpdate=true;
  preview.computeVertexNormals();preview.computeBoundingBox();
  preview.computeBoundingSphere();
  last=amount;modified=changes;
  return {strength:amount,modifiedVertices:changes,
   sourceUnchanged:true,realHeadTopology:true};
 }
 apply(0);
 return {faceMesh,apply,getReport:()=>({strength:last,modifiedVertices:modified,
   sourceFaceVertices:best,sourceUnchanged:true,realHeadTopology:true})};
}
