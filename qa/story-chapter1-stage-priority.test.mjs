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
 pg.states.some(state=>['MISSING','LEGACY_NATIVE_DEFECT_NEEDS_REGEN'].includes(state)));
assert.equal(answer.nextTask,eligible[0]?.pageTask);
assert.ok(eligible.length===0||eligible[0].stage>='c01-s03','stage1/2 appeared in prioritized batch');
const invalid=run(['--start-stage','c01-s11']);
assert.notEqual(invalid.status,0,'Invalid stage cannot launch Free API generation');
console.log('story stage-priority plan: PASS (no generation, no registration)');
