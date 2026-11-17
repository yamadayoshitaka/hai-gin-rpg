import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {comicForStage} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {chapter1ProvisionalLivePanel} from '../src/story-chapter1-provisional-live.js';
import {restoredStoryArchivePanel,RESTORED_STORY_ARCHIVE,
 RESTORED_STORY_ARCHIVE_COUNT} from '../src/story-archive-restored-art.js';

// This is a REAL binary/provenance check, not a visual P0 approval.
const required=[
 'c01-s05|pre|male|c01-s05-m1',
 'c01-s05|pre|male|c01-s05-m15',
 'c01-s05|post-victory|male|c01-s05-m6',
 'c01-s05|post-victory|male|c01-s05-m10',
 'c01-s05|post-victory|female|c01-s05-m6'
];
assert(RESTORED_STORY_ARCHIVE_COUNT>=5);
for(const key of required)assert(RESTORED_STORY_ARCHIVE[key],key);
let inspected=0;
for(const [key,entry] of Object.entries(RESTORED_STORY_ARCHIVE)){
 const [stageId,edition,gender,panelId]=key.split('|');
 assert.match(key,/^c\d{2}-s\d{2}\|(?:pre|post-victory|post-town|post-defeat|post-gameover)\|(?:male|female)\|c\d{2}-s\d{2}-(?:m\d+|death-\d+)$/);
 assert.equal(entry.reviewStatus,'PROVISIONAL_ARCHIVE_RESTORED_NOT_P0');
 assert.equal(entry.visualIdentityApproved,false);
 assert.equal(entry.sourceBranch,'story/chapter1-free-actual-art');
 assert.deepEqual([entry.stageId,entry.edition,entry.gender,entry.panelId],
  [stageId,edition,gender,panelId]);
 assert.equal(chapter1ProvisionalLivePanel({stageId,comicEdition:edition,protagonistGender:gender,id:panelId}),
  null,'Do not replace an existing live exact scene');
 const context={protagonistGender:gender};
 if(edition==='post-victory')context.battleOutcome={victory:true};
 const story=comicForStage(stageId,edition==='pre'?'pre':'post',context);
 const shot=story.panels.find(x=>x.id===panelId);
 assert(shot&&shot.comicEdition===edition, 'Image is for a different story, gender or ending: '+key);
 assert.equal(registeredStoryPanelAsset(shot),entry.asset);
 assert.equal(restoredStoryArchivePanel(shot),entry);
 const abs=path.resolve(entry.asset.replace(/^\.\//,''));
 const proofPath=path.resolve(entry.proof.replace(/^\.\//,''));
 const source=fs.readFileSync(abs);
 assert.equal(source.toString('ascii',0,4),'RIFF');
 assert.equal(source.toString('ascii',8,12),'WEBP');
 const type=source.toString('ascii',12,16);
 let w=0,h=0;
 if(type==='VP8 '){w=source.readUInt16LE(26)&0x3fff;h=source.readUInt16LE(28)&0x3fff;}
 else if(type==='VP8L'){const v=source.readUInt32LE(21);w=(v&0x3fff)+1;h=((v>>>14)&0x3fff)+1;}
 else if(type==='VP8X'){w=source.readUIntLE(24,3)+1;h=source.readUIntLE(27,3)+1;}
 assert.deepEqual([w,h],entry.nativePixels);
 assert(w>=800&&h>=450&&w*9===h*16);
 const sha256=crypto.createHash('sha256').update(source).digest('hex');
 assert.equal(sha256,entry.sha256,'Source pixels changed since original archival generation');
 const gitBlobHash=crypto.createHash('sha1').update(Buffer.from('blob '+source.length+'\0')).update(source).digest('hex');
 assert.equal(gitBlobHash,entry.gitBlobSha,'Archive Git object changed');
 const proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
 assert.equal(proof.kind,'CLOUDFLARE_REAL_WEBP_REVIEW_CANDIDATE_NOT_APPROVED');
 assert.equal(proof.shotKey,key);
 assert.equal(proof.stageId,stageId);
 assert.equal(proof.edition,edition);
 assert.equal(proof.gender,gender);
 assert.equal(proof.panelId,panelId);
 assert.equal(proof.imageBytes,source.length);
 assert.equal(proof.imageSha256,sha256);
 assert.deepEqual(proof.nativePixels,[w,h]);
 assert.equal(proof.visuallyApproved,false);
 assert.equal(proof.formallyRegistered,false); // Original proof predates reversible recovery.
 const ids=new Set(proof.actualReferenceImagesAttached?.map(x=>x.actorId));
 for(const actor of proof.visibleActorIds||[])
  assert(ids.has(actor),'Character had no actual reference bytes attached: '+key+'/'+actor);
 assert.deepEqual(proof.visibleActorIds,entry.visibleActorIds);
 inspected++;
}
const reviewed=fs.readFileSync('src/story-chapter-reviewed-art.js','utf8');
assert.match(reviewed,/REGISTERED_CHAPTER_REVIEWED=Object\.freeze\(\{\}\)/,
 'Provisional image must never be silently inserted as formally reviewed');
console.log(JSON.stringify({status:'PASS',restoredWebPs:inspected,
 provenanceVerified:inspected,noPaidApiCalls:true,formalVisualApproval:false}));
