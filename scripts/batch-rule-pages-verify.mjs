#!/usr/bin/env node
/** Verify that the Pages CDN serves a commit containing the SOURCE fix.
 * The request itself is not evidence of deployment. No model quality claims.
 */
import fs from 'node:fs';
const source=process.argv.find(x=>/^--source=[0-9a-f]{40}$/.test(x))?.slice(9);
const repo=process.env.GITHUB_REPOSITORY||'yamadayoshitaka/hai-gin-rpg';
if(!source||repo!=='yamadayoshitaka/hai-gin-rpg')throw Error('Need exact repair source SHA and canonical repo');
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
const url='https://yamadayoshitaka.github.io/hai-gin-rpg/release.json';
async function get(u,github=false){
 const r=await fetch(u,{headers:{
  'Accept':'application/json','Cache-Control':'no-cache',
  ...(github&&token?{Authorization:'Bearer '+token}:{})
 }});
 if(!r.ok)throw Error(r.status+' '+u);
 return r.json();
}
async function verifiesAncestry(pagesSha){
 if(source===pagesSha)return true;
 const data=await get('https://api.github.com/repos/'+repo+'/compare/'+source+'...'+pagesSha,true);
 return (data.status==='ahead'||data.status==='identical')&&
  Number.isInteger(data.ahead_by)&&data.ahead_by>=0;
}
const audit={sourceSha:source,startedAt:new Date().toISOString(),publishedSha:null,
 status:'pending',attempts:0,qualityClaim:false};
for(let attempt=1;attempt<=30;attempt++){
 audit.attempts=attempt;
 try{
  const release=await get(url+'?repairSha='+source.slice(0,12)+'-'+attempt);
  if(/^[0-9a-f]{40}$/.test(release.sha||'')&&await verifiesAncestry(release.sha)){
   audit.status='deployed_source_verified';audit.publishedSha=release.sha;
   break;
  }
 }catch(e){audit.lastError=String(e.message||e).slice(0,190)}
 if(attempt<30)await new Promise(resolve=>setTimeout(resolve,6000));
}
fs.mkdirSync('qa-reports/batch-rule-self-heal',{recursive:true});
fs.writeFileSync('qa-reports/batch-rule-self-heal/pages-check.json',JSON.stringify(audit,null,2)+'\n');
if(process.env.GITHUB_STEP_SUMMARY)
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,'- Pages source commit verification: '+audit.status+
  '\n- Repaired SHA: '+source+'\n- Published SHA: '+(audit.publishedSha||'NOT VERIFIED')+'\n');
console.log('RULE_PAGES_CHECK '+JSON.stringify(audit));
if(audit.status!=='deployed_source_verified')process.exitCode=1;
