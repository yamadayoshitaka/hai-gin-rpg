#!/usr/bin/env node
/**
 * FREE-PLAN-ONLY Cloudflare Workers AI pilot for ONE chapter-1 stage-2 page:
 * five separate REAL generation calls, one canonical shot per call.
 *
 * Plan (0 API requests):
 *   node scripts/generate-story-cloudflare-free-page.mjs --mode plan --page 1
 * Generate (requires user-confirmed Workers Free plan and secrets):
 *   node scripts/generate-story-cloudflare-free-page.mjs --mode generate --page 1
 *
 * Outputs are UNAPPROVED REVIEW CANDIDATES. Do not bind them to the game until
 * the existing separate per-scene formal registration/human-QA gate passes.
 * No paid model fallback, paid subscription switch, parallel calls or retries.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {comicForStage} from '../src/story-chapter-comic.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=process.argv.slice(2);
function option(key, fallback){
 const i=arg.indexOf(key);
 return i===-1?fallback:arg[i+1];
}
const mode=option('--mode','plan');
const page=Number(option('--page','1'));
if(!['plan','generate'].includes(mode)||!Number.isInteger(page)||page<1||page>2||
 arg.length!==arg.filter(a=>['--mode','--page'].includes(a)).length*2)
 throw Error('Usage: --mode plan|generate --page 1|2 (first pilot uses page 1)');
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const stage='c01-s02',edition='post-victory',gender='female';
const spec=read('assets/story/stage-manifests/c01-s02.manifest.json');
const assignments=read('assets/story/stage-manifests/c01-s02-shot-assignments.json');
const bible=read('assets/story/characters/c01-s02-reference-bible.json');
const masters=new Map(bible.actors.map(a=>[a.id,a.path]));
const group=spec.continuation.pendingGroups.find(g=>g.edition===edition&&g.gender===gender);
const sheet=group?.reviewSheets?.find(s=>s.page===page);
if(!sheet||sheet.panels.length>5||sheet.panels.length<1||
 spec.layout.maxPanelsPerPoster!==5||spec.continuation.remainingSceneCount!==25||
 JSON.stringify(spec.layout.minPerPanelNativePixels)!=='[768,320]')
 throw Error('P0 immutable five-maximum stage-2 page contract mismatch');
const comic=comicForStage(stage,'post',{protagonistGender:gender,battleOutcome:{victory:true}});
const shots=sheet.panels.map((id,i)=>{
 const a=assignments.entries[edition+'|'+gender+'|'+id];
 const scene=comic.panels.find(p=>p.id===id);
 if(!a||!scene||a.scriptText!==(scene.subtitleText||scene.text)||
  a.edition!==edition||a.gender!==gender||a.panelId!==id||
  !a.noInImageText||!a.noExtraCharacters||!a.requiresRealReferenceImageBytes||
  a.visibleActorIds.some(actor=>a.mustNotAppearActorIds.includes(actor)))
  throw Error('P0 screenplay/cast/source conflict '+id);
 const refs=a.visibleActorIds.map(actorId=>{
  const rel=masters.get(actorId);
  if(!rel||!fs.existsSync(path.join(root,rel)))
   throw Error('P0 missing physical actor reference image '+actorId);
  const bytes=fs.readFileSync(path.join(root,rel));
  if(bytes.length<30||bytes.toString('ascii',0,4)!=='RIFF'||
   bytes.toString('ascii',8,12)!=='WEBP')
   throw Error('P0 invalid real actor master '+actorId);
  return {actorId,sourcePath:rel,sourceSha256:hash(bytes),sourceBytes:bytes.length};
 });
 if(refs.length>4)throw Error('Cloudflare model supports maximum four physical references');
 const prompt=[
  'P0 CRITICAL: Generate EXACTLY ONE single seamless landscape cinematic fantasy RPG picture.',
  'This request is ONLY ONE scene. Absolutely NO contact sheet, storyboard, collage, multiple frames, borders, split panels, grid or story index.',
  'No visible text of ANY language, letters, numbers, speech bubbles, logos, watermark, UI, labels, headings, captions or typography.',
  'Story state: post-battle victory, female commander alive. Never switch protagonist gender or show her defeated or dead.',
  'Scene outcome / objective: '+a.sceneGoal,
  'Specific physical composition, poses and interactions: '+a.compositionHint,
  'Current scene screenplay beat for character acting ONLY, DO NOT draw these words in pixels: '+a.scriptText,
  'Foreground character identity: '+(a.foregroundActorId||'none')+
   '; supporting character identities: '+a.supportActorIds.join(', '),
  'On-screen characters are EXACTLY: '+a.visibleActorIds.join(', ')+
   '. No other people and no characters from other scenes.',
  'Absent characters: '+a.mustNotAppearActorIds.join(', '),
  ...refs.map((r,i)=>
   'Physical reference image '+i+' depicts '+r.actorId+
   '. Match their established face, silhouette, clothing and colors precisely.'),
  'Beautiful carefully modeled natural eyes, deep dimensional faces, fabric seams, believable hands, dramatic layered lighting, realistic fantasy game-cinematic quality.',
  'ONE independent full-width 16:9 scene, never an image of a dashboard or page list. No in-image words.'
 ].join('\n');
 const idNorm=id.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(Number(n)).padStart(2,'0'));
 return {panelId:id,shotKey:[stage,edition,gender,id].join('|'),
  screenplayText:a.scriptText,speaker:a.speaker,sceneGoal:a.sceneGoal,
  compositionHint:a.compositionHint,visibleActorIds:a.visibleActorIds,
  protagonistState:a.protagonistState,characterReferences:refs,
  prompt,filename:idNorm+'-'+edition+'-'+gender+'.webp'};
});
if(shots.length>5||new Set(shots.map(s=>s.panelId)).size!==shots.length)
 throw Error('P0 five independent per-page shots only');
const outRel='assets/story/chapter-drafts/c01/cloudflare-flux2-klein4b/'+
 stage+'-'+edition+'-'+gender+'/p'+String(page).padStart(2,'0');
const reportDir='qa-reports/story-stage-production/cloudflare-free-pilot';
const pilotFile=reportDir+'/c01-s02-'+gender+'-'+edition+'-page'+page+'.json';
const width=1024,height=576;
const outTiles=Math.ceil(width/512)*Math.ceil(height/512);
const estimate=s=>outTiles*26.05+s.characterReferences.length*5.37;
const estimateTotal=shots.reduce((n,s)=>n+estimate(s),0);
const statuses=shots.map(s=>({
 shotKey:s.shotKey,sceneGoal:s.sceneGoal,visibleActorIds:s.visibleActorIds,
 imageCount:1,referenceCount:s.characterReferences.length,
 referenceSourceSha256:s.characterReferences.map(r=>({actorId:r.actorId,sha256:r.sourceSha256})),
 estimatedNeurons:Number(estimate(s).toFixed(2)),
 rendered:false,qualityApproved:false,formallyRegistered:false
}));
const report={kind:'CF_WORKERS_AI_FLUX2_KLEIN_4B_FIVE_NATIVE_SHOT_PILOT',
 model:'@cf/black-forest-labs/flux-2-klein-4b',
 stageId:stage,edition,gender,page,
 mode,maxScenesPerReviewPage:5,maxScenesPerImageRequest:1,shotCount:shots.length,
 requestedNativePixels:[width,height],minimumNativePixels:[768,320],
 estimatedNeurons:Number(estimateTotal.toFixed(2)),
 safePlanRequired:'WORKERS_FREE_NOT_PAID',
 freePlanDailyNeurons:10000,
 prices:{outputPer512Tile:26.05,inputPer512Tile:5.37},
 outputRoot:outRel,qualityApproved:false,formalArtRegistered:0,
 imagesActuallyGenerated:0,requestsActuallySent:0,tokenRequiredOnlyWhenModeGenerate:true,
 shots:statuses};
function save(){
 fs.mkdirSync(path.join(root,reportDir),{recursive:true});
 fs.writeFileSync(path.join(root,pilotFile),JSON.stringify(report,null,2)+'\n');
}
save();
if(mode==='plan'){
 console.log(JSON.stringify({mode,scenes:shots.length,oneImagePerCall:true,
  actorsPresent:shots.map(s=>({id:s.panelId,actors:s.visibleActorIds})),
  estimates:report.estimatedNeurons,apiRequests:0,rendered:0,report:pilotFile}));
 process.exit(0);
}
const account=process.env.CLOUDFLARE_ACCOUNT_ID||'';
const token=process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN||'';
const free=process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED==='true';
const limit=Number(process.env.CLOUDFLARE_MAX_NEURONS||'1000');
if(!free||!/^[a-f0-9]{32}$/i.test(account)||token.length<20||
 !Number.isFinite(limit)||limit>1000||limit<estimateTotal)
 throw Error('P0 FREE_PLAN_ONLY: Cloudflare Account ID, Workers AI API token and explicit confirmed FREE plan required; per-page cap must cover estimate but never exceed 1000 Neurons. No requests sent.');
const refDir=path.join(root,reportDir,'preprocessed-reference-inputs');
function python(subCommand,input,output){
 const x=spawnSync('python3',['scripts/story-cloudflare-image-io.py',subCommand,input,output],
  {cwd:root,encoding:'utf8'});
 if(x.status!==0)throw Error('Image preflight failed: '+x.stderr.slice(0,800));
 return JSON.parse(x.stdout.trim());
}
const api='https://api.cloudflare.com/client/v4/accounts/'+account+
 '/ai/run/@cf/black-forest-labs/flux-2-klein-4b';
let reserved=0;
for(let i=0;i<shots.length;i++){
 const shot=shots[i],row=report.shots[i];
 if(reserved+estimate(shot)>limit)throw Error('P0 FREE_LIMIT_PREVENTED_CALL');
 const source=path.join(root,outRel,shot.filename);
 const proof=source+'.generation.json';
 if(fs.existsSync(source)&&fs.existsSync(proof)){
  const savedProof=JSON.parse(fs.readFileSync(proof,'utf8'));
  const present=hash(fs.readFileSync(source));
  if(savedProof.imageSha256!==present||savedProof.shotKey!==shot.shotKey)
   throw Error('P0 existing generated WebP proof does not match source; refuse overwrite');
  row.skippedAlreadyGenerated=true;row.rendered=true;row.imageSha256=present;
  row.outputPath=path.relative(root,source);report.imagesActuallyGenerated++;
  save();
  continue;
 }
 fs.mkdirSync(path.dirname(source),{recursive:true});
 fs.mkdirSync(refDir,{recursive:true});
 const form=new FormData();
 form.append('prompt',shot.prompt);
 form.append('width',String(width));
 form.append('height',String(height));
 const referenceEvidence=[];
 for(let r=0;r<shot.characterReferences.length;r++){
  const master=shot.characterReferences[r];
  const reduced=path.join(refDir,master.actorId+'.png');
  const result=python('reference',path.join(root,master.sourcePath),reduced);
  if(result.outputPixels.some(v=>v>=512))
   throw Error('P0 reference input does not satisfy Cloudflare 512px bound');
  const bytes=fs.readFileSync(reduced);
  form.append('input_image_'+r,new Blob([bytes],{type:'image/png'}),master.actorId+'.png');
  referenceEvidence.push({
   actorId:master.actorId,originalPath:master.sourcePath,
   originalSha256:master.sourceSha256,submittedInputSha256:hash(bytes),
   thumbnailPixels:result.outputPixels,attachedAs:'input_image_'+r
  });
 }
 const seed=crypto.createHash('sha256').update(shot.shotKey).digest().readUInt32BE(0)>>>1;
 form.append('seed',String(seed));
 reserved+=estimate(shot); // Reserve before any request; never retry 429/403.
 row.costReservedNeurons=Number(estimate(shot).toFixed(2));
 row.referencePayloadsSubmitted=referenceEvidence;
 row.referenceImageBytesActuallyAttachedToRequest=true;
 report.requestsActuallySent++;
 save();
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),100000);
 let response;
 try{
  response=await fetch(api,{
   method:'POST',
   headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   body:form,signal:controller.signal
  });
 }finally{clearTimeout(timeout);}
 if(!response.ok){
  const reason=response.status===429?'FREE_QUOTA_OR_CAPACITY_EXCEEDED':
   response.status===403?'ACCESS_DENIED_OR_PAID_ONLY':'API_RESPONSE_NON_2XX';
  row.error=reason;row.httpStatus=response.status;save();
  throw Error('P0 stopped without retries or paid fallback: '+reason+' (HTTP '+response.status+')');
 }
 const body=await response.json();
 const data=body?.result?.image;
 if(body?.success===false||typeof data!=='string'||data.length<2000||
  (Array.isArray(body?.result?.images)&&body.result.images.length!==1)){
  row.error='NOT_ONE_VALID_BASE64_IMAGE';save();
  throw Error('P0 model response does not contain precisely one genuine image');
 }
 const bytes=Buffer.from(data.replace(/^data:image\/\w+;base64,/,'').replace(/\s/g,''),'base64');
 if(bytes.length<5000)throw Error('P0 empty/invalid image response');
 const temp=path.join(root,reportDir,'raw-'+shot.panelId+'.bin');
 fs.writeFileSync(temp,bytes);
 const converted=python('result',temp,source);
 fs.rmSync(temp,{force:true});
 if(converted.outputPixels[0]<768||converted.outputPixels[1]<320||
  converted.inputPixels[0]!==converted.outputPixels[0]||
  converted.inputPixels[1]!==converted.outputPixels[1])
  throw Error('P0 native image invalid or upscaled');
 const webp=fs.readFileSync(source);
 const generated={
  kind:'ACTUAL_CLOUDFLARE_GENERATED_FRAME_REVIEW_REQUIRED',
  shotKey:shot.shotKey,stageId:stage,edition,gender,panelId:shot.panelId,
  nativePixels:converted.outputPixels,outputPath:path.relative(root,source),
  imageSha256:hash(webp),outputBytes:webp.length,
  sourceModel:report.model,generationSeed:seed,renderPromptSha256:hash(Buffer.from(shot.prompt)),
  sceneGoal:shot.sceneGoal,screenplayText:shot.screenplayText,speaker:shot.speaker,
  compositionHint:shot.compositionHint,visibleActorIds:shot.visibleActorIds,
  referencePayloadsSubmitted:referenceEvidence,
  physicalReferencesActuallyAttached:true,
  identityMatchHumanApproved:false,screenplayMatchHumanApproved:false,
  noTextDigitsUiHumanApproved:false,visuallyApproved:false,
  approvedForFormalGameRegistration:false
 };
 fs.writeFileSync(proof,JSON.stringify(generated,null,2)+'\n');
 row.rendered=true;row.outputPath=generated.outputPath;
 row.imageSha256=generated.imageSha256;row.nativePixels=generated.nativePixels;
 report.imagesActuallyGenerated++;
 save();
 console.log(JSON.stringify({shot:shot.panelId,
  rendered:true,nativePixels:converted.outputPixels,
  refsAttached:referenceEvidence.length,formallyRegistered:false}));
}
console.log(JSON.stringify({status:'PILOT_REAL_ART_CANDIDATES_DONE_QA_PENDING',
 frames:shots.length,requestsSent:report.requestsActuallySent,
 readyForManualVisualReview:report.imagesActuallyGenerated,
 gameRegistrations:0,summary:pilotFile}));
