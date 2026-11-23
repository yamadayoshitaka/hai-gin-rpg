import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {syncV115LashesToLiveEyeliner,V115_LASH_ROOT_ROW} from
 '../src/face-feature-meshes.js';

function linerGrid(){
 const vertices=[];
 for(let row=0;row<=3;row++)for(let i=0;i<=48;i++){
  const u=i/48,v=row/3;
  vertices.push(u*.16,Math.sin(u*Math.PI)*.026+v*.001,.17+u*.002);
 }
 const mesh=new THREE.Mesh(new THREE.BufferGeometry());
 mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 return mesh;
}
function sampleRoot(liner,u){
 const t=u*48,i=Math.min(47,Math.floor(t)),frac=t-i;
 const attr=liner.geometry.getAttribute('position');
 const at=(row,k,component)=>component===0?attr.getX(row*49+k):
  component===1?attr.getY(row*49+k):attr.getZ(row*49+k);
 const interp=component=>{
  const a=at(0,i,component)*(1-frac)+at(0,i+1,component)*frac;
  const b=at(1,i,component)*(1-frac)+at(1,i+1,component)*frac;
  const y=V115_LASH_ROOT_ROW*3;
  return a*(1-y)+b*y;
 };
 return [interp(0),interp(1),interp(2)];
}
function lashFrom(liner){
 const uList=[.17,.37,.58,.83],anchors=[],rest=[];
 const stations=6;
 for(const u of uList){
  const [x,y,z]=sampleRoot(liner,u);
  anchors.push(x,y,z);
  for(let j=0;j<stations;j++)for(const side of [-1,1]){
   const t=j/(stations-1);
   rest.push(x+side*.00008*(1-t)+t*.001,y+t*.008,z+.00015+t*.004);
  }
 }
 const lash=new THREE.Mesh(new THREE.BufferGeometry());
 lash.geometry.setAttribute('position',new THREE.Float32BufferAttribute(rest,3));
 Object.assign(lash.userData,{
  v115AnchorU:uList,v115AnchorXYZ:anchors,
  v115RestPositions:new Float32Array(rest),
  curvedRibbonStations:stations,
  v115DesiredTiltRadians:0,v115BuiltTiltRadians:0
 });
 return lash;
}
test('V115 each filament root follows its own 3D moving liner sample across blink/angle',()=>{
 const liner=linerGrid(),lash=lashFrom(liner),initial=lash.geometry.getAttribute('position').array.slice();
 const first=syncV115LashesToLiveEyeliner(lash,liner);
 assert.equal(first.updated,4);
 assert.ok(first.maximumRootError<.00017);
 assert.ok(lash.userData.v115LiveSyncCount===1);
 const linerPos=liner.geometry.getAttribute('position');
 for(let row=0;row<=3;row++)for(let i=0;i<=48;i++){
  const index=row*49+i;
  // Nonuniform blink displacement: corners remain still, centre closes.
  linerPos.setY(index,linerPos.getY(index)+.020*Math.sin(Math.PI*i/48));
 }
 linerPos.needsUpdate=true;
 lash.userData.v115DesiredTiltRadians=.18;
 const result=syncV115LashesToLiveEyeliner(lash,liner);
 assert.equal(result.updated,4);
 assert.ok(result.maximumRootError<.00017);
 const pos=lash.geometry.getAttribute('position');
 for(let i=0;i<4;i++){
  const u=lash.userData.v115AnchorU[i];
  const expected=sampleRoot(liner,u);
  const k=i*6*2,baseX=(pos.getX(k)+pos.getX(k+1))/2,
   baseY=(pos.getY(k)+pos.getY(k+1))/2;
  // Non-grid-aligned u samples are linearly interpolated. Approximate within
  // one segment slope; root is NEVER shifted by a global same-for-all Y.
  assert.ok(Math.abs(baseX-expected[0])<.0004);
  assert.ok(Math.abs(baseY-expected[1])<.0004);
 }
 assert.notDeepEqual(Array.from(initial),Array.from(pos.array));
 const twice=pos.array.slice();
 syncV115LashesToLiveEyeliner(lash,liner);
 assert.deepEqual(Array.from(pos.array),Array.from(twice),
  'Repeated blink update cannot accumulate mesh drift');
});
test('V115 visual generation keeps male optics and v113 original head intact',()=>{
 const source=readFileSync(new URL('../src/face-feature-meshes.js',import.meta.url),'utf8');
 const animation=readFileSync(new URL('../src/face-expression-animation-v48.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 assert.match(source,/v115OpticalPerimeterSeatedInsideLiners=female/);
 assert.match(source,/v115LiveLashRootMaxError/);
 assert.match(source,/v115DesiredTiltRadians/);
 assert.match(source,/v115LashRootError/);
 assert.match(animation,/syncV115LashesToLiveEyeliner\(side\.upperLash,side\.upperLiner\)/);
 assert.match(animation,/syncV115LashesToLiveEyeliner\(side\.lowerLash,side\.lowerLiner\)/);
 assert.doesNotMatch(animation,/side\.upperLash\.position\.y=side\.lashRestY/);
 assert.match(html,/v115OpticsFitToActualLids/);
 assert.match(html,/dataset\.faceMeshReady='v(?:117|119)'/);
 assert.match(html,/experimentalCheekRetopo/);
 assert.match(html,/V112_SKIN_WIRE_OVERLAY/);
});
