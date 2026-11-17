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
 assert.equal(groups.length,6,'All six quality categories must be visible');
 for(const g of groups)assert.equal(typeof switches[g.id]?.enabled,'boolean',g.id);
 for(const required of [
  'id="batchDisplaySelect"','id="batchLaunchEvidence"','id="worldObjectPicker"',
  'id="faceExpressionSelect"','ChatGPT用指示をコピー','GitHubでIssueを作成して起動',
  'actions/runs/44104745097'
 ])assert(monitor.includes(required),'Missing batch control UI '+required);
 for(const required of ['id="prLink"','getPrOnDemand(','PR_BACKOFF_KEY'])
  assert(compare.includes(required),'Missing PR 403 fallback '+required);
});
