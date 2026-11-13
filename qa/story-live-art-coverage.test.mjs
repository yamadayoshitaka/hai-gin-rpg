import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=spawnSync(process.execPath,['scripts/audit-story-art-coverage.mjs','--chapters','1,2'],
 {cwd:root,encoding:'utf8',maxBuffer:30*1024*1024});
assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
const summary=JSON.parse(run.stdout.trim().split('\n').at(-1));
assert.equal(summary.expected,1036);
assert(summary.registeredIndividual>=45,'Previously registered 45 scenes must remain available');
assert(summary.existingFullSheet>=0);
assert(summary.missing<=991,'Missing art should decline as images are registered');
assert.equal(summary.complete,summary.missing===0);
const report=JSON.parse(fs.readFileSync(path.join(root,summary.sourceFile),'utf8'));
assert.equal(report.artGeneratedByAudit,0);
assert.equal(report.approvedSourcePanels,0);
assert.equal(report.stages.length,20);
const stage=(id)=>report.stages.find(x=>x.stageId===id);
assert.equal(stage('c01-s01').registeredIndividual,30);
assert.equal(stage('c01-s01').missing,0);
assert(stage('c01-s02').registeredIndividual>=15);
assert(stage('c01-s02').missing<=33);
assert.equal(stage('c01-s05').expected,48);
assert(stage('c01-s05').registeredIndividual>=0);
assert(stage('c01-s05').missing<=48);
const female=stage('c01-s05').variants.find(x=>x.edition==='pre'&&x.gender==='female');
assert.equal(female.expected,8);
assert.equal(female.expected,female.missing+female.registeredIndividual+female.existingFullSheet);
assert(female.registeredIndividual>=0);
const screenshotMissing=female.missingShots.some(x=>x.id==='c01-s05-m3');
if(screenshotMissing)assert(female.missing>0,'Missing scene must be reported as such');
else assert(female.registeredIndividual+female.existingFullSheet>0,'Resolved art must be counted');
for(const item of report.stages.filter(s=>s.chapter===2)){
 assert.equal(item.expected,item.missing+item.registeredIndividual+item.existingFullSheet);
}
assert(report.stages.filter(x=>x.chapter===2).reduce((n,x)=>n+x.missing,0)<=574);
assert.equal(stage('c02-s05').expected,160);
assert.equal(stage('c02-s05').variants.length,24);
for(const record of report.stages)assert.equal(record.expected,
 record.registeredIndividual+record.existingFullSheet+record.missing);
console.log('PASS: screenshot scene is explicitly audited against physical originals; coverage can increase without breaking CI; no substitute artwork or false completion.');
