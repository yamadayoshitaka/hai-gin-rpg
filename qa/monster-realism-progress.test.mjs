import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MONSTER_CATALOG} from '../src/monster-catalog.js';
import {monsterEvidenceFor} from '../src/monster-anatomy-reference.js';
const state=JSON.parse(readFileSync(new URL('../data/monster-realism-progress.json',import.meta.url),'utf8'));
assert.equal(state.schemaVersion,1);
assert.equal(state.legacy15MinuteBatch,'paused-pr-215');
assert.equal(state.specimens.length,50);
const catalog=new Map(MONSTER_CATALOG.map(m=>[m.id,m]));
assert.equal(new Set(state.specimens.map(m=>m.id)).size,50);
const protectedIds=new Set(['m015',
  ...Array.from({length:15},(_,i)=>'m'+String(31+i).padStart(3,'0'))]);
for(const m of state.specimens){
 const spec=catalog.get(m.id);
 assert.ok(spec,'Unknown monster in queue '+m.id);
 assert.equal(m.name,spec.name);
 assert.equal(m.family,spec.family);
 assert.equal(m.status==='protected-humanlike',protectedIds.has(m.id));
 assert.equal(m.evidenceFile,'src/monster-anatomy-reference.js');
 assert.ok(monsterEvidenceFor(spec),'Missing scientific analogue '+m.id);
 if(m.latestIndividualPr!==null)assert.ok(Number.isInteger(m.latestIndividualPr));
 if(m.fullyPhotorealistic)assert.ok(m.closeupVisualVerified&&m.mobileFpsVerified,
  'Do not claim photorealism without visual/FPS verification');
}
assert.equal(state.priorityOrder.length,34);
assert.equal(new Set(state.priorityOrder).size,34);
assert.ok(state.priorityOrder.every(id=>!protectedIds.has(id)));
assert.equal(state.lastSuccessfulSpecimen,'m004');
const finished=state.specimens.filter(m=>m.status==='first-pass-mesh-reviewed');
assert.equal(finished.length,4,'Only four actual individual meshes have been reviewed');
assert.deepEqual(finished.map(m=>m.id),['m001','m002','m003','m004']);
const second=state.specimens.find(m=>m.id==='m002');
assert.equal(second.latestIndividualPr,220);
assert.equal(second.researchNote,'docs/monster-research/m002-flame-wolf-20261112.md');
assert.equal(second.fullyPhotorealistic,false);
const third=state.specimens.find(m=>m.id==='m003');
assert.equal(third.latestIndividualPr,223);
assert.equal(third.researchNote,'docs/monster-research/m003-ice-fenrir-20261112.md');
assert.equal(third.fullyPhotorealistic,false);
const fourth=state.specimens.find(m=>m.id==='m004');
assert.equal(fourth.latestIndividualPr,227);
assert.equal(fourth.researchNote,'docs/monster-research/m004-thunderwolf-spine-20261112.md');
assert.equal(fourth.fullyPhotorealistic,false);
console.log('Species-by-species research queue: 50 entries, 34 eligible, 16 frozen, no fake photorealism');
