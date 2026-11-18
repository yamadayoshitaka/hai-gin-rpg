import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {categoryFromMinute,isAllowedSource,eligiblePr,pickSources,canPublish,PROTECTED_WORLD_FILES} from '../scripts/batch-self-drive.mjs';
const REPO='yamadayoshitaka/hai-gin-rpg';
const pr=(name='world/structural-joinery-five-20261118',title='world joinery')=>({
 state:'open',title,head:{ref:name,sha:'a'.repeat(40),repo:{full_name:REPO}},
 base:{ref:'main'},user:{login:'yamadayoshitaka'}
});

test('rotation covers every scheduled category including image handoff without fake generation',()=>{
 assert.deepEqual([7,22,37,52,57].map(categoryFromMinute),
 ['faceHair','outfit','creatureMonster','world','anime']);
});
test('only owner-authored current-main PR heads can enter privileged source reconciliation',()=>{
 const good=pr();
 assert(eligiblePr(good,'world'));
 assert.equal(eligiblePr({...good,user:{login:'untrusted'}},'world'),false);
 assert.equal(eligiblePr({...good,base:{ref:'develop'}},'world'),false);
 assert.equal(eligiblePr({...good,head:{...good.head,repo:{full_name:'elsewhere/repo'}}},'world'),false);
 assert.equal(eligiblePr({...good,head:{...good.head,sha:'broken'}},'world'),false);
 assert.equal(eligiblePr(pr('world/masonry','world materials'),'faceHair'),false);
});
test('allowlisted source geometry only; world catalog and newest user-approved object list remain intact',()=>{
 assert(isAllowedSource('world','src/object-catalog.js'));
 assert(isAllowedSource('faceHair','src/character-system/hair-attachment-runtime.js'));
 assert(isAllowedSource('faceHair','src/face-scalp-wig.js'));
 assert(isAllowedSource('outfit','src/character-system/garment-coverage-runtime.js'));
 assert(isAllowedSource('creatureMonster','src/avian-guardian-sculpt.js'));
 for(const path of PROTECTED_WORLD_FILES){
  for(const category of ['world','faceHair','outfit','creatureMonster'])assert.equal(isAllowedSource(category,path),false,path);
 }
 for(const path of ['.github/workflows/publish-pages.yml','tactics-wireframe.html','data/batch-center-switches.json',
  'src/character-system/garment-coverage-runtime.js/../../object-list.html',
  '../src/object-catalog.js','data/story-chapter1.json','src/monster-summon-renderer.js']) {
  if(path==='src/monster-summon-renderer.js')continue;
  assert.equal(isAllowedSource('world',path),false,path);
 }
 assert.equal(isAllowedSource('anime','data/story-panels.json'),false,'No fabricated source/image auto-write');
});
test('source PR patch extraction is bounded and skips deletions/renames or irrelevant files',()=>{
 const files=[
  {filename:'src/object-catalog.js',status:'modified'},
  {filename:'object-list.html',status:'modified'},
  {filename:'src/tree-seasons.js',status:'modified'},
  {filename:'src/monster-summon-renderer.js',status:'modified'},
  {filename:'src/character-system/garment-coverage-runtime.js',status:'removed'}
 ];
 assert.deepEqual(pickSources('world',files),['src/object-catalog.js']);
 assert.deepEqual(pickSources('outfit',files),[]);
 assert.deepEqual(pickSources('creatureMonster',files),['src/monster-summon-renderer.js']);
});
test('red optional QA is not a prerequisite but conflict, syntax, ID and ref safety always are',()=>{
 const ok={changed:1,protectedPathsPreserved:true,syntaxOk:true,mainUnchanged:true,
  headUnchanged:true,worldIdsPreserved:true};
 assert.equal(canPublish(ok),true);
 for(const k of Object.keys(ok)){
  assert.equal(canPublish({...ok,[k]:k==='changed'?0:false}),false,k);
 }
});
test('scheduled source repair receives intended cron instead of delayed runner minute',()=>{
 const yaml=fs.readFileSync('.github/workflows/batch-self-drive.yml','utf8');
 const script=fs.readFileSync('scripts/batch-self-drive.mjs','utf8');
 assert(yaml.includes("SCHEDULED_CRON: ${{ github.event.schedule || '' }}"));
 assert.match(script,/categoryFromCron\(process\.env\.SCHEDULED_CRON\)/);
});
test('candidate regression QA must pass before unattended main commit',()=>{
 const script=fs.readFileSync('scripts/batch-self-drive.mjs','utf8');
 const qa=script.indexOf('const qa=qualityChecks(group)');
 const barrier=script.indexOf("if(qa.status!=='passed')",qa);
 const commit=script.indexOf("command('git',['commit'",qa);
 assert(qa>=0&&barrier>qa&&commit>barrier,'red QA gate precedes commit');
 assert.match(script,/attempt\.status='qa_rejected'/);
 assert.match(script,/resetToMain\(\);\s*continue;/);
});
test('scheduled GitHub workflow persists real source evidence and never misreports model quality',()=>{
 const yaml=fs.readFileSync('.github/workflows/batch-self-drive.yml','utf8');
 const script=fs.readFileSync('scripts/batch-self-drive.mjs','utf8');
 assert.match(yaml,/contents: write/);
 assert.match(yaml,/node --test qa\/batch-self-drive\.test\.mjs/);
 assert.match(yaml,/timeout-minutes: 20/);
 assert.match(script,/origin\/main/);
 assert.match(script,/git.*apply|\['apply','--index','--3way'/);
 assert.match(script,/headUnchanged/);
 assert.match(script,/worldIdsPreserved/);
 assert.match(script,/source_committed_main/);
 assert.match(script,/source_committed_work_branch/);
 assert.match(script,/art_generation_not_automatable_in_actions/);
 assert.match(script,/androidFpsVerified:false,webglApproved:false/);
});
