import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../face-mesh-studio.html',import.meta.url),'utf8');
test('v116 native touch pan and pinch are actually enabled together',()=>{
 assert.match(html,/orbit\.enablePan=true/);
 assert.match(html,/orbit\.screenSpacePanning=true/);
 assert.match(html,/orbit\.touches\.ONE=THREE\.TOUCH\.ROTATE/);
 assert.match(html,/orbit\.touches\.TWO=THREE\.TOUCH\.DOLLY_PAN/);
 assert.match(html,/#faceCanvas\{[^}]*touch-action:none/);
 assert.match(html,/id="faceTouchHint"[^>]*>操作：1本指＝回転 ／ 2本指スライド＝上下左右へ移動 ／ ピンチ＝拡大・縮小/);
 assert.match(html,/gestureProbe\(\)/);
 assert.doesNotMatch(html,/orbit\.enablePan=false/);
});
test('v116 only changes gestures; approved v115 face and original GLB remain',()=>{
 assert.match(html,/顔品質 v117・髪造形 v72/);
 assert.match(html,/dataset\.faceMeshReady='v117'/);
 assert.match(html,/experimentalCheekRetopo/);
 assert.match(html,/V112_SKIN_WIRE_OVERLAY/);
 assert.match(html,/function setView\(view\)/);
 assert.match(html,/orbit\.target\.copy\(c\);orbit\.update\(\)/);
});
