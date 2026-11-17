#!/usr/bin/env node
// Pure local filesystem regression; NEVER calls an image provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const source='qa-reports/story-sequential-missing/next.json';
const run=spawnSync(process.execPath,['scripts/story-sequential-missing-batch.mjs','--max','20'],
 {encoding:'utf8'});
assert.equal(run.status,0,run.stderr);
const q=JSON.parse(fs.readFileSync(source,'utf8'));
assert.equal(q.schemaVersion,1);
assert.equal(q.identities,880);
assert.equal(q.genderVariants,1760);
assert.equal(q.entries.length,1760);
assert.equal(new Set(q.entries.map(row=>row.key)).size,1760);
assert.equal(q.entries[0].stageId,'c01-s01');
assert.equal(q.entries.at(-1).stageId,'c20-s10');
assert.equal(new Set(q.entries.map(row=>row.stageId)).size,200);
for(let chapter=1;chapter<=20;chapter++){
 for(let stage=1;stage<=10;stage++){
  const id='c'+String(chapter).padStart(2,'0')+'-s'+String(stage).padStart(2,'0');
  const rows=q.entries.filter(row=>row.stageId===id);
  assert.equal(rows.length,stage===1?16:8,id);
  for(const row of rows){
   assert.match(row.key,/\|(male|female)$/);
   if(chapter===1&&stage<=4)
    assert.equal(row.policy,'EXACT_OLD_ART_REUSE_ALLOWED');
   else assert.equal(row.policy,'NEW_ORIGINAL_REQUIRED');
   assert(['REGISTERED_REAL_NOT_P0','BROKEN_REGISTRATION','MISSING_ART'].includes(row.status));
  }
 }
}
const pending=q.entries.filter(row=>row.status!=='REGISTERED_REAL_NOT_P0');
assert.equal(q.pending,pending.length);
assert.equal(q.registered+q.pending,1760);
assert.equal(q.firstMissing,pending[0]?.key??null);
assert.deepEqual(q.selected,q.enabled?pending.slice(0,20):[]);
assert.equal(q.generatedThisRun,0);
assert.equal(q.provisionallyRegisteredThisRun,0);
assert.equal(q.formalP0ThisRun,0);
assert.equal(q.providerRequestsThisRun,0);
assert.equal(q.noPaidApi,true);
const invalid=spawnSync(process.execPath,['scripts/story-sequential-missing-batch.mjs','--max','21'],
 {encoding:'utf8'});
assert.notEqual(invalid.status,0);
console.log('PASS: 1..200 sequential manga queue; native image and gender guards; generation=0 truth');
