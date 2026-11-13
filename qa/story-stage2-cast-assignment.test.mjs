import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const manifest=read('assets/story/stage-manifests/c01-s02.manifest.json');
const bible=read('assets/story/characters/c01-s02-reference-bible.json');
const locked=read('assets/story/stage-manifests/c01-s02-shot-assignments.json');
assert.equal(locked.priority,'P0_ABSOLUTE_MUST_FOLLOW');
assert.equal(locked.requiredPendingCount,25);
assert.equal(locked.maximumShotsPerReviewSheet,5);
assert.deepEqual(locked.minimumNativePixels,[768,320]);
assert.equal(Object.keys(locked.entries).length,25);
assert.equal(manifest.continuation.remainingSceneCount,25);
assert.equal(manifest.continuation.existingSceneCount,23);
assert.equal(manifest.continuation.newActualRegisteredWebps,0);
assert.equal(manifest.continuation.canonicalShotAssignments,
 'assets/story/stage-manifests/c01-s02-shot-assignments.json');
assert(bible.actors.some(a=>a.id==='vess' &&
 a.path==='assets/story-cinema/cast/vess.webp'));
const proc=spawnSync(process.execPath,
 ['scripts/run-story-stage.mjs','--stage','c01-s02','--prepare-only'],
 {cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
assert.equal(proc.status,0,proc.stdout+'\n'+proc.stderr);
const outputRoot='qa-reports/story-stage-production/batches/c01-s02/';
const report=read(outputRoot+'stage-manifest.json');
const briefs=read(outputRoot+'render-briefs.json');
const summary=read(outputRoot+'batch-summary.json');
assert.equal(summary.perPanelActorLockedRenderTasks,25);
assert.equal(summary.imageGeneratorConnected,false);
assert.equal(summary.stageApproved,false);
assert.equal(summary.gameDeployed,false);
const tasks=report.stages[0].variants.flatMap(v=>v.pages.flatMap(p=>p.panels));
assert.equal(tasks.length,48);
const assigned=tasks.filter(p=>p.castAssignment);
assert.equal(assigned.length,25);
assert.equal(tasks.filter(p=>!p.castAssignment).length,23);
const renderTasks=briefs.variants.flatMap(v=>v.reviewSheets.flatMap(s=>s.individualRenderTasks));
assert.equal(renderTasks.length,48);
const renderMap=new Map(renderTasks.map(x=>[x.shotKey,x]));
assert.equal(renderMap.size,48);
const lockedSet=new Set();
for(const panel of assigned){
 const key=[panel.castAssignment.edition,panel.castAssignment.gender,panel.panelId].join('|');
 assert.deepEqual(panel.castAssignment,locked.entries[key]);
 assert(!lockedSet.has(key));
 lockedSet.add(key);
 const shot=renderMap.get(panel.shotKey);
 assert(shot);
 assert.equal(shot.screenplayDialogue,locked.entries[key].scriptText);
 assert.equal(shot.speaker,locked.entries[key].speaker);
 assert.equal(shot.foregroundActorId,locked.entries[key].foregroundActorId);
 assert.deepEqual(shot.supportActorIds,locked.entries[key].supportActorIds);
 assert.deepEqual(shot.mustNotAppearActorIds,locked.entries[key].mustNotAppearActorIds);
 assert.equal(shot.sceneGoal,locked.entries[key].sceneGoal);
 assert.equal(shot.compositionHint,locked.entries[key].compositionHint);
 assert.equal(shot.protagonistState,locked.entries[key].protagonistState);
 assert.equal(shot.renderMode,locked.entries[key].renderMode);
 assert(shot.imageGenerationPrompt.includes('FOREGROUND ACTOR ID: '));
 assert(shot.imageGenerationPrompt.includes('CURRENT EXACT SCREENPLAY BEAT: '+panel.scriptText));
 assert(shot.imageGenerationPrompt.includes('NO text, Japanese letters, numbers'));
 assert(shot.imageGenerationPrompt.includes('MUST NOT APPEAR ACTOR IDS: '));
 assert.equal(shot.approval,'BLOCKED_MISSING_ACTUAL_GENERATION_AND_REVIEW');
 assert.deepEqual(shot.minimumNativePixels,[768,320]);
 assert(shot.imageInputs.every(a=>a.actualBytesReadable&&a.attachedToGenerator===false&&
  /^[a-f0-9]{64}$/.test(a.sha256)));
 assert.deepEqual(panel.requiredCharacterReferences.map(r=>r.actorId),
  locked.entries[key].visibleActorIds);
 assert(panel.requiredCharacterReferences.every(r=>r.sourceExists &&
  r.sourceBytesVerified===true && r.sourceByteLength>32 &&
  r.attachmentStatus==='NOT_ATTACHED_BY_PREFLIGHT'));
 assert(panel.requiredCharacterReferences.every(r=>bible.actors.some(a=>a.id===r.actorId)));
 if(key.includes('post-gameover')){
  assert(panel.castAssignment.protagonistState.startsWith('DEAD_'));
  if(panel.panelId.endsWith('death-2')){
   assert.equal(panel.castAssignment.foregroundActorId,null);
   assert.deepEqual(panel.requiredCharacterReferences,[]);
   assert.deepEqual(panel.castAssignment.visibleActorIds,[]);
   assert.equal(panel.castAssignment.renderMode,'ENVIRONMENT_ONLY');
  }
 }
 if(panel.castAssignment.visibleActorIds.includes('vess'))
  assert(panel.requiredCharacterReferences.some(r=>r.actorId==='vess'));
}
assert.equal(lockedSet.size,25);
assert.deepEqual(new Set(Object.keys(locked.entries)),lockedSet);
assert(report.stages[0].variants.every(v=>v.pages.every(page=>page.panels.length<=5)));
console.log('PASS stage2: 25 locked individual render tasks, exact dialogue/visible actors/composition, Vess source hashes, no substitute cast, death exception, 23 existing untouched; no new render/approval/registration');
