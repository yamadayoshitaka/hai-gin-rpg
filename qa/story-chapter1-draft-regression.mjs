#!/usr/bin/env node
/**
 * Independent regression of first chapter's REAL canonical art files.
 *
 * This checks byte identity, native WebP geometry, the actual gender/outcome
 * shot key, one-image provenance and physical character master hashes. It
 * CANNOT determine whether faces match, readable words appear in pixels, or
 * expressions/composition are acceptable. Those remain explicit human P0 QA.
 *
 * node qa/story-chapter1-draft-regression.mjs [--strict] [--require-all]
 *
 * --strict: fail on corrupted or duplicated real drafts (missing = pending)
 * --require-all: fail unless every shot is registered or approved (for release)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {comicEditionsForStage,comicForStage} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset} from '../src/story-panel-registered-art.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const exists=rel=>fs.existsSync(path.join(root,rel));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const strict=process.argv.includes('--strict');
const full=process.argv.includes('--require-all');
if(process.argv.slice(2).some(x=>!['--strict','--require-all'].includes(x)))
 throw Error('Usage: [--strict] [--require-all]');
function webpDimensions(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')
  throw Error('bad WebP container');
 const type=b.toString('ascii',12,16);
 if(type==='VP8 '){
  if(b[23]!==0x9d||b[24]!==0x01||b[25]!==0x2a)throw Error('bad VP8 signature');
  return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff];
 }
 if(type==='VP8L'){
  if(b[20]!==0x2f)throw Error('bad VP8L signature');
  const n=b.readUInt32LE(21);
  return [(n&0x3fff)+1,((n>>>14)&0x3fff)+1];
 }
 if(type==='VP8X')return [b.readUIntLE(24,3)+1,b.readUIntLE(27,3)+1];
 throw Error('unsupported image encoding '+type);
}
function context(edition,gender){
 const c={protagonistGender:gender};
 if(edition==='post-victory')c.battleOutcome={victory:true};
 else if(edition==='post-defeat')c.battleOutcome={victory:false};
 else if(edition==='post-gameover')c.battleOutcome={victory:false,playerCommanderDead:true};
 else if(!['pre','post-town'].includes(edition))throw Error('unexpected edition '+edition);
 return c;
}
const stage2=read('assets/story/stage-manifests/c01-s02-shot-assignments.json').entries;
const referenceBibles=new Map();
for(const stage of CAMPAIGN_STAGES.filter(x=>x.chapter===1)){
 const bible=read('assets/story/characters/'+(stage.id==='c01-s01'?'c01-s02':stage.id)+'-reference-bible.json');
 referenceBibles.set(stage.id,new Map(bible.actors.map(x=>[x.id,x.path])));
}
const base='assets/story/chapter-drafts/c01/cloudflare-chapter1-free/';
const stageReports=[],imageHashes=new Map(),sceneKeys=new Set();
const counts={expected:0,existingRegistrationNotP0Approved:0,
 validRealReviewDraft:0,missing:0,providerBlocked:0,
 incorrectNativePixels:0,invalidProof:0,duplicate:0,formallyApprovedNew:0};
const rejected=[];
function mark(stage,row,status,reason){
 row.status=status;
 if(reason)row.reason=reason;
 const key=status==='EXISTING_REGISTERED_NOT_P0_CERTIFIED'?'existingRegistrationNotP0Approved':
  status==='VALID_REAL_DRAFT_VISUAL_QA_PENDING'?'validRealReviewDraft':
  status==='MISSING_REAL_ART'?'missing':
  status==='PROVIDER_SAFETY_BLOCKED'?'providerBlocked':
  status==='LOW_NATIVE_PIXELS'?'incorrectNativePixels':
  status==='DUPLICATE_ART'?'duplicate':'invalidProof';
 counts[key]++;
 if(['LOW_NATIVE_PIXELS','DUPLICATE_ART','INVALID_PROOF'].includes(status))
  rejected.push({key:row.key,reason});
 stage.scenes.push(row);
}
for(const stage of CAMPAIGN_STAGES.filter(x=>x.chapter===1)){
 const stageReport={stageId:stage.id,scenes:[]},bible=referenceBibles.get(stage.id);
 for(const ed of comicEditionsForStage(stage.id))for(const gender of ['male','female']){
  const scene=comicForStage(stage.id,ed.phase,context(ed.edition,gender));
  if(scene.edition!==ed.edition)throw Error('variant mismatch '+stage.id);
  for(let i=0;i<scene.panels.length;i++){
   const shot=scene.panels[i],key=[stage.id,ed.edition,gender,shot.id].join('|');
   if(sceneKeys.has(key))throw Error('duplicated canonical shot '+key);
   sceneKeys.add(key);counts.expected++;
   const row={key,panelId:shot.id,gender,edition:ed.edition};
   if(registeredStoryPanelAsset(shot)){mark(stageReport,row,'EXISTING_REGISTERED_NOT_P0_CERTIFIED');continue;}
   const normal=shot.id.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(Number(n)).padStart(2,'0'));
   const page=String(Math.floor(i/5)+1).padStart(2,'0');
   const file=base+stage.id+'-'+ed.edition+'-'+gender+'/p'+page+'/'+normal+'-'+ed.edition+'-'+gender+'.webp';
   const proof=file+'.generation.json',block=file+'.provider-blocked.json';
   row.path=file;
   if(exists(block)){mark(stageReport,row,'PROVIDER_SAFETY_BLOCKED');continue;}
   if(!exists(file)&&!exists(proof)){mark(stageReport,row,'MISSING_REAL_ART');continue;}
   if(!exists(file)||!exists(proof)){mark(stageReport,row,'INVALID_PROOF','Image and generation proof must both exist');continue;}
   try{
    const bytes=fs.readFileSync(path.join(root,file)),m=read(proof);
    const dims=webpDimensions(bytes);
    const expectedMin=stage.id==='c01-s02'?[768,320]:[1536,864];
    if(dims[0]<expectedMin[0]||dims[1]<expectedMin[1]||dims[0]*9!==dims[1]*16){
     mark(stageReport,row,'LOW_NATIVE_PIXELS','Got '+dims.join('x')+', min '+expectedMin.join('x')+' native 16:9');continue;
    }
    if(!Array.isArray(m.nativePixels)||m.nativePixels[0]!==dims[0]||m.nativePixels[1]!==dims[1]||
       m.shotKey!==key||m.imageSha256!==sha(bytes)||
       m.visuallyApproved!==false||m.formallyRegistered!==false||
       m.model!=='@cf/black-forest-labs/flux-2-klein-4b'||m.imageBytes!==bytes.length||
       m.screenplayText!==(shot.subtitleText||shot.text))
      throw Error('image/provenance/scene hash or state mismatch');
    const refs=m.actualReferenceImagesAttached;
    if(!Array.isArray(refs)||refs.length>4)throw Error('missing or >4 actor master attachments');
    const assignment=stage2[ed.edition+'|'+gender+'|'+shot.id];
    if(assignment && JSON.stringify(m.visibleActorIds)!==JSON.stringify(assignment.visibleActorIds))
      throw Error('stage2 canonical visible actors differ');
    const refIDs=refs.map(ref=>ref.actorId);
    if(JSON.stringify(refIDs)!==JSON.stringify(m.visibleActorIds)||new Set(refIDs).size!==refs.length)
      throw Error('actor identity/attachment mismatch');
    if(refIDs.includes('commander_'+(gender==='male'?'female':'male')))
      throw Error('wrong-gender hero attached');
    for(const ref of refs){
     const source=bible.get(ref.actorId)||(ref.actorId==='commander_female'
      ?'assets/story/characters/commander/female-master.webp':
       ref.actorId==='commander_male'?'assets/story/panels/c01-s01-m01.webp':
       ref.actorId==='lucia'?'assets/story/characters/lucia/master.webp':
       'assets/story-cinema/cast/'+ref.actorId+'.webp');
     if(!exists(source)||ref.source!==source||ref.originalSha256!==sha(fs.readFileSync(path.join(root,source)))||
        !Number.isInteger(ref.actualBytes)||ref.actualBytes<1000||
        typeof ref.submittedSha256!=='string'||ref.submittedSha256.length!==64)
       throw Error('unverified physical actor source '+ref.actorId);
    }
    const h=sha(bytes);
    if(imageHashes.has(h)){
      mark(stageReport,row,'DUPLICATE_ART','Bit-identical to '+imageHashes.get(h));continue;
    }
    imageHashes.set(h,key);
    row.dimensions=dims;
    mark(stageReport,row,'VALID_REAL_DRAFT_VISUAL_QA_PENDING');
   }catch(e){mark(stageReport,row,'INVALID_PROOF',String(e.message));}
  }
 }
 stageReports.push(stageReport);
}
if(counts.expected!==462||stageReports.length!==10||sceneKeys.size!==462)
 throw Error('Chapter 1 queue cardinality mismatch');
const unresolved=counts.missing+counts.providerBlocked+counts.incorrectNativePixels+
 counts.invalidProof+counts.duplicate;
const report={kind:'C01_ACTUAL_IMAGE_REGRESSION_NOT_HUMAN_VISUAL_APPROVAL',
 canonicalScenes:462,canonicalPages:132,counts,
 allArtBytesAccountedFor:unresolved===0,
 P0VisualApprovalComplete:false,
 safeToAutoRegister:false,
 safeToDeploy:false,
 qualityGate:[
  'native WebP 16:9 / per-stage source pixels',
  'exact image SHA256 with immutable generation evidence',
  'canonical gender/branch/storyboard text',
  'physical actor master source hashes attached to generation',
  'distinct real frame per distinct canonical shot',
  'human verification STILL REQUIRED: appearance, anatomy, unwanted text, scene interpretation'
 ],
 rejected,stages:stageReports};
const dest='qa-reports/story-stage-production/chapter1-free-render/c01-regression.json';
fs.mkdirSync(path.dirname(path.join(root,dest)),{recursive:true});
fs.writeFileSync(path.join(root,dest),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({report:dest,counts,rejected:rejected.slice(0,5),missingAndBlocked:unresolved,
 visualApproval:false,formallyReleased:false}));
if(strict&&(counts.invalidProof>0||counts.duplicate>0||counts.incorrectNativePixels>0))process.exitCode=2;
if(full&&(unresolved>0||counts.existingRegistrationNotP0Approved>0||counts.validRealReviewDraft>0))
 process.exitCode=3;
