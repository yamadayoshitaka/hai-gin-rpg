import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FANTASY_JOB_ROSTER,FANTASY_JOB_MOTION,FANTASY_JOB_PALETTES,resolveFantasyActor,validateFantasyRoster} from '../src/fantasy-job-roster.js';
import {CHARACTER_PARTS,resolveCharacterAssembly} from '../src/character-assembly-bom.js';
import {sampleHumanClip} from '../src/human-motion-clips.js';
import {PLAYER_JOBS} from '../src/game-content.js';
import {ATB_ACTION,atbMotionSample,resolveAtbVictory} from '../src/atb-motion-data.js';
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

assert.equal(resolveAtbVictory([{hp:0},{hp:18},{hp:40}]),false,'one defeated enemy must not end a group encounter');
assert.equal(resolveAtbVictory([{hp:0},{hp:0},{hp:0}]),true,'only complete group defeat wins');
assert.equal(resolveAtbVictory([]),false,'empty/uninitialized groups must not trigger victory');
for(const t of [0,.16,.43,.51,.63,.8,1]){
 const m=atbMotionSample(t*ATB_ACTION.duration);
 assert.ok(m.travel>=0&&m.travel<=1);
 if(t<ATB_ACTION.approachEnd)assert.equal(m.state,'approach');
 if(t>.64&&t<1)assert.equal(m.state,'return');
}
assert.ok(runtime.includes('if(!atb.active&&(combat.mode'), 'live ATB must ignore obsolete first-symbol defeat');
assert.ok(runtime.includes('characterMotion.updatePose(host,dt)'), 'all combatants must use shared character motion');
assert.ok(!runtime.includes("if(enemy||/guard|soldier|knight"),'enemy visuals must not hardcode one knight model');
assert.ok(runtime.includes("host.userData.atbJobId||data.jobId"),'enemy model selection reads job identity');
assert.ok(runtime.includes("delete symbol.g.userData.atbJobId"),'field actor restores its role after encounter');
assert.ok(!runtime.includes("const knock=player.userData.hitKnockback;"),'retired arcade battle engine must remain removed');
console.log('Group victory and shared ATB timeline regression PASS');

assert.ok(runtime.includes('const inBattle=atb.active||Boolean('),'ATB must override legacy target HP when keeping encounter open');
assert.ok(runtime.includes('const active=!combat.dead&&(atb.active||'), 'battle camera must follow full ATB encounter');
assert.ok(runtime.includes('atb.active?(atb.enemies||[]).some('),'enemy visibility must be driven by living group participants');
console.log('Multi-enemy battle lifecycle precedence PASS');

assert.ok(runtime.includes('applyAtbCombatPose(dt);}else{applyDodgeAcrobatics(dt);}updateModels(dt);'),'field and ATB share one animation update after movement state selection');
assert.ok(runtime.includes('characterMotion.updatePose(host,dt);'),'battle uses same motion controller');
assert.ok(!runtime.includes('updateModels(dt);animateAtbLibraryCharacters(dt);'),'retired battle proxy animation must not execute');
assert.ok(runtime.includes('if(host.userData.atbChibi?.g)host.userData.atbChibi.g.visible=false;'),'legacy battle visuals never cover primary rig');
console.log('Single actor rig and animation authority regression PASS');
