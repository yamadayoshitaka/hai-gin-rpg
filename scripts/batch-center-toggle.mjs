#!/usr/bin/env node
/** Handle a GitHub Issue from the repository owner as an authenticated batch center switch.
 * No client-side token or public unauthenticated mutation. State changes only when
 * the owner submits the prefilled issue and this workflow succeeds.
 */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
export const MARKER='<!-- hai-gin-batch-switch-v1 -->';
export const CATEGORIES=Object.freeze(['human','monster','world','anime','faceHair','outfit','creatureMonster','creatureSummon']);
const PATH='data/batch-center-switches.json';
// Retired source groups can stay in history; live split groups use their own switches.

export function parseToggleIssue(issue, owner){
  if(!issue||issue.user?.login!==owner||!String(issue.title).startsWith('[hai-gin-switch] '))
    throw Error('Switch request must be submitted by the repository owner');
  const body=String(issue.body||'');
  if(!body.startsWith(MARKER+'\n'))throw Error('Invalid switch marker');
  const match=body.match(/```json\s*([\s\S]*?)\s*```/);
  if(!match)throw Error('Missing switch payload');
  const data=JSON.parse(match[1]);
  if(!CATEGORIES.includes(data.category)||typeof data.enabled!=='boolean')
    throw Error('Invalid batch category or enabled value');
  if(Object.keys(data).sort().join(',')!=='category,enabled')
    throw Error('Unexpected batch switch fields');
  return {category:data.category,enabled:data.enabled};
}
export function applyToggle(state,toggle,metadata){
  if(!state||state.schemaVersion!==1||!state.groups||
     !CATEGORIES.every(k=>typeof state.groups[k]?.enabled==='boolean'))
    throw Error('Unrecognized batch switch registry');
  return {...state, groups:{...state.groups,
    [toggle.category]:{enabled:toggle.enabled,updatedAt:metadata.updatedAt,
      issueNumber:metadata.issueNumber}}};
}
function gh(args,input){
  const r=spawnSync('gh',args,{encoding:'utf8',input,timeout:35000,env:process.env});
  if(r.status!==0)throw Error('GitHub API update failed: '+String(r.stderr||r.stdout).slice(0,800));
  return JSON.parse(r.stdout);
}
function postStatus(number,message){
  const r=spawnSync('gh',['issue','comment',String(number),'--body',message],{
    encoding:'utf8',timeout:20000,env:{...process.env,GH_REPO:process.env.GITHUB_REPOSITORY}});
  if(r.status!==0)process.stderr.write('Issue comment failed: '+r.stderr);
}
if(process.argv[1]?.endsWith('batch-center-toggle.mjs')){
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const toggle=parseToggleIssue(event.issue,process.env.GITHUB_REPOSITORY_OWNER);
  const endpoint='repos/'+process.env.GITHUB_REPOSITORY+'/contents/'+PATH;
  let updated=false;
  for(let i=0;i<3&&!updated;i++){
    const entry=gh(['api',endpoint,'-H','Accept: application/vnd.github+json']);
    const state=JSON.parse(Buffer.from(entry.content,'base64').toString('utf8'));
    const next=applyToggle(state,toggle,{
      updatedAt:new Date().toISOString(),issueNumber:event.issue.number});
    const payload={message:'ops(batch): '+toggle.category+' '+(toggle.enabled?'enable':'pause')+
      ' via owner issue #'+event.issue.number,content:Buffer.from(JSON.stringify(next,null,2)+'\n').toString('base64'),sha:entry.sha,branch:'main'};
    try{gh(['api','--method','PUT',endpoint,'-H','Accept: application/vnd.github+json','--input','-'],JSON.stringify(payload));updated=true}
    catch(error){if(i===2)throw error;}
  }
  const line=toggle.category+' = '+(toggle.enabled?'ON':'OFF')+
    ' (effective for work that reads data/batch-center-switches.json).';
  postStatus(event.issue.number,'バッチセンターの切替設定を保存しました。'+line+
    '\n注意：ChatGPTのタスク自体のON/OFFとGitHubで保存する実行制御は別です。');
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '# Batch center switch\n'+line+'\n');
  process.stdout.write(line+'\n');
}
