import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
test('visual gate refuses to infer artistic quality and requires actual frame screenshot',()=>{
 const py=fs.readFileSync('qa/visual-frame-guard.py','utf8');
 const workflow=fs.readFileSync('.github/workflows/game-quality-six-lane.yml','utf8');
 assert.match(py,/artisticQualityApproved.*False/);
 assert.match(py,/androidFpsMeasured.*False/);
 assert.match(py,/invalid_or_blank_frame/);
 assert.match(py,/missing_actual_game_screenshot/);
 assert.match(workflow,/python qa\/visual-frame-guard\.py qa-reports\/game-quality-six\/frame-webgl\.png/);
 assert.match(workflow,/if: steps\.lane\.outputs\.lane == 'frame'/);
});
