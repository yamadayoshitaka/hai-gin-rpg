import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(file,exposed){
 const context={};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
 assert.ok(context[exposed],exposed+' must load');
 return context[exposed];
}
const main='1'.repeat(40),release='2'.repeat(40),other='3'.repeat(40);

test('batch center identifies latest main vs matching published HTML and release',()=>{
 const {evaluate}=load('src/batch-release-parity.js','HaiGinReleaseParity');
 const synced=evaluate({mainSha:main,pageSha:main,releaseSha:main});
 assert.equal(synced.status,'synced');
 assert.equal(synced.compareUrl,null);
 const different=evaluate({mainSha:main,pageSha:release,releaseSha:release});
 assert.equal(different.status,'different');
 assert.equal(different.compareUrl,
  'https://github.com/yamadayoshitaka/hai-gin-rpg/compare/'+release+'...'+main);
 assert.equal(evaluate({mainSha:null,pageSha:release,releaseSha:release}).status,'unverified_main');
 assert.equal(evaluate({mainSha:main,pageSha:release,releaseSha:other}).status,'mixed_release');
 assert.equal(evaluate({mainSha:main,pageSha:null,releaseSha:release}).status,'unverified_release');
});

test('Pages source adoption is never inferred merely from a green release SHA',()=>{
 const {evaluate}=load('src/batch-pages-release-gate.js','HaiGinPagesAudit');
 const last={status:'source_committed_main',sourceCommits:1,mainAfterSha:main,qaStatus:'passed'};
 const mismatch=evaluate({pageSha:release,releaseSha:release,last});
 assert.equal(mismatch.published,true);
 assert.equal(mismatch.sourcePublished,false);
 assert.match(mismatch.message,/未照合/);
 assert.doesNotMatch(mismatch.message,/本編に反映/);
 const exact=evaluate({pageSha:main,releaseSha:main,last});
 assert.equal(exact.sourcePublished,true);
 const mixed=evaluate({pageSha:other,releaseSha:release,last});
 assert.equal(mixed.published,false);
 assert.equal(mixed.sourcePublished,false);
});

test('published batch UI exposes fresh main comparison and live journal fallback',()=>{
 const page=fs.readFileSync('batch-monitor.html','utf8');
 for(const required of [
  'id="releaseParityPanel"','id="releaseParityText"','id="releaseParityDiff"',
  'src/batch-release-parity.js','renderReleaseParity()',
  'refreshLiveIfDue()', 'document.addEventListener(\'visibilitychange\'',
  'raw.githubusercontent.com','main/data/batch-self-drive/',
  "updateProgress({forceLive:true})"
 ])assert.ok(page.includes(required),'Missing live release feature: '+required);
});

test('batch monitor inline browser controller has valid JavaScript syntax',()=>{
 const page=fs.readFileSync('batch-monitor.html','utf8');
 const start=page.lastIndexOf('<script>'),end=page.lastIndexOf('</script>');
 assert.ok(start>=0&&end>start,'Batch monitor controller script missing');
 assert.doesNotThrow(()=>new vm.Script(page.slice(start+'<script>'.length,end),{
  filename:'batch-monitor.inline.js'
 }));
});
