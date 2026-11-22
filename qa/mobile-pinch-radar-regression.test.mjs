import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const radar=source.slice(source.indexOf("miniCanvas.addEventListener('pointerup'"),source.indexOf('drawSquadMiniMap();\n\nlet activeSquadLabelPress'));
assert.match(radar,/focusCommandTeam\(nearest\.team,nearest\.id\)/,
 'A single radar pin tap must focus the corresponding command team');
assert.match(radar,/if\(!nearest\|\|nearest\.distance>\.085\)return;/,
 'Empty radar pixels must not change camera focus');
assert.doesNotMatch(radar,/camera\.position\.clone\(\)\.sub\(controls\.target\)/,
 'Do not preserve the current close-up zoom on a full-map radar tap');
assert.doesNotMatch(radar,/openSquadTactics\(/,
 'Radar taps are view-only; command menus must open from explicit squad labels');

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

// Gesture intent must override follow even if the previous gesture already
// set a sticky manual override and the player later selected a squad again.
const manualCamera=source.slice(
 source.indexOf('function takeManualBattleCameraControl(){'),
 source.indexOf('// Wheel zoom and finger drag both count as intentional manual navigation.')
);
assert.doesNotMatch(manualCamera,/commandOverviewLocked\|\|manualBattleCameraOverride\)return/);
assert.match(manualCamera,/followCamera=false;targetViewFollowing=false/);
const gestureDown=source.slice(
 source.indexOf("renderer.domElement.addEventListener('pointerdown'"),
 source.indexOf("renderer.domElement.addEventListener('pointermove'")
);
assert.match(gestureDown,/activeTouchPointers\.size>1\)\{[\s\S]*?takeManualBattleCameraControl\(\)/,
 'touching with the second finger immediately cancels automatic camera follow');
const gestureMove=source.slice(
 source.indexOf("renderer.domElement.addEventListener('pointermove'"),
 source.indexOf("renderer.domElement.addEventListener('pointerup'")
);
assert.match(gestureMove,/activeTouchPointers\.size>=2\)takeManualBattleCameraControl\(\)/,
 'panning remains under manual control while both fingers are down');

// Pinch out moves closer; pinch in moves away, while honoring the 4m limit.
const pinch=(startDistance,startGap,gap)=>Math.max(4,Math.min(340,startDistance*startGap/gap));
assert.equal(pinch(64,100,200),32);
assert.equal(pinch(64,100,400),16);
assert.equal(pinch(64,100,25),256);
assert.equal(pinch(4.5,100,250),4);
console.log('Androidピンチ直接ズーム・レーダー全域俯瞰への切替・視点実測値 PASS');
