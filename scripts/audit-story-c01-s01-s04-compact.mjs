#!/usr/bin/env node
/**
 * Stage 1-4 compact CG ledger. Audits actual present files and reports only
 * scene/gender/outcome slots currently playable. Does not call an image API.
 * The 462-panel historical source remains an archive, not a rework quota.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {compactComicForStage} from '../src/story-compact-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
const stages=['c01-s01','c01-s02','c01-s03','c01-s04'];
const out=[];
const root=process.cwd();
function summary(url){
 if(!url)return {status:'MISSING_EXACT_ASSET',asset:null};
 if(!url.startsWith('./'))return {status:'EXTERNAL_SOURCE_UNVERIFIED',asset:url};
 const location=path.join(root,url.slice(2));
 if(!fs.existsSync(location))return {status:'REGISTERED_PATH_MISSING_FILE',asset:url};
 const data=fs.readFileSync(location);
 const webp=data.length>30&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';
 if(!webp)return {status:'REGISTERED_NOT_WEBP',asset:url};
 let width=0,height=0;const format=data.toString('ascii',12,16);
 if(format==='VP8 '){width=data.readUInt16LE(26)&0x3fff;height=data.readUInt16LE(28)&0x3fff;}
 if(format==='VP8L'){const n=data.readUInt32LE(21);width=(n&0x3fff)+1;height=((n>>>14)&0x3fff)+1;}
 if(format==='VP8X'){width=data.readUIntLE(24,3)+1;height=data.readUIntLE(27,3)+1;}
 const nativeOK=width>=800&&height>=450&&width*9===height*16;
 return {status:nativeOK?'PLAYABLE_NATIVE_NOT_FORMAL_P0':'REGISTERED_BELOW_NATIVE_OR_INVALID_RATIO',
  asset:url,bytes:data.length,width,height,sha256:crypto.createHash('sha256').update(data).digest('hex')};
}
for(const id of stages)for(const gender of ['male','female'])
 for(const [phase,outcome,ctx] of [
  ['pre','before',{chapterOpeningSeen:false}],
  ['post','victory',{battleOutcome:{victory:true}}],
  ['post','defeat',{battleOutcome:{victory:false}}],
  ['post','gameover',{battleOutcome:{victory:false,playerCommanderDead:true}}]
 ]){
 const comic=compactComicForStage(id,phase,{...ctx,protagonistGender:gender});
 for(const shot of comic.panels){
  const entry=summary(shot.sharedArtAsset||registeredStoryPanelAsset(shot));
  out.push({stageId:id,gender,phase,outcome,sceneId:shot.id,edition:shot.comicEdition,
   sharedOutcome:Boolean(shot.sharedArtAsset),needsHumanIdentityReview:!shot.sharedArtAsset,
   ...entry});
 }
}
const missing=out.filter(x=>!x.status.startsWith('PLAYABLE_NATIVE'));
const priority=out.filter(x=>x.phase==='pre'||x.outcome==='victory');
const result={schemaVersion:1,scope:'CHAPTER1_STAGES01_TO_04_COMPACT_ART',
 auditOnly:true,noNewPaidAPI:true,legacyArchiveIsNotNewArtQuota:true,
 perStage:stages.map(stage=>({stage,
  required:out.filter(x=>x.stageId===stage).length,
  native:out.filter(x=>x.stageId===stage&&x.status==='PLAYABLE_NATIVE_NOT_FORMAL_P0').length,
  missingOrBelow:missing.filter(x=>x.stageId===stage).length,
  mainPathMissingOrBelow:priority.filter(x=>x.stageId===stage&&!x.status.startsWith('PLAYABLE_NATIVE')).length
 })),total:out.length,missingOrBelow:missing.length,
 allRows:out,backfillQueue:missing,
 rules:{identity:'stageId|edition|gender|sceneId',
  everyOriginalMustBeIndependent:true,minPixels:[800,450],referenceBytesRequired:true,
  noFalseP0Approval:true,neverBorrowOtherGenderOrOutcome:true,
  order:'stage1->stage4 then later stages',batchMaxScenes:5,
  completedOnlyWhenFileAndProvenanceAndVisualQA:true}
};
fs.mkdirSync('qa-reports',{recursive:true});
const file='qa-reports/story-c01-s01-s04-compact-backfill.json';
fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({file,total:result.total,missingOrBelow:result.missingOrBelow,
 stage:result.perStage,queuedKeys:result.backfillQueue.map(x=>[x.stageId,x.edition,x.gender,x.sceneId].join('|'))}));
