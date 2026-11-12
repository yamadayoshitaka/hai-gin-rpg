/**
 * Auditable, no-paid-API inventory and shotlist for EVERY story panel.
 *
 * The coverage JSON only counts actual, nonempty WebP files already placed
 * under assets/story/panels/. It never describes a generated prompt, chapter
 * collage, SVG substitute, or temporary work-in-progress as finished art.
 *
 * Run: node scripts/build-story-art-coverage.mjs
 * CI copies assets/story/panel-art-coverage.json to GitHub Pages, where the
 * read-only story-maintenance screen can show chapter-by-chapter counts.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {mangaForStage} from '../src/story-stage-manga.js';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {STORY_CHAPTERS} from '../src/story-chapters.js';
import {STORY_KEY_PEOPLE} from '../src/story-cinematic.js';
import {individualStoryPanelAsset} from '../src/story-cinematic-assets.js';

const repoRoot=path.resolve(new URL('..',import.meta.url).pathname);
const artRoot=path.join(repoRoot,'assets/story/panels');
const output=path.join(repoRoot,'assets/story/panel-art-coverage.json');
const reviewOutput=path.join(repoRoot,'qa-reports/story-art-shotlist.json');
const ids=new Map(STORY_KEY_PEOPLE.map(p=>[p.id,p]));
const panelTypes=['wide environmental establishing shot','dramatic character introduction','dialogue two-shot',
 'close-up of the chapter-specific clue','dynamic confrontation','silent character decision','transition toward the next stage'];
const strongIssues=[];
const fileCache=new Map();
const contentHashOwner=new Map();
async function realWebp(p){
 if(!p)return null;
 const relative=p.replace(/^\.\//,'');
 if(!/^assets\/story\/panels\/c\d{2}-s\d{2}-m(?:0[1-9]|10)(?:-female)?\.webp$/.test(relative))
  throw Error('Unsafe panel art path: '+relative);
 if(fileCache.has(relative))return fileCache.get(relative);
 let data;
 try{data=await fs.readFile(path.join(repoRoot,relative));}
 catch(e){if(e.code==='ENOENT'){fileCache.set(relative,null);return null;}throw e;}
 if(data.length<12000||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WEBP'){
  strongIssues.push({path:relative,error:'Not an actual, nonempty WebP image'});
  fileCache.set(relative,null);return null;
 }
 const sha256=crypto.createHash('sha256').update(data).digest('hex');
 const original=contentHashOwner.get(sha256);
 if(original&&original!==relative)strongIssues.push({
  path:relative,error:'Exact image reused under a different panel filename',firstUsedAt:original
 });
 else contentHashOwner.set(sha256,relative);
 const result={path:relative,bytes:data.length,sha256};
 fileCache.set(relative,result);return result;
}
const results=[];
const shotlist=[];
for(const stage of CAMPAIGN_STAGES){
 const chapter=STORY_CHAPTERS[stage.chapter-1];
 const shots=mangaForStage(stage.id,{protagonistGender:'unspecified'}).panels;
 if(shots.length!==10)throw Error('Wrong panel count: '+stage.id);
 for(const p of shots){
  const male=await realWebp(individualStoryPanelAsset({...p,protagonistGender:'male'}));
  const female=await realWebp(individualStoryPanelAsset({...p,protagonistGender:'female'}));
  const shared=male&&female&&male.path===female.path;
  const npc=[p.characterId,p.secondaryId].filter(Boolean).map(id=>{
   const c=ids.get(id);if(!c)throw Error('Unknown character: '+id);
   return {id,name:c.name,faction:c.faction,role:c.role};
  });
  results.push({id:p.id,chapter:stage.chapter,stage:stage.id,male:male?.path||null,
   female:female?.path||null,sharedNeutral:Boolean(shared)});
  for(const gender of ['male','female']){
   const candidate=gender==='male'?male:female;
   if(candidate)continue;
   shotlist.push({
    panelId:p.id,stageId:stage.id,chapter:stage.chapter,chapterTitle:chapter.title,
    location:chapter.location,stageName:stage.name,gender,
    camera:panelTypes[p.index]||panelTypes[0],
    expression:p.expression,emotion:p.mood,
    phase:p.phase,requiresOutcomeNeutralArt:p.phase==='post'&&stage.kind!=='town',
    characters:npc,
    narration:p.text,
    outputPath:'assets/story/panels/'+p.id.replace(/-m(\d{1,2})$/,(_,n)=>'-m'+String(n).padStart(2,'0'))+
      (gender==='female'?'-female':'')+'.webp',
    artDirection:'A SINGLE standalone horizontal 16:9 cinematic fantasy RPG illustration depicting THIS specific scene. Natural dynamic staging and period-consistent costumes. Use the canonical character ID portrait references, the location and actions described in the narration. The protagonist gender is '+gender+'. '+(p.phase==='post'&&stage.kind!=='town'?'POST-BATTLE OUTCOME-NEUTRAL ART: This exact image is reused for both victory and defeat. Show the surviving cast reflecting on the aftermath without depicting a confirmed victory, defeat, casualties, trophy, celebration or next-stage unlock. The game overlays the verified outcome-specific dialogue. ':'')+'No text, no UI, no gameplay screenshot, no collage, no repeated chapter backdrop, no splash screen, no invented characters, no copying another franchise character.',
    note:'A shotlist entry is an UNGENERATED instruction; never report it as completed art.'
   });
  }
 }
}
const byChapter=STORY_CHAPTERS.map(ch=>{
 const panels=results.filter(p=>p.chapter===ch.id);
 return {chapter:ch.id,title:ch.title,total:panels.length,
  maleDedicated:panels.filter(p=>p.male).length,
  femaleSpecific:panels.filter(p=>p.female&&!p.sharedNeutral).length,
  sharedNeutral:panels.filter(p=>p.sharedNeutral).length,
  femaleUsable:panels.filter(p=>p.female).length,
  maleMissing:panels.filter(p=>!p.male).length,
  femaleMissing:panels.filter(p=>!p.female).length};
});
const stats={
 totalChapters:STORY_CHAPTERS.length,totalStages:CAMPAIGN_STAGES.length,totalPanels:results.length,
 maleDedicated:results.filter(p=>p.male).length,
 femaleSpecific:results.filter(p=>p.female&&!p.sharedNeutral).length,
 genderNeutralShared:results.filter(p=>p.sharedNeutral).length,
 femaleUsable:results.filter(p=>p.female).length,
 maleMissing:results.filter(p=>!p.male).length,
 femaleMissing:results.filter(p=>!p.female).length,
 pendingArtInstructions:shotlist.length,
};
if(stats.totalPanels!==2000||stats.totalChapters!==20||stats.totalStages!==200)throw Error('Story schema unexpectedly changed');
if(strongIssues.length)throw Error('Invalid or reused panel artwork: '+JSON.stringify(strongIssues.slice(0,8)));
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.mkdir(path.dirname(reviewOutput),{recursive:true});
await fs.writeFile(output,JSON.stringify({schemaVersion:1,note:'Only real, verified scene-specific files count; conceptual chapter/composite images and SVG do not count.',stats,byChapter,present:results.filter(p=>p.male||p.female)},null,2)+'\n');
await fs.writeFile(reviewOutput,JSON.stringify({schemaVersion:1,summary:stats,pending:shotlist},null,2)+'\n');
console.log('Story art inventory:',JSON.stringify(stats));
console.log('Per-chapter:',JSON.stringify(byChapter));
