/**
 * Low-overhead anatomical surface details for battlefield dragons.
 * All geometry is folded into existing InstancedMesh body/wing batches;
 * never allocate a scene object, material or bone per summoned creature.
 */
import * as THREE from 'three';

const V=value=>new THREE.Vector3(...value);
const blend=(a,b,t)=>a+(b-a)*t;

/** A continuous keratin/bony horn with buried roots, ridged surface,
 * curved growth axis and a genuine taper (rather than a floating cone).
 * The root is intentionally embedded inside its parent skull.
 */
export function createRootedCreatureHornGeometry({
  root,elbow,tip,radius=.12,detail='high',ridges=9
}={}){
 if(![root,elbow,tip].every(v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite))||
    !Number.isFinite(radius)||radius<=0)throw Error('Invalid anatomical horn');
 const curve=new THREE.QuadraticBezierCurve3(V(root),V(elbow),V(tip));
 const segments=detail==='high'?10:6,around=detail==='high'?8:5;
 const points=[],uv=[],indices=[];
 for(let row=0;row<=segments;row++){
   const t=row/segments,center=curve.getPoint(t);
   const tangent=curve.getTangent(t).normalize();
   const guide=Math.abs(tangent.y)>.88?
     new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
   const x=guide.addScaledVector(tangent,-guide.dot(tangent)).normalize();
   const z=new THREE.Vector3().crossVectors(tangent,x).normalize();
   // The root stays broad inside the bone; the tip ends in a fine point.
   const basal=radius*Math.pow(Math.max(0,1-t),.85)*
       (1+.20*Math.sin(Math.PI*Math.min(1,t*3)));
   for(let col=0;col<=around;col++){
     const u=col/around,angle=u*Math.PI*2;
     const grain=1+.045*Math.sin(angle*ridges+t*11)*
       Math.sin(Math.PI*Math.min(1,t*4));
     const r=Math.max(.0008,basal*grain);
     const p=center.clone().addScaledVector(x,Math.cos(angle)*r)
       .addScaledVector(z,Math.sin(angle)*r);
     points.push(p.x,p.y,p.z);uv.push(u,t);
   }
 }
 for(let row=0;row<segments;row++)for(let col=0;col<around;col++){
   const a=row*(around+1)+col,b=a+around+1;
   indices.push(a,b,a+1,a+1,b,b+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 geo.userData={kind:'curved-keratin-horn',root,tip};
 return geo;
}

/** Overlapping, shallow domed scutes. On a scaled dragon torso these read as
 * armour-like skin scales rather than the old rows of outward-pointing cones.
 * No shader, texture, or new material required.
 */
export function createCreatureScuteGeometry({
 center,normal,radiusX=.055,radiusY=.075,depth=.018,detail='high'
}={}){
 if(!Array.isArray(center)||center.length!==3||!Array.isArray(normal)||normal.length!==3||
    ![...center,...normal,radiusX,radiusY,depth].every(Number.isFinite)||
    radiusX<=0||radiusY<=0||depth<=0)throw Error('Invalid scute parameters');
 const n=V(normal);
 if(n.lengthSq()<.01)throw Error('Invalid scute normal');
 n.normalize();
 const guide=Math.abs(n.y)>.89?new THREE.Vector3(1,0,0):
   new THREE.Vector3(0,1,0);
 const tangent=guide.addScaledVector(n,-guide.dot(n)).normalize();
 const bitangent=new THREE.Vector3().crossVectors(n,tangent).normalize();
 const rings=detail==='high'?2:1,around=detail==='high'?8:5;
 const vertices=[],uv=[],indices=[],base=V(center);
 for(let r=0;r<=rings;r++){
   const t=r/rings;
   for(let a=0;a<=around;a++){
     const angle=a/around*Math.PI*2;
     // A low dome, root edge buried into adjacent skin/scute surfaces.
     const p=base.clone().addScaledVector(tangent,
       Math.cos(angle)*radiusX*t)
       .addScaledVector(bitangent,Math.sin(angle)*radiusY*t)
       .addScaledVector(n,depth*(1-t*t)-.003*t);
     vertices.push(...p.toArray());
     uv.push(.5+.5*t*Math.cos(angle),.5+.5*t*Math.sin(angle));
   }
 }
 for(let r=0;r<rings;r++)for(let a=0;a<around;a++){
   const x=r*(around+1)+a,y=x+around+1;
   indices.push(x,y,x+1,x+1,y,y+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 geo.userData={kind:'anatomical-scute',detail};
 return geo;
}
