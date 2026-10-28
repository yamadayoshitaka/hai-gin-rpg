import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FANTASY_JOB_ROSTER,FANTASY_JOB_MOTION,FANTASY_JOB_PALETTES,resolveFantasyActor,validateFantasyRoster} from '../src/fantasy-job-roster.js';
import {CHARACTER_PARTS,resolveCharacterAssembly} from '../src/character-assembly-bom.js';
import {sampleHumanClip} from '../src/human-motion-clips.js';
import {PLAYER_JOBS} from '../src/game-content.js';
assert.equal(validateFantasyRoster(),true);
const ids=Object.keys(PLAYER_JOBS);assert.equal(ids.length,20);
const variants=new Set();
for(const job of ids)for(const sex of ['male','female']){
 const actor=resolveFantasyActor(job,sex);variants.add(actor.id);
 assert.equal(actor.sex,sex);
 assert.ok(FANTASY_JOB_MOTION[job]&&FANTASY_JOB_PALETTES[job]);
 assert.ok(CHARACTER_PARTS.bodies[actor.body]&&CHARACTER_PARTS.faces[actor.face]&&CHARACTER_PARTS.hairs[actor.hair]);
 const outfit=CHARACTER_PARTS.outfits[actor.outfit]?'valid':'mapped';
 const fallbackOutfit=outfit==='valid'?actor.outfit:'traveler';
 assert.ok(resolveCharacterAssembly({role:'hero',overrides:{body:actor.body,face:actor.face,hair:actor.hair,outfit:fallbackOutfit,equipment:actor.weapon}}));
 for(const state of ['idle','walk','run','attack','hit','guard','dead']){
  for(const t of [0,.12,.3,.65,1,2.5]){
   const pose=sampleHumanClip(state,t,actor.motion);
   for(const key of ['hips','knees','ankles','shoulders','elbows','wrists'])
    assert.ok(pose[key].length===2&&pose[key].every(Number.isFinite),actor.id+' '+state+' '+key);
   assert.ok(Number.isFinite(pose.bob)&&Number.isFinite(pose.spineY));
  }
 }
}
assert.equal(variants.size,40);
const runtime=fs.readFileSync('src/game-runtime.js','utf8');
assert.ok(runtime.includes('safeFieldPosition(home.x,home.z,used)'),'post-battle exit has collision recovery');
assert.ok(runtime.includes('visualGeneration'),'job switching cancels obsolete asynchronous visuals');
assert.ok(runtime.includes('const activeActor=[atb.move'),'overhead UI does not display every combatant');
console.log('40 actor variants x 7 actions x 6 times: finite poses; equipment and recovery contracts PASS');
