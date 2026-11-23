import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// A release gate that cannot silently ask Pages for v117 after
// face-mesh-studio.html has moved to v119 or later.
test('Pages public face validation matches the current real face studio version',()=>{
 const html=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
 const workflow=readFileSync(new URL('../.github/workflows/publish-pages.yml',import.meta.url),'utf8');
 const heading=html.match(/<h1>顔・髪の編集｜顔品質 v(\d+)・髪造形 v\d+<\/h1>/);
 const ready=html.match(/dataset\.faceMeshReady='v(\d+)'/);
 assert.ok(heading,'The face editor must display an explicit release version');
 assert.ok(ready,'The editor must stamp its initial ready version');
 assert.equal(heading[1],ready[1],'Displayed and running versions must match');
 const version=ready[1];
 const start=workflow.indexOf('      - name: Confirm v');
 assert.ok(start>0,'A post-publication face validation step must exist');
 const faceGate=workflow.slice(start);
 assert.match(faceGate,new RegExp('Confirm v'+version+' '));
 assert.ok(faceGate.includes("grep -Fq '顔品質 v"+version+"' /tmp/public-face-studio.html"));
 assert.ok(faceGate.includes("dataset.faceMeshReady='v"+version+"'"));
 assert.ok(faceGate.includes('hai-gin-pages-sha'));
 assert.ok(faceGate.includes('v'+version+'_sculpt_code'));
 assert.ok(faceGate.includes('sculptV'+version+'PortraitContours'));
 assert.ok(faceGate.includes('enableV'+version+'PortraitContours:portraitV'+version));
 assert.ok(faceGate.includes('v117_sculpt_code')&&faceGate.includes('sculptV117ReferencePortrait'),
  'The published v117 source baseline must remain validated');
 assert.ok(faceGate.includes('exit 1'),'Failure of publication validation must fail the workflow');
});
