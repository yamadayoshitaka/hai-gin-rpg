import assert from 'node:assert/strict';
import fs from 'node:fs';
import {qualityInventory,objectCount,stageCount,referencePrompt} from '../scripts/world-quality-catalog.mjs';
import {normalizeRequest,parseIssueBody,makeIssueBody} from '../scripts/world-quality-manual-command.mjs';
assert.equal(stageCount,200,'All 20 x 10 campaign stages included');
assert.equal(objectCount,60,'Every shared game-catalog object should be included');
assert.equal(qualityInventory.length,260);
assert.equal(new Set(qualityInventory.map(x=>x.key)).size,260);
assert(qualityInventory.find(x=>x.key==='object:timber_bridge_001'));
assert(qualityInventory.find(x=>x.key==='object:castle_001'));
assert(qualityInventory.find(x=>x.key==='stage:c20-s10'));
for(const row of qualityInventory){
 const prompt=referencePrompt(row);
 assert.match(prompt,/PHOTOREAL/);
 assert.match(prompt,/no words/i);
 assert.match(prompt,/16:9/);
 assert.match(prompt,/not actual game geometry|not actual game geometry|NOT actual game geometry/i);
}
const master=fs.readFileSync('scripts/world-quality-run.mjs','utf8');
const runner=fs.readFileSync('scripts/world-quality-postprocess.mjs','utf8');
const pbr=fs.readFileSync('src/world-quality-pbr.js','utf8');
const html=fs.readFileSync('batch-monitor.html','utf8');
assert(master.includes('CLOUDFLARE_FREE_PLAN_CONFIRMED'));
assert(master.includes('NO_PAID_FALLBACK'));
assert(master.includes('referenceSha256'));
assert(runner.includes('world-quality-capture.cjs'));
assert(runner.includes('world-quality-stage-capture.cjs'));
assert(pbr.includes('WORLD_QUALITY_AUTO_BEGIN'));
assert(pbr.includes('WORLD_QUALITY_AUTO_END'));
assert(html.includes("API+'/actions/runs?per_page=100'"),
 'dashboard must request actual workflow run status, not the legacy workflows list');
assert(html.includes('RUN_BACKOFF_KEY')&&html.includes('r.status===403||r.status===429'),
 '403/429 must have a bounded retry instead of hammering unauthenticated GitHub');
assert(html.includes('hourly-batch-dashboard.json'));
assert(html.includes("REAL_STAGE_CAPTURE_HUMAN_QA_PENDING")===false);
const preview=fs.readFileSync('world-quality-preview.html','utf8');
assert(preview.includes('createCatalogObject'));
assert(preview.includes('roughnessScale'));
assert(preview.includes("dataset.qaReady='true'"));
const testManual=normalizeRequest({kind:'stage',target:'stage:c01-s04',
 instruction:'湿った石畳と自然な光の陰影を丁寧に',maxReferences:2});
assert.deepEqual(parseIssueBody(makeIssueBody(testManual)),testManual);
assert.throws(()=>normalizeRequest({kind:'object',target:'stage:c01-s04'}),/Target/);
assert.throws(()=>normalizeRequest({kind:'all',maxReferences:4}),/maximum/);
assert.throws(()=>parseIssueBody('untrusted issue'),/Not a quality request/);
assert(html.includes('次の手動指示'));
assert(html.includes("issues/new?"));
const worldWorkflow=fs.readFileSync('.github/workflows/world-quality-photoreal.yml','utf8');
assert(worldWorkflow.includes('issues:'));
assert(worldWorkflow.includes('world-quality-manual-command.mjs'));
assert(worldWorkflow.includes("github.event.issue.user.login == github.repository_owner"));
console.log('PASS: 60 objects + 200 campaign stages; references, capture, bounded tuning, dashboard QA gates');
