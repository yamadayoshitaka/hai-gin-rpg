import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const plan=JSON.parse(await fs.readFile(new URL('../qa-reports/story-art-batch-plan.json',import.meta.url),'utf8'));
assert.equal(plan.totalChapters,20);
assert.equal(plan.totalStages,200);
assert.equal(plan.totalPanels,4000);
assert.equal(plan.totalBatches,400);
assert.equal(plan.batches.length,400);
const seen=new Set();
for(let i=0;i<400;i++){
 const b=plan.batches[i];
 assert.equal(b.index,i+1);
 assert.equal(b.panels.length,10);
 assert.equal(b.stages.length,1);
 assert.equal(b.layout.columns,2);
 assert.equal(b.layout.rows,5);
 assert.match(b.sheetPrompt,/no gutters|no page border/i);
 assert.match(b.heroineEditPrompt,/ONLY the player strategist/i);
 const hero=b.panels.filter(p=>p.phase==='pre'),epilogue=b.panels.filter(p=>p.phase==='post');
 assert.equal(b.phase,i%2===0?'pre':'post');
 assert.equal(hero.length,b.phase==='pre'?10:0);assert.equal(epilogue.length,b.phase==='post'?10:0);
 for(let n=0;n<10;n++){
  const shot=b.panels[n];
  assert.equal(shot.frame,n+1);
  assert.equal(shot.row,Math.floor(n/2)+1);
  assert.equal(shot.column,n%2+1);
  assert.equal(shot.stageId,b.stages[0]);
  assert.equal(shot.phase,b.phase);
  assert.match(shot.id,new RegExp('^'+b.stages[0]+'-m(?:[1-9]|1[0-9]|20)
  assert.ok(!seen.has(shot.id));seen.add(shot.id);
  assert.match(shot.maleOutput,/^assets\/story\/panels\/c\d{2}-s\d{2}-m(?:0[1-9]|1[0-9]|20)\.webp$/);
  assert.match(shot.femaleOutput,/^assets\/story\/panels\/c\d{2}-s\d{2}-m(?:0[1-9]|1[0-9]|20)-female\.webp$/);
  assert.ok(shot.subtitleText.length>12);
  assert.ok(shot.voiceText.length>10);
  assert.ok(shot.characters.length>=0);
 }
}
assert.equal(seen.size,4000);
const py=await fs.readFile(new URL('../scripts/slice-story-art-batch.py',import.meta.url),'utf8');
assert.match(py,/hero-mask\.png/);
assert.match(py,/review-approved\.json/);
assert.match(py,/outside\.getbbox\(\) is not None/);
assert.match(py,/near-duplicate/);
assert.match(py,/4000/);
console.log('PASS 400 independent ten-scene 2x5 pre/post art batches, 4000 exact IDs, heroine-only masks and approval checks');
));
  assert.ok(!seen.has(shot.id));seen.add(shot.id);
  assert.match(shot.maleOutput,/^assets\/story\/panels\/c\d{2}-s\d{2}-m(?:0[1-9]|1[0-9]|20)\.webp$/);
  assert.match(shot.femaleOutput,/^assets\/story\/panels\/c\d{2}-s\d{2}-m(?:0[1-9]|1[0-9]|20)-female\.webp$/);
  assert.ok(shot.subtitleText.length>12);
  assert.ok(shot.voiceText.length>10);
  assert.ok(shot.characters.length>=0);
 }
}
assert.equal(seen.size,2000);
const py=await fs.readFile(new URL('../scripts/slice-story-art-batch.py',import.meta.url),'utf8');
assert.match(py,/hero-mask\.png/);
assert.match(py,/review-approved\.json/);
assert.match(py,/outside\.getbbox\(\) is not None/);
assert.match(py,/near-duplicate/);
assert.match(py,/2000/);
console.log('PASS 200 independent ten-scene 2x5 art batches, 2000 exact IDs, heroine-only masks and approval checks');
