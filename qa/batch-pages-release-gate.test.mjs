import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context={window:{}};
vm.runInNewContext(fs.readFileSync('src/batch-pages-release-gate.js','utf8'),context);
const gate=context.window.HaiGinPagesAudit;
const shaA='a'.repeat(40),shaB='b'.repeat(40);
const last=Object.freeze({status:'source_committed_main',mainAfterSha:shaA,
 sourceCommits:1,qaStatus:'failed',pr:615});

test('only exact Pages HTML and release JSON SHA proves public deployment',()=>{
 const r=gate.evaluate({pageSha:shaB,releaseSha:shaB,last,verifiedSource:last});
 assert.equal(r.published,true);
 assert.equal(r.steps.deploy,'done');
 assert.equal(r.steps.commit,'done');
 assert.equal(r.steps.code,'done');
 assert.equal(r.steps.qa,'failed','the owner permits deployment despite optional failed QA');
 assert.equal(r.steps.pr,'skipped','direct main commit does not mean PR was merged');
 assert.equal(r.steps.merge,'skipped');
 assert.equal(r.improvementVerified,false,'no FF15-quality assertion from an upload');
});
test('dispatch only, broken SHA or CDN mismatch never appears as deployed',()=>{
 for(const options of [
  {pageSha:shaA,releaseSha:shaB},
  {pageSha:null,releaseSha:shaB},
  {pageSha:'broken',releaseSha:shaB},
  {pageSha:shaB,releaseSha:null},
  {pageSha:shaB,releaseSha:shaB.slice(0,12)}
 ]){
  const r=gate.evaluate({...options,last});
  assert.equal(r.published,false);
  assert.equal(r.steps.deploy,'pending');
 }
});
test('QA-only zero-source run may publish its accurate evidence without fake model changes',()=>{
 const zero={status:'blocked_candidates',sourceCommits:0,qaStatus:'not_run',
  pr:null};
 const historic={status:'source_committed_main',sourceCommits:1,
  mainAfterSha:shaA};
 const r=gate.evaluate({pageSha:shaB,releaseSha:shaB,last:zero,
  verifiedSource:historic});
 assert.equal(r.steps.deploy,'done');
 assert.equal(r.steps.code,'pending');
 assert.equal(r.steps.commit,'skipped');
 assert.equal(r.steps.qa,'skipped');
 assert.equal(r.previousCommit,true);
 assert.equal(r.mainCommitted,false);
 assert.match(r.message,/過去の実ソースコミット/);
});
test('production monitor uses same-origin SHA proof instead of hardcoded pending deploy',()=>{
 const html=fs.readFileSync('batch-monitor.html','utf8');
 assert.match(html,/src\/batch-pages-release-gate\.js/);
 assert.match(html,/meta\[name="hai-gin-pages-sha"\]/);
 assert.match(html,/HaiGinPagesAudit\.evaluate/);
 assert.match(html,/proof\.steps\[key\]/);
 assert.match(html,/release\.json\?ts=/);
 assert.doesNotMatch(html,/merge:hasSource\?'done':'pending',deploy:'pending'/);
});
