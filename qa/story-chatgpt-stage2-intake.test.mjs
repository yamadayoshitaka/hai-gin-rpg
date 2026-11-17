#!/usr/bin/env node
/** Real bytes and reversible stage2 ChatGPT intake; never grants final P0. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {registeredStoryPanelAsset,storyArtDisplayUrl} from '../src/story-panel-registered-art.js';
import {CHAPTER1_PROVISIONAL_LIVE,chapter1ProvisionalLivePanel} from '../src/story-chapter1-provisional-live.js';
const cases=[
 {scene:'c01-s02-m1',sha:'5f90fd72465ac45690e71cecda1aa369591da238de6f3a6e7817a964eb0befaa',
  blob:'932e25de2541a6c6818a62e736d7ced3dee138ba',bytes:550550,live:true},
 {scene:'c01-s02-m15',sha:'1ea96c6e634f94fe890368935503ad24e8ec43c6f7e24871b5b619c5aa1abf0c',
  blob:'705d8b2ed73305535d8d1e58d192d5994706c86c',bytes:396770,live:false}
];
for(const x of cases){
 const key='c01-s02|pre|male|'+x.scene;
 const short=x.scene.replace('c01-s02-','');
 const path='assets/story/'+(x.live?'chapter1-provisional-live':'chatgpt-candidates')+
  '/c01-s02__pre__male__'+x.scene+'.webp';
 const proof=JSON.parse(fs.readFileSync(path+'.generation.json','utf8'));
 const raw=fs.readFileSync(path);
 assert.equal(raw.length,x.bytes,key);
 assert.equal(raw.toString('ascii',0,4),'RIFF',key);
 assert.equal(raw.toString('ascii',8,12),'WEBP',key);
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),x.sha,key);
 assert.equal(crypto.createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex'),x.blob,key);
 const fmt=raw.toString('ascii',12,16);
 let width,height;
 if(fmt==='VP8 '){width=raw.readUInt16LE(26)&16383;height=raw.readUInt16LE(28)&16383;}
 else if(fmt==='VP8L'){const n=raw.readUInt32LE(21);width=(n&16383)+1;height=((n>>>14)&16383)+1;}
 else if(fmt==='VP8X'){width=raw.readUIntLE(24,3)+1;height=raw.readUIntLE(27,3)+1;}
 else throw Error('Not native WebP: '+fmt);
 assert.deepEqual([width,height],[1664,936],key);
 assert.equal(proof.shotKey,key,key);
 assert.equal(proof.canonicalQueueKey,'c01-s02|pre|'+x.scene+'|male',key);
 assert.equal(proof.provider,'ChatGPT Images, user-initiated subscription UI',key);
 assert.equal(proof.nativeQAComplete,true,key);
 assert.equal(proof.visualP0Approved,false,key);
 assert.equal(proof.formallyApproved,false,key);
 assert.equal(proof.additionalPaidApiCalls,0,key);
 assert.equal(proof.imageBytes,x.bytes,key);
 assert.equal(proof.sha256,x.sha,key);
 assert.equal(proof.gitBlobSha,x.blob,key);
 assert.deepEqual(proof.nativePixels,[1664,936],key);
 assert.equal(proof.gameArtworkRegistered,x.live,key);
 const shot={stageId:'c01-s02',comicEdition:'pre',protagonistGender:'male',id:x.scene};
 const live=chapter1ProvisionalLivePanel(shot);
 if(x.live){
  assert.equal(live?.status,'PROVISIONAL_OWNER_AUTHORIZED_PENDING_P0',key);
  assert.equal(live?.sha256,x.sha,key);
  assert.equal(live?.visualP0Approved,false,key);
  assert.deepEqual(live?.visibleHumanCast,[],key);
  assert.deepEqual(proof.visibleHumanCast,[],key);
  assert.equal(registeredStoryPanelAsset(shot),'./'+path,key);
  // This asset is exposed by the public game through the pinned RAW commit,
  // so it must be under the existing reversible provisional URL namespace.
  assert(storyArtDisplayUrl('./'+path),key);
 } else {
  assert.equal(live,null,'Commander identity not verified: never activate provisional m15');
  assert.equal(proof.actualCharacterMasterBytesAttached,false,key);
  assert(proof.visibleHumanCast.includes('commander_male_back_view'),key);
  assert.notEqual(registeredStoryPanelAsset(shot),'./'+path,key);
 }
 const opposite={...shot,protagonistGender:'female'};
 assert.notEqual(registeredStoryPanelAsset(opposite),'./'+path,'No reuse from opposite gender: '+key);
}
assert.equal(Object.keys(CHAPTER1_PROVISIONAL_LIVE).filter(k=>k.startsWith('c01-s02|pre|male|')).length,1,
 'Only the character-free canonical scene is activated');
console.log(JSON.stringify({status:'PASS',chatGPTRealWebP:2,reversibleActorFreeInGame:1,
 heldForCharacterIdentityReview:1,formallyP0Approved:0,paidApiCalls:0}));
