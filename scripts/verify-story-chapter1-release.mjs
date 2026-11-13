#!/usr/bin/env node
/**
 * Chapter1 last immutable release gate. 462/462 actual GAME-BINDABLE assets
 * AND 462/462 human P0 visual approvals must be present before publication.
 * Passing the "draft generated" regression NEVER counts as live completion.
 *
 * node scripts/verify-story-chapter1-release.mjs --plan
 * node scripts/verify-story-chapter1-release.mjs --require-all
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {comicEditionsForStage,comicForStage} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {chapterReviewedPanelAsset} from '../src/story-chapter-reviewed-art.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const abs=p=>path.join(root,p),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const strict=process.argv.includes('--require-all');
if(process.argv.slice(2).some(s=>!['--plan','--require-all'].includes(s)))
 throw Error('Usage: [--plan] [--require-all]');
const totals={required:462,p0HumanApproved:0,legacyApproved:0,chapterNewApproved:0,
 legacyPending:0,missingLiveRegistration:0,invalidHumanProof:0};
const gaps=[],keys=new Set();
function context(edition,gender){
 const c={protagonistGender:gender};
 if(edition==='post-victory')c.battleOutcome={victory:true};
 else if(edition==='post-defeat')c.battleOutcome={victory:false};
 else if(edition==='post-gameover')c.battleOutcome={victory:false,playerCommanderDead:true};
 else if(!['pre','post-town'].includes(edition))throw Error('Unexpected edition '+edition);
 return c;
}
function verifyReview(cert,key,art,shot){
 if(!cert||cert.shotKey!==key||cert.sha256!==sha(fs.readFileSync(abs(art)))||
  cert.scriptText!==(shot.subtitleText||shot.text))return false;
 const fields=['exactScreenplayHumanApproved','identityGenderHumanApproved',
  'correctOutcomeHumanApproved','noTextDigitsUiHumanApproved','sourceNotUpscaled',
  'renderedAsOneIndependentScene'];
 if(fields.some(x=>cert[x]!==true))return false;
 if(typeof cert.humanReviewer!=='string'||cert.humanReviewer.trim().length<3||
  /^(AI|BOT|AUTOMATIC|AGENT|LLM|GITHUB_ACTIONS)$/i.test(cert.humanReviewer.trim()))
  return false;
 if(typeof cert.reviewEvidence!=='string'||cert.reviewEvidence.trim().length<8)return false;
 return true;
}
for(const stage of CAMPAIGN_STAGES.filter(s=>s.chapter===1))for(const edition of comicEditionsForStage(stage.id))
for(const gender of ['male','female']){
 const comic=comicForStage(stage.id,edition.phase,context(edition.edition,gender));
 for(const shot of comic.panels){
  const key=[stage.id,edition.edition,gender,shot.id].join('|');
  if(keys.has(key))throw Error('Duplicate canonical '+key);
  keys.add(key);
  const source=registeredStoryPanelAsset(shot),approvedSource=chapterReviewedPanelAsset(shot);
  if(!source||!source.startsWith('./')){
   totals.missingLiveRegistration++;gaps.push({key,reason:'NO_FORMAL_BINDING'});
   continue;
  }
  const rel=source.slice(2).split(/[?#]/)[0];
  if(!fs.existsSync(abs(rel))){
   totals.missingLiveRegistration++;gaps.push({key,reason:'REGISTERED_IMAGE_MISSING'});
   continue;
  }
  const name=shot.id.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(Number(n)).padStart(2,'0'))+
   '-'+edition.edition+'-'+gender;
  const review=approvedSource?
   'assets/story/chapters/c01/art-reviews/'+name+'.review.json':
   'assets/story/chapters/c01/art-reviews/legacy/'+name+'.review.json';
  if(!fs.existsSync(abs(review))){
   if(approvedSource)totals.invalidHumanProof++;else totals.legacyPending++;
   gaps.push({key,reason:approvedSource?'REGISTERED_NEW_ART_MISSING_PROOF':'LEGACY_VISUAL_P0_APPROVAL_PENDING'});
   continue;
  }
  let valid=false;
  try{valid=verifyReview(JSON.parse(fs.readFileSync(abs(review),'utf8')),key,rel,shot);}
  catch{valid=false;}
  if(!valid){
   totals.invalidHumanProof++;gaps.push({key,reason:'HUMAN_VISUAL_PROOF_MISMATCH'});
   continue;
  }
  if(approvedSource)totals.chapterNewApproved++;
  else totals.legacyApproved++;
  totals.p0HumanApproved++;
 }
}
if(keys.size!==462)throw Error('Not 462 canonical unique scenes');
const ready=totals.p0HumanApproved===462&&totals.missingLiveRegistration===0&&
 totals.invalidHumanProof===0&&totals.legacyPending===0;
const report={kind:'C01_FINAL_462_SHOT_LIVE_RELEASE_GATE',
 releaseReady:ready,
 expectedStages:10,expectedPages:132,totals,
 humanQARequired:true,automatedApproval:false,
 allGenderAndOutcomeVariantsCovered:keys.size===462,
 requiresPassingGameCI:true,
 draftReviewOnlyIsNotProduction:true,
 gaps,
 recommendedNextAction:ready?'All P0 signed art ready; run CI, merge reviewed branch into main then Pages deploys':
 'Resolve every missing/invalid image and signed human approval before main merge'};
const dest='qa-reports/story-stage-production/chapter1-free-render/c01-final-live-release-gate.json';
fs.mkdirSync(path.dirname(abs(dest)),{recursive:true});
fs.writeFileSync(abs(dest),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ready,totals,firstGaps:gaps.slice(0,5),report:dest}));
if(strict&&!ready)process.exitCode=2;
