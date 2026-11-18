#!/usr/bin/env node
/** Free, bounded source parameter search. No paid API, no AI model synthesis.
 * Candidate must (1) improve a measurable 3D geometry proxy, (2) pass real
 * source regressions, (3) pass two actual battle browser runs (FPS/P95/error)
 * and (4) preserve current-main ancestry. FF15 artistic quality is NEVER
 * inferred from a surrogate score. Outfit awaits an artistic reference.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const REPO='yamadayoshitaka/hai-gin-rpg';
const profilePath='src/character-system/quality-evolution-profile.js';
const logDir='qa-reports/quality-evolution';
const CAP=3;
const choices={
 face:{key:'eyeInsetRatio',min:.018,max:.040,offsets:[-.002,.002,-.004],
  tests:['qa/facehair-fivefold-cosmetics-braid.test.mjs',
   'qa/eyebrow-surface-regression.test.mjs']},
 hair:{key:'fringeRootScale',min:1,max:1.16,offsets:[.04,.08,-.04],
  tests:['qa/hair-camera-distance-stability.test.mjs',
   'qa/battle-studio-groom-policy.test.mjs']},
 outfit:{key:'fabricBumpScale',min:.9,max:1.1,offsets:[.03,-.03,.06],
  tests:['qa/outfit-surface-regression.test.mjs',
   'qa/battle-outfit-integration.test.mjs']}
};
export function candidateValues(domain,value){
 const spec=choices[domain];if(!spec||!Number.isFinite(value))throw Error('unknown tuning candidate');
 return [...new Set(spec.offsets.map(x=>Number((value+x).toFixed(4))))]
  .filter(x=>x>=spec.min&&x<=spec.max).slice(0,CAP);
}
export function scoreCandidate(domain,before,after){
 if(!before?.hardGate||!after?.hardGate||after.domain!==domain||before.domain!==domain)
  return {improved:false,reason:'actual generator hard gate failed'};
 if(!Number.isFinite(before.proxyScore)||!Number.isFinite(after.proxyScore))
  return {improved:false,reason:'no objective aesthetic reference for numeric scoring'};
 const gain=after.proxyScore-before.proxyScore;
 if(domain==='hair'){
  const original=before.metrics?.meshTriangles,changed=after.metrics?.meshTriangles;
  if(!(original>0&&changed>0)||changed>original*1.04)
   return {improved:false,reason:'hair geometry cost exceeds +4% safety budget',gain};
 }
 if(domain==='face'&&before.metrics?.faceTriangles!==after.metrics?.faceTriangles)
  return {improved:false,reason:'face topology changed unexpectedly',gain};
 if(gain<.20)return {improved:false,reason:'insufficient measurable geometry-proxy gain',gain};
 return {improved:true,gain,reason:'measurable geometry proxy improved, pending browser and visual gates'};
}
export function compareBrowser(baseline,candidate){
 const valid=x=>x&&x.status==='measured_ci_fps'&&
  x.environment==='github-actions-swiftshader-chromium'&&
  x.scenario==='50v50'&&Number.isFinite(x.fps)&&x.fps>0&&
  Number.isFinite(x.p95Ms)&&x.p95Ms>0&&
  Number.isFinite(x.runtimeErrors)&&x.runtimeErrors===0&&
  x.screenshotBytes>=10000&&x.webglContextLost!==true;
 if(!valid(baseline)||!valid(candidate))
  return {approved:false,reason:'unverified actual WebGL FPS, screenshot or runtime'};
 const checks={
  sameScenario:baseline.scenario===candidate.scenario,
  fpsWithinBudget:candidate.fps>=baseline.fps-2,
  p95WithinBudget:candidate.p95Ms<=baseline.p95Ms*1.05+1,
  drawCallsWithinBudget:!Number.isFinite(baseline.drawCalls)||
   !Number.isFinite(candidate.drawCalls)||
   candidate.drawCalls<=baseline.drawCalls*1.05+2
 };
 return {
  approved:Object.values(checks).every(Boolean),
  reason:Object.entries(checks).filter(([,ok])=>!ok).map(([name])=>name).join(', ')||
   'CI WebGL/FPS nonregression only; not physical Android FPS or FF15 image approval',
  fpsBefore:baseline.fps,fpsAfter:candidate.fps,
  p95Before:baseline.p95Ms,p95After:candidate.p95Ms,checks
 };
}
function run(bin,args,timeout=240000){
 const p=spawnSync(bin,args,{encoding:'utf8',timeout,maxBuffer:8*1024*1024});
 return {ok:p.status===0&&!p.error,out:((p.stdout||'')+'\n'+(p.stderr||'')).slice(-2500)};
}
const required=(bin,args)=>{
 const r=run(bin,args);if(!r.ok)throw Error(bin+' '+args.join(' ')+': '+r.out);
 return r.out.trim();
};
function evaluate(domain){
 const p=run('node',['qa/quality-evolution-probe.mjs',domain],240000);
 const match=/EVOLUTION_PROBE (\{[^\n]+\})/.exec(p.out);
 if(!match)throw Error('Missing actual 3D probe result: '+p.out.slice(-1200));
 return {result:JSON.parse(match[1]),ok:p.ok};
}
function readProfile(domain){
 const s=fs.readFileSync(profilePath,'utf8');
 const key=choices[domain].key;
 const re=new RegExp(domain+':Object\\.freeze\\(\\{'+key+':([0-9.]+)\\}\\)');
 const match=re.exec(s);
 if(!match)throw Error('Unknown profile source layout: '+domain);
 return {source:s,value:Number(match[1]),pattern:match[0],replace:v=>
  s.replace(match[0],domain+':Object.freeze({'+key+':'+v+'})')};
}
function browser(){
 const t=run('node',['qa/game-quality-browser.cjs','--lane=frame'],240000);
 const file='qa-reports/game-quality-six/browser-frame.json';
 if(!fs.existsSync(file))return {status:'missing',error:t.out.slice(-450)};
 try{return JSON.parse(fs.readFileSync(file,'utf8'))}
 catch{return {status:'malformed',error:t.out.slice(-450)}}
}
async function publishApprovedEvidence(){
 const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
 if(!token)throw Error('Missing token for verified improvement ledger');
 const route='contents/data/quality-evolution/history.json';
 const endpoint='https://api.github.com/repos/'+REPO+'/'+route;
 const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
  'Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'};
 for(let attempt=0;attempt<3;attempt++){
  const get=await fetch(endpoint+'?ref=main',{headers});
  if(!get.ok)throw Error('Cannot read current score ledger: '+get.status);
  const stored=await get.json();
  const ledger=JSON.parse(Buffer.from(stored.content.replace(/\\s/g,''),'base64').toString('utf8'));
  if(ledger.schemaVersion!==1||!Array.isArray(ledger.acceptedChanges))
   throw Error('Unknown score ledger schema');
  const record={sourceSha:report.sourceCommitSha,at:report.startedAt,
   domain:report.domain,baselineValue:report.baseline?.profile,
   adoptedValue:report.selected?.value,sourcePaths:report.changedSourceFiles,
   proxyBefore:report.baseline?.proxyScore,proxyAfter:report.selected?.proxyScore,
   proxyGain:report.selected?.gain,gameFpsBaseline:report.browserGate?.fpsBefore,
   gameFpsCandidate:report.browserGate?.fpsAfter,
   gameP95Baseline:report.browserGate?.p95Before,
   gameP95Candidate:report.browserGate?.p95After,
   webglPassed:report.browserGate?.approved===true,
   artisticQualityApproved:false,androidFpsMeasured:false,
   note:'Objective geometry surrogate improved; FF15 aesthetic quality NOT assessed'};
  if(!ledger.acceptedChanges.some(x=>x.sourceSha===record.sourceSha))
   ledger.acceptedChanges.push(record);
  ledger.acceptedChanges=ledger.acceptedChanges.slice(-70);
  ledger.lastPublishedBy=record.sourceSha;
  const response=await fetch(endpoint,{method:'PUT',headers,body:JSON.stringify({
   branch:'main',sha:stored.sha,
   message:'chore(quality): record verified 3D geometry and CI FPS evolution evidence',
   content:Buffer.from(JSON.stringify(ledger,null,2)+'\\n').toString('base64')
  })});
  if(response.ok)return (await response.json()).commit?.sha;
  if(attempt===2||![409,422].includes(response.status))
   throw Error('Score ledger update rejected: '+response.status);
 }
 return null;
}
function save(report){
 fs.mkdirSync(logDir,{recursive:true});
 fs.writeFileSync(path.join(logDir,'latest.json'),JSON.stringify(report,null,2)+'\n');
 console.log('EVOLUTION_RESULT '+JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
   '## Continuous 3D quality evolution\n- Domain: '+report.domain+
   '\n- Outcome: '+report.status+
   '\n- Candidates tested: '+report.candidates.length+
   '\n- Real source SHA: '+(report.sourceCommitSha||'none')+
   '\n- WebGL/FPS gate: '+(report.browserGate?.reason||'not run')+
   '\n- Artistic quality: NOT APPROVED; physical Android FPS: NOT MEASURED\n');
}
const report={schemaVersion:1,mode:'bounded-free-parameter-search',
 domain:process.env.QUALITY_DOMAIN||'face',
 startedAt:new Date().toISOString(),baselineSha:null,sourceCommitSha:null,
 baseline:null,candidates:[],selected:null,browserGate:null,
 status:'starting',artisticQualityApproved:false,androidFpsMeasured:false,
 changedSourceFiles:[],releasedSha:null};
const original=fs.readFileSync(profilePath,'utf8');
async function main(){
 try{
  const domain=report.domain;
  if(!choices[domain])throw Error('Invalid domain');
  const switches=JSON.parse(fs.readFileSync('data/batch-center-switches.json','utf8'));
  const group=domain==='face'||domain==='hair'?'faceHair':'outfit';
  if(switches.groups?.gameQuality?.enabled!==true||switches.groups?.[group]?.enabled!==true){
   report.status='disabled_by_batch_center';return;
  }
  if(process.env.GITHUB_EVENT_NAME==='pull_request'){
   report.status='read_only_pr';return;
  }
  const prof=readProfile(domain);
  const pre=evaluate(domain);
  report.baseline=pre.result;
  if(!pre.ok){report.status='baseline_generator_failed';return}
  const baselineQA=run('node',['--test',...choices[domain].tests],240000);
  if(!baselineQA.ok){report.status='baseline_regression_failed';report.error=baselineQA.out;return}
  // Measure before changing source. The CI GPU is deliberately identified as
  // SwiftShader and is NEVER reported as Android FPS.
  const baselineBrowser=browser();
  report.baselineBrowser=baselineBrowser;
  let best=null;
  for(const value of candidateValues(domain,prof.value)){
   fs.writeFileSync(profilePath,prof.replace(value));
   try{
    const measurement=evaluate(domain);
    const scored=scoreCandidate(domain,pre.result,measurement.result);
    const record={value,proxyScore:measurement.result.proxyScore,
     metrics:measurement.result.metrics,hardGate:measurement.ok,
     gain:scored.gain??null,decision:scored.reason,status:'rejected'};
    if(measurement.ok&&scored.improved){
     const staticQA=run('node',['--test',...choices[domain].tests],240000);
     record.qaPassed=staticQA.ok;
     if(staticQA.ok){
      const perf=browser();
      record.browser=perf;
      record.browserGate=compareBrowser(baselineBrowser,perf);
      if(record.browserGate.approved){
       record.status='accepted_candidate';
       if(!best||record.gain>best.gain)best=record;
      }else record.status='blocked_browser_or_fps';
     }else{record.status='regression_failed';record.qaError=staticQA.out}
    }
    report.candidates.push(record);
   }catch(error){report.candidates.push({value,status:'probe_exception',error:String(error).slice(0,600)})}
   finally{fs.writeFileSync(profilePath,original)}
  }
  if(!best){
   report.status='no_safe_measured_improvement';
   report.note='All candidate scores are proxies, not finished character art. No commit without actual browser FPS.';
   return;
  }
  report.selected=best;
  report.browserGate=best.browserGate;
  fs.writeFileSync(profilePath,prof.replace(best.value));
  const integrity=run('node',['--check',profilePath]);
  const finalQA=run('node',['--test',...choices[domain].tests],240000);
  if(!integrity.ok||!finalQA.ok)throw Error('Final candidate regression failed');
  const modified=required('git',['diff','--name-only']).split('\n').filter(Boolean);
  if(modified.length!==1||modified[0]!==profilePath)
   throw Error('Unexpected changed source path: '+modified.join(','));
  required('git',['diff','--check']);
  if(process.env.GITHUB_REPOSITORY!==REPO)
   throw Error('Refusing untrusted repository');
  required('git',['fetch','--no-tags','origin','main']);
  report.baselineSha=required('git',['rev-parse','origin/main']);
  if(required('git',['rev-parse','HEAD'])!==report.baselineSha){
   report.status='main_moved';return;
  }
  required('git',['config','user.name','github-actions[bot]']);
  required('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);
  required('git',['add','--',profilePath]);
  required('git',['commit','-m','feat(quality): measured '+domain+' geometry proxy gain with CI WebGL FPS guard']);
  const sourceSha=required('git',['rev-parse','HEAD']);
  const push=run('git',['push','origin','HEAD:main'],90000);
  if(!push.ok){report.status='main_push_rejected';report.error=push.out;return}
  report.sourceCommitSha=sourceSha;
  report.changedSourceFiles=[profilePath];
  report.status='committed_measured_proxy_improvement';
  try{
   report.ledgerCommitSha=await publishApprovedEvidence();
  }catch(error){
   report.ledgerError=String(error.message||error).slice(0,500);
   report.status='committed_ledger_failed';
  }
  // Preserve successful source commit even if the independent Pages release
  // dispatch later fails; this cannot be called visually approved.
  const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
  if(token){
   const resp=await fetch('https://api.github.com/repos/'+REPO+
    '/actions/workflows/publish-pages.yml/dispatches',{
      method:'POST',headers:{Authorization:'Bearer '+token,
      Accept:'application/vnd.github+json','Content-Type':'application/json'},
      body:JSON.stringify({ref:'main'})
    });
   if(!resp.ok){report.status='committed_pages_dispatch_failed';report.error='GitHub Pages dispatch '+resp.status}
   else report.pagesDispatch='requested';
  }
 }catch(error){report.status='error';report.error=String(error.stack||error).slice(0,1100)}
 finally{
  fs.writeFileSync(profilePath,original);
  save(report);
  if(process.env.GITHUB_OUTPUT){
   fs.appendFileSync(process.env.GITHUB_OUTPUT,'changed='+(report.sourceCommitSha?'true':'false')+'\n');
   if(report.sourceCommitSha)fs.appendFileSync(process.env.GITHUB_OUTPUT,'source_sha='+report.sourceCommitSha+'\n');
  }
  if(report.status==='error'||report.status==='committed_pages_dispatch_failed'||report.status==='committed_ledger_failed')
   process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve('scripts/quality-evolution-loop.mjs')){
 await main();
}
