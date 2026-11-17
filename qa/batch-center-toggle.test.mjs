import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKER,parseToggleIssue,applyToggle} from '../scripts/batch-center-toggle.mjs';
const owner='yamadayoshitaka';
const issue=(category,enabled,user=owner)=>({title:'[hai-gin-switch] update',
 user:{login:user},body:MARKER+'\n```json\n'+JSON.stringify({category,enabled})+'\n```'});
test('Owner-approved pause/restart and no unrelated mutation',()=>{
 const state={schemaVersion:1,groups:{human:{enabled:true},monster:{enabled:true},
 world:{enabled:true},anime:{enabled:false},
 faceHair:{enabled:true},outfit:{enabled:true},creatureMonster:{enabled:true},creatureSummon:{enabled:true}}};
 const cmd=parseToggleIssue(issue('human',false),owner);
 assert.deepEqual(cmd,{category:'human',enabled:false});
 const next=applyToggle(state,cmd,{updatedAt:'2026-11-15T08:00:00Z',issueNumber:10});
 assert.equal(next.groups.human.enabled,false);
 assert.equal(next.groups.world.enabled,true);
 assert.equal(state.groups.human.enabled,true);
});
test('New quality group may be independently suspended without affecting other groups',()=>{
 const s={schemaVersion:1,groups:Object.fromEntries(['human','monster','world','anime','faceHair','outfit','creatureMonster','creatureSummon'].map(id=>[id,{enabled:true}]))};
 const next=applyToggle(s,parseToggleIssue(issue('outfit',false),owner),{updatedAt:'2026-11-17T00:00:00Z',issueNumber:20});
 assert.equal(next.groups.outfit.enabled,false);assert.equal(next.groups.faceHair.enabled,true);
});
test('A third party cannot switch',()=>assert.throws(()=>parseToggleIssue(issue('world',false,'attacker'),owner)));
test('An invalid category cannot switch',()=>assert.throws(()=>parseToggleIssue(issue('deploy',true),owner)));
test('Extra injected fields are forbidden',()=>{
 const i=issue('human',true);i.body=MARKER+'\n```json\n'+JSON.stringify({
  category:'human',enabled:true,forcePaid:true})+'\n```';
 assert.throws(()=>parseToggleIssue(i,owner));
});
