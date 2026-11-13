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
const additional=read('assets/story/chapter-drafts/c01/c01-s02-female-gameover-death1-local-handoff-20261113.json');
assert.equal(additional.kind,'NEW_LOCAL_IMAGE_CANDIDATE_NOT_GITHUB_ASSET');
assert.equal(additional.stageId,'c01-s02');
assert.equal(additional.shotId,'c01-s02-death-1');
assert.equal(additional.edition,'post-gameover');
assert.equal(additional.gender,'female');
assert.equal(additional.compoundKey,'c01-s02|post-gameover|female|c01-s02-death-1');
assert(contract.variants.some(v=>v.gender===additional.gender&&v.edition===additional.edition&&v.scriptPanelIds.includes(additional.shotId)));
assert.deepEqual(additional.pixelSize,[1664,936]);
assert.equal(additional.pixelSize[0]*9,additional.pixelSize[1]*16);
assert(additional.pixelSize[0]>=1536&&additional.pixelSize[1]>=864);
assert.equal(additional.bytes,276408);
assert.equal(additional.sha256,'cb6fe35fa9b4c570bcf434c3b5bf236f59e5d6970b64b52a9e9f987aac187e07');
assert.equal(additional.visualStatus,'UNAPPROVED_DRAFT_PRELIMINARY_REVIEW');
assert.equal(additional.humanApproval,false);
assert.equal(additional.githubBinaryCommitted,false);
assert.equal(additional.gameMappingAdded,false);
assert.equal(additional.pagesDeploymentVerified,false);
assert.equal(additional.currentAccounting.githubRegisteredUnapproved,15);
assert.equal(additional.currentAccounting.previousOfflineCandidates,11);
assert.equal(additional.currentAccounting.newOfflineCandidates,1);
assert.equal(additional.currentAccounting.withoutCandidate,21);
assert.equal(additional.currentAccounting.qualityApproved,0);
assert.equal(Object.values(additional.currentAccounting).slice(0,4).reduce((a,b)=>a+b,0),48);
console.log('PASS stage2: 15 Github drafts + 11 previous offline + 1 new offline unapproved + 21 without candidates = 48; none quality-approved or deployed');
