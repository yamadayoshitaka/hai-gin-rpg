import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));

const m=read('assets/story/chapter-drafts/c01/c01-s02-11-draft-handoff-20261113.json');
const previous=read('assets/story/chapter-drafts/c01/c01-s02-female-offline-handoff-20261113.json');
const contract=read('assets/story/stage-manifests/c01-s02.manifest.json');

assert.equal(m.stageId,'c01-s02');
assert.equal(contract.layout.requiredPanels,48);
assert.equal(m.registeredExistingUnapprovedOnGithub,15);
assert.equal(m.offlineCandidates,11);
assert.equal(m.stillWithoutAnyCandidate,22);
assert.equal(15+11+22,48);
assert.equal(m.qualityApprovedTotal,0);
assert.equal(m.realBinaryFilesCommittedToGithub,false);
assert.equal(m.doNotPromoteUntilVisualQA,true);
assert.equal(m.images.length,11);
const seen=new Set();
const allowed=new Set(contract.variants.flatMap(v=>
 v.scriptPanelIds.map(id=>{
  const numeric=id.match(/-m(\d+)$/);
  const canonical=numeric?id.replace(/-m\d+$/,'-m'+String(Number(numeric[1])).padStart(2,'0')):id;
  return canonical+'-'+v.edition+'-'+v.gender+'.webp';
 })));
for(const image of m.images){
 assert(!seen.has(image.assetName));seen.add(image.assetName);
 assert(allowed.has(image.assetName),'Unknown stage/result/gender asset '+image.assetName);
 assert.deepEqual(image.pixels,[1536,864]);
 assert.match(image.sha256,/^[0-9a-f]{64}$/);
 assert(image.bytes>100000&&image.bytes<25000000);
 assert.equal(image.status,'UNAPPROVED_DRAFT_OFFLINE');
}
for(const old of previous.newCandidateFiles){
 const actual=m.images.find(x=>x.assetName===old.assetName);
 assert(actual);
 assert.equal(actual.sha256,old.sha256);
 assert.equal(actual.bytes,old.bytes);
}
const newMale=m.images.filter(x=>x.gender==='male');
assert.equal(newMale.length,1);
assert.equal(newMale[0].assetName,'c01-s02-m06-post-defeat-male.webp');
assert.equal(newMale[0].bytes,545028);
assert.equal(newMale[0].sha256,'26a2b9d5521a656a7e278a742ed98fbe2a0a03abea49b0f9944b037310a156d0');
console.log('PASS stage2: 15 registered drafts + 11 authentic offline WebP hashes + 22 uncreated candidates = 48; no false approval or publish');
