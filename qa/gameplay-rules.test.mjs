import assert from 'node:assert/strict';
import { GAMEPLAY_RULES } from '../src/gameplay-rules.js';
import { CombatRecoverySystem,AlignmentDecisionSystem,ExperienceRuleSystem } from '../src/data-systems.js';

const c={playerStamina:20,maxStamina:100,playerMp:90,maxMp:100,guardPosture:30,maxGuardPosture:100,engagementTimer:2,guardHeld:false,guardBroken:0};
const before=structuredClone(c);
const combat=new CombatRecoverySystem();
assert.deepEqual(combat.execute({combat:c,dt:1,rules:GAMEPLAY_RULES.combat}),{playerStamina:28,playerMp:92.5,guardPosture:49});
assert.equal(combat.execute({combat:{...c,engagementTimer:0},dt:1,rules:GAMEPLAY_RULES.combat}).playerStamina,37);
assert.equal(combat.execute({combat:{...c,guardHeld:true},dt:1,rules:GAMEPLAY_RULES.combat}).guardPosture,30);
assert.deepEqual(c,before);
const alignment=new AlignmentDecisionSystem();
assert.deepEqual(alignment.execute({value:0,delta:-20,rules:GAMEPLAY_RULES.alignment}),{alignment:-20,branch:'abyss',storyStage:1});
assert.deepEqual(alignment.execute({value:95,delta:50,rules:GAMEPLAY_RULES.alignment}),{alignment:100,branch:'dawn',storyStage:2});
const experience=new ExperienceRuleSystem();
assert.equal(experience.execute({level:1,rules:GAMEPLAY_RULES.progression}).threshold,49);
assert.equal(experience.execute({level:6,rules:GAMEPLAY_RULES.progression}).skillTier,2);
assert.throws(()=>experience.execute({level:0,rules:GAMEPLAY_RULES.progression}));
console.log('Gameplay data rules passed');
