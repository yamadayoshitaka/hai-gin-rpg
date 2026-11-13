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
assert.equal(summary.registeredIndividual,45);
assert.equal(summary.existingFullSheet,0);
assert.equal(summary.missing,991);
assert.equal(summary.complete,false);
const report=JSON.parse(fs.readFileSync(path.join(root,summary.sourceFile),'utf8'));
assert.equal(report.artGeneratedByAudit,0);
assert.equal(report.approvedSourcePanels,0);
assert.equal(report.stages.length,20);
const stage=(id)=>report.stages.find(x=>x.stageId===id);
assert.equal(stage('c01-s01').registeredIndividual,30);
assert.equal(stage('c01-s01').missing,0);
assert.equal(stage('c01-s02').registeredIndividual,15);
assert.equal(stage('c01-s02').missing,33);
assert.equal(stage('c01-s05').expected,48);
assert.equal(stage('c01-s05').registeredIndividual,0);
assert.equal(stage('c01-s05').missing,48);
const female=stage('c01-s05').variants.find(x=>x.edition==='pre'&&x.gender==='female');
assert.equal(female.expected,8);
assert.equal(female.missing,8);
assert.equal(female.registeredIndividual,0);
assert(female.missingShots.some(x=>x.id==='c01-s05-m3'));
for(const item of report.stages.filter(s=>s.chapter===2)){
 assert.equal(item.registeredIndividual,0);
 assert.equal(item.expected,item.missing);
}
assert.equal(report.stages.filter(x=>x.chapter===2).reduce((n,x)=>n+x.missing,0),574);
assert.equal(stage('c02-s05').expected,160);
assert.equal(stage('c02-s05').variants.length,24);
for(const record of report.stages)assert.equal(record.expected,
 record.registeredIndividual+record.existingFullSheet+record.missing);
console.log('PASS: screenshot c01-s05/female/pre m3 really absent; 45 registered early drafts, 991 missing scenes across chapters 1-2, branch/gender-safe; no substitute artwork or completion claim.');
