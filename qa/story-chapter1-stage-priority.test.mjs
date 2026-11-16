#!/usr/bin/env node
/**
 * Regression: the real Cloudflare Free chapter batch may start at c01-s03
 * without silently starting at an earlier chapter stage or invalid ID.
 * This is a plan-only test: no provider request, approval or deployment.
 */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const script='scripts/generate-story-chapter1-free-batch.mjs';
function run(args){
 return spawnSync(process.execPath,[script,'--mode','plan',...args],{cwd:root,encoding:'utf8'});
}
const plan=run(['--start-stage','c01-s03','--through-stage','c01-s10']);
assert.equal(plan.status,0,plan.stderr);
const answer=JSON.parse(plan.stdout.trim().split('\n').at(-1));
assert.equal(answer.startStage,'c01-s03');
assert.equal(answer.throughStage,'c01-s10');
assert.equal(answer.pages,132);
assert.equal(answer.scenes,462);
assert.equal(answer.apiRequests,0);
const progress=JSON.parse(readFileSync(path.join(root,'qa-reports/story-stage-production/chapter1-free-render/last-run.json'),'utf8'));
const eligible=progress.pageStates.filter(pg=>pg.stage>='c01-s03'&&pg.stage<='c01-s10'&&
 pg.shotKeys.some((key,i)=>pg.compactRequiredKeys.includes(key)&&
 !['REGISTERED_NOT_P0_CERTIFIED','REAL_DRAFT_UNAPPROVED'].includes(pg.states[i])));
assert.equal(answer.nextTask,eligible[0]?.pageTask);
assert.equal(answer.compactTargets,progress.compactTargets);
assert.equal(answer.compactMissing,progress.compactStillMissing);
assert.equal(answer.minimumPrimaryCGSlots,44,'One chapter = opening 4 plus 10 stages x 4');
assert.equal(answer.genderVariants,88,'Gender is a guarded art variant, not a second basic scene');
assert.equal(progress.minimumPrimaryCGSlots,44);
assert.equal(progress.genderVariants,88);
assert.equal(progress.provenGenderNeutralArtShares,0,
 'No unreviewed male/female source art may be counted as a safe shared scene');
const stageFour=progress.pageStates.filter(pg=>pg.stage==='c01-s04');
const activeFour=new Set(stageFour.flatMap(pg=>pg.compactRequiredKeys));
assert(activeFour.has('c01-s04|post-victory|female|c01-s04-m6'));
assert(activeFour.has('c01-s04|post-victory|female|c01-s04-m10'));
assert(!activeFour.has('c01-s04|post-victory|female|c01-s04-m8'),
 'Legacy stage4 female victory m8 must not block compact Chapter 1 production');
const compactCount=progress.pageStates.reduce((sum,pg)=>sum+pg.compactRequiredKeys.length,0);
assert.equal(compactCount,progress.compactTargets);
assert(progress.compactTargets<progress.totalScenes,'Legacy panels must remain archived, not regenerated');
assert.ok(eligible.length===0||eligible[0].stage>='c01-s03','stage1/2 appeared in prioritized batch');
const invalid=run(['--start-stage','c01-s11']);
assert.notEqual(invalid.status,0,'Invalid stage cannot launch Free API generation');
const generatorSource=readFileSync(path.join(root,script),'utf8');
const registeredGuard="if(s.registered&&!s.legacyBelowNative)return 'REGISTERED_NOT_P0_CERTIFIED';";
const oldProviderBlock="if(fs.existsSync(p(s.img+'.provider-blocked.json')))return 'BLOCKED_PROVIDER_SAFETY';";
assert(generatorSource.indexOf(registeredGuard)>0&&generatorSource.indexOf(registeredGuard)<generatorSource.indexOf(oldProviderBlock),
 'Existing native owner-accepted image must be recognized before old Cloudflare provider block');
assert(generatorSource.includes("if(incomplete.length)"),'Stage cannot skip missing compact images');
assert(generatorSource.includes('if(!pg.shots.some(compactRequired))continue;'));
assert(generatorSource.includes('compactRequired(shot)'), 'Legacy shots cannot block later stages');
const productionWorkflow=readFileSync(path.join(root,
 '.github/workflows/story-chapter1-free-complete-draft-production.yml'),'utf8');
assert(productionWorkflow.includes('git show origin/main:data/story-compact-20chapters.json'),
 'Persistent old review branch must receive latest canonical compact shot IDs');
console.log('story stage-priority plan: PASS (no generation, no registration)');
