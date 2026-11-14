import test from 'node:test';
import assert from 'node:assert/strict';
import {AGE_PROFILES,BODY_PROFILES,AGE_BAND_IDS,BODY_TYPE_IDS,
 enumerateDemographics,resolveDemographicProfile,
 applyDemographicFaceControls,resolveBodyType} from '../src/character-demographics-v47.js';
import {defaultPartSelection,resolvePartSelection,normalizePartSelection} from '../src/face-part-catalog-v32.js';
import {normalizeFemaleFaceControls,normalizeMaleFaceControls} from '../src/face-v7-controls.js';
import {CHARACTER_CAST_V46,characterAppearance,MAJOR_CHARACTER_IDS} from '../src/character-cast-v46.js';
test('8 age groups × 4 body builds × both sexes = 64 individually selectable real 3D recipes',()=>{
 assert.equal(AGE_BAND_IDS.length,8);
 assert.deepEqual(AGE_BAND_IDS,['under10','teens','twenties','thirties',
  'forties','sixties','seventies','eightyPlus']);
 assert.deepEqual(BODY_TYPE_IDS,['ultraThin','thin','normal','fat']);
 const grid=enumerateDemographics();
 assert.equal(grid.length,64);
 assert.equal(new Set(grid.map(c=>c.id)).size,64);
 for(const record of grid){
  const age=AGE_PROFILES[record.ageBand],body=BODY_PROFILES[record.bodyType];
  const demo=resolveDemographicProfile(record.ageBand,record.bodyType);
  assert.equal(demo.age.id,age.id);
  assert.equal(demo.body.id,body.id);
  const before=defaultPartSelection();
  const selected=normalizePartSelection({...before,ageBand:record.ageBand,bodyType:record.bodyType});
  assert.equal(selected.ageBand,record.ageBand);
  assert.equal(selected.bodyType,record.bodyType);
  const controls=resolvePartSelection(record.gender,selected).controls;
  const after=applyDemographicFaceControls(controls,record.ageBand,record.bodyType,record.gender);
  const normalized=record.gender==='female'?normalizeFemaleFaceControls(after):normalizeMaleFaceControls(after);
  assert.equal(normalized.ageBand,record.ageBand);
  assert.equal(normalized.bodyType,record.bodyType);
  assert.ok(normalized.eyeDepth>=.02);
  assert.ok(normalized.eyeWidth>=.70&&normalized.eyeWidth<=1.45);
 }
});
test('ageing changes real eyelid, sag, wrinkle and height independently of body weight',()=>{
 const last=AGE_PROFILES.eightyPlus,young=AGE_PROFILES.twenties;
 assert.ok(last.sag>young.sag&&last.wrinkles>young.wrinkles);
 assert.ok(AGE_PROFILES.under10.heightScale<AGE_PROFILES.teens.heightScale);
 assert.ok(last.heightScale<young.heightScale);
 assert.ok(last.eyelidScale<young.eyelidScale);
 assert.ok(AGE_PROFILES.sixties.wrinkles>AGE_PROFILES.forties.wrinkles);
 const standard={eyeWidth:1,eyeHeight:1,faceMorph:0,jawSharpness:4.3};
 const eye0=applyDemographicFaceControls(standard,'twenties','normal','female');
 const eye80=applyDemographicFaceControls(standard,'eightyPlus','normal','female');
 assert.ok(eye80.eyeHeight<eye0.eyeHeight);
 const thin=applyDemographicFaceControls(standard,'forties','thin','male');
 const fat=applyDemographicFaceControls(standard,'forties','fat','male');
 assert.ok(thin.faceMorph<fat.faceMorph);
 assert.ok(resolveBodyType('fat').width>resolveBodyType('normal').width);
 assert.ok(resolveBodyType('thin').depth<resolveBodyType('normal').depth);
});
test('main cast regenerated with fixed identities, decades and build profiles',()=>{
 assert.equal(MAJOR_CHARACTER_IDS.length,6);
 for(const c of CHARACTER_CAST_V46){
  const a=characterAppearance(c.id);
  assert.equal(a.ageBand,c.ageBand);
  assert.equal(a.bodyType,c.bodyType);
  assert.equal(a.controls.ageBand,c.ageBand);
  assert.equal(a.controls.bodyType,c.bodyType);
  assert.equal(a.item.id,c.id);
  assert.equal(a.parts.ageBand,c.ageBand);
  assert.equal(a.parts.bodyType,c.bodyType);
  assert.ok(a.styleId);
 }
 assert.equal(characterAppearance('mina').ageBand,'under10');
 assert.equal(characterAppearance('garan').ageBand,'seventies');
 assert.equal(characterAppearance('lucia').ageBand,'thirties');
});
