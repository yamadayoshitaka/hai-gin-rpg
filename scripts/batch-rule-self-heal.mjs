#!/usr/bin/env node
/** No-cost, rule-based self-repair. No LLM/API generation and no fake models.
 * Existing source invariants -> known patch -> target QA -> retry -> main push
 * -> immutable evidence -> explicit Pages dispatch. Unknowns become issues.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {CHARACTER_QUALITY_SIX_LANES} from '../src/character-system/character-quality-six-lanes.js';
import {REPAIR_RULES,PROTECTED_PATHS,allowedRepairPath,applyKnownRule} from './batch-repair-rules.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REPO='yamadayoshitaka/hai-gin-rpg',TOKEN=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
const runUrl='https://github.com/'+REPO+'/actions/runs/'+(process.env.GITHUB_RUN_ID||'local');
const evidenceDir=path.join(ROOT,'qa-reports/batch-rule-self-heal');
const report={schemaVersion:1,mode:'free-rule-based-only',startedAt:new Date().toISOString(),
 baselineSha:null,sourceCommitSha:null,improvements:[],detected:[],attempts:[],
 status:'starting',pagesDispatch:'not_requested',webglQualityVerified:false,
 androidFpsMeasured:false,modelGlbsGenerated:0,runUrl};
function run(cmd,args,timeout=180000){
 const p=spawnSync(cmd,args,{cwd:ROOT,encoding:'utf8',timeout,maxBuffer:8*1024*1024});
 return {ok:p.status===0&&!p.error,text:((p.stdout||'')+'\n'+(p.stderr||'')).slice(-3000),code:p.status};
}
function requireRun(cmd,args,timeout){
 const r=run(cmd,args,timeout);if(!r.ok)throw Error(cmd+' '+args.join(' ')+': '+r.text.slice(-700));
 return r.text.trim();
}
async function api(route,{method='GET',body}={}){
 if(!TOKEN)throw Error('GitHub token unavailable for automated repair');
 const result=await fetch('https://api.github.com/repos/'+REPO+'/'+route,{
  method,headers:{Authorization:'Bearer '+TOKEN,Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const text=await result.text();
 if(!result.ok)throw Error('GitHub '+result.status+' '+route+' '+text.slice(0,160));
 return text?JSON.parse(text):null;
}
function suites(paths){
 return run('node',['--test',...paths],240000);
}
function ruleFilesOnly(files){
 return files.every(p=>allowedRepairPath(p)&&!PROTECTED_PATHS.includes(p));
}
async function openOrUpdateIssue(){
 if(!TOKEN)return null;
 const title='[rule-self-heal] Unknown game regression or failed known-rule patch';
 const detail=['# Free deterministic self-repair could not fix this regression',
  'Main baseline: '+report.baselineSha,
  'Run: '+runUrl,'Status: '+report.status,'',
  'Known recipe attempts:',
  ...report.attempts.map(x=>'- '+x.id+' ['+x.status+'] '+String(x.detail||'').slice(0,450)),
  'Unresolved QA:',
  ...report.detected.map(x=>'- '+x.id+': '+String(x.error||'').slice(0,750)),
  '',
  'Do not assert visual improvement based only on tests. The next human/ChatGPT edit should add a narrowly scoped deterministic repair rule and a failing regression fixture, then verify the game on Android.',
  'Current object list/60 IDs, protected m005/m006 external models, story identities and FF15 image assets must not be silently overwritten.'
 ].join('\n');
 try{
  const issues=await api('issues?state=open&per_page=100');
  const existing=issues.find(x=>x.title===title&&!x.pull_request);
  const issue=existing?await api('issues/'+existing.number,{method:'PATCH',body:{body:detail}}):
   await api('issues',{method:'POST',body:{title,body:detail}});
  return issue.html_url;
 }catch(e){report.issueError=String(e.message||e);return null}
}
async function publishEvidence(){
 const route='contents/data/batch-rule-self-heal/latest.json';
 for(let tries=0;tries<3;tries++){
  let old=null;
  try{old=await api(route+'?ref=main')}
  catch(e){if(!String(e.message).includes('GitHub 404 '))throw e}
  let history=[];
  if(old?.content){
   const parsed=JSON.parse(Buffer.from(old.content.replace(/\s/g,''),'base64').toString('utf8'));
   history=Array.isArray(parsed.history)?parsed.history:[];
  }
  const result={
   schemaVersion:1,description:'Only verified source rule fixes are improvements, not model/FPS approval',
   latest:{...report,pagesDispatch:'requested_not_yet_verified'},
   history:[...history.slice(-23),{...report,pagesDispatch:'requested_not_yet_verified'}]
  };
  const payload={branch:'main',
   message:'chore(batch): publish deterministic self-heal source/QA evidence',
   content:Buffer.from(JSON.stringify(result,null,2)+'\n').toString('base64')};
  if(old?.sha)payload.sha=old.sha;
  try{
   const saved=await api(route,{method:'PUT',body:payload});
   return saved.commit?.sha;
  }catch(e){if(tries===2||!/GitHub (409|422) /.test(String(e.message)))throw e}
 }
 return null;
}
function safeRestore(files){
 for(const f of files)requireRun('git',['checkout','--',f]);
}
async function selfHeal(){
 if(process.env.GITHUB_REPOSITORY!==REPO)throw Error('Refusing repair on another repository');
 if(process.env.GITHUB_EVENT_NAME==='pull_request')throw Error('A PR validation cannot mutate production main');
 requireRun('git',['fetch','--no-tags','origin','main']);
 const baseline=requireRun('git',['rev-parse','origin/main']).trim();
 report.baselineSha=baseline;
 requireRun('git',['config','user.name','github-actions[bot]']);
 requireRun('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
 if(requireRun('git',['rev-parse','HEAD']).trim()!==baseline){
  // A queued Actions job may start after another batch committed a newer
  // main. Freshen ONLY an untouched runner checkout: never discard actual
  // candidate edits or reset a developer's worktree.
  if(!run('git',['diff','--quiet']).ok||
     !run('git',['diff','--cached','--quiet']).ok){
   report.status='stale_checkout_with_changes';
   return;
  }
  requireRun('git',['reset','--hard','origin/main']);
  if(requireRun('git',['rev-parse','HEAD']).trim()!==baseline)
   throw Error('Could not safely refresh queued runner checkout to latest main');
  report.initialCheckoutRefreshed=true;
 }
 // Respect the existing public batch-center switches; an owner-disabled
 // category must never be modified just because a scheduled runner started.
 const switches=JSON.parse(fs.readFileSync(
  path.join(ROOT,'data/batch-center-switches.json'),'utf8'));
 const isEnabled=id=>switches?.groups?.[id]?.enabled===true;
 if(!isEnabled('gameQuality')){
  report.status='disabled_by_batch_center';return;
 }
 const enabledFor={
  'monster-refresh-duplicates':()=>isEnabled('creatureMonster'),
  'studio-source-manifest-drift':()=>isEnabled('faceHair')&&isEnabled('outfit'),
  'invalid-crowd-lod-budget':()=>isEnabled('gameQuality')
 };
 const patched=new Set();
 for(let pass=1;pass<=3;pass++){
  let appliedThisPass=0;
  for(const rule of REPAIR_RULES){
   if(patched.has(rule.id)||!enabledFor[rule.id]?.())continue;
   const filepath=path.join(ROOT,rule.file);
   const original=fs.readFileSync(filepath,'utf8');
   const candidate=applyKnownRule(rule.id,original,CHARACTER_QUALITY_SIX_LANES);
   if(!candidate.changed)continue;
   const attempt={id:rule.id,file:rule.file,pass,status:'attempted',detail:candidate.reason};
   report.attempts.push(attempt);
   if(!allowedRepairPath(rule.file)){
    attempt.status='unsafe_path_blocked';continue;
   }
   fs.writeFileSync(filepath,candidate.code);
   const syntax=rule.file.endsWith('.js')?run('node',['--check',rule.file]):{ok:true};
   const targetQA=suites(rule.tests);
   const whitespace=run('git',['diff','--check']);
   const changed=requireRun('git',['diff','--name-only']).split('\n').filter(Boolean);
   if(!syntax.ok||!targetQA.ok||!whitespace.ok||!ruleFilesOnly(changed)){
    fs.writeFileSync(filepath,original);
    attempt.status='rolled_back';
    attempt.detail=[!syntax.ok?'Invalid JS: '+syntax.text:'',!targetQA.ok?'QA: '+targetQA.text:'',
     !whitespace.ok?'Whitespace: '+whitespace.text:''].filter(Boolean).join('\n').slice(-1200);
    continue;
   }
   attempt.status='test_passed';
   patched.add(rule.id);appliedThisPass++;
   report.improvements.push({rule:rule.id,file:rule.file,
    description:candidate.reason,tests:rule.tests,qa:'passed'});
  }
  if(!appliedThisPass)break;
 }
 // Run every known recipe's regression tests, even if no fix was needed.
 for(const rule of REPAIR_RULES){
  if(!enabledFor[rule.id]?.())continue;
  const checked=suites(rule.tests);
  if(!checked.ok)report.detected.push({id:rule.id,error:checked.text.slice(-1100)});
 }
 // Match the existing Pages publication check: vm.SourceTextModule
 // requires this flag on the current GitHub Node.js runner.
 const integrity=run('node',['--experimental-vm-modules','qa/pages-publication-integrity.cjs']);
 if(!integrity.ok)report.detected.push({id:'pages-integrity',error:integrity.text.slice(-1100)});
 const files=requireRun('git',['diff','--name-only']).split('\n').filter(Boolean);
 if(!ruleFilesOnly(files)){
  safeRestore(files.filter(allowedRepairPath));
  throw Error('Unexpected modified file outside the strict repair allowlist');
 }
 if(report.detected.length){
  if(files.length)safeRestore(files);
  report.status='unresolved_tests';
  report.issueUrl=await openOrUpdateIssue();
  return;
 }
 if(!files.length){
  report.status='no_known_error_to_fix';
  return;
 }
 requireRun('git',['add','--',...files]);
 requireRun('git',['diff','--cached','--check']);
 requireRun('git',['fetch','--no-tags','origin','main']);
 if(requireRun('git',['rev-parse','origin/main']).trim()!==baseline){
  report.status='main_changed_retry_next_run';
  report.issueUrl=await openOrUpdateIssue();
  return;
 }
 requireRun('git',['commit','-m','fix(rule-self-heal): repair verified game invariants without AI API']);
 const sha=requireRun('git',['rev-parse','HEAD']).trim();
 const pushed=run('git',['push','origin','HEAD:main'],90000);
 if(!pushed.ok){
  report.status='main_push_rejected';
  report.pushError=pushed.text.slice(-900);
  report.issueUrl=await openOrUpdateIssue();
  return;
 }
 report.sourceCommitSha=sha;
 report.status='source_repaired_main';
 report.modifiedSourceFiles=files;
 const evidenceSha=await publishEvidence();
 if(!evidenceSha)throw Error('Rule repair committed but evidence journal did not return SHA');
 report.evidenceCommitSha=evidenceSha;
 await api('actions/workflows/publish-pages.yml/dispatches',{method:'POST',body:{ref:'main'}});
 report.pagesDispatch='requested_not_yet_verified';
}
async function main(){
 fs.mkdirSync(evidenceDir,{recursive:true});
 try{await selfHeal()}catch(e){
  report.status=report.sourceCommitSha?'source_committed_but_publication_failed':'error';
  report.error=String(e.stack||e).slice(0,1200);
  report.issueUrl=await openOrUpdateIssue();
 }
 finally{
  fs.writeFileSync(path.join(evidenceDir,'latest.json'),JSON.stringify(report,null,2)+'\n');
  if(process.env.GITHUB_OUTPUT){
   fs.appendFileSync(process.env.GITHUB_OUTPUT,'changed='+(report.sourceCommitSha?'true':'false')+'\n');
   if(report.sourceCommitSha)fs.appendFileSync(process.env.GITHUB_OUTPUT,'source_sha='+report.sourceCommitSha+'\n');
  }
  if(process.env.GITHUB_STEP_SUMMARY)
   fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '## Free rule-based repair\n- Outcome: '+report.status+
    '\n- Known recipe repairs: '+report.improvements.length+
    '\n- Exact source commit: '+(report.sourceCommitSha||'none')+
    '\n- Pages dispatch: '+report.pagesDispatch+
    '\n- Known QA findings: '+report.detected.length+
    '\n- GLBs generated: 0; Android FPS measured: NO; FF15 visual approval: NO'+
    '\n- Unresolved issue: '+(report.issueUrl||'none')+'\n');
  console.log('RULE_SELF_HEAL '+JSON.stringify(report));
  if(['error','unresolved_tests','main_push_rejected','source_committed_but_publication_failed'].includes(report.status))
   process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
