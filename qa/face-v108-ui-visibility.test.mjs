import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=()=>readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
test('v108 mobile 3D face canvas is not obscured by developer diagnostics',()=>{
 const page=html();
 const stageStart=page.indexOf('<div class="previewStage" id="previewStage">');
 const detailsStart=page.indexOf('<details id="studioTechnicalDetails"');
 const partsStart=page.indexOf('<section id="v32PartsStudio">');
 assert.ok(stageStart>0&&detailsStart>stageStart&&partsStart>detailsStart,
  'Model first; detailed quality logs second; face presets afterwards');
 const stage=page.slice(stageStart,detailsStart);
 assert.match(stage,/id="faceCanvas"/);
 assert.match(stage,/id="faceViewerStatus"/);
 assert.match(stage,/id="facePoseQuick"/);
 for(const id of ['hairBuildBadge','faceQualityRelease',
  'hairRuntimeDiagnostics','facePoseDiagnostics']){
  assert.doesNotMatch(stage,new RegExp('id="'+id+'"'),
   id+' must not cover the face');
  assert.match(page.slice(detailsStart,partsStart),new RegExp('id="'+id+'"'),
   id+' must remain available under technical details');
 }
 const details=page.slice(detailsStart,partsStart);
 assert.doesNotMatch(details,/<details[^>]*\bopen(?:\s|>)/,
  'Extended diagnostics must be collapsed by default');
 assert.match(page,/id="faceViewerStatus"[\s\S]*?<canvas id="faceCanvas"/,
  'Face status is outside, not absolute over the canvas');
 assert.doesNotMatch(page,/<div id="hairBuildBadge"[^>]*position:absolute/,
  'Old translucent diagnostic overlay must be removed');
 assert.match(page,/#hairBuildBadge\{position:static;/);
});
test('v108 portrait view enlarges face without changing donor topology or its persistent zoom',()=>{
 const page=html();
 assert.match(page,/const distance=Math\.max\(size\.x,size\.y,size\.z\)\*2\.05;/);
 assert.match(page,/#faceCanvas\{height:40dvh;min-height:255px\}/);
 assert.match(page,/\.previewStage\{position:relative;top:auto;z-index:auto\}/,
  'Mobile preview must not sticky-overlap other face editor content');
 assert.match(page,/if\(compact\)compact\.textContent=/);
 assert.match(page,/if\(quick\)quick\.textContent=/);
 assert.match(page,/const cameraSnapshot=\{position:camera\.position\.clone\(\)/,
  'Rebuilding a selected face must still preserve the custom zoom');
});
