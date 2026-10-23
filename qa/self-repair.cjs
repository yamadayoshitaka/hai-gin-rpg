// Bounded deterministic self-repair for known regressions, not an unrestricted AI editor.
const fs=require('node:fs'),cp=require('node:child_process');
const file='index.html', report='qa-screenshots/self-repair-report.json';
fs.mkdirSync('qa-screenshots',{recursive:true});
const repairs=[
 {name:'restore-3d-mesh', bad:"const useImportedAnimation=false;",good:"const useImportedAnimation=true;"},
 {name:'fix-hidden-three-d-model',bad:"obj.visible=hasMotionClips&&useImportedAnimation;",good:"obj.visible=true;"},
 {name:'remove-wall-material-reset',bad:"for(const [mesh,original] of faded){mesh.material=original;faded.delete(mesh);}",good:"const shouldFade=new Set();"},
 {name:'remove-too-fast-citizen-step',bad:"const step=n.pace*dt,dx=",good:"const step=Math.min(n.pace,1.45)*dt,dx="},
 {name:'align-ceiling-trim',bad:"place(grp,alongX?span:.24,.12,alongX?.24:span,timber,xx,wallH-.09,zz);",good:"// Ceiling edge uses integrated framing only."}
];
let log=[],original=fs.readFileSync(file,'utf8'),current=original;
function test(){const x=cp.spawnSync(process.execPath,['qa/movement.cjs'],{encoding:'utf8',timeout:180000});return {passed:x.status===0,exit:x.status,tail:(x.stdout+'\n'+x.stderr).slice(-5000)};}
for(let round=0;round<3;round++){
 const result=test();log.push({round,test:result});
 if(result.passed)break;
 let changed=false;
 for(const fix of repairs){if(current.includes(fix.bad)){current=current.replace(fix.bad,fix.good);log.push({round,repair:fix.name});changed=true;}}
 if(!changed)break;
 fs.writeFileSync(file,current);
}
const last=log.filter(x=>x.test).at(-1)?.test;
if(!last?.passed){fs.writeFileSync(file,original);log.push({rolledBack:true});}
fs.writeFileSync(report,JSON.stringify(log,null,2));
console.log(JSON.stringify(log.map(x=>x.test?{round:x.round,passed:x.test.passed,exit:x.test.exit}:x),null,2));
if(!last?.passed)process.exitCode=1;
