import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {HUMAN_MONSTER_IDS} from '../src/monster-character-cosplay-manifest.js';
import {NONHUMAN_SPECIES_ANIMATION,animateNonhumanSpeciesDetails}
 from '../src/nonhuman-species-animation.js';

test('every nonhuman monster has a distinct manually tuned profile',()=>{
 const ids=MONSTER_CATALOG.filter(m=>!HUMAN_MONSTER_IDS.includes(m.id)).map(m=>m.id);
 assert.equal(ids.length,34);
 assert.deepEqual(Object.keys(NONHUMAN_SPECIES_ANIMATION),ids);
 for(const id of ids){
  const profile=NONHUMAN_SPECIES_ANIMATION[id];
  assert.ok(profile.visualFeatures.some(f=>f.startsWith('skill-')));
  assert.ok(Number.isFinite(profile.phaseOffset));
 }
 for(const id of HUMAN_MONSTER_IDS)
  assert.equal(NONHUMAN_SPECIES_ANIMATION[id],undefined);
});
test('wolf anatomy is a reference, not a substituted insect or bird rig',()=>{
 for(const [id,p] of Object.entries(NONHUMAN_SPECIES_ANIMATION)){
  if(['m001','m002','m003','m004','m005'].includes(id))
   assert.equal(p.sourceModel,'r-wolf-anatomy-reference');
  if(['tripod','octopod','flight','swim'].includes(p.locomotion))
   assert.notEqual(p.sourceModel,'r-wolf-anatomy-reference');
 }
});
test('secondary motion moves real joints but protects original wolf and panther',()=>{
 const part=()=>({rotation:{x:0,y:0,z:0}});
 const pivots={tailTip:part(),tailMid:part(),neckCollar:part()};
 const model={userData:{speciesId:'m002',pivots}};
 assert.equal(animateNonhumanSpeciesDetails(model,.42,'attack',1),true);
 assert.notEqual(pivots.tailTip.rotation.x,0);
 assert.equal(model.userData.nonhumanAnimationProfile,'m002');
 for(const id of ['m005','m006','m031']){
  model.userData.speciesId=id;
  pivots.tailTip.rotation.x=0;
  assert.equal(animateNonhumanSpeciesDetails(model,.42,'attack',1),false);
  assert.equal(pivots.tailTip.rotation.x,0);
 }
 assert.equal(animateNonhumanSpeciesDetails({userData:{speciesId:'m002'}},1),false);
});
