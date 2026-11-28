import assert from 'node:assert/strict';
import {ACTIONS,AGING,CLIPS,sampleOriginal} from '../src/original-body-motion-v2.mjs';
const builds=['ultraThin','thin','normal','fat'],sides=['r','l','both'];let n=0;
for(const action of Object.keys(ACTIONS))for(const age of Object.keys(AGING))for(const build of builds)for(const side of sides)for(let i=0;i<=120;i++){const p=sampleOriginal(action,i/30,{age,build,side});assert.ok([...p.h,...p.k,...p.a,...p.e,...p.ankle,p.b,p.tw,p.w,p.y,p.g,p.reach].every(Number.isFinite));assert.ok(p.k.every(x=>x>=0&&x<=135*Math.PI/180));assert.ok(p.e.every(x=>x>=0&&x<=140*Math.PI/180));n++}
for(const c of Object.values(CLIPS)){assert.equal(c.keys[0].t,0);assert.equal(c.keys.at(-1).t,1);assert.ok(c.keys.every((k,i)=>!i||k.t>c.keys[i-1].t));if(c.loop){const {t:a,...first}=c.keys[0],{t:b,...last}=c.keys.at(-1);assert.deepEqual(first,last)}if(c.attach){assert.ok(c.reach[0]<c.reach[1]&&c.reach[1]===c.attach)}}
const walk=Array.from({length:100},(_,i)=>sampleOriginal('walk',i*1.18/100));assert.ok(walk.every(p=>p.contact.some(Boolean)));assert.ok(walk.some(p=>p.contact.every(Boolean)));
const run=Array.from({length:100},(_,i)=>sampleOriginal('run',i*.78/100));assert.ok(run.some(p=>p.contact.every(v=>!v)));assert.ok(run.some(p=>p.contact.some(Boolean)));
assert.equal(sampleOriginal('grasp',0).attach,false);assert.equal(sampleOriginal('grasp',2).attach,true);assert.equal(sampleOriginal('pickup',0).attach,false);assert.equal(sampleOriginal('pickup',2).attach,true);
assert.notDeepEqual(sampleOriginal('walk',.3,{age:'twenties'}).h,sampleOriginal('walk',.3,{age:'eightyPlus'}).h);console.log('Original motion design checks:',n,'poses');
