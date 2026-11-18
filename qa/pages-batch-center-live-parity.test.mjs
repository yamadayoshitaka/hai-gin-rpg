import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root='pages-dist';
const sha=process.env.GITHUB_SHA||'local';
function read(p){return fs.readFileSync(path.join(root,p),'utf8')}
const stamp=page=>page.includes('<meta name="hai-gin-pages-sha" content="'+sha+'">');

test('published game, batch center and PR preview share the same exact build SHA',()=>{
 const meta=JSON.parse(read('release.json'));
 assert.equal(meta.sha,sha);
 for(const page of ['tactics-wireframe.html','batch-monitor.html','batch-pr-preview.html']){
  assert(stamp(read(page)),'Missing deployed commit stamp: '+page);
 }
});
test('batch center and control assets are in the delivered Pages archive',()=>{
 const monitor=read('batch-monitor.html');
 const compare=read('batch-pr-preview.html');
 const groups=JSON.parse(read('data/hourly-batch-dashboard.json')).groups;
 const switches=JSON.parse(read('data/batch-center-switches.json')).groups;
 assert.equal(groups.length,7,'All seven quality categories (including full-game six-lane batch) must be visible');
 for(const g of groups)assert.equal(typeof switches[g.id]?.enabled,'boolean',g.id);
 assert(groups.some(x=>x.id==='gameQuality'&&x.workflow==='game-quality-six-lane.yml'));
 assert(monitor.includes('gameQuality'),'Full-game quality card must reach public Pages');
 assert(monitor.includes('実際に何が改善されたか'),'Per-commit improvements must be visible');
 assert(monitor.includes('batch-pages-release-gate.js'),'The release verification script must be shipped in Pages');
 assert(monitor.includes('batch-release-parity.js'),'Live main-vs-Pages parity script must ship');
 assert(monitor.includes('id="releaseParityPanel"'),'Pages must show release divergence');
 assert(fs.existsSync(path.join(root,'src/batch-release-parity.js')),'Missing main-vs-Pages helper in published assets');
 assert(fs.existsSync(path.join(root,'src/batch-pages-release-gate.js')),'Missing verified Pages release helper in published assets');
 for(const required of [
  'id="batchDisplaySelect"','id="batchLaunchEvidence"','id="worldObjectPicker"',
  'id="faceExpressionSelect"','ChatGPT用指示をコピー','GitHubでIssueを作成して起動',
  'actions/runs/44104745097'
 ])assert(monitor.includes(required),'Missing batch control UI '+required);
 for(const required of ['id="prLink"','getPrOnDemand(','PR_BACKOFF_KEY'])
  assert(compare.includes(required),'Missing PR 403 fallback '+required);
});
