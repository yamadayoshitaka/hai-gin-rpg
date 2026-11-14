import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {CHAPTER1_PROVISIONAL_LIVE} from '../src/story-chapter1-provisional-live.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
const shots=chapterOneReviewPages().flatMap(p=>p.shots).filter(s=>s.stageId==='c01-s03');
assert.equal(shots.length,48,'Stage 3 must have exactly 48 canonical branches/shots');
const target='c01-s03|post-gameover|female|c01-s03-death-2';
const record=CHAPTER1_PROVISIONAL_LIVE[target];
assert(record&&record.status==='PROVISIONAL_OWNER_AUTHORIZED_PENDING_P0');
assert(record.outstandingP0?.length>0,'Do not present provisional artwork as P0 approved');
const proof=JSON.parse(fs.readFileSync(record.provenance,'utf8'));
assert.equal(proof.shotKey,target);
assert.equal(proof.ownerAccepted,true);
assert.equal(proof.formalQualityApproved,false);
assert.equal(proof.style.hasTextOrSpeechBubbles,false);
assert.equal(proof.referenceMasterCompliance,'UNVERIFIED');
const file=record.asset.replace(/^\.\//,'');
const bytes=fs.readFileSync(file);
assert.equal(bytes.toString('ascii',0,4),'RIFF');
assert.equal(bytes.toString('ascii',8,12),'WEBP');
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(sha,record.sha256);
assert.equal(sha,proof.image.sha256);
for(const shot of shots){
 const key=shot.key;
 const path=registeredStoryPanelAsset({stageId:shot.stageId,comicEdition:shot.edition,
  protagonistGender:shot.gender,id:shot.shotId});
 assert(path, 'Scene not registered '+key);
 assert(path.endsWith('.webp'),'Not a real WebP mapping '+key);
}
console.log('PASS: 48/48 stage3 canonical scene bindings, physically verified owner provisional image; 0 newly formal P0 approvals');
