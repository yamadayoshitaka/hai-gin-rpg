/** Data-driven per-character appearance and animation selection. */
import {JOB_CATALOG} from './job-catalog.js';
const RANGER=/ranger|hunter|archer|sniper|thief|assassin|rogue|scout|fisher|woodcutter|bandit|bow|dagger|ranged/;
const ARMORED=/knight|paladin|guard|samurai|soldier|warrior|axeman|berserker|spearman/;
const ROBED=/mage|wizard|priest|cleric|scholar|healer|sorcerer|necromancer|summoner|alchemist/;
const profiles={};
for(const [id,entry] of Object.entries(JOB_CATALOG)){
 const family=RANGER.test(id+' '+entry.motionSet)?'Ranger':'Peasant';
 const outfit=ARMORED.test(id)?'knight':ROBED.test(id)?'mage':/merchant|trader/.test(id)?'merchant':/noble|lord/.test(id)?'noble':/smith|blacksmith/.test(id)?'smith':/cook|chef/.test(id)?'chef':/farmer/.test(id)?'farmer':/priest/.test(id)?'priest':family==='Ranger'?'ranger':'villager';
 const attackPatterns={sword:['Sword_Attack','Sword','Slash','Attack'],dagger:['Dagger','Stab','Punch','Attack'],spear:['Spear','Thrust','Attack'],axe:['Axe','Heavy','Attack'],hammer:['Hammer','Heavy','Attack'],bow:['Bow','Shoot','Attack'],ranged:['Shoot','Throw','Attack'],staff:['Cast','Spell','Attack'],unarmed:['Punch','Kick','Attack'],common:['Interact','Wave','Attack'],noble:['Gesture','Wave','Attack']};
 const motion=entry.motionSet;
 profiles[id]=Object.freeze({id,modelFamily:family,outfit,animation:Object.freeze({
  idle:['Idle_Loop','Idle','Stand'],walk:['Walk_Loop','Walk'],run:['Jog_Fwd_Loop','Jog','Run'],attack:attackPatterns[motion]||attackPatterns.common,guard:['Block','Guard','Defend'],hit:['Hit','Hurt','Damage'],dead:['Death','Fall'],getup:['GetUp','StandUp','Recover']
 })});
}
export const CHARACTER_JOB_PROFILES=Object.freeze(profiles);
export function resolveCharacterJobProfile(id){return CHARACTER_JOB_PROFILES[id]||CHARACTER_JOB_PROFILES.civilian}
