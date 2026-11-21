import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {WIG_BASE_VOLUME_PROFILES,getWigStyle} from '../src/face-wig-styles.js';
import {REBUILT_HAIR_CATALOG} from '../src/hair-rebuilt-catalog-v67.js';
import {PART_CATALOG} from '../src/face-part-catalog-v32.js';
import {CHARACTER_CAST_V46,MAJOR_CHARACTER_IDS,characterAppearance}
 from '../src/character-cast-v46.js';
import {shapeRebuiltStraightBangs,shapeRebuiltEarTuck,
 shapeRebuiltNaturalContour} from '../src/face-scalp-wig.js';
const box=new THREE.Box3(new THREE.Vector3(-.5,0,-.5),
 new THREE.Vector3(.5,1,.5));
const guides=()=>Array.from({length:19},(_,j)=>
 new THREE.Vector3(.12,.96-j*.045,.32));
test('v69 volume maximum never exceeds the previous most compact profile',()=>{
 const order=['soft','natural','airy','lifted','full'];
 for(const [i,id] of order.entries()){
  const v=WIG_BASE_VOLUME_PROFILES[id];
  assert.ok(v.crown<=.016+1e-9);
  assert.ok(v.side<=.008+1e-9);
  assert.ok(v.spread<=-1+1e-9,
   'No catalog volume may form a positive spreading umbrella: '+id);
  if(i){
   const prev=WIG_BASE_VOLUME_PROFILES[order[i-1]];
   assert.ok(v.crown>=prev.crown&&v.side>=prev.side);
   assert.ok(v.spread>=prev.spread);
  }
 }
});
test('v69 center, above-brow bangs, and one-length ear tuck are different recipes',()=>{
 for(const gender of ['female','male'])
  for(const style of REBUILT_HAIR_CATALOG[gender]){
   assert.ok(['center','bangs','tucked'].includes(style.front));
   assert.equal(getWigStyle(style.id).catalogFront,style.front);
  }
 for(const id of ['rb-f-bob-straight','rb-f-medium','rb-f-long']){
  assert.equal(getWigStyle(id).catalogFront,'tucked');
 }
 for(const id of ['rb-f-bob-bangs','rb-f-long-bangs','rb-m-bangs-medium']){
  assert.equal(getWigStyle(id).catalogFront,'bangs');
 }
 for(const id of ['rb-f-bob-wave','rb-m-center-medium'])
  assert.notEqual(getWigStyle(id).catalogFront,'tucked');
});
test('v69 blunt bangs terminate at the same brow height, not a center part',()=>{
 const left=guides(),right=guides().map(p=>new THREE.Vector3(-p.x,p.y,p.z));
 shapeRebuiltStraightBangs(left,{box,rootIndex:0});
 shapeRebuiltStraightBangs(right,{box,rootIndex:1});
 for(const points of [left,right]){
  const tip=points.at(-1);
  assert.ok(tip.y>=.78&&tip.y<.79,'blunt eyebrow cut');
  assert.ok(Math.abs(tip.x-points[0].x)<.012,'no center-part lateral sweep');
  assert.ok(points[0].y===.96,'original scalp root preserved');
 }
});
test('v69 ear tuck reveals the face without moving the roots',()=>{
 const guide=guides(),root=guide[0].clone();
 shapeRebuiltEarTuck(guide,{box,side:1});
 assert.deepEqual(guide[0].toArray(),root.toArray());
 assert.ok(guide[12].x>.25&&guide[12].z<.12,
  'one-length hair moves toward and behind the ear');
});
test('v69 compact hair geometry cannot spread into horizontal wings',()=>{
 const guide=guides();
 guide.forEach((p,i)=>{if(i>1)p.x=.8;});
 shapeRebuiltNaturalContour(guide,{box});
 assert.equal(guide[0].x,.12);
 assert.ok(guide.slice(2).every(p=>Math.abs(p.x)<=.475+1e-7));
});
test('all six major characters and all NPCs use current gender-compatible hair IDs',()=>{
 assert.equal(MAJOR_CHARACTER_IDS.length,6);
 const major=CHARACTER_CAST_V46.filter(x=>MAJOR_CHARACTER_IDS.includes(x.id));
 assert.equal(major.length,6);
 for(const item of CHARACTER_CAST_V46){
  const spec=characterAppearance(item.id);
  const ids=PART_CATALOG[item.gender].hair.map(h=>h.values.styleId);
  assert.ok(ids.includes(item.hairStyleId),item.id+' has a retired hair style');
  assert.equal(spec.styleId,item.hairStyleId);
 }
 assert.equal(characterAppearance('commander-female').styleId,'rb-f-long-bangs');
 assert.equal(characterAppearance('lucia').styleId,'rb-f-long');
 assert.equal(characterAppearance('iris').styleId,'rb-f-bob-bangs');
});
