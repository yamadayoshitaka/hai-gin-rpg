import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code=fs.readFileSync('src/batch-live-ref-selection.js','utf8');
const sandbox={window:{}};
vm.runInNewContext(code,sandbox);
const ref=sandbox.window.HaiGinBatchRefs;
const sha=x=>String(x).repeat(40).slice(0,40);
const pr=(number,branch,title,updated_at,base='main')=>({
 number,state:'open',draft:true,title,updated_at,head:{ref:branch,sha:sha('a')},
 base:{ref:base}
});

test('live selection prefers latest world work over old hardcoded world PR while main is canonical',()=>{
 const older=pr(442,'feat/world-five-real-entry-doors-20261116','door tiers','2026-11-15T18:01:00Z');
 const newer=pr(624,'world/structural-joinery-five-20261118','five structures','2026-11-18T01:22:56Z');
 const rows=ref.liveRows([older,newer],'world',sha('b'));
 assert.equal(rows[0].pr,0,'Canonical main is ALWAYS first');
 assert.equal(rows[0].page,'object-list.html');
 assert.equal(rows[0].sha,sha('b'));
 assert.equal(rows[1].pr,624);
 assert.equal(rows[2].pr,442);
 assert.equal(rows[1].branch,newer.head.ref);
 assert.equal(rows[1].sha,newer.head.sha);
});

test('active PRs cannot come from closed, non-main, unrelated or missing SHA branches',()=>{
 const bad=pr(999,'world/exp','object','2026-11-18T09:00:00Z','production');
 const closed=pr(998,'world/deleted','object','2026-11-18T09:00:00Z');closed.state='closed';
 const unrelated=pr(997,'feature/anime-art','story','2026-11-18T09:00:00Z');
 const missing=pr(996,'world/incomplete','object','2026-11-18T09:00:00Z');missing.head.sha='';
 assert.deepEqual([...ref.recent([bad,closed,unrelated,missing],'world')],[]);
 assert.equal(ref.recent([unrelated],'anime').length,1);
});

test('face editor and outfit QA resolve independent previews and current PRs',()=>{
 const hair=pr(615,'fix/facehair-scalp-head-weighted-selection-20261118','scalp','2026-11-18T01:09:17Z');
 const outfit=pr(616,'automation/outfit-boundary-unified-20261118-0318','garment','2026-11-18T01:09:40Z');
 assert.equal(ref.recent([hair,outfit],'faceHair')[0].pr,615);
 assert.equal(ref.recent([hair,outfit],'outfit')[0].pr,616);
 assert.equal(ref.previewPage('faceHair'),'face-mesh-studio.html');
 assert.equal(ref.previewPage('outfit'),'outfit-maintenance.html');
 assert.equal(ref.previewPage('creatureSummon'),'monster-manager.html');
});

test('batch UI never selects old fixed PR manifest for live status; current objects stay unchanged',()=>{
 const monitor=fs.readFileSync('batch-monitor.html','utf8');
 const preview=fs.readFileSync('batch-pr-preview.html','utf8');
 const objects=fs.readFileSync('object-list.html','utf8');
 assert.match(monitor,/fetchJSON\(API\+'\/commits\/main'\)/);
 assert.match(monitor,/fetchJSON\(API\+'\/pulls\?state=open/);
 assert.match(monitor,/HaiGinBatchRefs\.recent/);
 assert.match(monitor,/旧固定PRで品質を判定せず/);
 assert.match(preview,/HaiGinBatchRefs\.liveRows/);
 assert.match(preview,/GitHub最新照合不可/);
 assert.match(preview,/mainSha/);
 assert.match(objects,/src\/tree-seasons\.js/);
 assert.match(monitor,/world-quality-preview\.html\?object=/);
});

test('quality QA can fail without blocking Pages, but corrupted public content still blocks',()=>{
 const yaml=fs.readFileSync('.github/workflows/publish-pages.yml','utf8');
 assert.match(yaml,/name: Reject corrupted public HTML and JavaScript blobs\n\s+run:/);
 assert.match(yaml,/name: Verify independent male\/female source-derived face meshes\n\s+id: qa_9\n[\s\S]*?continue-on-error: true/);
 assert.match(yaml,/name: Record tolerated quality-test failures before publishing/);
 assert.match(yaml,/name: Assemble compact game website without master asset archives\n\s+run:/);
 assert.match(yaml,/name: Publish source in order without starving active development/);
});
