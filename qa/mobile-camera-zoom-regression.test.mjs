import assert from 'node:assert/strict';
import fs from 'node:fs';

const game=fs.readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
assert.match(game,/maximum-scale=1,user-scalable=no,viewport-fit=cover/,
  'touch gestures must zoom the 3D world, not the mobile browser document');
assert.match(game,/#squadScreenLabels\{[^}]*touch-action:none/,
  'squad label overlay must not trigger browser pinch zoom');
assert.match(game,/\.squadScreenLabel\{[^}]*touch-action:none/,
  'tapping squad text must not enable browser pinch magnification');
assert.match(game,/const pageZoomed=\(window\.visualViewport\?\.scale\?\?1\)>1\.08/,
  'hide screen overlays if the browser ignores the page-level zoom lock');
assert.match(game,/if\(pageZoomed\|\|!marker\.visible\)continue/,
  'never render giant squad labels over the close-up army');
assert.match(game,/camera\.position\.distanceTo\(marker\.position\)<24/,
  'near-camera soldier inspection should not be obstructed by labels');
assert.match(game,/controls\.rotateSpeed=1\.3;controls\.zoomSpeed=1\.4;controls\.panSpeed=1\.15/,
  'mobile orbit/zoom/pan gestures should have direct, responsive sensitivity');
assert.match(game,/controls\.enableDamping=false/,
  'no latent easing is permitted after the finger stops');
assert.match(game,/controls\.touches\.TWO=THREE\.TOUCH\.DOLLY_PAN/,
  'two-finger gestures still work as in-world zoom and pan');
console.log('モバイル拡大: 文書拡大防止・部隊ラベル抑制・カメラ入力感度 PASS');
