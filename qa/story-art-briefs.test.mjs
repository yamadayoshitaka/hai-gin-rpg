import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['scripts/compile-story-art-briefs.mjs'],{stdio:'pipe'});
const p=JSON.parse(fs.readFileSync('qa-reports/story-chapters/c01-c05-art-briefs.json','utf8'));
assert.equal(p.stageCount,50);
assert.equal(p.genderSeparatedSheetCount,444);
assert.equal(p.status,'AWAITING_REAL_IMAGES_AND_APPROVAL');
assert.equal(p.pages.length,444);
const keys=new Set();
const stageKeys=new Set();
const genderPairs=new Map();
for(const s of p.pages){
 assert.equal(s.sourceImageStatus,'NOT_GENERATED_NOT_APPROVED');
 assert.ok(s.canvas.cellCount>=1&&s.canvas.cellCount<=10);
 assert.equal(s.canvas.rows,Math.ceil(s.canvas.cellCount/2));
 assert.equal(s.canvas.height,s.canvas.rows*432);
 assert.equal(s.canvas.width,1536);
 assert.equal(s.storyboard.length,s.canvas.cellCount);
 assert.ok(!keys.has(s.outputPath));
 keys.add(s.outputPath);
 stageKeys.add(s.stageId);
 const edition=s.stageId+'-'+s.edition;
 const pair=genderPairs.get(edition)||new Set();
 pair.add(s.gender);genderPairs.set(edition,pair);
 for(const [i,scene] of s.storyboard.entries()){
  assert.equal(scene.position,i+1);
  assert.deepEqual(scene.grid.pixelRect,[(i%2)*768,Math.floor(i/2)*432,768,432]);
  assert.equal(scene.speechInsideImage,false);
  assert.ok(scene.sceneAction.length>3);
  assert.ok(scene.externalVoiceText.length>0);
 }
 if(s.edition.includes('gameover')){
  assert.ok(s.mandatoryArtRules.some(rule=>rule.includes('living commander')));
 }
 if(s.phase==='pre')assert.equal(s.verifiedVictoryContext,null);
 if(s.phase==='post'&&s.edition.includes('defeat'))
  assert.equal(s.verifiedVictoryContext,null);
 if(s.gender==='female')assert.match(s.protagonist.path,/female-master/);
 assert.ok(s.mandatoryArtRules.some(rule=>rule.includes('NOT a poster')));
}
assert.equal(stageKeys.size,50);
assert.equal(genderPairs.size,222);
assert.ok([...genderPairs.values()].every(p=>p.size===2&&p.has('male')&&p.has('female')));
console.log('PASS chapters 1-5: 444 real-art-only sheet prompts / 222 unique branched editions / 50 stages');
