import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {migrateV114UneditedAutoSavedEyes} from '../src/face-v114-eye-migration.js';
import {defaultPartSelection,resolvePartSelection} from '../src/face-part-catalog-v32.js';
import {resolveEditedFaceControls} from '../src/face-state-v49.js';
const natural=()=>{
 const parts=defaultPartSelection();
 return resolveEditedFaceControls('female',
  resolvePartSelection('female',parts).controls,'twenties','normal',{},false);
};
const oldControls={eyeWidth:1.12,eyeHeight:1.28*1.07,
 irisDiameter:1.12,eyeAngle:-4,lipstickWidth:1.35};
const args={
 savedPreset:{version:40,bodySelectionExplicit:true},
 parts:defaultPartSelection(),controls:oldControls,
 naturalControls:natural(),manualOverrides:{}
};
test('v114 existing old auto-saved standard normal face is upgraded on FIRST frame',()=>{
 const r=migrateV114UneditedAutoSavedEyes(args);
 assert.equal(r.changed,true);
 assert.equal(r.controls.eyeWidth,1.17);
 assert.ok(Math.abs(r.controls.eyeHeight-.94*1.07)<1e-6);
 assert.equal(r.controls.irisDiameter,1.28);
 assert.equal(r.controls.eyeAngle,1);
 assert.equal(r.controls.lipstickWidth,oldControls.lipstickWidth);
 assert.deepEqual(oldControls,args.controls,'Never mutate saved source');
 const untouchedRaw=migrateV114UneditedAutoSavedEyes({
  ...args,controls:{...oldControls,eyeHeight:1.28}});
 assert.equal(untouchedRaw.changed,true,'Pre-demographic auto-save also migrates');
});
test('v114 keeps manual iris/eye, alternate eye styles and arbitrary edited portraits',()=>{
 for(const arg of [
  {...args,manualOverrides:{irisDiameter:1.03}},
  {...args,manualOverrides:{eyeHeight:.91}},
  {...args,parts:{...args.parts,eye:4}},
  {...args,controls:{...oldControls,eyeWidth:1.30}},
  {...args,controls:{...oldControls,irisDiameter:1.35}},
  {...args,savedPreset:null}
 ]){
  const r=migrateV114UneditedAutoSavedEyes(arg);
  assert.equal(r.changed,false,'An intentionally customized eye must stay');
  assert.equal(r.controls,arg.controls);
 }
});
test('v114 auto-saved-eye upgrade occurs before initial GLB geometry is constructed',()=>{
 const html=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 const migration=html.indexOf('migrateV114UneditedAutoSavedEyes({');
 const init=html.indexOf('async function init(){');
 assert.ok(migration>0&&migration<init);
 assert.match(html,/if\(migration\.changed\)modelChanges=normalizeFemaleFaceControls\(migration\.controls\)/);
 assert.match(html,/face-v114-eye-migration\.js\?v=20261123-v114-natural-realistic-eyes/);
});
