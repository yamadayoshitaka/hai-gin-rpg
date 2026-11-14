import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {chapterOneReviewPages} from '../src/story-chapter1-review-core.js';
import {buildStage45ArtPrompt,STAGE45_IDS} from '../src/story-c01-stage45-art-guard.js';

const pages=chapterOneReviewPages();
const physical=p=>{assert(fs.existsSync(p),'Physical reference missing '+p);return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');};
let shots=0;
for(const stageId of STAGE45_IDS){
 const relevant=pages.filter(p=>p.stageId===stageId).flatMap(p=>p.shots.map(s=>({s,page:p})));
 assert.equal(relevant.length,48,stageId+' must have 48 canonical gender/branch shots');
 const bible=JSON.parse(fs.readFileSync('assets/story/characters/'+stageId+'-reference-bible.json','utf8'));
 const known=new Map(bible.actors.map(x=>[x.id,x]));
 const signatures=new Set();
 for(const {s,page} of relevant){
  assert(!signatures.has(s.key),'Duplicate canonical frame key '+s.key);signatures.add(s.key);
  const masterIds=[s.characterId,s.secondaryId].filter(Boolean);
  const refs=[...new Set(masterIds)].map(id=>{
   const b=known.get(id); const file=b?.path||'assets/story-cinema/cast/'+id+'.webp';
   return {id,path:file,sha:physical(file),rule:b?.visualRule||id};
  });
  const stylePath='assets/story/chapters/c01/panels/c01-s01-m02-'+s.gender+'.webp';
  const output=buildStage45ArtPrompt({stageId,stageName:page.stageName,
   edition:s.edition,gender:s.gender,
   shot:{id:s.shotId,text:s.scriptText,kind:s.sceneKind,scenery:s.scenery},
   actorRefs:refs,stageStory:bible.scene,
   styleRef:{gender:s.gender,path:stylePath,sha:physical(stylePath)}});
  const must=[s.key,s.scriptText,bible.scene,stylePath,'speech balloons',
   'P0 NO TEXT','P0 VISUAL STYLE LOCK','P0 VISIBLE CAST STRICT','16:9','P0 STAGE'];
  must.forEach(x=>assert(output.includes(x),'Per-shot instruction missing '+s.key+' / '+x));
  assert(output.includes(s.edition==='post-gameover'?'commander DEATH':
   s.edition==='pre'?'Outcome UNKNOWN':
   s.edition==='post-victory'?'VERIFIED VICTORY':'After DEFEAT'));
  shots++;
 }
}
assert.equal(shots,96);
assert.throws(()=>buildStage45ArtPrompt({
 stageId:'c01-s04',stageName:'森と遺構の調査',edition:'pre',gender:'female',
 shot:{id:'c01-s04-m1',text:'x'},actorRefs:[],stageStory:'forest',
 styleRef:{gender:'male',path:'c01-s01-m02-male.webp',sha:'abc'}
}),/matching-gender/);
const generator=fs.readFileSync('scripts/generate-story-chapter1-free-batch.mjs','utf8');
assert(generator.includes('buildStage45ArtPrompt({'),'Real generator must invoke stage45 guard every shot');
assert(generator.includes('styleRef?[...refs,styleRef]:refs'),'Physical style reference must enter FormData');
assert(generator.includes("form.append('input_image_'+i"),'Real image bytes must actually be posted');
assert(generator.includes("!STAGE45_IDS.includes(s.stage.id)"),'Stage4/5 cannot add invented hero');
console.log('PASS: 96 individually locked stage4/5 shot prompts and native same-gender references');
