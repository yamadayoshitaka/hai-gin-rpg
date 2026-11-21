import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SUMMON_GALLERY_ACTIONS,summonGalleryActions,summonGalleryAction}
 from '../src/summon-gallery-action-catalog.js';
import {sampleSummonPreviewRoute,SUMMON_PREVIEW_ROUTE}
 from '../src/summon-gallery-motion-route.js';

test('three featured summons expose genuine named abilities, not only shared special',()=>{
 assert.deepEqual(summonGalleryActions('forest_archer').map(x=>x.id),
  ['forest_rejuvenation','spirit_arrow']);
 assert.deepEqual(summonGalleryActions('seraph_guardian').map(x=>x.id),
  ['seraph_blessing','seraph_resurrection','radiant_lance']);
 assert.deepEqual(summonGalleryActions('dragon_lord').map(x=>x.id),
  ['dragon_lord_starflare','inferno_breath','royal_roar']);
 assert.ok(summonGalleryAction('dragon_lord','dragon_lord_starflare').label.includes('大焔'));
 assert.equal(summonGalleryAction('forest_archer','bad'),null);
 assert.equal(summonGalleryActions('wolf').length,0);
 assert.ok(Object.isFrozen(SUMMON_GALLERY_ACTIONS));
 for(const [species,actions] of Object.entries(SUMMON_GALLERY_ACTIONS))
  for(const a of actions){
   assert.ok(a.label&&a.id&&a.pose&&a.vfx, species+' missing real animation contract');
   assert.ok(['special','attack','roar','guard'].includes(a.pose));
  }
});
test('preview route progresses smoothly, at distinctly slower walking speed',()=>{
 assert.equal(SUMMON_PREVIEW_ROUTE.length,10);
 const a=sampleSummonPreviewRoute(0),b=sampleSummonPreviewRoute(.25);
 const c=sampleSummonPreviewRoute(.25,{running:true});
 assert.ok(b.x>0&&b.x<1);
 assert.ok(c.x>b.x,'run must be faster than walking');
 assert.equal(a.action,'walk');
 assert.equal(c.action,'run');
 const before=sampleSummonPreviewRoute(.659),after=sampleSummonPreviewRoute(.661);
 assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<.01,
  'route must interpolate continuously across cell edges, no teleport');
 const full=sampleSummonPreviewRoute(.66*10);
 assert.equal(full.x,0);assert.equal(full.z,0);
 assert.equal(sampleSummonPreviewRoute(-5).x,0);
});
test('actual gallery moves the canonical GLB and exposes species skill buttons',()=>{
 const html=readFileSync(new URL('../summon-showcase.html',import.meta.url),'utf8');
 assert.match(html,/renderSpeciesSkillButtons\(\)/);
 assert.match(html,/motionStrip\.insertBefore\(button,document\.getElementById\('walk'\)\)/);
 assert.match(html,/femaleSummonHandle\?\.start\(walking\?\(running\?'run':'walk'\):'idle',t\)/);
 assert.match(html,/sampleSummonPreviewRoute\(t-walkBeganAt,\{running\}\)/);
 assert.match(html,/femaleSummonHandle\.root\.position\.x=previewObject\.x/);
 assert.match(html,/femaleSummonHandle\.root\.position\.z=previewObject\.z/);
 assert.match(html,/femaleSummonHandle\?\.start\(entry\.pose,t,entry\.id\)/);
 assert.match(html,/canonicalMovementAudit\(\)/);
 assert.doesNotMatch(html,/femaleSummonHandle\?\.start\(walking\?'run':'idle'/);
 const actor=readFileSync(new URL('../src/monster-character-cosplay.js',import.meta.url),'utf8');
 assert.match(actor,/start\(action,time=0,skillId=null\)/);
 assert.match(actor,/root\.userData\.previewSkillId/);
 const gesture=readFileSync(new URL('../src/monster-humanoid-combat-poses.js',import.meta.url),'utf8');
 assert.match(gesture,/skillId==='seraph_resurrection'/);
 assert.match(gesture,/skillId==='forest_rejuvenation'/);
});
