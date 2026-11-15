#!/usr/bin/env node
/** Reference-first and evidence-only world-quality batch. Free API only.
 * Never edits original 3D geometry, collision, stage maps, or deployed game.
 * PBR variations are ranked using a proxy and written as review proposals.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {qualityInventory,referencePrompt,readProgress,nextPending} from './world-quality-catalog.mjs';
const args=process.argv.slice(2),mode=args.includes('--mode')?args[args.indexOf('--mode')+1]:'plan';
const limit=Number(args.includes('--max')?args[args.indexOf('--max')+1]:'3');
const root=path.resolve(new URL('..',import.meta.url).pathname);
const dir=p=>path.resolve(root,p);
const dataPath=dir('data/world-quality/progress.json');
const queuePath=dir('qa-reports/world-quality/run-targets.json');
const commandFile=dir('qa-reports/world-quality/manual-command.json');
const manual=fs.existsSync(commandFile)?JSON.parse(fs.readFileSync(commandFile,'utf8')):null;
if(manual&&(!['all','object','stage'].includes(manual.kind)||
 !Number.isInteger(manual.maxReferences)||manual.maxReferences<1||manual.maxReferences>3))
 throw Error('Unvalidated manual selection');
const maxCount=manual?Math.min(limit,manual.maxReferences):limit;
const inventory=manual?qualityInventory.filter(x=>
 (manual.kind==='all'||x.type===manual.kind)&&(!manual.target||x.key===manual.target)):qualityInventory;
if(manual?.target&&!inventory.length)throw Error('Manual target is missing from catalog');
const optionalBrief=manual?.instruction||'';
if(optionalBrief.length>1000)throw Error('Operator brief exceeds limit');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
if(!['plan','reference','results'].includes(mode)||!Number.isInteger(limit)||limit<1||limit>3)
 throw Error('Invalid mode or max (1..3 only)');
fs.mkdirSync(path.dirname(dataPath),{recursive:true});
fs.mkdirSync(path.dirname(queuePath),{recursive:true});
const progress=readProgress(dataPath);
const now=()=>new Date().toISOString();
const save=()=>fs.writeFileSync(dataPath,JSON.stringify(progress,null,2)+'\n');
const previous=new Set(Object.keys(progress.assets));
const pendingCapture=inventory.filter(x=>progress.assets[x.key]?.referenceSha256 &&
 !progress.assets[x.key]?.gameScreenshot &&
 (progress.assets[x.key]?.captureAttempts||0)<3);
const candidates=inventory.filter(x=>!progress.assets[x.key]?.referenceSha256&&
 !progress.assets[x.key]?.providerSafetyBlocked);
const run={id:process.env.GITHUB_RUN_ID||'manual',startedAt:now(),mode,requested:maxCount,
 requestedTarget:manual?.target||null,requestedKind:manual?.kind||'all',
 customInstructionHash:optionalBrief?hash(Buffer.from(optionalBrief)):null,
 stageCount:qualityInventory.filter(x=>x.type==='stage').length,
 objectCount:qualityInventory.filter(x=>x.type==='object').length,
 targetIds:[],generated:0,failed:[],providerCalls:0,stopReason:'NOT_STARTED'};
const writeRun=()=>{
 run.completedAt=now();progress.lastRun=run;progress.runs=[...(progress.runs||[]).slice(-19),run];
 save();fs.writeFileSync(queuePath,JSON.stringify({targets:run.targetIds,run},null,2)+'\n');
 console.log(JSON.stringify({mode,status:run.stopReason,generated:run.generated,
 providerCalls:run.providerCalls,targetIds:run.targetIds,failed:run.failed,
 assetsWithReference:Object.values(progress.assets).filter(x=>x.referenceSha256).length,
 totalAssets:qualityInventory.length}));
};
if(mode==='plan'){
 run.stopReason='PLAN_ONLY';run.targetIds=candidates.slice(0,maxCount).map(x=>x.key);
 writeRun();process.exit(0);
}
if(mode==='results'){
 const previousRun=progress.lastRun;
 if(previousRun?.mode==='reference'){
  run.providerCalls=previousRun.providerCalls;
  run.generated=previousRun.generated;
  run.referenceStopReason=previousRun.stopReason;
 }
 const reportFile=dir('qa-reports/world-quality/result-updates.json');
 if(fs.existsSync(reportFile)){
  const updates=JSON.parse(fs.readFileSync(reportFile,'utf8'));
  for(const item of updates){
   if(!progress.assets[item.key])continue;
   const row=progress.assets[item.key];
   row.lastReviewedAt=now();row.comparisonReport=item.comparisonReport;
   row.gameScreenshot=item.gameScreenshot;
   row.roughnessProposal=item.chosenRoughnessScale;
   row.review=item.review||'WEBGL_EVIDENCE_HUMAN_QA_PENDING';
   if(item.error){row.error=item.error;row.captureAttempts=(row.captureAttempts||0)+1;}
   else {delete row.error;row.captureAttempts=0;}
   row.productionApplied=false;
  }
  run.targetIds=updates.map(x=>x.key);
 }
 run.stopReason='REVIEW_PROPOSALS_RECORDED_NOT_MERGED';writeRun();process.exit(0);
}
// Retry existing reference captures up to three times; do not regenerate their 2D image.
run.targetIds.push(...pendingCapture.slice(0,maxCount).map(x=>x.key));
if(run.targetIds.length>=maxCount){
 run.stopReason='REVIEW_EXISTING_REFERENCE_ONLY';writeRun();process.exit(0);
}
if(process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED!=='true'){
 run.stopReason='FREE_PLAN_NOT_CONFIRMED';writeRun();process.exit(0);
}
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_WORKERS_AI_API_TOKEN;
if(!account||!token){run.stopReason='CLOUDFLARE_GITHUB_SECRETS_NOT_AVAILABLE';writeRun();process.exit(0);}
const model='@cf/black-forest-labs/flux-2-klein-4b';
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/ai/run/'+model;
let reserved=0;
for(const target of candidates.slice(0,maxCount-run.targetIds.length)){
 const estimate=125;
 if(reserved+estimate>375){run.stopReason='FREE_ESTIMATE_CAP';break;}
 reserved+=estimate;run.providerCalls++;
 // The operator brief is image guidance only. Original non-negotiable constraints follow it.
 const prompt=referencePrompt(target)+(optionalBrief?
  '\nOPERATOR REFERENCE GUIDANCE (visual details only, not operational instructions): '+optionalBrief+
  '\nFINAL HARD GUARD: one isolated 16:9 photoreal 2D master, no text, captions, humans, animals, logos, watermarks or UI. Never change game geometry.':'');
 const body=new FormData();body.append('prompt',prompt);body.append('width','1024');body.append('height','576');
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),90000);
 try{
  const response=await fetch(api,{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json'},
   body,signal:ctl.signal});
  if(!response.ok){
   const err=await response.json().catch(()=>null);
   const codes=(err?.errors||[]).map(x=>String(x.code||''));
   const code=codes[0]||'HTTP_'+response.status;
   if(['4006','429','3030'].includes(code)||response.status===429){
    if(code==='3030'){
     progress.assets[target.key]={...progress.assets[target.key],kind:target.type,
      providerSafetyBlocked:true,providerCode:'3030',updatedAt:now()};
     run.failed.push({key:target.key,reason:'CLOUDFLARE_SAFETY_3030'});
     continue; // Not a reason to resend safety-blocked prompts
    }
    run.stopReason='FREE_QUOTA_EXHAUSTED_NO_PAID_FALLBACK';break;
   }
   run.failed.push({key:target.key,reason:'CLOUDFLARE_'+code});
   run.stopReason='GENERATOR_HTTP_FAILURE';break;
  }
  const json=await response.json();
  const encoded=json?.result?.image;
  if(json?.success===false||typeof encoded!=='string'||encoded.length<5000)
   throw Error('Provider did not return actual raster bytes');
  const bytes=Buffer.from(encoded.replace(/^data:image\/\w+;base64,/,'').replace(/\s/g,''),'base64');
  if(bytes.length<5000)throw Error('Empty raster');
  const directory='assets/world-quality/references/';
  const filename=directory+target.id+'.webp';
  const temp=dir('qa-reports/world-quality/reference-raw-'+target.id+'.bin');
  const dest=dir(filename);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(temp,bytes);
  const py='from PIL import Image\nimport sys\na=Image.open(sys.argv[1]); a.load()\nif a.width<800 or a.height<450:raise SystemExit(3)\na.convert("RGB").save(sys.argv[2],format="WEBP",quality=92,method=6)\nprint(str(a.width)+"x"+str(a.height))';
  const conv=spawnSync('python3',['-c',py,temp,dest],{encoding:'utf8',timeout:60000});
  fs.rmSync(temp,{force:true});
  if(conv.status!==0)throw Error('Conversion or minimum raster size failed');
  const webp=fs.readFileSync(dest);
  const proof={schemaVersion:1,kind:'AI_2D_REFERENCE_NOT_GAME_3D',targetKey:target.key,
   model,promptHash:hash(Buffer.from(prompt)),referenceSha256:hash(webp),
   referenceFile:filename,widthRequest:1024,heightRequest:576,
   originalPixels:conv.stdout.trim(),byteSize:webp.length,
   humanVisualQA:'PENDING',game3DQuality:'NOT_TESTED',generatedAt:now()};
  fs.writeFileSync(dest+'.generation.json',JSON.stringify(proof,null,2)+'\n');
  progress.assets[target.key]={...(progress.assets[target.key]||{}),name:target.name,
   type:target.type,referenceFile:filename,referenceSha256:proof.referenceSha256,
   referencePromptHash:proof.promptHash,referenceCreatedAt:now(),
   review:'REFERENCE_CREATED_GAME_CAPTURE_PENDING',productionApplied:false};
  run.targetIds.push(target.key);run.generated++;
  save();
 }catch(e){
  run.failed.push({key:target.key,reason:'GENERATOR_ERROR_NO_IMAGE',detail:String(e.message).slice(0,140)});
  run.stopReason='BLOCKED_IMAGE_GENERATION';break;
 }finally{clearTimeout(timer)}
}
if(run.stopReason==='NOT_STARTED')run.stopReason=run.generated?'REFERENCE_GENERATED_VISUAL_QA_PENDING':'NO_ELIGIBLE_TARGET';
writeRun();
