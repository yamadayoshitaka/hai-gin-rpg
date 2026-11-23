import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeFaceReference,transferFaceReference}
 from '../src/face-v118-alina-reference-transfer.js';

// A deterministic surface fixture: actual 3D front/back vertices, not a
// downloaded model, a screenshot, or a claimed Alina-geometry comparison.
function fixture({nose=.13,cheek=.13,jaw=1}={}){
 const points=[];
 for(let yi=0;yi<=80;yi++){
  const yn=yi/80;
  for(let xi=-40;xi<=40;xi++){
   const xn=xi/40;
   const edge=Math.sqrt(Math.max(.001,1-xn*xn));
   const y=.28*yn;
   const x=.14*xn*(yn<.43?jaw:1);
   const zBase=.09*edge*Math.sqrt(Math.max(.01,1-(yn-.52)**2));
   const noseRise=nose*Math.exp(-.5*(xn/.13)**2)
    *Math.exp(-.5*((yn-.59)/.07)**2);
   const cheekRise=cheek*.18*
    Math.exp(-.5*((Math.abs(xn)-.45)/.21)**2)
    *Math.exp(-.5*((yn-.51)/.13)**2);
   points.push(x,y,zBase+noseRise+cheekRise);
   points.push(x,y,-zBase*.87);
  }
 }
 return new Float32Array(points);
}
function geometry(src){
 const array=src.slice();
 return {
  getAttribute(name){return name==='position'?{
   array,count:array.length/3,
   getX(i){return array[i*3]},
   getY(i){return array[i*3+1]},
   getZ(i){return array[i*3+2]},
   setXYZ(i,x,y,z){array[i*3]=x;array[i*3+1]=y;array[i*3+2]=z;}
  }:null;},
  computeVertexNormals(){},
  computeBoundingBox(){},
  computeBoundingSphere(){}
 };
}
test('3D source measuring is stable, finite, and not a thumbnail proxy',()=>{
 const shape=fixture({nose:.13});
 const report=analyzeFaceReference(shape,{frontSign:1});
 assert.equal(report.vertexCount,shape.length/3);
 assert.ok(report.samples.cheek>100);
 assert.ok(report.samples.nose>100);
 assert.ok(report.noseRelief>.015);
 assert.ok(Number.isFinite(report.jawToCheek));
 assert.throws(()=>analyzeFaceReference(new Float32Array(15)),/300 real/);
});
test('same Alina reference creates separate male/female changes, never edits donor',()=>{
 const original=fixture({nose:.08,cheek:.06});
 const reference=analyzeFaceReference(fixture({nose:.13,cheek:.17}),{frontSign:1});
 const gf=geometry(original),gm=geometry(original);
 const a=transferFaceReference(gf,{gender:'female',reference,donorPositions:original});
 const b=transferFaceReference(gm,{gender:'male',reference,donorPositions:original});
 assert.equal(a.applied,true);
 assert.equal(b.applied,true);
 assert.ok(a.modifiedVertices>100&&b.modifiedVertices>100);
 assert.ok(a.maxOffset>b.maxOffset);
 assert.ok(gf.getAttribute('position').array.some((x,i)=>x!==original[i]));
 assert.ok(gm.getAttribute('position').array.some((x,i)=>x!==original[i]));
 assert.notDeepEqual(Array.from(gf.getAttribute('position').array),
   Array.from(gm.getAttribute('position').array));
 assert.deepEqual(original,fixture({nose:.08,cheek:.06}));
});
test('no source keeps v117 untouched and incorrect genders are rejected',()=>{
 const points=fixture(),g=geometry(points);
 assert.equal(transferFaceReference(g,{gender:'female',donorPositions:points}).applied,false);
 assert.deepEqual(g.getAttribute('position').array,points);
 assert.throws(()=>transferFaceReference(g,{gender:'unknown',donorPositions:points}),/gender/);
});
