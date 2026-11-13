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

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const p=rel=>path.join(root,rel),read=rel=>JSON.parse(fs.readFileSync(p(rel),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2),mode=args[args.indexOf('--mode')+1]||'plan';
const maxPages=Number(args.includes('--max-pages')?args[args.indexOf('--max-pages')+1]:'12');
const limit=Number(process.env.CLOUDFLARE_CHAPTER1_DAILY_ESTIMATE_CAP||'7500');
const branch='story/chapter1-free-actual-art';
if(!['plan','generate'].includes(mode)||!Number.isInteger(maxPages)||maxPages<1||maxPages>15||
 !Number.isFinite(limit)||limit<=0||limit>7500)throw Error('Invalid run arguments or Free daily cap');
const abs=read('assets/story/quality/artwork-p0-rules.json');
if(abs.priority!=='P0_ABSOLUTE_MUST_FOLLOW'||!abs.failClosed)throw Error('P0 contract missing');
const stages=CAMPAIGN_STAGES.filter(s=>s.chapter===1);
if(stages.length!==10)throw Error('Chapter 1 stage count drift');
const assign=read('assets/story/stage-manifests/c01-s02-shot-assignments.json').entries;
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
    return {key,shot,stage,gender,edition:ed.edition,img,proof:img+'.generation.json',registered:!!registeredStoryPanelAsset(shot)};
   });
   pages.push({num:pages.length+1,stage:stage.id,edition:ed.edition,gender,page:Math.floor(i/5)+1,shots:group});
  }
 }
}
if(pages.length!==132||keys.size!==462)throw Error('Expected EXACTLY 132 pages and 462 canonical shots');
function status(s){
 if(s.registered)return 'REGISTERED_NOT_P0_CERTIFIED';
 const image=fs.existsSync(p(s.img)),proof=fs.existsSync(p(s.proof));
 if(!image&&!proof)return 'MISSING';
 if(!image||!proof)return 'BLOCKED_UNPAIRED';
 try{
  const raw=fs.readFileSync(p(s.img)),meta=read(s.proof);
  if(raw.toString('ascii',0,4)!=='RIFF'||raw.toString('ascii',8,12)!=='WEBP'||
   meta.imageSha256!==hash(raw)||meta.shotKey!==s.key||meta.visuallyApproved!==false)
   return 'BLOCKED_BAD_PROVENANCE';
  const minimum=s.stage.id==='c01-s02'?[768,320]:[1536,864];
  return Array.isArray(meta.nativePixels)&&meta.nativePixels[0]>=minimum[0]&&
   meta.nativePixels[1]>=minimum[1]?'REAL_DRAFT_UNAPPROVED':'LOW_NATIVE_RESOLUTION_REGENERATE';
 }catch{return 'BLOCKED_BAD_PROVENANCE';}
}
function progress(){
 const all=pages.flatMap(pg=>pg.shots);
 return {chapter:1,pages:132,totalScenes:462,
  existingRegisteredUnapproved:all.filter(s=>status(s)==='REGISTERED_NOT_P0_CERTIFIED').length,
  generatedDraftUnapproved:all.filter(s=>status(s)==='REAL_DRAFT_UNAPPROVED').length,
  missing:all.filter(s=>['MISSING','LOW_NATIVE_RESOLUTION_REGENERATE'].includes(status(s))).length,
  blocked:all.filter(s=>status(s).startsWith('BLOCKED')).map(s=>s.key),
  gameRegistrationsByThisTool:0,approvedByThisTool:0,
  pageStates:pages.map(pg=>({pageTask:pg.num,stage:pg.stage,edition:pg.edition,gender:pg.gender,
    shotKeys:pg.shots.map(s=>s.key),states:pg.shots.map(status)}))};
}
const out='qa-reports/story-stage-production/chapter1-free-render/';
fs.mkdirSync(p(out),{recursive:true});
function save(meta){fs.writeFileSync(p(out+'last-run.json'),JSON.stringify({...progress(),...meta},null,2)+'\n');}
if(mode==='plan'){
 const result=progress();save({mode:'plan',apiRequests:0,imagesRendered:0});
 console.log(JSON.stringify({pages:132,scenes:462,registered:result.existingRegisteredUnapproved,
  drafts:result.generatedDraftUnapproved,missing:result.missing,blocked:result.blocked.length,
  nextTask:result.pageStates.find(pg=>pg.states.includes('MISSING'))?.pageTask,apiRequests:0}));
 process.exit(0);
}
const acct=process.env.CLOUDFLARE_ACCOUNT_ID||'',token=process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN||'';
if(process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED!=='true'||!/^[a-f0-9]{32}$/i.test(acct)||token.length<20)
 throw Error('FREE_ONLY: Variable and two secrets required; no API call attempted');
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
 if(!fixed&&!s.edition.includes('gameover')&&!actors.includes('commander_'+s.gender))
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
 const width=s.stage.id==='c01-s02'?1024:1536;
 const height=s.stage.id==='c01-s02'?576:864;
 return {actors,refs,prompt,width,height,
  estimate:Math.ceil(width/512)*Math.ceil(height/512)*26.05+refs.length*5.37};
}
let reserved=0,requests=0,created=0,committed=0,blocked=[];
const summary=reason=>{
 const o={mode:'generate',stopReason:reason,runRequestedPages:maxPages,
  estimatedNeuronsReserved:Number(reserved.toFixed(2)),apiRequests:requests,
  newRealDraftImages:created,newDraftPageCommits:committed,blockedPages:blocked,
  freeOnly:true,noPaidFallback:true,noAutoApproval:true};
 save(o);return o;
};
summary('STARTED');
for(const pg of pages){
 if(committed>=maxPages){summary('PAGE_CAP');break;}
 const pending=pg.shots.filter(s=>['MISSING','LOW_NATIVE_RESOLUTION_REGENERATE'].includes(status(s)));
 if(!pending.length)continue;
 if(pg.shots.some(s=>status(s).startsWith('BLOCKED'))){
  blocked.push({page:pg.num,reason:'Unpaired or invalid existing source'});continue;
 }
 let todo;
 try{todo=pending.map(s=>({s,info:renderSpec(s)}));}
 catch(e){blocked.push({page:pg.num,reason:String(e.message)});continue;}
 const cost=todo.reduce((total,t)=>total+t.info.estimate,0);
 if(cost+reserved>limit){summary('DAILY_FREE_ESTIMATE_CAP');break;}
 const files=[];
 try{
  for(const {s,info} of todo){
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
   if(!response.ok)throw Error('FREE_API_STOP_NO_RETRY_HTTP_'+response.status);
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
    conv.outputPixels[0]<(s.stage.id==='c01-s02'?768:1536)||
    conv.outputPixels[1]<(s.stage.id==='c01-s02'?320:864))throw Error('Non-native image dimensions');
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
  console.log(JSON.stringify({pageTask:pg.num,result:'FIVE_OR_FEWER_REAL_DRAFTS_COMMITTED_NO_FORMAL_REGISTRATION',shots:todo.length}));
 }catch(e){
  const error=String(e.message||e);summary('STOPPED_NO_RETRIES_'+error);
  console.error('P0 FREE ONLY STOP: '+error);process.exitCode=2;break;
 }
}
const state=summary(process.exitCode?'ERROR':committed===maxPages?'PAGE_CAP_OR_DAILY_CAP':'BATCH_LIMIT_OR_ALL_DONE');
console.log(JSON.stringify({status:'REAL_DRAFTS_ONLY',...state,imagesMissing:progress().missing,reviewRequired:true}));
