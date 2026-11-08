import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const radar=source.slice(source.indexOf("miniCanvas.addEventListener('pointerup'"),source.indexOf('drawSquadMiniMap();\n\nlet activeSquadLabelPress'));
assert.match(radar,/new THREE\.Vector3\(\.02,Math\.ceil\(WORLD_SIZE\*CELL\*1\.36\),\.02\)/,
 'A tap on the radar must move the camera to an overhead, distant battlefield view');
assert.doesNotMatch(radar,/camera\.position\.clone\(\)\.sub\(controls\.target\)/,
 'Do not preserve the current close-up zoom on a full-map radar tap');
assert.match(radar,/openSquadTactics\(nearest\.id\)/,
 'Squad selection via radar is retained even though the view zooms out');

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
console.log('Androidピンチ直接ズーム・レーダー全域俯瞰への切替・視点実測値 PASS');
