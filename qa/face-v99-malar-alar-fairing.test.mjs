import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {v99FacialSurfaceDelta,refineV99FemaleProfile}
 from '../src/face-v99-malar-alar-fairing.js';
const field=(xn,yn,zn=.96,ageWrinkles=0)=>
 v99FacialSurfaceDelta({xn,yn,zn,ageWrinkles});
const noDelta=v=>v.dx===0&&v.dy===0&&v.dz===0;

test('v99 broad cheek support trims the peak rather than building a hard mountain',()=>{
 const malar=field(.48,.57),mouthSide=field(.49,.47);
 assert.ok(malar.ridge>.3,'A real malar ridge needs peak reduction');
 assert.ok(malar.dz<0,'Upper cheek mountain is trimmed in Z');
 assert.ok(mouthSide.dz>0,'Lower hollow is supported instead');
 assert.ok(mouthSide.cheek>0,'The pad covers a broad midface area');
 assert.ok(Math.abs(malar.dx)<.004,'Do not drag cheek columns out to the side');
 assert.ok(noDelta(field(.9,.55)),'Outer cheek/ear remain unchanged');
 assert.ok(noDelta(field(.25,.509)),'Actual mouth boundary is isolated');
 assert.ok(noDelta(field(.44,.75)),'Eye and upper forehead are isolated');
 assert.ok(noDelta(field(.48,.55,.1)),'Rear skull is isolated');
});
test('v99 nose points downward and alar underside lowers instead of front-facing nostrils',()=>{
 const right=field(.16,.545),left=field(-.16,.545);
 const tip=field(.05,.567),columella=field(.065,.535);
 assert.ok(right.dy<-.005&&left.dy<-.005);
 assert.ok(tip.dy<-.005,'Nasal tip moves down');
 assert.ok(columella.dy<0,'Central columella extends down from tip');
 assert.ok(right.dx<0&&left.dx>0,'Wings narrow symmetrically');
 assert.ok(Math.abs(right.dx+left.dx)<1e-12);
 assert.ok(Math.abs(tip.dz)<.012,'No deep tip collapse causing a weird profile');
 assert.ok(noDelta(field(.08,.50)),'Native lips are never distorted');
});
test('v99 respects age, sex and original indexed triangle mesh',()=>{
 const original=new THREE.SphereGeometry(.14,72,56);
 const orig=original.getAttribute('position').array.slice();
 const triangleIndices=Array.from(original.index.array);
 const female=original.clone();
 // Inject a synthetic concentration of cheek height to simulate the
 // screenshot's raised, sharp strip around the malar ridge.
 const pos=female.getAttribute('position');
 original.computeBoundingBox();
 const box=original.boundingBox,depth=box.max.z-box.min.z;
 for(let i=0;i<pos.count;i++){
  const x=Math.abs(pos.getX(i)/.14),y=(pos.getY(i)+.14)/.28;
  const z=pos.getZ(i);
  if(z<0)continue;
  const ridge=Math.exp(-.5*((x-.48)/.11)**2)*
   Math.exp(-.5*((y-.57)/.052)**2);
  pos.setZ(i,z+depth*.042*ridge);
 }
 const before=pos.array.slice();
 const report=refineV99FemaleProfile(female,{gender:'female'});
 assert.equal(report.applied,true,JSON.stringify(report));
 assert.ok(report.cheekVertices>10);
 assert.ok(report.alarVertices>2);
 assert.ok(report.maxNoseDown>0);
 assert.equal(report.fairingIterations,4);
 assert.deepEqual(Array.from(original.index.array),triangleIndices);
 assert.deepEqual(Array.from(original.getAttribute('position').array),Array.from(orig));
 const changed=female.getAttribute('position');
 let peaksTrimmed=0,lowerSupported=0,rimLowered=0,untouchedLips=0,untouchedBack=0;
 for(let i=0;i<changed.count;i++){
  const x=Math.abs(before[i*3]/.14),y=(before[i*3+1]+.14)/.28;
  const z=before[i*3+2],nz=changed.getZ(i),ny=changed.getY(i);
  if(z>0&&x>.40&&x<.56&&y>.54&&y<.59&&nz<z)peaksTrimmed++;
  if(z>0&&x>.38&&x<.60&&y>.45&&y<.50&&nz>z)lowerSupported++;
  if(z>0&&x>.12&&x<.21&&y>.530&&y<.56&&ny<before[i*3+1])rimLowered++;
  if(y<.510&&y>.490&&x<.12&&
     changed.getX(i)===before[i*3]&&ny===before[i*3+1]&&nz===z)untouchedLips++;
  if(z<-.12&&changed.getX(i)===before[i*3]&&ny===before[i*3+1]&&nz===z)untouchedBack++;
  assert.ok(Number.isFinite(changed.getX(i))&&Number.isFinite(ny)&&Number.isFinite(nz));
 }
 assert.ok(peaksTrimmed>3,'Malars are locally flattened');
 assert.ok(lowerSupported>3,'Lower midface is not made gaunt');
 assert.ok(rimLowered>2,'Real nasal vertices hide nostrils from frontal view');
 assert.ok(untouchedLips>1,'Keep native mouth line untouched');
 assert.ok(untouchedBack>10);
 const male=original.clone();
 assert.equal(refineV99FemaleProfile(male,{gender:'male'}).applied,false);
 assert.deepEqual(Array.from(male.getAttribute('position').array),Array.from(orig));
 const older=original.clone();
 assert.equal(refineV99FemaleProfile(older,{gender:'female',ageWrinkles:1}).applied,false);
 assert.deepEqual(Array.from(older.getAttribute('position').array),Array.from(orig));
 original.dispose();female.dispose();male.dispose();older.dispose();
});
