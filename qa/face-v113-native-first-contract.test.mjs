import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');

test('v113 default reuses the previously approved smooth original source and never forces rough v106 retopo',()=>{
 assert.match(html,/experimentalCheekRetopo=new URLSearchParams\(location\.search\)\.get\('retopo'\)==='1'/);
 assert.match(html,/enableV106LocalRetopo:g==='female'&&experimentalCheekRetopo/);
 assert.match(html,/enableV106LocalRetopo:experimentalCheekRetopo/);
 assert.match(html,/v113NativeNormalGeometry:!experimentalCheekRetopo/);
 assert.match(html,/v113FaceVertexCount:/);
 assert.match(html,/<h1>顔・髪の編集｜顔品質 v113・髪造形 v72<\/h1>/);
 assert.match(html,/dataset\.faceMeshReady='v113'/);
 assert.doesNotMatch(html,/enableV106LocalRetopo:g==='female',/);
 assert.doesNotMatch(html,/enableV106LocalRetopo:true,/);
});
test('v113 preserves v112 opaque skin on wire toggle and v111 atomic first display',()=>{
 assert.match(html,/wireframe:true,transparent:true,opacity:\.17/);
 assert.match(html,/function syncWireOverlay\(face\)/);
 assert.match(html,/await requestRealSkinPhotoMaps\(\);/);
 assert.match(html,/try\{rebuildWig\(\);\}/);
 assert.match(html,/try\{rebuildMaleHair\(\);\}/);
 assert.match(html,/geometrySignature\(\)/);
});
