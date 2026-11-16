#!/usr/bin/env node
/* Real artwork ONLY. Chapter 1, 132 five-shot pages / 462 canonical scenes.
 * One original native WebP per shot; no auto-approvals, registration or deployment.
 * Safe to resume. 7500 estimated Neurons MAX per invocation; no paid fallback.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {comicEditionsForStage,comicForStage} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
import {buildStage45ArtPrompt,STAGE45_IDS} from '../src/story-c01-stage45-art-guard.js';
import {classifyCloudflareFailure,canOfferChatGPTHandoff,makeChatGPTHandoff} from '../src/story-generation-fallback.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const p=rel=>path.join(root,rel),read=rel=>JSON.parse(fs.readFileSync(p(rel),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2),mode=args[args.indexOf('--mode')+1]||'plan';
const maxPages=Number(args.includes('--max-pages')?args[args.indexOf('--max-pages')+1]:'12');
const startStage=args.includes('--start-stage')?args[args.indexOf('--start-stage')+1]:'c01-s01';
const throughStage=args.includes('--through-stage')?args[args.indexOf('--through-stage')+1]:'c01-s10';
const isStageId=id=>/^c01-s(?:0[1-9]|10)$/.test(id);
const budget=read('data/story-generation-spend-policy.json');
if(budget.policyId!=='HAI_GIN_CHATGPT_SUBSCRIPTION_ONLY_NO_PAID_API_V1'||
   budget.allowedAdditionalPaidApiSpendJpy!==0||
   budget.cloudflare?.paidTierOrTopUpsAllowed!==false||
   budget.chatGPTImageGeneration?.automaticPaidApiFallback!==false)
 throw Error('BUDGET_POLICY_FAIL_CLOSED: Additional paid APIs are forbidden');
const limit=Number(process.env.CLOUDFLARE_CHAPTER1_DAILY_ESTIMATE_CAP||'7500');
if(limit>budget.cloudflare.cloudflareDailyEstimatedNeuronCap)
 throw Error('BUDGET_POLICY_FAIL_CLOSED: Neuron cap exceeded');
const branch='story/chapter1-free-actual-art';
function webpPixels(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')throw Error('not WebP');
 const t=b.toString('ascii',12,16);
 if(t==='VP8 ')return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
 if(t==='VP8L'){const n=b.readUInt32LE(21);return [(n&0x3fff)+1,((n>>>14)&0x3fff)+1];}
 if(t==='VP8X')return [b.readUIntLE(24,3)+1,b.readUIntLE(27,3)+1];
 throw Error('unsupported WebP');
}
function legacyBelowNative(url,stageId){
 if(!url||!url.startsWith('./'))return false;
 const rel=url.slice(2).split(/[?#]/)[0];
 if(!fs.existsSync(p(rel)))return true;
 try{
  const [w,h]=webpPixels(fs.readFileSync(p(rel)));
  const [mw,mh]=stageId==='c01-s02'?[768,320]:(stageId>='c01-s04'?[800,450]:[1536,864]);
  return w<mw||h<mh||w*9!==h*16;
 }catch{return true;}
}
if(!['plan','generate'].includes(mode)||!Number.isInteger(maxPages)||maxPages<1||maxPages>15||
 !Number.isFinite(limit)||limit<=0||limit>7500||!isStageId(startStage)||!isStageId(throughStage)||startStage>throughStage)
 throw Error('Invalid run arguments, one-stage range or Free daily cap');
const abs=read('assets/story/quality/artwork-p0-rules.json');
if(abs.priority!=='P0_ABSOLUTE_MUST_FOLLOW'||!abs.failClosed)throw Error('P0 contract missing');
const stages=CAMPAIGN_STAGES.filter(s=>s.chapter===1);
if(stages.length!==10)throw Error('Chapter 1 stage count drift');
const assign=read('assets/story/stage-manifests/c01-s02-shot-assignments.json').entries;
// Real production follows the 20-chapter compact game CG identity, not the
// full archived 462-panel storyboard. Legacy images are retained for rollback.
const compactManifest=read('data/story-compact-20chapters.json');
if(compactManifest.kind!=='STORY_COMPACT_20_CHAPTERS_V1'||
   compactManifest.stageCount!==200||compactManifest.expectedNormalImageSlots!==880)
 throw Error('Compact production source mismatch; refuse to call Free provider');
const chapterOne=compactManifest.chapters.find(ch=>ch.chapter===1);
if(!chapterOne||chapterOne.stages.length!==10)throw Error('Expected ten compact Chapter 1 stages');
const compactStages=new Map(chapterOne.stages.map(stage=>{
 if(stage.beforeIds.length!==2||stage.afterIds.length!==2||
    !Array.isArray(stage.chapterOpeningIds)||stage.chapterOpeningIds.length>(stage.slot===1?4:0))
  throw Error('Invalid compact scene quotas '+stage.stageId);
 return [stage.stageId,{pre:new Set([...stage.chapterOpeningIds,...stage.beforeIds]),
  post:new Set(stage.afterIds)}];
}));
const masters=new Map(),pages=[],keys=new Set();
for(const stage of stages){
 const man=read('assets/story/stage-manifests/'+stage.id+'.manifest.json');
 const bible=read('assets/story/characters/'+(stage.id==='c01-s01'?'c01-s02':stage.id)+'-reference-bible.json');
 if(man.stageId!==stage.id||(bible.stageId!==stage.id&&!(stage.id==='c01-s01'&&bible.stageId==='c01-s02')))throw Error('Stage contract drift '+stage.id);
 masters.set(stage.id,new Map(bible.actors.map(a=>[a.id,a])));
 for(const ed of comicEditionsForStage(stage.id))for(const gender of ['male','female']){
  const ctx={protagonistGender:gender};
  if(ed.edition==='post-victory')ctx.battleOutcome={victory:true};
  else if(ed.edition==='post-defeat')ctx.battleOutcome={victory:false};
  else if(ed.edition==='post-gameover')ctx.battleOutcome={victory:false,playerCommanderDead:true};
  else if(!['pre','post-town'].includes(ed.edition))throw Error('Unknown branch '+ed.edition);
  const scenes=comicForStage(stage.id,ed.phase,ctx);
  if(scenes.edition!==ed.edition)throw Error('Edition drift');
  for(let i=0;i<scenes.panels.length;i+=5){
   const group=scenes.panels.slice(i,i+5).map(shot=>{
    const key=[stage.id,ed.edition,gender,shot.id].join('|');
    if(keys.has(key))throw Error('Duplicate '+key); keys.add(key);
    const id=shot.id.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(Number(n)).padStart(2,'0'));
    const dir='assets/story/chapter-drafts/c01/cloudflare-chapter1-free/'+stage.id+'-'+ed.edition+'-'+gender+'/p'+String(Math.floor(i/5)+1).padStart(2,'0')+'/';
    const img=dir+id+'-'+ed.edition+'-'+gender+'.webp';
    const live=registeredStoryPanelAsset(shot);
    return {key,shot,stage,gender,edition:ed.edition,img,proof:img+'.generation.json',registered:!!live,
     legacySource:live,legacyBelowNative:legacyBelowNative(live,stage.id)};
   });
   pages.push({num:pages.length+1,stage:stage.id,edition:ed.edition,gender,page:Math.floor(i/5)+1,shots:group});
  }
 }
}
if(pages.length!==132||keys.size!==462)throw Error('Expected EXACTLY 132 pages and 462 canonical shots');
function compactRequired(s){
 const stage=compactStages.get(s.stage.id);
 if(!stage)throw Error('Missing compact stage mapping '+s.stage.id);
 if(s.edition==='pre')return stage.pre.has(s.shot.id);
 if(s.edition==='post-victory'||s.edition==='post-town')return stage.post.has(s.shot.id);
 // Shared defeat/gameover scenes, never unnecessary gendered legacy variants.
 return false;
}
const compactQueue=pages.flatMap(pg=>pg.shots).filter(compactRequired);
// Minimum-first policy counts each scene once, not automatically twice for
// the player's gender. Distinct assets are still mandatory unless human
// visual QA proves the candidate contains no protagonist.
const minimumCGIdentities=new Map();
for(const s of compactQueue){
 const key=[s.stage.id,s.edition,s.shot.id].join('|');
 if(!minimumCGIdentities.has(key))minimumCGIdentities.set(key,[]);
 minimumCGIdentities.get(key).push(s);
}
if(minimumCGIdentities.size!==44||compactQueue.length!==88||
 [...minimumCGIdentities.values()].some(variants=>variants.length!==2||
  !variants.some(v=>v.gender==='male')||!variants.some(v=>v.gender==='female')))
 throw Error('Chapter 1 minimum-first contract: 44 scenes x 2 protected gender variants');
if(!compactQueue.some(s=>s.stage.id==='c01-s04'))
 throw Error('Compact queue missing canonical scenes');
function status(s){
 // A separately owner-accepted, native and physically present live image supersedes
 // an old Cloudflare safety-block marker for the SAME scene. Never re-call a
 // provider-blocked generation unless that alternative registration is removed.
 if(s.registered&&!s.legacyBelowNative)return 'REGISTERED_NOT_P0_CERTIFIED';
 if(fs.existsSync(p(s.img+'.provider-blocked.json')))return 'BLOCKED_PROVIDER_SAFETY';
 const image=fs.existsSync(p(s.img)),proof=fs.existsSync(p(s.proof));
 if(!image&&!proof)return s.legacyBelowNative?'LEGACY_NATIVE_DEFECT_NEEDS_REGEN':
   s.registered?'REGISTERED_NOT_P0_CERTIFIED':'MISSING';
 if(!image||!proof)return 'BLOCKED_UNPAIRED';
 try{
  const raw=fs.readFileSync(p(s.img)),meta=read(s.proof);
  if(raw.toString('ascii',0,4)!=='RIFF'||raw.toString('ascii',8,12)!=='WEBP'||
   meta.imageSha256!==hash(raw)||meta.shotKey!==s.key||meta.visuallyApproved!==false)
   return 'BLOCKED_BAD_PROVENANCE';
  const minimum=s.stage.id==='c01-s02'?[768,320]:(s.stage.id>='c01-s04'?[800,450]:[1536,864]);
  return Array.isArray(meta.nativePixels)&&meta.nativePixels[0]>=minimum[0]&&
   meta.nativePixels[1]>=minimum[1]?'REAL_DRAFT_UNAPPROVED':'LOW_NATIVE_RESOLUTION_REGENERATE';
 }catch{return 'BLOCKED_BAD_PROVENANCE';}
}
function progress(){
 const all=pages.flatMap(pg=>pg.shots);
 return {chapter:1,pages:132,totalScenes:462,
  existingRegisteredUnapproved:all.filter(s=>s.registered).length,
  legacyNativeDefects:all.filter(s=>status(s)==='LEGACY_NATIVE_DEFECT_NEEDS_REGEN').length,
  generatedDraftUnapproved:all.filter(s=>status(s)==='REAL_DRAFT_UNAPPROVED').length,
  missing:all.filter(s=>['MISSING','LOW_NATIVE_RESOLUTION_REGENERATE','LEGACY_NATIVE_DEFECT_NEEDS_REGEN'].includes(status(s))).length,
  blocked:all.filter(s=>status(s).startsWith('BLOCKED')).map(s=>s.key),
  gameRegistrationsByThisTool:0,approvedByThisTool:0,
  compactTargets:compactQueue.length,
  minimumPrimaryCGSlots:minimumCGIdentities.size,
  minimumPrimaryMissing:([...minimumCGIdentities.values()]).filter(variants=>
    variants.every(s=>!['REGISTERED_NOT_P0_CERTIFIED','REAL_DRAFT_UNAPPROVED'].includes(status(s)))).length,
  genderVariants:compactQueue.length,
  provenGenderNeutralArtShares:0,
  compactSatisfiedUnapproved:compactQueue.filter(s=>
    ['REGISTERED_NOT_P0_CERTIFIED','REAL_DRAFT_UNAPPROVED'].includes(status(s))).length,
  compactStillMissing:compactQueue.filter(s=>![
    'REGISTERED_NOT_P0_CERTIFIED','REAL_DRAFT_UNAPPROVED'].includes(status(s))).length,
  pageStates:pages.map(pg=>({pageTask:pg.num,stage:pg.stage,edition:pg.edition,gender:pg.gender,
    shotKeys:pg.shots.map(s=>s.key),states:pg.shots.map(status),
    compactRequiredKeys:pg.shots.filter(compactRequired).map(s=>s.key)}))};
}
const out='qa-reports/story-stage-production/chapter1-free-render/';
fs.mkdirSync(p(out),{recursive:true});
let handoff=null;
function queueChatGPTHandoff(reason,s,attemptedRequests=0){
 if(!s||!canOfferChatGPTHandoff(reason))return null;
 const queue=makeChatGPTHandoff({reason,attemptedRequests,shot:{
  stageId:s.stage.id,edition:s.edition,gender:s.gender,shotId:s.shot.id}});
 handoff=queue;
 // This report is not a ChatGPT API call or proof of rendered art.
 fs.writeFileSync(p(out+'chatgpt-handoff.json'),JSON.stringify(queue,null,2)+'\n');
 console.log(JSON.stringify({chatGPTManualHandoff:queue.chatGPTReviewUrl,
  shotKey:queue.shotKey,reason,requiresUserAction:true,actualChatGPTImagesGenerated:0}));
 return queue;
}
function save(meta){fs.writeFileSync(p(out+'last-run.json'),JSON.stringify({...progress(),...meta},null,2)+'\n');}
if(mode==='plan'){
 const result=progress();save({mode:'plan',apiRequests:0,imagesRendered:0});
 console.log(JSON.stringify({pages:132,scenes:462,registered:result.existingRegisteredUnapproved,
  drafts:result.generatedDraftUnapproved,missing:result.missing,blocked:result.blocked.length,
  startStage,throughStage,
  minimumPrimaryCGSlots:result.minimumPrimaryCGSlots,
  minimumPrimaryMissing:result.minimumPrimaryMissing,
  genderVariants:result.genderVariants,
  compactTargets:result.compactTargets,compactMissing:result.compactStillMissing,
  nextTask:result.pageStates.find(pg=>pg.stage>=startStage&&pg.stage<=throughStage&&pg.shotKeys.some(
   (key,i)=>pg.compactRequiredKeys.includes(key)&&
    !['REGISTERED_NOT_P0_CERTIFIED','REAL_DRAFT_UNAPPROVED'].includes(pg.states[i])))?.pageTask,
  apiRequests:0}));
 process.exit(0);
}
const acct=process.env.CLOUDFLARE_ACCOUNT_ID||'',token=process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN||'';
if(process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED!=='true'||!/^[a-f0-9]{32}$/i.test(acct)||token.length<20){
 const first=pages.filter(pg=>pg.stage>=startStage&&pg.stage<=throughStage)
  .flatMap(pg=>pg.shots).find(s=>compactRequired(s)&&
   ['MISSING','LEGACY_NATIVE_DEFECT_NEEDS_REGEN'].includes(status(s)));
 queueChatGPTHandoff('CLOUDFLARE_NOT_CONFIGURED',first,0);
 throw Error('FREE_ONLY: Missing GitHub Actions Free configuration; no API calls. ChatGPT manual queue emitted if an unregistered shot exists');
}
const api='https://api.cloudflare.com/client/v4/accounts/'+acct+'/ai/run/@cf/black-forest-labs/flux-2-klein-4b';
const exec=(program,items)=>{
 const v=spawnSync(program,items,{cwd:root,encoding:'utf8'});
 if(v.status!==0)throw Error(program+' '+items[0]+' failed '+v.stderr.slice(0,800));
 return v.stdout.trim();
};
function python(cmd,input,output){return JSON.parse(exec('python3',['scripts/story-cloudflare-image-io.py',cmd,input,output]));}
function renderSpec(s){
 const fixed=assign[s.edition+'|'+s.gender+'|'+s.shot.id];
 if(fixed&&fixed.scriptText!==(s.shot.subtitleText||s.shot.text))throw Error('Stage2 canonical screenplay drift');
 let actors=fixed?fixed.visibleActorIds:
  [s.shot.characterId,s.shot.secondaryId].filter(Boolean);
 // Stage 4/5 must use ONLY the screenplay's actual named cast, not auto-add a hero.
 if(!fixed&&!STAGE45_IDS.includes(s.stage.id)&&!s.edition.includes('gameover')&&!actors.includes('commander_'+s.gender))
  actors.push('commander_'+s.gender);
 actors=[...new Set(actors)];
 if(actors.includes('commander_'+(s.gender==='male'?'female':'male'))||actors.length>4)
  throw Error('P0 wrong-gender or >4 cast '+s.key);
 const refs=actors.map(id=>{
  const bible=masters.get(s.stage.id).get(id);
  const rel=bible?.path||(id==='commander_female'?'assets/story/characters/commander/female-master.webp':
   id==='commander_male'?'assets/story/panels/c01-s01-m01.webp':
   id==='lucia'?'assets/story/characters/lucia/master.webp':'assets/story-cinema/cast/'+id+'.webp');
  if(!fs.existsSync(p(rel)))throw Error('P0 missing real master '+rel);
  const raw=fs.readFileSync(p(rel));
  if(raw.toString('ascii',0,4)!=='RIFF'||raw.toString('ascii',8,12)!=='WEBP')throw Error('Bad master '+rel);
  return {id,rel,sha:hash(raw),rule:bible?.visualRule||id};
 });
 const stage45=STAGE45_IDS.includes(s.stage.id);
 const styleSource='assets/story/chapters/c01/panels/c01-s01-m02-'+s.gender+'.webp';
 let styleRef=null;
 if(stage45){
  if(refs.length>=4)throw Error('P0 stage4/5 style reference exceeds image slots '+s.key);
  if(!fs.existsSync(p(styleSource)))throw Error('P0 missing native stage1 style image '+styleSource);
  const image=fs.readFileSync(p(styleSource));
  if(image.toString('ascii',0,4)!=='RIFF'||image.toString('ascii',8,12)!=='WEBP')
   throw Error('P0 invalid style source '+styleSource);
  styleRef={id:'style_benchmark',rel:styleSource,sha:hash(image),
   rule:'style and lighting quality ONLY, not an additional visible character',
   gender:s.gender,path:styleSource};
 }
 const branchRule=s.edition==='pre'?'BEFORE battle, NO known outcome':
 s.edition==='post-victory'?'AFTER confirmed victory; commander ALIVE':
 s.edition==='post-defeat'?'AFTER confirmed defeat; NO victory':
 s.edition==='post-gameover'?'GAMEOVER: commander DEAD, NO victory or living commander':
 'TOWN conclusion, NO fabricated battle';
 const prompt=[
  'P0 MANDATORY: Render ONE AND ONLY ONE original 16:9 cinematic fantasy RPG image. Never a collage, grid, page or panel list.',
  'P0 NO TEXT: No letters, numerals, kanji, hiragana, katakana, speech bubbles, subtitles, writings, map labels, written scrolls, readable documents, logos, interface, signs, captions, marks or watermarks. ALL PAPER completely blank. No writing anywhere in the pixels.',
  'Physically realistic mature detailed game-cinematic scene: individually shaped faces, nuanced eyes, deep lighting, believable armor and fabric, clean human anatomy. NOT 2D infographics, UI, storyboards.',
  'STAGE for scene only (do not write): '+s.stage.name,
  'OUTCOME for scene only: '+branchRule,
  'Scene action: '+(fixed?.sceneGoal||s.shot.kind||'character story event'),
  'CINEMATIC COMPOSITION: '+(fixed?.compositionHint||'One action beat at '+(s.shot.scenery||'the stage location')+' with correct cast expressing this exact narration'),
  'CANONICAL screenplay, NEVER visible as text: '+(s.shot.subtitleText||s.shot.text),
  'ON-SCREEN ACTORS EXACTLY: '+actors.join(', ')+'. No extra characters or clones.',
  ...refs.map((r,i)=>'Reference input '+i+' is actor '+r.id+', enforce reference face/age/silhouette/attire: '+r.rule),
  'If documents or maps occur, show entirely BLANK undecorated papers. Do NOT repeat appearance of female commander as Lucia, or Iris as an armored knight.'
 ].join('\n');
 const stageArtManifest=stage45?read('assets/story/stage-manifests/'+s.stage.id+'.manifest.json'):null;
 const shotDirection=stageArtManifest?.perShotCameraDirections?.[s.shot.id];
 const shotWithDirection=shotDirection?{...s.shot,visualDirection:shotDirection}:s.shot;
 const guardedPrompt=stage45?buildStage45ArtPrompt({
  stageId:s.stage.id,stageName:s.stage.name||s.stage.id,edition:s.edition,gender:s.gender,shot:shotWithDirection,
  actorRefs:refs.map(r=>({id:r.id,path:r.rel,sha:r.sha,rule:r.rule})),
  stageStory:read('assets/story/characters/'+s.stage.id+'-reference-bible.json').scene,
  styleRef
 }):prompt;
 const submittedRefs=styleRef?[...refs,styleRef]:refs;
 const width=s.stage.id==='c01-s02'||s.stage.id>='c01-s04'?1024:1536;
 const height=s.stage.id==='c01-s02'||s.stage.id>='c01-s04'?576:864;
 return {actors,refs:submittedRefs,prompt:guardedPrompt,width,height,
  estimate:Math.ceil(width/512)*Math.ceil(height/512)*26.05+submittedRefs.length*5.37};
}
let reserved=0,requests=0,created=0,committed=0,blocked=[];
let freeLimitReached=false;
const summary=reason=>{
 const o={mode:'generate',stopReason:reason,runRequestedPages:maxPages,
  estimatedNeuronsReserved:Number(reserved.toFixed(2)),apiRequests:requests,
  newRealDraftImages:created,newDraftPageCommits:committed,blockedPages:blocked,
  chatGPTManualHandoff:handoff?.chatGPTReviewUrl||null,
  chatGPTHandoffShotKey:handoff?.shotKey||null,
  freeOnly:true,noPaidFallback:true,noAutoApproval:true};
 save(o);return o;
};
summary('STARTED');
let activeStage=null,stageGateStopped=false;
for(const pg of pages){
 if(pg.stage<startStage||pg.stage>throughStage)continue;
 if(!pg.shots.some(compactRequired))continue;
 // Stage-order gating applies only to CG identities that the game displays.
 if(activeStage!==null&&activeStage!==pg.stage){
  const incomplete=pages.filter(page=>page.stage===activeStage).flatMap(page=>page.shots)
   .filter(shot=>compactRequired(shot)&&
    !['REGISTERED_NOT_P0_CERTIFIED','REAL_DRAFT_UNAPPROVED'].includes(status(shot)));
  if(incomplete.length){
   stageGateStopped=true;
   console.log(JSON.stringify({stageGate:'STOP_BEFORE_NEXT_STAGE',stage:activeStage,
    remainingKeys:incomplete.map(shot=>shot.key),nextStage:pg.stage}));
   summary('STAGE_INCOMPLETE_DO_NOT_ADVANCE');break;
  }
 }
 activeStage=pg.stage;
 if(committed>=maxPages){summary('PAGE_CAP');break;}
 const pending=pg.shots.filter(s=>compactRequired(s)&&
  ['MISSING','LOW_NATIVE_RESOLUTION_REGENERATE','LEGACY_NATIVE_DEFECT_NEEDS_REGEN'].includes(status(s)));
 if(!pending.length)continue;
 const blockers=pg.shots.filter(s=>compactRequired(s)&&status(s).startsWith('BLOCKED'));
 if(blockers.length)blocked.push(...blockers.map(s=>({page:pg.num,shotKey:s.key,reason:status(s)})));
 // A provider-blocked shot needs its own reviewed revision, but must not
 // prevent completing the OTHER distinct scenes on this review page.
 if(blockers.some(s=>status(s)!=='BLOCKED_PROVIDER_SAFETY'))continue;
 let todo;
 try{todo=pending.map(s=>({s,info:renderSpec(s)}));}
 catch(e){blocked.push({page:pg.num,reason:String(e.message)});continue;}
 const cost=todo.reduce((total,t)=>total+t.info.estimate,0);
 if(cost+reserved>limit){
  queueChatGPTHandoff('FREE_ESTIMATE_CAP',todo[0]?.s,requests);
  summary('DAILY_FREE_ESTIMATE_CAP_CHATGPT_MANUAL_HANDOFF');break;
 }
 const files=[];
 let activeShot=null;
 try{
  for(const {s,info} of todo){
   activeShot=s;
   if(status(s)==='LOW_NATIVE_RESOLUTION_REGENERATE'){
    // Rejected below-spec candidates remain recoverable in Git history.
    fs.rmSync(p(s.img),{force:true});fs.rmSync(p(s.proof),{force:true});
   }
   if(fs.existsSync(p(s.img))||fs.existsSync(p(s.proof)))throw Error('Unexpected concurrent source');
   fs.mkdirSync(path.dirname(p(s.img)),{recursive:true});
   const form=new FormData();
   form.append('prompt',info.prompt);form.append('width',String(info.width));form.append('height',String(info.height));
   const sent=[];
   for(let i=0;i<info.refs.length;i++){
    const r=info.refs[i],small=p(out+'reference-'+s.stage.id+'-'+r.id+'.png');
    const processed=python('reference',p(r.rel),small);
    if(processed.outputPixels.some(n=>n>=512))throw Error('Reference exceeds native input bound');
    const bytes=fs.readFileSync(small);
    form.append('input_image_'+i,new Blob([bytes],{type:'image/png'}),r.id+'.png');
    sent.push({actorId:r.id,source:r.rel,originalSha256:r.sha,submittedSha256:hash(bytes),
      actualBytes:bytes.length,pixels:processed.outputPixels});
   }
   const seed=crypto.createHash('sha256').update(s.key).digest().readUInt32BE(0)>>>1;
   form.append('seed',String(seed));
   reserved+=info.estimate;requests++;summary('GENERATING');
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),100000);
   let response;
   try{response=await fetch(api,{method:'POST',
    headers:{Authorization:'Bearer '+token,Accept:'application/json'},body:form,
    signal:controller.signal});}finally{clearTimeout(timer);}
   if(!response.ok){
    // The API can return HTTP 400 for free-quota enforcement as well as malformed inputs.
    // Log only provider error code / a sanitized short message, never account ID or token.
    const detail=await response.json().catch(()=>null);
    const reason=(Array.isArray(detail?.errors)?detail.errors:[]).map(e=>
     String(e.code||'')+':'+String(e.message||'')).join('; ').slice(0,300);
    const safe=reason.replaceAll(token,'[TOKEN_REDACTED]').replaceAll(acct,'[ACCOUNT_REDACTED]');
    throw Error('FREE_API_STOP_NO_RETRY_HTTP_'+response.status+' '+safe);
   }
   const body=await response.json(),encoded=body?.result?.image;
   if(body?.success===false||typeof encoded!=='string'||encoded.length<2000||
    (Array.isArray(body.result?.images)&&body.result.images.length!==1))
    throw Error('Not one real generated image');
   const bytes=Buffer.from(encoded.replace(/^data:image\/\w+;base64,/,'').replace(/\s/g,''),'base64');
   if(bytes.length<5000)throw Error('Empty image from API');
   const temp=p(out+'raw-'+hash(Buffer.from(s.key)).slice(0,16)+'.bin');
   fs.writeFileSync(temp,bytes);
   let conv;
   try{conv=python('result',temp,p(s.img));}finally{fs.rmSync(temp,{force:true});}
   files.push(s.img);
   if(conv.inputPixels[0]!==conv.outputPixels[0]||conv.inputPixels[1]!==conv.outputPixels[1]||
    conv.outputPixels[0]<(s.stage.id==='c01-s02'?768:s.stage.id>='c01-s04'?800:1536)||
    conv.outputPixels[1]<(s.stage.id==='c01-s02'?320:s.stage.id>='c01-s04'?450:864))throw Error('Non-native image dimensions');
   const image=fs.readFileSync(p(s.img));
   fs.writeFileSync(p(s.proof),JSON.stringify({
    kind:'CLOUDFLARE_REAL_WEBP_REVIEW_CANDIDATE_NOT_APPROVED',
    shotKey:s.key,stageId:s.stage.id,edition:s.edition,gender:s.gender,panelId:s.shot.id,
    screenplayText:s.shot.subtitleText||s.shot.text,visibleActorIds:info.actors,
    actualReferenceImagesAttached:sent,imageSha256:hash(image),nativePixels:conv.outputPixels,
    imageBytes:image.length,model:'@cf/black-forest-labs/flux-2-klein-4b',
    seed,promptSha256:hash(Buffer.from(info.prompt)),estimatedNeurons:Number(info.estimate.toFixed(2)),
    visuallyApproved:false,formallyRegistered:false,gameDeployed:false},null,2)+'\n');
   files.push(s.proof);created++;summary('GENERATION_IN_PROGRESS');
   console.log(JSON.stringify({key:s.key,result:'NATIVE_REAL_IMAGE_UNAPPROVED',pixels:conv.outputPixels}));
  }
  if(todo.some(({s})=>status(s)!=='REAL_DRAFT_UNAPPROVED'))throw Error('Page proof gate failed');
  exec('git',['add','--',...files]);
  exec('git',['commit','-m','art(review): '+pg.stage+' '+pg.edition+' '+pg.gender+' page '+pg.page+' '+todo.length+' real unapproved frames']);
  exec('git',['push','origin','HEAD:'+branch]);
  committed++;summary('PAGE_COMMITTED');
  console.log(JSON.stringify({pageTask:pg.num,result:pg.shots.some(s=>status(s)==='BLOCKED_PROVIDER_SAFETY')?
   'PARTIAL_PAGE_DRAFTS_COMMITTED_PROVIDER_REVIEW_NEEDED':'FIVE_OR_FEWER_REAL_DRAFTS_COMMITTED_NO_FORMAL_REGISTRATION',shots:todo.length}));
 }catch(e){
  const error=String(e.message||e);
  if(activeShot&&error.includes('FREE_API_STOP_NO_RETRY_HTTP_400 3030:')){
   // Respect provider moderation. Never retry a flagged prompt/input automatically.
   const blocker=activeShot.img+'.provider-blocked.json';
   fs.mkdirSync(path.dirname(p(blocker)),{recursive:true});
   fs.writeFileSync(p(blocker),JSON.stringify({kind:'PROVIDER_GENERATION_SAFETY_BLOCK',
    shotKey:activeShot.key,provider:'Cloudflare Workers AI',errorCode:3030,
    requiresHumanSceneRevision:true,automaticRetry:false,actualImageGenerated:false,
    formallyRegistered:false,gameDeployed:false},null,2)+'\n');
   // Safely preserve all earlier real images of this page as review-only.
   // Do not claim the page is complete: the blocked frame still has NO art.
   const validPartial=files.filter(rel=>fs.existsSync(p(rel)));
   exec('git',['add','--',blocker,...validPartial]);
   exec('git',['commit','-m','qa(story): preserve partial unapproved art and provider safety block for '+activeShot.key]);
   exec('git',['push','origin','HEAD:'+branch]);
   blocked.push({page:pg.num,shotKey:activeShot.key,reason:'CLOUDFLARE_SAFETY_3030'});
   summary('PROVIDER_SAFETY_BLOCK_RECORDED_AND_NEXT_PAGE');
   continue;
  }
  // A quota / network / decoder stop must not discard earlier independently
  // verified actual WebPs from this page. Commit only complete image+proof pairs.
  const complete=pg.shots.filter(s=>status(s)==='REAL_DRAFT_UNAPPROVED'&&
   files.includes(s.img)&&files.includes(s.proof));
  if(complete.length){
   exec('git',['add','--',...complete.flatMap(s=>[s.img,s.proof])]);
   exec('git',['commit','-m','art(review): preserve '+complete.length+' native unapproved frames before provider stop']);
   exec('git',['push','origin','HEAD:'+branch]);
   committed++;
  }
  const http=error.match(/FREE_API_STOP_NO_RETRY_HTTP_(\d{3})/);
  const codes=[...error.matchAll(/\b(\d{4}):/g)].map(m=>({code:m[1]}));
  const stopReason=classifyCloudflareFailure({status:http?Number(http[1]):null,errors:codes});
  if(canOfferChatGPTHandoff(stopReason)){
   // The provider may use HTTP 400 or 429 for free-quota enforcement.
   // No automatic ChatGPT image call is attempted: the Plus tool is interactive.
   freeLimitReached=true;
   queueChatGPTHandoff(stopReason,activeShot,requests);
   summary('FREE_QUOTA_EXHAUSTED_CHATGPT_MANUAL_HANDOFF');
   console.log('FREE_ONLY_STOP: existing verified image+proof pairs saved; no paid calls');
   break;
  }
  summary('STOPPED_NO_RETRIES_'+error);
  console.error('P0 FREE ONLY STOP: '+error);process.exitCode=2;break;
 }
}
const state=summary(process.exitCode?'ERROR':handoff?'CLOUDFLARE_STOP_CHATGPT_MANUAL_HANDOFF':freeLimitReached?'FREE_QUOTA_EXHAUSTED':stageGateStopped?'STAGE_INCOMPLETE_DO_NOT_ADVANCE':committed===maxPages?'PAGE_CAP_OR_DAILY_CAP':'BATCH_LIMIT_OR_ALL_DONE');
console.log(JSON.stringify({status:'REAL_DRAFTS_ONLY',...state,imagesMissing:progress().missing,reviewRequired:true}));
