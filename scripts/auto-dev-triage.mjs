#!/usr/bin/env node
/** Free deterministic GitHub Actions failure triage. Never infer code repair or visual approval. */
import fs from 'node:fs';
import crypto from 'node:crypto';
const REPO='yamadayoshitaka/hai-gin-rpg';
export const MAX_WRITES=3;
export function categoryFor(name=''){
 const n=name.toLowerCase();
 if(/manga|comic|story|chapter|漫画/.test(n))return 'anime';
 if(/world|terrain|object|prop|town|地形|オブジェクト/.test(n))return 'world';
 if(/creature|monster|summon|avian|wolf|feline|召喚/.test(n))return 'creatureMonster';
 if(/outfit|garment|armor|costume|pauldron|衣装|鎧/.test(n))return 'outfit';
 if(/face|hair|scalp|wig|makeup|頭皮|髪/.test(n))return 'faceHair';
 return 'gameQuality';
}
export function actionable(run,now=Date.now()){
 if(!run||!['failure','timed_out','action_required'].includes(run.conclusion))return false;
 if(!['push','pull_request','workflow_dispatch','schedule'].includes(run.event))return false;
 if(!run.id||!run.name||/Auto.dev failure triage/i.test(run.name))return false;
 const t=Date.parse(run.created_at);
 return Number.isFinite(t)&&t<=now&&now-t<=36*3600000;
}
export function marker(name,category){
 return 'hai-gin-auto-dev:'+crypto.createHash('sha256').update(category+'\0'+name).digest('hex').slice(0,16);
}
export function clean(s,n=220){
 return String(s??'').replace(/\x1b\[[0-9;]*m/g,'')
  .replace(/(?:github_pat_[a-z0-9_]{15,}|gh[psu]_[a-z0-9]{10,}|Bearer\s+[^\s]+)/gi,'[redacted]')
  .replace(/\s+/g,' ').slice(0,n);
}
export function failedJobs(jobs){
 return (jobs||[]).filter(j=>['failure','timed_out'].includes(j.conclusion)).slice(0,4)
  .map(j=>({name:clean(j.name,100),
   url:/^https:\/\/github\.com\/yamadayoshitaka\/hai-gin-rpg\/actions\/runs\/\d+\/job\/\d+$/.test(j.html_url||'')?j.html_url:null,
   steps:(j.steps||[]).filter(s=>['failure','timed_out'].includes(s.conclusion)).slice(0,6).map(s=>clean(s.name,120))}));
}
export function issueBody(row){
 return ['## 自動開発・未知障害の修正キュー','<!-- '+row.marker+' -->',
  'カテゴリ: '+row.category,'ワークフロー: '+clean(row.name),
  '失敗実行: '+row.url,'対象ソースSHA: '+row.sha,
  '検出: '+row.at,'PR: '+(row.pr||'main/手動'),
  '### 失敗した実ジョブと工程',
  ...row.jobs.map(j=>'- '+j.name+' / '+(j.steps.join(' / ')||'job failure')+(j.url?' / '+j.url:'')),
  '### 担当ChatGPT開発タスクの作業指示',
  '最新mainと失敗ソースを照合し、Actionsログの具体的な例外を再現してください。',
  '対象カテゴリの最小コード差分と回帰テストを作成し、ブランチへコミットしてPRを作成してください。',
  '実行時のFPS低下、画質退化、モデルID消失、漫画人物誤登録がないか検証してください。',
  '失敗QA・未確認のWebGL画質・未測定のAndroid実機FPSを成功と報告してはいけません。',
  'CIが不合格ならmainへマージせず、原因をこのIssueへ残してください。',
  'これは自動診断票であり、GitHub Actionsだけで未知の修正コードを生成したものではありません。'
 ].join('\n');
}
async function api(route,{method='GET',body}={}){
 const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
 if(!token)throw Error('GitHub token missing');
 const r=await fetch('https://api.github.com/repos/'+REPO+'/'+route,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 const raw=await r.text();
 if(!r.ok)throw Error('GitHub '+r.status+' '+route+': '+raw.slice(0,240));
 return raw?JSON.parse(raw):null;
}
export async function triage(apiCall=api,now=Date.now()){
 const [runs,issues]=await Promise.all([
  apiCall('actions/runs?per_page=100'),
  apiCall('issues?state=open&sort=updated&direction=desc&per_page=100')
 ]);
 const failures=(runs.workflow_runs||[]).filter(r=>actionable(r,now)).slice(0,32);
 const records=[];
 const seen=new Set();
 for(const run of failures){
  if(records.length===MAX_WRITES)break;
  const category=categoryFor(run.name),key=marker(run.name,category);
  // Inspect only the newest failure per workflow/category; stale runs
  // must not churn one Issue repeatedly or starve unrelated categories.
  if(seen.has(key))continue;
  seen.add(key);
  const old=(issues||[]).find(i=>!i.pull_request&&String(i.body||'').includes('<!-- '+key+' -->'));
  if(old&&String(old.body||'').includes('/actions/runs/'+run.id))continue;
  const detail=await apiCall('actions/runs/'+run.id+'/jobs?per_page=100').catch(()=>({jobs:[]}));
  const row={marker:key,name:run.name,category,sha:run.head_sha||'unknown',
   runId:run.id,url:run.html_url,at:new Date(now).toISOString(),
   pr:run.pull_requests?.[0]?.number||null,jobs:failedJobs(detail.jobs),
   status:'unresolved'};
  try{
   const response=old?
    await apiCall('issues/'+old.number,{method:'PATCH',body:{body:issueBody(row)}}):
    await apiCall('issues',{method:'POST',body:{
     title:'[auto-dev]['+category+'] '+clean(run.name,75),body:issueBody(row)}});
   row.issueUrl=response.html_url||old?.html_url||null;
   row.issueNumber=response.number||old?.number||null;
  }catch(error){row.status='issue_write_failed';row.error=clean(error,340)}
  records.push(row);
 }
 return {schemaVersion:1,at:new Date(now).toISOString(),failedRunsInspected:failures.length,
  issueWrites:records.length,sourceCodeFixes:0,androidFpsMeasured:false,
  artisticQualityApproved:false,records};
}
async function main(){
 if(process.env.GITHUB_REPOSITORY!==REPO)throw Error('Unexpected repository');
 const result=await triage();
 fs.mkdirSync('qa-reports/auto-dev',{recursive:true});
 fs.writeFileSync('qa-reports/auto-dev/triage.json',JSON.stringify(result,null,2)+'\n');
 console.log('AUTO_DEV_TRIAGE '+JSON.stringify(result));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
  '## 未知障害の自動引継ぎ\n'+result.records.map(r=>'- '+r.category+': '+r.url+' -> '+(r.issueUrl||r.status)).join('\n')+'\n');
 if(result.records.some(r=>r.status==='issue_write_failed'))process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)await main().catch(e=>{
 console.error(e);process.exitCode=1;
});
