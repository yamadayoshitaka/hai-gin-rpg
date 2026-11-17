#!/usr/bin/env node
// First missing playable CG, chapter 1 stage 1 through chapter 20 stage 10.
// Builds on the existing canonical 880-scene / 1760-gender audit.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const source='qa-reports/story-sequential-missing/canonical.json';
const result='qa-reports/story-sequential-missing/next.json';
const sw=JSON.parse(fs.readFileSync('data/batch-center-switches.json','utf8'));
// Disabled batches must not write queue artifacts or invoke generators.
if(sw.groups?.anime?.enabled!==true){
 console.log(JSON.stringify({enabled:false,skipped:true,reason:'ANIME_BATCH_DISABLED'}));
 process.exit(0);
}
const policy=JSON.parse(fs.readFileSync('data/story-generation-spend-policy.json','utf8'));
if(policy.allowedAdditionalPaidApiSpendJpy!==0||policy.cloudflare?.paidTierOrTopUpsAllowed!==false)
 throw Error('Paid provider forbidden');
const max=Number(process.argv.includes('--max')?process.argv[process.argv.indexOf('--max')+1]:20);
if(!Number.isInteger(max)||max<1||max>20)throw Error('Batch cap must be 1..20');
fs.mkdirSync(path.dirname(result),{recursive:true});
const run=spawnSync(process.execPath,['scripts/build-story-compact-production-queue.mjs',source],
 {cwd:root,encoding:'utf8'});
if(run.status!==0)throw Error('Canonical queue failed: '+run.stderr.slice(0,1000));
const q=JSON.parse(fs.readFileSync(source,'utf8'));
if(q.entries.length!==880||q.result.genderVariantsObserved!==1760)
 throw Error('200-stage compact source drift');
function webpOK(rel){
 if(typeof rel!=='string'||!rel.startsWith('./assets/story/')||rel.includes('..'))return false;
 const full=path.resolve(root,rel.slice(2));
 if(!full.startsWith(root+path.sep)||!fs.existsSync(full))return false;
 try {
  const b=fs.readFileSync(full);
  if(b.length<32||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')return false;
  // Reject truncated or appended payloads rather than counting a header-only stub as real art.
  if(b.readUInt32LE(4)+8!==b.length)return false;
  const t=b.toString('ascii',12,16);
  let w=0,h=0;
  if(t==='VP8 '){w=b.readUInt16LE(26)&16383;h=b.readUInt16LE(28)&16383;}
  else if(t==='VP8L'){const n=b.readUInt32LE(21);w=(n&16383)+1;h=((n>>>14)&16383)+1;}
  else if(t==='VP8X'){w=b.readUIntLE(24,3)+1;h=b.readUIntLE(27,3)+1;}
  return w>=800&&h>=450&&w*9===h*16;
 }catch{return false;}
}
const rows=[];
for(const scene of q.entries){
 for(const gender of ['male','female']){
  const v=scene.genderVariants[gender];
  const valid=webpOK(v.sourceArt);
  rows.push({key:v.key,stageId:scene.stageId,chapter:scene.chapter,
   sceneId:scene.shotId,edition:scene.edition,phase:scene.phase,
   gender,status:valid?'REGISTERED_REAL_NOT_P0':v.sourceArt?'BROKEN_REGISTRATION':'MISSING_ART',
   sourceArt:valid?v.sourceArt:null,policy:scene.stageId<='c01-s04'?
    'EXACT_OLD_ART_REUSE_ALLOWED':'NEW_ORIGINAL_REQUIRED'});
 }
}
if(rows.length!==1760||new Set(rows.map(r=>r.key)).size!==1760)throw Error('Duplicate/missing variants');
const pending=rows.filter(r=>r.status!=='REGISTERED_REAL_NOT_P0');
const enabled=sw.groups?.anime?.enabled===true;
const next=enabled?pending.slice(0,max):[];
const report={kind:'STORY_MANGA_SEQUENTIAL_200_STAGE_GAP_QUEUE',schemaVersion:1,
 chapters:20,stages:200,identities:880,genderVariants:1760,enabled,
 registered:rows.length-pending.length,pending:pending.length,
 firstMissing:pending[0]?.key??null,selected:next,
 generatedThisRun:0,provisionallyRegisteredThisRun:0,formalP0ThisRun:0,
 providerRequestsThisRun:0,noPaidApi:true,
 unsupportedGeneratorAfterChapter1:true,entries:rows};
fs.writeFileSync(result,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({firstMissing:report.firstMissing,pending:report.pending,
 registered:report.registered,selected:next.length,enabled,report:result,generated:0}));
if(process.env.GITHUB_STEP_SUMMARY)
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '## 漫画不足画像：全200ステージ順次キュー\n\n' +
  '登録済（実WebP、P0未保証）: '+report.registered+' / 1760\n\n'+
  '未登録・要修正: '+report.pending+'\n\n'+
  '次の対象: '+(report.firstMissing||'なし')+'\n\n'+
  '今回の画像生成: 0（キュー検査のみ）。追加有料APIなし。\n');
