#!/usr/bin/env node
/** Owner-authorized self-driving bridge: move SOURCE changes from the latest
 * same-repository PR heads onto current main, without ever resetting the
 * current 60-object catalog or confusing static QA with visual approval.
 * Only a bounded, path-allowlisted, conflict-free source patch can publish.
 * This is not an AI mesh generator. Unsolvable conflicts become an actionable
 * issue for the existing hourly code-editing ChatGPT tasks.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const REPO='yamadayoshitaka/hai-gin-rpg';
const GROUPS=['faceHair','outfit','creatureMonster','world','anime'];
export const PROTECTED_WORLD_FILES=Object.freeze([
 'object-list.html','src/tree-seasons.js','data/world-quality/catalog-targets.json',
 'data/world-quality/production-model-adoption.json'
]);
const protectedSet=new Set(PROTECTED_WORLD_FILES);
export function categoryFromMinute(minute){
 return ({7:'faceHair',22:'outfit',37:'creatureMonster',52:'world',57:'anime'})[minute]||'faceHair';
}
export function isAllowedSource(group,file){
 if(!file||file.startsWith('/')||file.includes('..')||protectedSet.has(file))return false;
 const rules={
  faceHair:/^(src\/(?:face-[\w-]+|independent-face-masters|hero-hair-controls-v43|character-system\/(?:hair-attachment-runtime|battle-visual-pipeline))\.js)$/,
  outfit:/^(src\/(?:outfit-maintenance-model|character-system\/(?:rigged-outfit-runtime|garment-coverage-runtime|outfit-surface-policy))\.js)$/,
  creatureMonster:/^(src\/(?:creature-[\w-]+|avian-guardian-sculpt|monster-summon-renderer|monster-[\w-]+)\.js)$/,
  world:/^src\/object-catalog\.js$/,
  anime:/^NOT_SAFE_TO_AUTO_WRITE_IMAGES$/
 };
 return !!rules[group]?.test(file);
}
export function eligiblePr(pr,group){
 if(!pr||pr.state!=='open'||pr.base?.ref!=='main'||pr.head?.repo?.full_name!==REPO||pr.user?.login!=='yamadayoshitaka')return false;
 if(!/^[0-9a-f]{40}$/.test(pr.head.sha||''))return false;
 const value=(pr.title||'')+' '+(pr.head.ref||'');
 const patterns={
  faceHair:/face.?hair|scalp|headwear|face.hair|hair|wig|顔|頭皮/i,
  outfit:/outfit|wardrobe|garment|armor|costume|cape|衣装|鎧|マント/i,
  creatureMonster:/creature|monster|summon|avian|wolf|feline|beast|モンスター|召喚/i,
  world:/world|object|joinery|prop|door|furniture|木組み|オブジェクト/i,
  anime:/anime|manga|story|comic|chapter|漫画|物語/i
 };
 return patterns[group]?.test(value)===true;
}
export function pickSources(group,files){
 return files.filter(x=>x.status==='modified'&&isAllowedSource(group,x.filename))
  .map(x=>x.filename).sort();
}
export function canPublish({changed,protectedPathsPreserved,syntaxOk,mainUnchanged,headUnchanged,worldIdsPreserved}){
 return changed>0&&protectedPathsPreserved&&syntaxOk&&mainUnchanged&&headUnchanged&&worldIdsPreserved;
}
function command(bin,args,options={}){
 const result=spawnSync(bin,args,{cwd:ROOT,encoding:'utf8',timeout:180000,maxBuffer:24*1024*1024,...options});
 if(result.error||result.status!==0)throw Error([bin,...args].join(' ')+' failed: '+(result.stderr||result.stdout||result.error||'unknown').slice(-1600));
 return result.stdout.trim();
}
function tryCommand(bin,args,options={}){
 const result=spawnSync(bin,args,{cwd:ROOT,encoding:'utf8',timeout:180000,maxBuffer:24*1024*1024,...options});
 return {ok:result.status===0&&!result.error,out:(result.stdout||'')+'\n'+(result.stderr||''),status:result.status};
}
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
async function api(route,{method='GET',body=null}={}){
 if(!token)throw Error('GITHUB_TOKEN missing');
 const result=await fetch('https://api.github.com/repos/'+REPO+'/'+route,{
  method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 const text=await result.text();
 if(!result.ok)throw Error('GitHub '+result.status+' '+route+' '+text.slice(0,240));
 return text?JSON.parse(text):null;
}
function allWorldIds(){
 return JSON.parse(command('node',['--input-type=module','-e',
  "import {OBJECT_CATALOG} from './src/object-catalog.js'; console.log(JSON.stringify(Object.keys(OBJECT_CATALOG).sort()))"]));
}
function sourceSanity(group,files,beforeWorldIds){
 for(const file of files){
  if(!isAllowedSource(group,file))return {ok:false,reason:'blocked path: '+file};
  const check=tryCommand('node',['--check',file]);
  if(!check.ok)return {ok:false,reason:'JS syntax: '+file+' '+check.out.slice(-500)};
 }
 if(group==='world'){
  try{
   const after=allWorldIds();
   if(JSON.stringify(after)!==JSON.stringify(beforeWorldIds))
    return {ok:false,reason:'object ID catalog changed from current main'};
  }catch(e){return {ok:false,reason:'world catalog cannot be imported: '+e.message}}
 }
 return {ok:true};
}
function qualityChecks(group){
 const suites={
  faceHair:['qa/studio-model-route-contract.test.mjs','qa/character-six-lane-contract.test.mjs'],
  outfit:['qa/studio-model-route-contract.test.mjs','qa/garment-coverage-regression.test.mjs'],
  creatureMonster:['qa/creature-six-lane-contract.test.mjs'],
  world:['qa/object-list-catalog.test.mjs','qa/world-object-physical-quality.test.mjs']
 };
 if(!suites[group])return {status:'not_run'};
 const result=tryCommand('node',['--test',...suites[group]],{timeout:240000});
 return {status:result.ok?'passed':'failed',detail:result.ok?'':result.out.slice(-900)};
}
async function recordIssue(group,report){
 if(process.env.DRY_RUN==='1')return null;
 const title='[hai-gin-self-drive] '+group+' latest-main patch recovery';
 try{
  const issues=await api('issues?state=open&per_page=100');
  const existing=issues.find(x=>x.title===title&&!x.pull_request);
  const body=['# 自走バッチ｜最新mainに差分統合できなかった原因',
   'Category: '+group,'Main SHA: '+report.mainSha,
   'Last check: '+report.startedAt,'',
   'Attempts:',...(report.attempts||[]).map(x=>
    '- PR #'+x.pr+' '+x.sha+' '+x.status+': '+String(x.reason||'').slice(0,350)),
   '','次のChatGPT定期改修はこのIssueから、mainの現行コードと候補PRの**必要な3D差分のみ**を読み、衝突原因をコード修正して別ブランチへコミット。オブジェクト一覧・ID・protected m005/m006と漫画の人物同一性を保持すること。',
   '静的QAが失敗しても公開可能。ただし破損コード、ID欠損、衝突の自動採用は禁止。',
   '新規GLB・実画面品質・Android FPSは未確認。'].join('\n');
  if(existing){await api('issues/'+existing.number,{method:'PATCH',body:{body}});return existing.html_url}
  const created=await api('issues',{method:'POST',body:{title,body}});
  return created.html_url;
 }catch(e){report.issueError=String(e.message||e);return null}
}
function resetToMain(){
 command('git',['reset','--hard','origin/main']);
 command('git',['clean','-fd','--','src','qa-reports/batch-self-drive']);
}
const report={schemaVersion:1,startedAt:new Date().toISOString(),mainSha:null,
 category:null,status:'starting',sourceCommits:0,modelChanges:0,glbsGenerated:0,
 androidFpsVerified:false,webglApproved:false,pagesSha:null,attempts:[]};
async function run(){
 if(process.env.GITHUB_REPOSITORY!==REPO)throw Error('Refusing unexpected repo');
 const group=process.env.INPUT_CATEGORY&&GROUPS.includes(process.env.INPUT_CATEGORY)
  ?process.env.INPUT_CATEGORY:categoryFromMinute(new Date().getUTCMinutes());
 report.category=group;
 const switches=JSON.parse(fs.readFileSync(path.join(ROOT,'data/batch-center-switches.json'),'utf8'));
 if(switches.groups?.[group]?.enabled!==true){report.status='disabled';return}
 command('git',['fetch','--no-tags','origin','main']);
 const main=command('git',['rev-parse','origin/main']);report.mainSha=main;
 command('git',['config','user.name','github-actions[bot]']);
 command('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
 // No image bytes should ever be guessed. The owner-approved ChatGPT manga
 // task handles original image production and character identity manually.
 if(group==='anime'){
  report.status='art_generation_not_automatable_in_actions';
  report.note='No valid rendered image bytes available in GitHub Actions. Keep ChatGPT art generation and Free quota separate.';
  return;
 }
 const all=await api('pulls?state=open&sort=updated&direction=desc&per_page=100');
 const prs=all.filter(x=>eligiblePr(x,group)).slice(0,12);
 report.candidateCount=prs.length;
 if(!prs.length){report.status='no_open_source_pr';return}
 const beforeWorldIds=group==='world'?allWorldIds():null;
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'hai-gin-self-drive-'));
 try{
 for(const pr of prs){
  const attempt={pr:pr.number,sha:pr.head.sha,branch:pr.head.ref,status:'inspect',reason:''};
  report.attempts.push(attempt);
  try{
   if(pr.head.repo.full_name!==REPO)throw Error('external PR rejected');
   const prfiles=await api('pulls/'+pr.number+'/files?per_page=100');
   if(prfiles.length>=100)throw Error('too many changed files; manual review required');
   const source=pickSources(group,prfiles);
   if(!source.length){attempt.status='no_applicable_source';continue}
   if(source.length>4){attempt.status='too_many_source_files';attempt.reason=source.join(', ');continue}
   attempt.sourceFiles=source;
   const fetched=tryCommand('git',['fetch','--no-tags','origin',
    '+refs/pull/'+pr.number+'/head:refs/remotes/origin/selfdrive-'+pr.number]);
   if(!fetched.ok)throw Error('PR fetch failed: '+fetched.out.slice(-300));
   const candidate=command('git',['rev-parse','refs/remotes/origin/selfdrive-'+pr.number]);
   if(candidate!==pr.head.sha)throw Error('PR HEAD advanced since GitHub API snapshot');
   const base=command('git',['merge-base',main,candidate]);
   if(!base||base===candidate){attempt.status='already_in_main';continue}
   const diff=command('git',['diff','--binary','--no-ext-diff',base,candidate,'--',...source]);
   if(!diff){attempt.status='no_patch';continue}
   resetToMain();
   const patch=path.join(work,'candidate-'+pr.number+'.patch');fs.writeFileSync(patch,diff+'\n');
   const applied=tryCommand('git',['apply','--index','--3way',patch]);
   if(!applied.ok){
    attempt.status='conflict';attempt.reason=applied.out.slice(-700);resetToMain();continue;
   }
   const changed=command('git',['diff','--cached','--name-only']).split('\n').filter(Boolean);
   if(!changed.length){attempt.status='already_applied';resetToMain();continue}
   const protectedPathsPreserved=changed.every(file=>isAllowedSource(group,file));
   const safety=sourceSanity(group,changed,beforeWorldIds);
   attempt.safety=safety;
   if(!canPublish({changed:changed.length,protectedPathsPreserved,syntaxOk:safety.ok,
    mainUnchanged:true,headUnchanged:true,worldIdsPreserved:safety.ok})){
    attempt.status='safety_rejected';attempt.reason=safety.reason;resetToMain();continue;
   }
   const qa=qualityChecks(group);attempt.qa=qa;
   // The owner has permitted optional quality QA failures; syntax and world ID
   // integrity remain hard gates. A red QA is never reported as a pass.
   command('git',['commit','-m','fix('+group+'): reconcile PR #'+pr.number+' source with latest main']);
   attempt.commitSha=command('git',['rev-parse','HEAD']);
   const checked=await api('pulls/'+pr.number);
   command('git',['fetch','--no-tags','origin','main']);
   const latest=command('git',['rev-parse','origin/main']);
   const mainUnchanged=latest===main;
   const headUnchanged=checked.head.sha===pr.head.sha&&checked.state==='open';
   if(!mainUnchanged||!headUnchanged){
    attempt.status='raced';attempt.reason='main or PR advanced; will reconstruct patch on next run';resetToMain();continue;
   }
   attempt.status='commit_ready';
   const pushed=tryCommand('git',['push','origin','HEAD:main'],{timeout:90000});
   if(pushed.ok){
    attempt.status='merged_to_main';report.status='source_committed_main';
    report.sourceCommits=1;report.modelChanges=changed.length;
    report.mainAfter=attempt.commitSha;report.pr=pr.number;report.qa=qa.status;
    // A push authenticated with GITHUB_TOKEN does not trigger other push
    // workflows. Explicit workflow_dispatch is required to publish this
    // newly created commit. Never mark Pages success until verified.
    try{
     await api('actions/workflows/publish-pages.yml/dispatches',{method:'POST',body:{ref:'main'}});
     report.pagesDispatch='requested';
     report.note='Explicit Pages workflow_dispatch requested; release SHA and visual quality not yet verified.';
    }catch(error){
     report.pagesDispatch='failed';
     report.pagesError=String(error.message||error);
     report.note='Source committed to main, but Pages dispatch failed and must be retried.';
    }
    return;
   }
   // A branch is a durable artifact when main write permissions are restricted.
   const branch='batch/self-drive-'+group.toLowerCase()+'-'+pr.number+'-'+process.env.GITHUB_RUN_ID;
   const branchPush=tryCommand('git',['push','origin','HEAD:refs/heads/'+branch],{timeout:90000});
   if(!branchPush.ok)throw Error('Failed both main and work-branch push: '+pushed.out.slice(-160)+' '+branchPush.out.slice(-160));
   report.sourceCommits=1;report.modelChanges=changed.length;
   report.status='source_committed_work_branch';
   report.branch=branch;report.pr=pr.number;report.qa=qa.status;
   attempt.status='work_branch_saved';attempt.reason='Main push unavailable: '+pushed.out.slice(-260);
   try{
    const created=await api('pulls',{method:'POST',body:{title:'fix('+group+'): reconcile PR #'+pr.number+' to newest main',head:branch,base:'main',body:
     'Owner-authorized bounded source-port. Safety checks passed. Optional QA: '+qa.status+
     '. Original PR: #'+pr.number+'. Visual/Android quality not yet approved; never claim FF15 complete.'}});
    report.reviewPr=created.html_url;
   }catch(e){report.prError=String(e.message||e)}
   return;
  }catch(e){
   attempt.status='error';attempt.reason=String(e.message||e).slice(0,600);
   try{resetToMain()}catch{}
  }
 }
 report.status='blocked_candidates';
 report.issueUrl=await recordIssue(group,report);
 }finally{fs.rmSync(work,{recursive:true,force:true});}
}
async function main(){
 try{await run()}catch(e){report.status='error';report.error=String(e.stack||e)}
 finally{
  const output=path.join(ROOT,'qa-reports/batch-self-drive');
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'latest.json'),JSON.stringify(report,null,2)+'\n');
  const summary=process.env.GITHUB_STEP_SUMMARY;
  if(summary)fs.appendFileSync(summary,
   '## Autonomous source recovery\n'+
   '- Category: '+report.category+'\n- Main baseline: '+report.mainSha+
   '\n- Status: '+report.status+'\n- Source commits: '+report.sourceCommits+
   '\n- Actual modified source files: '+report.modelChanges+
   '\n- New GLB bytes: 0; WebGL approval: NOT verified; mobile FPS: NOT verified'+
   '\n- Last issue: '+(report.issueUrl||'none')+'\n');
  console.log(JSON.stringify(report));
  if(report.status==='error')process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main();
