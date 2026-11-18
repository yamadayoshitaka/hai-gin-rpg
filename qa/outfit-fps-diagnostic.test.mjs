import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyOutfitFps} from '../scripts/outfit-fps-diagnostic.mjs';

const valid={status:'measured_ci_fps',environment:'github-actions-swiftshader-chromium',
 scenario:'50v50',fps:24,p95Ms:41.3,drawCalls:680,runtimeErrors:0,
 screenshotBytes:40000,webglContextLost:false};
test('actual dressed 50v50 CI FPS is displayed with immutable hardware caveat',()=>{
 const r=classifyOutfitFps(valid);
 assert.equal(r.status,'measured_ci_fps');
 assert.equal(r.fps,24);assert.equal(r.p95Ms,41.3);assert.equal(r.drawCalls,680);
 assert.equal(r.androidFpsMeasured,false);
 assert.equal(r.visualQualityApproved,false);
 assert.equal(r.beforeAfterComparable,false);
 assert.equal(r.sourceModifiedByDiagnostic,false);
});
test('static success, missing screenshot, runtime errors or 1000-boot do not fabricate FPS',()=>{
 for(const bad of [{...valid,status:'static_qa_passed'}, {...valid,screenshotBytes:0},
   {...valid,runtimeErrors:1}, {...valid,scenario:'1000v1000'},
   {...valid,environment:'unknown'},null]){
  const r=classifyOutfitFps(bad);
  assert.equal(r.status,'fps_unverified');
  assert.equal(r.fps,null);
 }
});
test('outfit all-six QA has an hourly real WebGL FPS step with archived report',()=>{
 const yaml=readFileSync('.github/workflows/character-six-lane.yml','utf8');
 assert.match(yaml,/CRON.*github\.event\.schedule/);
 assert.match(yaml,/53 \* \* \* \*/);
 assert.match(yaml,/qa\/game-quality-browser\.cjs --lane=frame/);
 assert.match(yaml,/scripts\/outfit-fps-diagnostic\.mjs/);
 assert.match(yaml,/qa-reports\/character-six-lane\/\$\{\{ matrix\.category \}\}-\*\.json/);
 assert.match(yaml,/browser-frame\.json/);
 assert.match(yaml,/pull_request/);
});
