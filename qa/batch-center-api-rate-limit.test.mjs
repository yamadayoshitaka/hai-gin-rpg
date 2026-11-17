import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('batch-monitor.html','utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';
const runs=inline.slice(inline.indexOf('async function updateRuns('),inline.indexOf('async function updateWorldSix()'));
const preview=inline.slice(inline.indexOf('async function updatePreviewStatus()'),inline.indexOf('async function updateChapter4()'));

test('management page JavaScript parses and renders from static records without GitHub API',()=>{
 assert(inline.length>500);
 assert.doesNotThrow(()=>new vm.Script(inline));
 assert.match(inline,/updateRuns\(\{request=false\}/);
 assert.match(inline,/await updateRuns\(\);/,'initial read displays only local cache');
 assert.match(inline,/await updateRuns\(\{request:true\}\)/,'explicit refresh can request live API');
 assert.doesNotMatch(inline,/updateProgress\(\);updateRuns\(\)/,'90-second poll may not call GitHub API');
 assert.doesNotMatch(preview,/fetchJSON\(API\+/,'PR cards do not call GitHub API on render');
 assert.match(preview,/makeLink\('PRを直接確認'/,'PR remains directly accessible');
});

test('only one unauthenticated GitHub Actions collection call per manual refresh',()=>{
 assert.doesNotMatch(runs,/actions\/workflows\?per_page|actions\/workflows\//);
 assert.match(runs,/API\+'\/actions\/runs\?per_page=100'/);
 assert.equal((runs.match(/fetch\(API\+/g)||[]).length,1);
 assert.match(runs,/if\(!request\)/);
 assert.match(runs,/RUN_MIN_REFRESH_MS/);
 assert.match(runs,/RUN_BACKOFF_KEY/);
 assert.match(runs,/403\|\|r.status===429/);
 assert.match(runs,/x-ratelimit-remaining/);
 assert.match(runs,/x-ratelimit-reset/);
 assert.match(runs,/バッチ停止とは限りません/);
 assert.match(runs,/new URL\(location|source/);
});

test('six-lane world QA is isolated by ref and ignores dashboard-only PRs',()=>{
 const yaml=fs.readFileSync('.github/workflows/world-six-lane.yml','utf8');
 assert.match(yaml,/group: world-six-lane-\$\{\{ github.ref \}\}-\$\{\{ github.event_name \}\}/);
 const section=yaml.slice(yaml.indexOf('  pull_request:'),yaml.indexOf('permissions:'));
 assert(!section.includes('batch-monitor.html'),'UI-only change should not trigger six GPU jobs');
 assert(!section.includes('tactics-wireframe.html'),'battle-only change should not trigger six world geometry jobs');
 assert(section.includes('src/object-catalog.js'));
});
