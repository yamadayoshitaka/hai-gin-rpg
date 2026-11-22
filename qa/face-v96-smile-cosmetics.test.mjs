import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {naturalLaughLipDelta,naturalSmileCheekDelta,
 nativeVermilionMask,eyelinerCoverage}
 from '../src/face-v96-smile-cosmetics.js';

test('v96 neutral mouth is identical, large smile opens an oval rather than a V',()=>{
 const at=(t,sign,smile=.80,open=.70,cheek=.70)=>
  naturalLaughLipDelta({t,sign,smile,open,cheek,width:.07,height:.30,depth:.2});
 for(const t of [-1,-.8,-.4,0,.4,.8,1]){
  const rest=at(t,1,0,0,0);
  assert.equal(rest.dx,0);assert.equal(rest.dy,0);assert.equal(rest.dz,0);
 }
 const centerUpper=at(0,1),centerLower=at(0,-1);
 const midUpper=at(.55,1),midLower=at(.55,-1);
 const edgeUpper=at(1,1),edgeLower=at(1,-1);
 assert.ok(centerUpper.opening>midUpper.opening);
 assert.ok(midUpper.opening>edgeUpper.opening);
 assert.equal(edgeUpper.opening,0);
 assert.ok(centerUpper.dy>0&&centerLower.dy<0);
 assert.ok(midUpper.dy>0&&midLower.dy<0);
 assert.ok(at(-.8,1).dx<0&&at(.8,1).dx>0);
 assert.ok(edgeUpper.cornerLift>0&&edgeLower.cornerLift>0);
 assert.ok(Math.abs(at(.75,1).dx)<.015,'No 51-percent width spike');
});

test('v96 cheek smile raises and fills young malar pad without a dark carved fold',()=>{
 const upper=naturalSmileCheekDelta({
  ax:.263,ny:.601,front:1,smile:.8,cheek:.7,ageWrinkles:0});
 const outside=naturalSmileCheekDelta({
  ax:.8,ny:.601,front:1,smile:.8,cheek:.7});
 assert.ok(upper.dy>0&&upper.dz>0);
 assert.ok(upper.dz>outside.dz*10);
 const neutral=naturalSmileCheekDelta({ax:.263,ny:.601,smile:0,cheek:0});
 assert.equal(neutral.dy,0);assert.equal(neutral.dz,0);
 const mature=naturalSmileCheekDelta({ax:.263,ny:.601,front:1,smile:.8,cheek:.7,ageWrinkles:1});
 assert.ok(mature.dz>0&&mature.dz<upper.dz);
});

test('v96 native lipstick follows the actual ordered oral rim, not a detached plate',()=>{
 const positions=[];
 const rim=[];
 for(let i=0;i<40;i++){
  const a=2*Math.PI*i/40;
  rim.push(i);
  positions.push(.055*Math.cos(a),.50+.008*Math.sin(a),.86);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 const opts={lipCenter:.5,centerX:0,faceWidth:1,faceHeight:1,
  faceDepth:1,mouthWidth:1,lipstickWidth:1,lipstickHeight:1,
  rim,positionAttribute:geometry.getAttribute('position')};
 const rimMask=nativeVermilionMask({...opts,x:.055,y:.5,z:.86});
 assert.ok(rimMask>.7,'Actual lip commissure receives colour and gloss');
 assert.equal(nativeVermilionMask({...opts,x:.4,y:.5,z:.86}),0);
 assert.equal(nativeVermilionMask({...opts,x:.055,y:.5,z:.20}),0);
 assert.equal(nativeVermilionMask({...opts,x:.055,y:.7,z:.86}),0);
 assert.equal(nativeVermilionMask({...opts,x:.055,y:.5,z:.86,rim:[]}),0);
 geometry.dispose();
});

test('v96 eyeliner tapers at both canthi and has no jagged plateau at ends',()=>{
 for(const upper of [true,false]){
  assert.equal(eyelinerCoverage(0,0,{upper}),0);
  assert.equal(eyelinerCoverage(1,0,{upper}),0);
  assert.ok(eyelinerCoverage(.5,0,{upper})>.9);
  assert.ok(eyelinerCoverage(.03,0,{upper})<
   eyelinerCoverage(.08,0,{upper}));
  assert.ok(eyelinerCoverage(.97,0,{upper})<
   eyelinerCoverage(.92,0,{upper}));
 }
});
