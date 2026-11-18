#!/usr/bin/env node
/**
 * Recover the *execution pipeline*, not unreviewed game geometry.
 * Failed Actions get one bounded retry; persistent failures become a concrete
 * regression issue for the existing code-editing ChatGPT quality tasks.
 * Real model improvements are NEVER inferred from a successful QA run.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const WATCHED = Object.freeze([
 {workflow:'character-six-lane.yml',groups:['faceHair','outfit'],maxAgeMinutes:80,retry:true,dispatch:true},
 {workflow:'creature-six-lane.yml',groups:['creatureMonster','creatureSummon'],maxAgeMinutes:80,retry:true,dispatch:true},
 {workflow:'world-six-lane.yml',groups:['world'],maxAgeMinutes:110,retry:true,dispatch:true},
 // All of these were added AFTER the six-group recovery workflow: monitoring
 // the dashboard switch alone did not make their GitHub schedules run.
 {workflow:'game-quality-six-lane.yml',groups:['gameQuality'],maxAgeMinutes:90,retry:true,dispatch:true},
 {workflow:'quality-evolution-loop.yml',groups:['faceHair','outfit','gameQuality'],maxAgeMinutes:120,retry:false,dispatch:true},
 {workflow:'batch-rule-self-heal.yml',groups:['gameQuality'],maxAgeMinutes:125,retry:true,dispatch:true},
 {workflow:'batch-self-drive.yml',groups:['faceHair','outfit','creatureMonster','world'],maxAgeMinutes:125,retry:false,dispatch:true},
 {workflow:'story-sequential-missing-batch.yml',groups:['anime'],maxAgeMinutes:1620,retry:false,dispatch:true},
 {workflow:'story-cloudflare-free-daily.yml',groups:['anime'],maxAgeMinutes:1620,retry:false,dispatch:false},
 {workflow:'story-chapter1-free-complete-draft-production.yml',groups:['anime'],maxAgeMinutes:null,retry:false,dispatch:false}
]);

export function decideRecovery(spec,run,now=Date.now()){
 if(!run)return spec.maxAgeMinutes===null?'observe_only':spec.dispatch?'dispatch':'stale';
 if(['queued','in_progress','waiting','pending','requested'].includes(run.status))return 'running';
 const ageMinutes=(now-Date.parse(run.created_at||run.run_started_at))/60000;
 if(run.conclusion==='success'){
  if(spec.maxAgeMinutes!==null&&Number.isFinite(ageMinutes)&&ageMinutes>spec.maxAgeMinutes)
   return spec.dispatch?'dispatch':'stale';
  return 'success';
 }
 if(['failure','timed_out','cancelled','action_required'].includes(run.conclusion)){
  if(spec.retry&&Number(run.run_attempt||1)<2&&run.conclusion!=='action_required')return 'rerun_failed';
  return 'escalate';
 }
 return 'unknown';
}
export const MAX_RECOVERIES_PER_CHECK=3;
export const GAME_LANES=Object.freeze(['model','fidelity','motion','frame','scale','runtime']);
export const EVOLUTION_DOMAINS=Object.freeze(['face','hair','outfit']);
export const SOURCE_REPAIR_DOMAINS=Object.freeze(['faceHair','outfit','creatureMonster','world','anime']);

/** Input selection for a missed GitHub schedule is explicit; default 'model'
 * or default 'outfit' every time would starve the other 5/2 quality lanes.
 * The latest per-domain evidence is a read-only hint; no speculative source
 * adoption, GLBs or Android FPS are created by this dispatch.
 */
