import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {LANES,laneBySchedule,validateLane,compareMetrics} from '../scripts/game-quality-six-batch.mjs';
import {isAllowedSource,publicRunSummary,compareGameQualitySamples} from '../scripts/batch-self-drive.mjs';

test('all six game-quality responsibilities are distinct and cover actual real-game sources',()=>{
 assert.equal(LANES.length,6);
 assert.equal(new Set(LANES.map(x=>x.id)).size,6);
 for(const l of LANES){
  assert.equal(validateLane(l.id),l);
  assert(l.testPaths.length>=2,l.id);
  for(const p of l.testPaths)assert(fs.existsSync(p),'Missing existing regression QA '+p);
 }
 assert.deepEqual(Object.values(laneBySchedule),LANES.map(x=>x.id));
});
test('FPS before/after is valid only on comparable real CI measurements',()=>{
 const before={scenario:'50v50',environment:'github-actions-swiftshader-chromium',
  fps:32,p95Ms:39,drawCalls:780,gpuGeometries:98,gpuTextures:24,runtimeErrors:0};
 const after={...before,fps:38,p95Ms:29,drawCalls:690};
 const x=compareMetrics(before,after);
 assert.equal(x.comparable,true);assert.equal(x.delta.fps,6);
 assert.equal(x.delta.p95Ms,-10);assert.equal(x.delta.drawCalls,-90);
 assert.equal(x.fpsImproved,true);assert.equal(x.frameP95Improved,true);
 assert.equal(compareMetrics(before,{...after,scenario:'1000v1000'}).comparable,false);
 const y=compareGameQualitySamples({gameQuality:{browser:{...before,status:'measured_ci_fps'}}},
  {gameQuality:{browser:{...after,status:'measured_ci_fps'}}});
 assert.equal(y.comparable,true);assert.equal(y.p95Improved,true);
});
test('new batch may safely port runtime optimization but never overwrite newest object or story catalog',()=>{
 for(const p of ['src/battle-frame-pacing.js','src/crowd-performance-budget.js',
   'src/stage-static-instancing.js','src/battle-rigid-frustum-optimization.js',
   'src/creature-game-model-routing.js'])
  assert(isAllowedSource('gameQuality',p),p);
 for(const p of ['object-list.html','src/object-catalog.js','src/tree-seasons.js',
  'tactics-wireframe.html','data/story-chapter1.json','.github/workflows/publish-pages.yml'])
  assert.equal(isAllowedSource('gameQuality',p),false,p);
});
test('finished batch report must be based on verified main SHA and real browser result',()=>{
 const j=JSON.parse(fs.readFileSync('data/hourly-batch-dashboard.json','utf8'));
 const sw=JSON.parse(fs.readFileSync('data/batch-center-switches.json','utf8'));
 const lane=j.groups.find(g=>g.id==='gameQuality');
 assert(lane,'Game-wide batch card missing');
 assert.equal(typeof sw.groups.gameQuality.enabled,'boolean','respect owner enable/disable switch');
 assert.equal(lane.workflow,'game-quality-six-lane.yml');
 const html=fs.readFileSync('batch-monitor.html','utf8');
 assert.match(html,/gameQuality/);
 assert.match(html,/data\/batch-self-drive/);
 assert.match(html,/latestSourceCommit/);
 assert.match(html,/FPS|fps/);
 const inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';
 assert.doesNotThrow(()=>new vm.Script(inline));
 const workflow=fs.readFileSync('.github/workflows/game-quality-six-lane.yml','utf8');
 for(const name of ['model','fidelity','motion','frame','scale','runtime'])
  assert(workflow.includes(name));
 assert.match(workflow,/GAME_QUALITY_REPORT:/);
 assert.match(workflow,/upload-artifact@v4/);
 assert.match(workflow,/continue-on-error: true/);
});
