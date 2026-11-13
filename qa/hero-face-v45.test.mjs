import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultPartSelection,resolvePartSelection,PART_CATALOG} from '../src/face-part-catalog-v32.js';
import {HERO_FACE_PRESETS,chooseHeroFacePreset,matchHeroFacePreset,polishHeroFaceControls} from '../src/hero-face-presets-v45.js';
test('male and female have ten coherent complete-face shapes preserving hair',()=>{
 for(const gender of ['male','female']){
  const presets=HERO_FACE_PRESETS[gender];
  assert.equal(presets.length,10);
  assert.equal(new Set(presets.map(p=>p.id)).size,10);
  for(let index=0;index<10;index++){
   const before={...defaultPartSelection(),hair:14,hairColor:'pink',hairVolume:'soft',hairY:-1};
   const after=chooseHeroFacePreset(gender,index,before);
   assert.equal(after.hair,14);
   assert.equal(after.hairColor,'pink');
   assert.equal(after.hairVolume,'soft');
   assert.equal(after.hairY,-1);
   assert.equal(matchHeroFacePreset(gender,after),index);
   const actual=resolvePartSelection(gender,after);
   assert.equal(actual.hairStyleId,PART_CATALOG[gender].hair[14].values.styleId);
   assert.notDeepEqual(actual.controls,{});
   const beauty=polishHeroFaceControls(gender,actual.controls);
   assert.ok(beauty.irisDiameter>= (gender==='female'?1.19:1.08));
   assert.ok(beauty.eyeDepth>= (gender==='female'?.045:.035));
  }
 }
});
test('every face preset has a distinct eye/face/nose/mouth signature',()=>{
 for(const gender of ['male','female']){
  const variants=HERO_FACE_PRESETS[gender].map(p=>[p.face,p.eye,p.nose,p.mouth].join(':'));
  assert.equal(new Set(variants).size,10);
 }
});
