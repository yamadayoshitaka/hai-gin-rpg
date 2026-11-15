#!/usr/bin/env node
/**
 * Honest stage 1..4 native-art asset audit: no image generation or P0 approval.
 * Compares the canonical 174 shot keys with actual on-disk game bindings.
 * Reports pixel geometry and SHA; semantic actor/scene/no-text remain HUMAN_PENDING.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {CHAPTER1_PROVISIONAL_LIVE} from '../src/story-chapter1-provisional-live.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pages=chapterOneReviewPages().filter(p=>/^c01-s0[1-4]$/.test(p.stageId));
const shots=pages.flatMap(p=>p.shots);
if(shots.length!==174)throw Error('Canonical stage1..4 count drifted from 174');
const minima={ 'c01-s01':[1536,864], 'c01-s02':[768,320], 'c01-s03':[800,450], 'c01-s04':[800,450] };
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function webpSize(b){
 if(b.length<30||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')return null;
 const typ=b.toString('ascii',12,16);
 if(typ==='VP8 ')return [b.readUInt16LE(26)&16383,b.readUInt16LE(28)&16383];
 if(typ==='VP8L'){if(b[20]!==47)return null;const n=b.readUInt32LE(21);return [(n&16383)+1,((n>>>14)&16383)+1]}
 if(typ==='VP8X')return [b.readUIntLE(24,3)+1,b.readUIntLE(27,3)+1];
 return null;
}
const items=[],seen=new Map();
for(const s of shots){
 const live=CHAPTER1_PROVISIONAL_LIVE[s.key];
 const url=live?.asset||s.legacyPath||null;
 const item={shotKey:s.key,stageId:s.stageId,
  sourceKind:live?'active_provisional':url?'legacy_or_draft':'missing',
  artPath:url,formalP0Approved:false,semanticIdentityVisualQA:'NOT_PERFORMED',
  screenplayImageExactnessQA:'NOT_PERFORMED',noTextUIVisualQA:'NOT_PERFORMED',
  issues:[]};
 if(!url){item.issues.push('NO_ART_BINDING');items.push(item);continue}
 const relative=url.replace(/^\.\//,'');
 if(relative.startsWith('/')||relative.split('/').includes('..')){
   item.issues.push('INVALID_ART_PATH');items.push(item);continue;
 }
 const p=path.resolve(root,relative);
 if(!p.startsWith(root+path.sep)||!fs.existsSync(p)){item.issues.push('ART_FILE_MISSING');items.push(item);continue}
 const buf=fs.readFileSync(p),dims=webpSize(buf);
 item.sizeBytes=buf.length;item.realSha256=sha(buf);item.nativePixels=dims;
 if(!dims){item.issues.push('NOT_VALID_WEBP')}else{
   const [minW,minH]=minima[s.stageId], [w,h]=dims;
   if(w<minW||h<minH)item.issues.push('BELOW_STAGE_NATIVE_MINIMUM');
   // Some grandfathered stage2 phone crops are non-16:9; report, do not fake approval.
   if(w*9!==h*16)item.issues.push('NOT_EXACT_NATIVE_16_9');
 }
 if(live?.sha256&&live.sha256!==item.realSha256)item.issues.push('REGISTERED_SHA_MISMATCH');
 if(seen.has(item.realSha256))item.issues.push('IMAGE_BYTES_REUSED:'+seen.get(item.realSha256));
 else seen.set(item.realSha256,s.key);
 items.push(item);
}
const stages={};
for(const stage of ['c01-s01','c01-s02','c01-s03','c01-s04']){
 const arr=items.filter(x=>x.stageId===stage);
 stages[stage]={total:arr.length,activeProvisional:arr.filter(x=>x.sourceKind==='active_provisional').length,
 legacyOrDraft:arr.filter(x=>x.sourceKind==='legacy_or_draft').length,unbound:arr.filter(x=>x.sourceKind==='missing').length,
 withTechnicalIssues:arr.filter(x=>x.issues.length).length,formalP0Approved:0};
}
const result={schemaVersion:1,kind:'REPRODUCIBLE_REAL_ART_AUDIT_NOT_VISUAL_P0',
 total:174,stages,canClaimAllStage1To4QualityCompleted:false,items};
fs.mkdirSync(path.join(root,'qa-reports'),{recursive:true});
const out=path.join(root,'qa-reports','story-stage1-4-asset-audit.json');
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({auditFile:path.relative(root,out),stages},null,2));
if(process.argv.includes('--strict-technical')&&items.some(x=>x.issues.some(i=>
 ['NO_ART_BINDING','INVALID_ART_PATH','ART_FILE_MISSING','NOT_VALID_WEBP','REGISTERED_SHA_MISMATCH'].includes(i))))process.exitCode=2;
