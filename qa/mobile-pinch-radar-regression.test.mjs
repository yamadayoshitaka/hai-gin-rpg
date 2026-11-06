import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const radar=source.slice(source.indexOf("miniCanvas.addEventListener('pointerup'"),source.indexOf('drawSquadMiniMap();\n\nfunction makeSquadLabel'));
assert.match(radar,/camera\.position\.clone\(\)\.sub\(controls\.target\)/,
 'radar navigation must preserve the original camera zoom and angle');
assert.doesNotMatch(radar,/new THREE\.Vector3\(\.02,64,4\)/,
 'radar navigation must not reset camera distance to 64 metres');

const touch=source.slice(source.indexOf('let down=null,touchGestureEngaged=false'),source.indexOf("renderer.domElement.addEventListener('pointerup'"));
assert.match(touch,/activeTouchPointers=new Map\(\)/);
assert.match(touch,/pinchStartGap=Math\.hypot/);
assert.match(touch,/pointermove/);
assert.match(touch,/pinchStartDistance\*pinchStartGap\/gap/,
 'native touchscreen zoom is calibrated from the actual finger separation');
assert.match(touch,/camera\.position\.copy\(controls\.target\)\.addScaledVector\(offset,desired\)/);
assert.match(source,/window\.getBattleCameraStats=\(\)=>/,
 'exact camera distance is available for Android diagnosis');
assert.match(source,/視点 '\+camera\.position\.distanceTo\(controls\.target\)\.toFixed\(1\)\+'m/,
 'on-screen metrics must show the actual zoom distance');

// Pinch out moves closer; pinch in moves away, while honoring the 4m limit.
const pinch=(startDistance,startGap,gap)=>Math.max(4,Math.min(340,startDistance*startGap/gap));
assert.equal(pinch(64,100,200),32);
assert.equal(pinch(64,100,400),16);
assert.equal(pinch(64,100,25),256);
assert.equal(pinch(4.5,100,250),4);
console.log('Androidピンチ直接ズーム・レーダー倍率保持・視点実測値 PASS');
