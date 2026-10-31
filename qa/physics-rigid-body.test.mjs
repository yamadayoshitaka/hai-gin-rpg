import test from 'node:test';
import assert from 'node:assert/strict';
import {createDynamicBody,stepDynamicBody,createFixedStepWorld,PHYSICS_STEP} from '../src/physics-rigid-body.js';
test('gravity accelerates bodies regardless of mass',()=>{
 const a=createDynamicBody({massKg:1,position:[0,10,0]});
 const b=createDynamicBody({massKg:100,position:[0,10,0]});
 for(let i=0;i<60;i++){stepDynamicBody(a);stepDynamicBody(b);}
 assert.deepEqual(a.position,b.position);
 assert.ok(a.position[1]<6);
});
test('ground contact prevents sinking and dissipates velocity',()=>{
 const a=createDynamicBody({massKg:70,position:[0,.2,0],radius:.2});
 for(let i=0;i<180;i++)stepDynamicBody(a);
 assert.ok(a.position[1]>=.2-1e-9);
 assert.ok(Math.abs(a.velocity[1])<1e-9);
 assert.ok(a.contacts>0);
});
test('fixed step is frame chunk invariant',()=>{
 const a=createFixedStepWorld(),b=createFixedStepWorld();
 const aa=a.add(createDynamicBody({position:[0,10,0]}));
 const bb=b.add(createDynamicBody({position:[0,10,0]}));
 for(let i=0;i<60;i++)a.advance(PHYSICS_STEP);
 for(let i=0;i<30;i++)b.advance(PHYSICS_STEP*2);
 assert.ok(Math.abs(aa.position[1]-bb.position[1])<1e-8);
});
test('invalid dynamic mass is rejected',()=>assert.throws(()=>createDynamicBody({massKg:0}),RangeError));

test('preview death body settles on ground with fixed-step physics',()=>{
 const world=createFixedStepWorld();
 const body=world.add(createDynamicBody({massKg:70,position:[0,1,0],radius:.22,friction:.8}));
 for(let i=0;i<180;i++)world.advance(1/60);
 assert.ok(Math.abs(body.position[1]-.22)<1e-6);
 assert.ok(body.contacts>0);
});