export function dispatchInputFor(spec,checkedAt,switches,readDomain=()=>null){
 const hour=new Date(checkedAt).getUTCHours();
 if(spec.workflow==='game-quality-six-lane.yml')
  return {lane:GAME_LANES[hour%GAME_LANES.length]};
 if(spec.workflow==='quality-evolution-loop.yml'){
  const available=EVOLUTION_DOMAINS.filter(x=>
   switches?.groups?.[x==='outfit'?'outfit':'faceHair']?.enabled===true);
  if(!available.length)return null;
  const ordered=available.map(domain=>({
   domain,time:Date.parse(readDomain(domain)||'1970-01-01T00:00:00Z')
  })).sort((a,b)=>(a.time||0)-(b.time||0)||
   available.indexOf(a.domain)-available.indexOf(b.domain));
  return {domain:ordered[0].domain};
 }
 if(spec.workflow==='batch-self-drive.yml'){
  const available=SOURCE_REPAIR_DOMAINS.filter(x=>
   switches?.groups?.[x]?.enabled===true);
  if(!available.length)return null;
  return {category:available[hour%available.length]};
 }
 return {};
}
export function isAuthorizedRepo(repo){
 return repo==='yamadayoshitaka/hai-gin-rpg';
}

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const API='https://api.github.com';
const ownerRepo=process.env.GITHUB_REPOSITORY||'yamadayoshitaka/hai-gin-rpg';
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
const dryRun=process.argv.includes('--dry-run');
const checkedAt=new Date().toISOString();
/** Read only already-committed per-domain run evidence. The watchdog itself
 * does not run a model generator or create any imagery. */
function lastEvolutionCheck(domain){
 const source=path.join(ROOT,'data/quality-evolution/runs',domain+'.json');
 if(!fs.existsSync(source))return null;
 try{
  const data=JSON.parse(fs.readFileSync(source,'utf8'));
  return data?.latest?.completedAt||data?.latest?.startedAt||null;
 }catch{return null}
}

