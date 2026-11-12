import assert from 'node:assert/strict';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {STORY_CHAPTERS,STORY_ENDINGS} from '../src/story-chapters.js';
import {STORY_DECISIONS,ROUTES,storyDecisionForStage} from '../src/story-narrative-flow.js';
import {STORY_STAGE_BEATS} from '../src/story-stage-beats-v2.js';
import {screenplayForStage,screenplayForChapter,screenplayIndex,screenplayRubyTokens,screenplayVoiceText} from '../src/story-screenplay-v2.js';

assert.equal(STORY_CHAPTERS.length,20);
assert.equal(CAMPAIGN_STAGES.length,200);
assert.equal(STORY_STAGE_BEATS.length,20);
assert.ok(STORY_STAGE_BEATS.every(ch=>ch.length===10));
assert.equal(screenplayIndex().length,200);
for(let chapter=1;chapter<=20;chapter++){
 const scripts=screenplayForChapter(chapter);
 assert.equal(scripts.length,10);
 assert.ok(scripts.every(x=>x.chapter===chapter));
}
for(const stage of CAMPAIGN_STAGES){
 const female=screenplayForStage(stage.id,{protagonistGender:'female'});
 const male=screenplayForStage(stage.id,{protagonistGender:'male'});
 assert.equal(male.stageName,stage.name);
 assert.equal(male.winCondition,stage.winCondition);
 assert.equal(male.stageKind,stage.kind);
 assert.equal(male.status,'screenplay-draft-not-art-or-audio');
 assert.notEqual(male.edition,female.edition);
 for(const script of [male,female]){
  assert.ok(script.pre.length>0&&script.post.length>0,stage.id);
  assert.ok(script.pre.every(l=>l.protagonistGender===script.gender));
  assert.ok(script.post.every(l=>l.protagonistGender===script.gender));
  for(const phase of ['pre','post']){
   assert.ok(script.pages[phase].every(p=>p.cellCount>=1&&p.cellCount<=10),stage.id);
   assert.equal(script.pages[phase].reduce((n,p)=>n+p.cellCount,0),script[phase].length);
   assert.ok(script[phase].every(l=>l.rubyTokens.map(t=>t.text).join('')===l.text));
   assert.ok(script[phase].every(l=>l.voiceText.length>0));
  }
 }
 if(stage.kind==='town'){
  assert.equal(male.outcome,'town');
  assert.ok(male.post.some(x=>x.text===STORY_STAGE_BEATS[stage.chapter-1][stage.slot-1][1]
   ||x.text.includes(STORY_STAGE_BEATS[stage.chapter-1][stage.slot-1][1])));
  continue;
 }
 const win=screenplayForStage(stage.id,{battleOutcome:{victory:true}});
 const lost=screenplayForStage(stage.id,{battleOutcome:{victory:false}});
 const died=screenplayForStage(stage.id,{battleOutcome:{victory:false,playerCommanderDead:true}});
 assert.equal(win.outcome,'victory');
 assert.equal(lost.outcome,'defeat');
 assert.equal(died.outcome,'gameover');
 assert.ok(win.post.some(x=>x.text.includes(STORY_STAGE_BEATS[stage.chapter-1][stage.slot-1][1])));
 assert.ok(lost.post.every(x=>!x.text.includes(STORY_STAGE_BEATS[stage.chapter-1][stage.slot-1][1])));
 assert.ok(died.post.some(x=>x.text.includes('戦死')));
 assert.ok(died.post.every(x=>!x.text.includes('次は「')));
 assert.ok(lost.post.some(x=>x.text.includes('再挑戦')));
 assert.notEqual(win.edition,lost.edition);
 assert.notEqual(lost.edition,died.edition);
}
for(const [chapter,decision] of Object.entries(STORY_DECISIONS)){
 const stage='c'+String(chapter).padStart(2,'0')+'-s05';
 assert.ok(storyDecisionForStage(stage));
 for(const [id,label] of decision.choices){
  const script=screenplayForStage(stage,{decision:id,battleOutcome:{victory:true}});
  assert.ok(script.pre.some(x=>x.text.includes(label)));
  assert.ok(script.post.some(x=>x.text.includes(label)));
 }
}
for(const route of ROUTES){
 const script=screenplayForStage('c13-s02',{route:route.id,battleOutcome:{victory:true}});
 assert.ok(script.pre.some(x=>x.text.includes(route.name)));
 assert.ok(script.post.some(x=>x.text.includes(route.name)));
}
for(const [id,ending] of Object.entries(STORY_ENDINGS)){
 const script=screenplayForStage('c20-s10',{route:'silver',storyEnding:id,battleOutcome:{victory:true}});
 assert.ok(script.post.some(x=>x.text.includes(ending.title)));
 assert.equal(script.post.at(-1).kind,'ending');
}
assert.equal(screenplayForStage('c20-s10',{battleOutcome:{victory:true}}).post.at(-1).kind,'ending-pending');
assert.ok(screenplayRubyTokens('星鐘と勅命').some(t=>t.ruby==='せいしょう'));
assert.match(screenplayVoiceText('勅命の星鐘'),/ちょくめい/);
assert.throws(()=>screenplayForStage('c02-s05',{decision:'not-a-decision'}));
console.log('PASS screenplay 20 chapters x 10 stages: canonical objectives, genders, outcomes, decisions, routes, endings and ruby');
