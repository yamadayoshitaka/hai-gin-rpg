import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {compareBrowser} from '../scripts/quality-evolution-loop.mjs';

const monitor=fs.readFileSync('batch-monitor.html','utf8');
const script=fs.readFileSync('scripts/quality-evolution-loop.mjs','utf8');
const probe=fs.readFileSync('qa/game-quality-browser.cjs','utf8');

test('batch monitor exposes quality-evolution status separately from old selfdrive',()=>{
 assert.match(monitor,/await updateSelfDriveEvidence\(data\)/);
 assert.match(monitor,/await updateEvolutionResults\(\)/);
 assert.match(monitor,/async function updateEvolutionResults\(\)/);
 for(const id of ['faceHair','outfit','gameQuality'])assert(monitor.includes(id));
 assert.match(monitor,/data\/quality-evolution\/runs\//);
 assert.match(monitor,/raw\.githubusercontent\.com\/yamadayoshitaka\/hai-gin-rpg\/main/);
 assert.match(monitor,/品質進化の最新実行/);
 assert.match(monitor,/従来自走/);
 assert.match(monitor,/実WebGLのFPS計測失敗/);
 assert.match(monitor,/候補.*件、個別QA通過/);
 const inline=monitor.match(/<script>([\s\S]*?)<\/script>/)?.[1]||'';
 assert.doesNotThrow(()=>new vm.Script(inline));
});

test('every optimizer run records rejected candidate details on current main',()=>{
 assert.match(script,/async function publishEvolutionRun\(\)/);
 assert.match(script,/quality-evolution\/runs/);
 assert.match(script,/history\.push\(summary\)/);
 assert.match(script,/report\.completedAt=new Date\(\)\.toISOString\(\)/);
 assert.match(script,/await publishEvolutionRun\(\)/);
 assert.match(script,/baselineBrowserError:report\.baselineBrowser\?\.error/);
 assert.match(script,/sourceCommitSha:report\.sourceCommitSha/);
 assert.match(script,/GITHUB_RUN_ID/);
 assert.match(script,/artisticQualityApproved:false/);
 assert.match(script,/androidFpsMeasured:false/);
});

test('failed real browser baseline does not trigger two more expensive identical failures',()=>{
 assert.match(script,/const baselineBrowserHealthy=compareBrowser\(baselineBrowser,baselineBrowser\)\.approved/);
 assert.match(script,/if\(!baselineBrowserHealthy\)/);
 assert.match(script,/record\.status='blocked_browser_baseline'/);
 assert.match(script,/report\.status=baselineBrowserHealthy\?'no_safe_measured_improvement':'blocked_browser_baseline'/);
 assert.match(script,/fs\.rmSync\(file,\{force:true\}\)/,
  'a crashed Chromium run must never reuse a previous frame sample');
 assert.match(script,/--wizard-timeout-ms=65000/);
 assert.match(probe,/page\.on\('crash'/);
 assert.match(probe,/timeout:wizardTimeout/);
 const dead={status:'failed',error:'Chromium page closed',fps:null};
 assert.equal(compareBrowser(dead,dead).approved,false);
});

test('do not claim successful main model adoption from failed browser, QA or empty history',()=>{
 const files=fs.readFileSync('data/quality-evolution/history.json','utf8');
 const ledger=JSON.parse(files);
 assert.equal(ledger.visualApprovalRequired,true);
 assert(Array.isArray(ledger.acceptedChanges));
 assert.match(script,/if\(!best\)/);
 assert.match(script,/report\.status=baselineBrowserHealthy/);
 assert.match(script,/report\.status='committed_measured_proxy_improvement'/);
 assert.match(script,/report\.sourceCommitSha=sourceSha/);
});