async function api(endpoint,method='GET',body=null){
 if(!isAuthorizedRepo(ownerRepo))throw Error('Refusing unexpected repository');
 if(!token)throw Error('GITHUB_TOKEN missing: cannot inspect authorized workflow runs');
 const res=await fetch(API+'/repos/'+ownerRepo+'/'+endpoint,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const response=await res.text();
 if(!res.ok)throw Error('GitHub '+res.status+' '+endpoint+': '+response.slice(0,300));
 return response?JSON.parse(response):null;
}
async function createOrRefreshIssue(spec,run,reason){
 if(dryRun)return 'dry-run: issue not opened';
 const title='[hai-gin-regression] '+spec.workflow;
 const data=await api('issues?state=open&per_page=100');
 const existing=data.find(x=>x.title===title&&!x.pull_request);
 const runUrl=run?.html_url||'No run available';
 const body=[
  '## 自動回帰の修正待ち（失敗検出）',
  'Affected groups: '+spec.groups.join(', '),
  'Workflow: '+spec.workflow,
  'Failure: '+reason,
  'Run: '+runUrl,
  'Run attempt: '+(run?.run_attempt??0),
  'Recorded at: '+checkedAt,
  '',
  '既存の定期品質改修タスクはこのIssueをチェックポイントとして取り込み、失敗ジョブと回帰テストを調査して**実ソースを修正しコミット**してください。',
  'テストの無効化、無検証のマージ、画像生成/FF15達成の虚偽報告は禁止。'
 ].join('\n');
 if(existing){
  if(!String(existing.body||'').includes(runUrl)||!String(existing.body||'').includes('Run attempt: '+(run?.run_attempt??0)))
   await api('issues/'+existing.number,'PATCH',{body});
  return existing.html_url;
 }
 const created=await api('issues','POST',{title,body});
 return created.html_url;
}
async function inspect(spec,switches,{canRecover=true}={}){
 const active=spec.groups.some(k=>switches.groups?.[k]?.enabled===true);
 const row={workflow:spec.workflow,groups:spec.groups,enabled:active,checkedAt,
  status:'unknown',runId:null,runUrl:null,runAttempt:0,action:'none',issueUrl:null,error:null,
  maxAgeMinutes:spec.maxAgeMinutes,decision:'unknown',dispatchInputs:null};
 if(!active){row.status='disabled_by_owner';return row;}
 try{
  const data=await api('actions/workflows/'+encodeURIComponent(spec.workflow)+'/runs?branch=main&per_page=6');
  const run=(data.workflow_runs||[]).find(x=>x.event!=='pull_request')||null;
  if(run){row.status=run.status==='completed'?(run.conclusion||'unknown'):run.status;
   row.runId=run.id;row.runUrl=run.html_url;row.runAttempt=run.run_attempt||1;
   row.lastStartedAt=run.run_started_at||run.created_at;row.headSha=run.head_sha;}
  const decision=decideRecovery(spec,run);
  row.decision=decision;
  if(dryRun||['success','running','observe_only','unknown'].includes(decision))return row;
  if(!canRecover&&['rerun_failed','dispatch'].includes(decision)){
   row.action='deferred_bounded_recovery_budget';
   return row;
  }
  if(decision==='rerun_failed'){
   // A retry is safe for QA-only jobs. Image-generation workflows are NEVER rerun.
   await api('actions/runs/'+run.id+'/rerun-failed-jobs','POST');
   row.action='rerun_failed_jobs_once';
  }else if(decision==='dispatch'){
   // Recreate a missed schedule, not an extra free provider dispatch.
   const inputs=dispatchInputFor(spec,checkedAt,switches,lastEvolutionCheck);
   if(inputs===null){
    row.action='skipped_disabled_category';
    return row;
   }
   row.dispatchInputs=inputs;
   await api('actions/workflows/'+encodeURIComponent(spec.workflow)+'/dispatches','POST',{
    ref:'main',...(Object.keys(inputs).length?{inputs}:{})
   });
   row.action='dispatch_missing_schedule';
  }else if(decision==='escalate'||decision==='stale'){
   row.issueUrl=await createOrRefreshIssue(spec,run,decision);
   row.action='escalated_to_source_fix_issue';
  }
 }catch(error){row.error=String(error.message||error);row.status='api_error';
   if(!dryRun){
    try{row.issueUrl=await createOrRefreshIssue(spec,null,row.error);row.action='escalated_api_error';}
    catch(issueError){row.error+='; issue: '+String(issueError.message||issueError);}
   }
 }
 return row;
}
async function main(){
 const switches=JSON.parse(fs.readFileSync(path.join(ROOT,'data/batch-center-switches.json'),'utf8'));
 const rows=[];
 let remaining=MAX_RECOVERIES_PER_CHECK;
 for(const spec of WATCHED){
  const row=await inspect(spec,switches,{canRecover:remaining>0});
  rows.push(row);
  if(['dispatch_missing_schedule','rerun_failed_jobs_once'].includes(row.action))remaining--;
 }
 const report={schemaVersion:1,checkedAt,source:'GitHub Actions authorized workflow-run API',
  note:'Actions success verifies task execution, NOT 3D mesh change, QA visual approval, commit, merge or Pages deployment.',
  recoveryPolicy:'watch all seven registered categories plus their game-quality, evolution, rule-self-heal and PR-source helpers; max three recovery launches per inspection; one bounded QA retry; persistent errors produce a code-editing Issue; paid image workflows are never retried',
  workflows:rows};
 const output=path.join(ROOT,'data/batch-regression-runtime.json');
 fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '## 六系統 回帰・復旧\n'+rows.map(x=>'- '+x.workflow+': '+x.status+' / '+x.action+
   (x.runUrl?' / '+x.runUrl:'')+(x.error?' / '+x.error:'')).join('\n')+'\n');
 console.log(JSON.stringify({output,workflows:rows.map(x=>({workflow:x.workflow,status:x.status,action:x.action,error:x.error}))}));
 if(rows.every(x=>x.status==='api_error'))process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(e=>{console.error(e);process.exitCode=1;});
}
