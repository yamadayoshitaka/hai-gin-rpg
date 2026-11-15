#!/usr/bin/env node
/**
 * One-shot AI Horde Free/anonymous img2img comparison.
 * Only c01-s04 | pre | male | m5; NEVER automatically approved or game-bound.
 * Source: existing Cloudflare REAL review draft on story/chapter1-free-actual-art.
 *
 * The Cloudflare draft is the SINGLE image sent to AI Horde. Separate actor
 * masters are locally SHA-verified but NOT uploaded as multiple references:
 * this experiment therefore cannot pass the game's P0 identity gate on its own.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {comicForStage} from '../src/story-chapter-comic.js';
import {buildStage45ArtPrompt} from '../src/story-c01-stage45-art-guard.js';

const root=path.resolve(import.meta.dirname,'..');
const target=Object.freeze({
 stageId:'c01-s04',edition:'pre',gender:'male',shotId:'c01-s04-m5',
 key:'c01-s04|pre|male|c01-s04-m5',
 source:'assets/story/chapter-drafts/c01/cloudflare-chapter1-free/c01-s04-pre-male/p01/c01-s04-m05-pre-male.webp',
 output:'assets/story/chapter-drafts/c01/ai-horde-pilot/c01-s04-pre-male/p01/c01-s04-m05-pre-male.webp'
});
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const readJSON=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const imagePixels=bytes=>{
 if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')
  throw Error('NOT_WEBP');
 const kind=bytes.toString('ascii',12,16);
 if(kind==='VP8 ')return [bytes.readUInt16LE(26)&0x3fff,bytes.readUInt16LE(28)&0x3fff];
 if(kind==='VP8L'){const n=bytes.readUInt32LE(21);return [(n&0x3fff)+1,((n>>>14)&0x3fff)+1];}
 if(kind==='VP8X')return [bytes.readUIntLE(24,3)+1,bytes.readUIntLE(27,3)+1];
 throw Error('INVALID_WEBP_CHUNK');
};

export function buildPilotPlan(){
 const policy=readJSON('data/story-generation-spend-policy.json');
 if(policy.allowedAdditionalPaidApiSpendJpy!==0||
    policy.chatGPTImageGeneration?.automaticPaidApiFallback!==false)
   throw Error('BUDGET_NOT_ZERO');
 const manifest=readJSON('assets/story/stage-manifests/c01-s04.manifest.json');
 const bible=readJSON('assets/story/characters/c01-s04-reference-bible.json');
 const shot=comicForStage('c01-s04','pre',{protagonistGender:'male'})
  .panels.find(p=>p.id===target.shotId);
 if(!shot||!manifest.stageName||bible.stageId!=='c01-s04')
  throw Error('CANONICAL_SHOT_MISSING');
 const text=shot.subtitleText||shot.text;
 if(text!=='この勅命に記された王印は、本物ではありません。')
  throw Error('CANONICAL_SCREENPLAY_CHANGED');
 const actors=['lucia','vess'];
 const actualRefs=actors.map(id=>{
  const actor=bible.actors.find(a=>a.id===id);
  const refPath=actor?.path||(id==='vess'?'assets/story-cinema/cast/vess.webp':null);
  if(!refPath)throw Error('MISSING_CAST_MASTER '+id);
  const bytes=fs.readFileSync(path.join(root,refPath));
  imagePixels(bytes);
  return {id,path:refPath,sha:hash(bytes),rule:actor?.visualRule||id};
 });
 const stylePath='assets/story/chapters/c01/panels/c01-s01-m02-male.webp';
 const styleBytes=fs.readFileSync(path.join(root,stylePath));
 imagePixels(styleBytes);
 const styleRef={path:stylePath,sha:hash(styleBytes),gender:'male'};
 const guard=buildStage45ArtPrompt({
  stageId:target.stageId,stageName:manifest.stageName,
  edition:target.edition,gender:target.gender,shot,actorRefs:actualRefs,
  stageStory:bible.scene,styleRef
 });
 const prompt=guard+
  '\nOnly in the render: two distinct characters, Lucia (silver-haired regent) and Vess (as referenced). '+
  'The royal seal in the edict is revealed to be fake. Do not draw letters or a legible seal inscription.';
 return {target,actors,actualRefs,styleRef,prompt,promptSha256:hash(Buffer.from(prompt)),
  screenplayText:text,sourceProcessing:'img2img',
  sourceFrom:'Cloudflare unapproved review candidate',
  nativePixels:[1024,576],referenceLimit:'ONE_IMAGE_ONLY_NOT_FULL_P0',
  costCeilingJpy:0,requestsMax:1,automaticApproval:false};
}

export function makePayload(plan,sourceBytes,model=''){
 if(!Buffer.isBuffer(sourceBytes)||imagePixels(sourceBytes).join('x')!=='1024x576')
  throw Error('BAD_SOURCE_GEOMETRY');
 const negative='text, letters, writing, watermark, speech bubble, manga page, collage, split image, '+
   'UI, menu, cartoon, illustration, duplicate person, extra person, flat shading';
 return {
  prompt:plan.prompt+'\n### '+negative,
  params:{width:1024,height:576,steps:25,cfg_scale:7,
   sampler_name:'k_euler',denoising_strength:0.65,n:1},
  source_image:sourceBytes.toString('base64'),source_processing:'img2img',
  nsfw:false,censor_nsfw:true,shared:false,slow_workers:false,
  dry_run:false,r2:true,...(model?{models:[model]}:{})
 };
}

async function jsonResponse(url,options={}){
 const res=await fetch(url,{...options,signal:AbortSignal.timeout(30000)});
 const txt=await res.text();
 let obj;try{obj=JSON.parse(txt);}catch{throw Error('HORDE_NON_JSON_'+res.status);}
 if(!res.ok)throw Error('HORDE_HTTP_'+res.status+':'+JSON.stringify(obj).slice(0,500));
 return obj;
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function retrieveResult(id,headers){
 const base='https://aihorde.net/api/v2/generate';
 const started=Date.now();
 for(let poll=0;poll<45;poll++){
  if(Date.now()-started>7*60*1000)break;
  await sleep(9000);
  const status=await jsonResponse(base+'/check/'+encodeURIComponent(id),{headers});
  if(status.done===true||status.finished>=1){
   const full=await jsonResponse(base+'/status/'+encodeURIComponent(id),{headers});
   if(full.generations?.length)return full;
   if(status.faulted)throw Error('HORDE_FAULTED');
  }
  if(status.faulted||status.is_possible===false)throw Error('HORDE_NO_WORKER_OR_FAULT');
 }
 throw Error('HORDE_TIMED_OUT_WITHOUT_IMAGE');
}
async function imageData(record){
 const img=record?.img;
 if(typeof img!=='string'||!img)throw Error('NO_GENERATED_IMAGE');
 if(img.startsWith('https://')){
  const url=new URL(img);
  if(url.username||url.password||url.port||/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname))
   throw Error('UNSAFE_IMAGE_URL');
  const res=await fetch(url,{signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw Error('IMAGE_DOWNLOAD_HTTP_'+res.status);
  const buf=Buffer.from(await res.arrayBuffer());
  if(buf.length>16000000)throw Error('IMAGE_TOO_LARGE');
  return buf;
 }
 const raw=img.replace(/^data:image\/[a-z0-9.+-]+;base64,/i,'');
 if(!/^[A-Za-z0-9+/\r\n=]+$/.test(raw)||raw.length>22000000)
  throw Error('UNSUPPORTED_IMAGE_ENCODING');
 return Buffer.from(raw,'base64');
}
async function generate(){
 const plan=buildPilotPlan();
 const source=path.join(root,'.pilot-input/cloudflare.webp');
 const proofPath=path.join(root,'.pilot-input/cloudflare.generation.json');
 const src=fs.readFileSync(source),proof=JSON.parse(fs.readFileSync(proofPath,'utf8'));
 if(proof.shotKey!==target.key||proof.imageSha256!==hash(src)||
   JSON.stringify(proof.nativePixels)!=='[1024,576]'||
   proof.visuallyApproved!==false||
   JSON.stringify(proof.visibleActorIds)!=='["lucia","vess"]')
  throw Error('SOURCE_PROOF_MISMATCH');
 for(const ref of plan.actualRefs){
  const original=proof.actualReferenceImagesAttached?.find(x=>x.actorId===ref.id);
  if(!original||original.originalSha256!==ref.sha)
   throw Error('ACTOR_PROVENANCE_MISMATCH_'+ref.id);
 }
 const out=path.join(root,target.output);
 if(fs.existsSync(out)||fs.existsSync(out+'.generation.json'))
  throw Error('NEVER_OVERWRITE_GENERATED_REVIEW');
 const key=process.env.AI_HORDE_API_KEY||'0000000000';
 const model=(process.env.AI_HORDE_MODEL||'').trim();
 const payload=makePayload(plan,src,model);
 const headers={'apikey':key,'Client-Agent':'hai-gin-rpg:0.1:github.com/yamadayoshitaka/hai-gin-rpg',
  'Content-Type':'application/json'};
 let requestId='';
 try{
  const start=await jsonResponse('https://aihorde.net/api/v2/generate/async',
   {method:'POST',headers,body:JSON.stringify(payload)});
  requestId=start.id;
  if(typeof requestId!=='string'||!requestId)throw Error('HORDE_NO_REQUEST_ID');
  console.log('AI_HORDE_REQUEST_ID='+requestId);
  const result=await retrieveResult(requestId,headers);
  const generation=result.generations?.[0];
  if(!generation||generation.censored)throw Error('IMAGE_MISSING_OR_CENSORED');
  const raw=await imageData(generation);
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const input=path.join(root,'.pilot-input/horde-result.bin');
  fs.writeFileSync(input,raw);
  const conversion=spawnSync('python3',['scripts/story-cloudflare-image-io.py','result',input,out],
   {cwd:root,encoding:'utf8'});
  if(conversion.status!==0)throw Error('IMAGE_DECODE_FAILED_'+conversion.stderr.slice(0,300));
  const actual=fs.readFileSync(out),[width,height]=imagePixels(actual);
  if(width<800||height<450||width*9!==height*16)throw Error('NATIVE_RATIO_OR_SIZE_REJECTED');
  fs.writeFileSync(out+'.generation.json',JSON.stringify({
   kind:'AI_HORDE_REVIEW_CANDIDATE_NEVER_AUTO_APPROVED',
   shotKey:target.key,screenplayText:plan.screenplayText,
   provider:'AI Horde anonymous/community workers',model:generation.model||model||'unreported',
   workerId:generation.worker_id||null,requestId,seed:generation.seed||null,
   sourceImageSha256:hash(src),sourceProvider:'Cloudflare Free',
   actualReferenceImagesLocallyVerified:plan.actualRefs,
   actualSeparateActorReferenceImagesSubmitted:false,
   uploadedSourceImageCount:1,sourceProcessing:'img2img',
   denoisingStrength:0.65,promptSha256:plan.promptSha256,
   imageSha256:hash(actual),nativePixels:[width,height],imageBytes:actual.length,
   visuallyApproved:false,formallyRegistered:false,gameDeployed:false,
   costCeilingJpy:0,licenseReviewRequired:true,
   limitation:'P0 character master bytes cannot all be attached in this img2img call; manual QA mandatory'
  },null,2)+'\n');
  console.log(JSON.stringify({rendered:1,registered:0,approved:0,
   path:target.output,model:generation.model||null,imageSha256:hash(actual),nativePixels:[width,height]}));
 }finally{
  if(requestId){
   try{await fetch('https://aihorde.net/api/v2/generate/status/'+encodeURIComponent(requestId),
    {method:'DELETE',headers,signal:AbortSignal.timeout(8000)});}catch{}
  }
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 const mode=process.argv[2]==='--mode'?process.argv[3]:'plan';
 if(!['plan','generate'].includes(mode))throw Error('Usage: --mode plan|generate');
 if(mode==='plan'){
  const p=buildPilotPlan();
  console.log(JSON.stringify({shotKey:p.target.key,actors:p.actors,
   originalImageSource:p.target.source,aiHordeCostJpy:0,maxCalls:p.requestsMax,
   approved:false,registered:false,referenceLimit:p.referenceLimit}));
 }else await generate();
}
