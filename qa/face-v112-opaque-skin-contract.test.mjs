import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');

test('v112 wire mode only overlays translucent original skin, never replaces shaded face/eyes/hair',()=>{
 assert.match(html,/function syncWireOverlay\(face\)/);
 assert.match(html,/name='V112_SKIN_WIRE_OVERLAY'/);
 assert.match(html,/wireframe:true,transparent:true,opacity:\.17/);
 assert.match(html,/depthTest:true,depthWrite:false/);
 assert.match(html,/overlay\.geometry=face\.geometry/);
 assert.match(html,/overlay\.raycast=\(\)=>\{\}/);
 assert.match(html,/wired\?'ワイヤー解除':'ワイヤー表示'/);
 assert.doesNotMatch(html,/material\.wireframe=wired/);
 assert.doesNotMatch(html,/if\(wired\)next\.face\.traverse/);
 assert.match(html,/skinWireframe:!!model\?\.face\?\.material\?\.wireframe/);
 assert.match(html,/hairWireframeMaterials/);
});

test('v112 wire overlay tracks clipping and both gender/build rebuilds',()=>{
 assert.match(html,/if\(!enabled\)\{syncWireOverlay\(face\);return;\}/);
 assert.match(html,/if\(!removed&&!clipped\)\{syncWireOverlay\(face\);return;\}/);
 assert.match(html,/face\.userData\.hairScalpMaskMode=sadakoCover\?[\s\S]*?syncWireOverlay\(face\);/);
 assert.equal((html.match(/syncWireOverlay\(next\.face\);/g)||[]).length,2);
 assert.match(html,/faceMode='color'/);
 assert.match(html,/wired=initialFaceV110\.defaultWireframe/);
 assert.match(html,/<h1>顔・髪の編集｜顔品質 v113・髪造形 v72<\/h1>/);
});
