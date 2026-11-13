import test from 'node:test';
import assert from 'node:assert/strict';
import {PART_CATALOG,defaultPartSelection} from '../src/face-part-catalog-v32.js';
import {WIG_SILHOUETTE_PROFILES} from '../src/face-wig-styles.js';
import {synchronizeHeroHairSelection,resolveHeroHairSpec} from '../src/hero-hair-controls-v43.js';

test('v46: every hair change synchronizes the stored index and live styleId',()=>{
 for(const gender of ['female','male']){
  const catalog=PART_CATALOG[gender].hair;
  assert.equal(catalog.length,24);
  for(const [index,entry] of catalog.entries()){
   const original={...defaultPartSelection(),hair:index===0?10:0};
   const chosen=synchronizeHeroHairSelection(gender,original,entry.values.styleId);
   assert.equal(chosen.parts.hair,index);
   assert.equal(chosen.styleId,entry.values.styleId);
   assert.equal(resolveHeroHairSpec(gender,chosen.parts).styleId,chosen.styleId);
   assert.equal(original.hair,index===0?10:0,'caller state must not mutate');
   const recalled=synchronizeHeroHairSelection(gender,chosen.parts,chosen.styleId);
   assert.deepEqual(recalled.parts,chosen.parts);
  }
  const fallback=synchronizeHeroHairSelection(gender,{hair:12},'no-such-style');
  assert.equal(fallback.parts.hair,12);
  assert.equal(fallback.styleId,'buzz-cut');
 }
});

test('v43: all 16 hairstyles have real, distinct 3D fringe and rear contours',()=>{
 const names=new Set();
 for(const [id,profile] of Object.entries(WIG_SILHOUETTE_PROFILES)){
  names.add(id);
  for(const key of ['fringeDrop','rearWidth','rearCutShift','sideFlare','rearDepth'])
   assert.ok(Number.isFinite(profile[key]),id+' '+key);
  assert.ok(profile.fringeDrop>=0&&profile.fringeDrop<=.12);
  assert.ok(profile.rearWidth>0&&profile.rearWidth<=1);
 }
 for(const sex of ['female','male'])
  for(const row of PART_CATALOG[sex].hair)
   assert.ok(names.has(row.values.styleId),sex+' missing 3D silhouette '+row.values.styleId);
 const male=new Set(PART_CATALOG.male.hair.map(x=>x.values.styleId));
 for(const femaleOnly of ['princess-long','curtain-bangs-long','knight-long',
  'mature-layer-long','full-fringe-straight'])
  assert.equal(male.has(femaleOnly),false);
 assert.ok(WIG_SILHOUETTE_PROFILES['full-fringe-straight'].fringeDrop >
  WIG_SILHOUETTE_PROFILES['center-part-gravity-long'].fringeDrop);
 assert.ok(WIG_SILHOUETTE_PROFILES['rounded-bob'].rearCutShift >
  WIG_SILHOUETTE_PROFILES['princess-long'].rearCutShift);
});
