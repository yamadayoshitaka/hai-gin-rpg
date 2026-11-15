#!/usr/bin/env node
/** Report owner-issued, one-shot GitHub QA to the originating Issue.
 * A QA result is NOT a 3D repair, a generated asset, a PR, or a deployment.
 */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parseRequest} from './manual-hourly-batch-dispatch.mjs';

const CATEGORIES=new Set(['human','monster','world','anime']);
export function parseFeedbackContext(event,metadata){
  if(metadata.eventName!=='workflow_dispatch')return null;
  const raw=String(event?.inputs?.batch_issue||'');
  if(!/^[1-9][0-9]{0,7}$/.test(raw))return null; // No batch_issue = normal QA run.
  const category=String(metadata.category||'');
  if(!CATEGORIES.has(category))throw Error('Unsupported quality batch category');
  const status=String(metadata.status||'');
  if(!['success','failure','cancelled'].includes(status))
    throw Error('Unsupported QA job status');
  const stage=String(metadata.stage||'qa');
  if(!/^[a-z][a-z0-9-]{0,39}$/.test(stage))throw Error('Invalid QA stage');
  if(!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(metadata.repo||''))
    throw Error('Invalid repository');
  if(!/^[0-9]{1,20}$/.test(String(metadata.runId||'')))throw Error('Invalid workflow run');
  return {issueNumber:Number(raw),category,status,stage,
    repo:metadata.repo,runId:String(metadata.runId),
    attempt:String(metadata.attempt||'1')};
}
export function validateOriginIssue(issue,ctx,owner){
  if(issue?.pull_request)throw Error('Batch instruction must be an Issue, not a PR');
  const command=parseRequest(issue,owner);
  if(command.category!==ctx.category)throw Error('Batch category mismatch');
  if(issue.number!==ctx.issueNumber)throw Error('Batch Issue number mismatch');
  return command;
}
export function formatQAComment(ctx){
  const url='https://github.com/'+ctx.repo+'/actions/runs/'+ctx.runId;
  const key=ctx.category+'-'+ctx.runId+'-'+ctx.attempt+'-'+ctx.stage;
  const passed=ctx.status==='success';
  return [
    '<!-- hai-gin-batch-qa-v1:'+key+' -->',
    '### バッチ引継ぎ：'+ctx.category+' / '+ctx.stage,
    '- 結果：'+(passed?'QA成功':'QA '+ctx.status),
    '- 実行証跡：'+url,
    '- 依頼Issue：#'+ctx.issueNumber,
    '- ChatGPTへの引継ぎ：次回の対象別定期実行が本Issue・QA証跡を読んで実修正を判断',
    '- 実コード変更・PR・マージ・公開：**このQAだけでは未完了**',
    '- 処理済み印（MANUAL_BATCH_HANDLED）：**付与しない**。実改修と検証完了後のみ付ける',
    '- 品質ゲート：実WebGL・関連テスト未確認なら自動マージ・デプロイ禁止',
    '',
    '※ QA成功は見た目の品質改善達成を意味しません。'
  ].join('\n');
}
function gh(args){
  const result=spawnSync('gh',args,{encoding:'utf8',timeout:30000,env:process.env});
  if(result.status!==0)throw Error('GitHub response failed: '+String(result.stderr||result.stdout).slice(0,600));
  return JSON.parse(result.stdout);
}
if(process.argv[1]?.endsWith('batch-qa-report.mjs')){
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const ctx=parseFeedbackContext(event,{
    eventName:process.env.GITHUB_EVENT_NAME,category:process.env.BATCH_CATEGORY,
    status:process.env.QA_JOB_STATUS,stage:process.env.QA_STAGE,
    repo:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,
    attempt:process.env.GITHUB_RUN_ATTEMPT
  });
  if(!ctx){console.log('No issue-linked workflow_dispatch request; QA feedback skipped.');process.exit(0);}
  const owner=process.env.GITHUB_REPOSITORY_OWNER;
  const issue=gh(['api','repos/'+ctx.repo+'/issues/'+ctx.issueNumber]);
  validateOriginIssue(issue,ctx,owner);
  const marker='<!-- hai-gin-batch-qa-v1:'+ctx.category+'-'+ctx.runId+'-'+ctx.attempt+'-'+ctx.stage+' -->';
  const comments=gh(['api','repos/'+ctx.repo+'/issues/'+ctx.issueNumber+'/comments?per_page=100']);
  if(comments.some(c=>String(c.body||'').includes(marker))){
    console.log('Idempotent QA feedback already recorded on Issue #'+ctx.issueNumber);
    process.exit(0);
  }
  const body=formatQAComment(ctx);
  gh(['api','--method','POST','repos/'+ctx.repo+'/issues/'+ctx.issueNumber+'/comments','-f','body='+body]);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,body+'\n');
  console.log('QA feedback recorded on owner Issue #'+ctx.issueNumber);
}
