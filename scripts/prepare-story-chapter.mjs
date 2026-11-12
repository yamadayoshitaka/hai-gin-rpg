#!/usr/bin/env node
/**
 * Chapter-at-a-time production plan. Does NOT draw or pretend to approve art.
 *
 * node scripts/prepare-story-chapter.mjs --chapter 1
 * node scripts/prepare-story-chapter.mjs --all
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {comicChapterPlan,comicPageAsset} from '../src/story-chapter-comic.js';
import {STORY_CHAPTERS} from '../src/story-chapters.js';
import {STORY_KEY_PEOPLE} from '../src/story-cinematic.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const all=args.includes('--all'),at=args.indexOf('--chapter');
if((all&&at>=0)||(!all&&at<0))throw Error('Use --chapter 1..20 OR --all');
const chosen=all?Array.from({length:20},(_,i)=>i+1):[Number(args[at+1])];
const cast=new Map(STORY_KEY_PEOPLE.map(p=>[p.id,p]));
const pad=n=>String(n).padStart(2,'0');
export function produceChapterPlan(chapter){
 const chapterSource=STORY_CHAPTERS[Number(chapter)-1];
 const plan=comicChapterPlan(chapter);
 const work=plan.editions.map(edition=>{
  const pages=edition.pages.map(page=>{
   const outputs=Object.fromEntries(['male','female'].map(gender=>{
    const relative=comicPageAsset(edition.stageId,edition.phase,
     {decision:edition.edition.match(/choice-([a-z]+)/)?.[1]||null,
      route:edition.edition.match(/route-([a-z]+)/)?.[1]||null,
      battleOutcome:edition.edition.includes('victory')?{victory:true}:
       edition.edition.includes('defeat')?{victory:false}:null,
      storyEnding:edition.edition.match(/ending-([a-z]+)/)?.[1]||null},
     page.number,gender).replace(/^\.\//,'');
    return [gender,relative];
   }));
   return {number:page.number,columns:page.columns,rows:page.rows,
    panelCount:page.cellCount,panelIds:page.panelIds,
    expectedPixels:[1536,page.rows*432],
    files:outputs,
    referenceImagePolicy:'Attach actual image references for every named character; URL strings alone are not visual references'};
  });
  return {stageId:edition.stageId,stageName:edition.stageName,
   phase:edition.phase,edition:edition.edition,sceneCount:edition.panels.length,
   panels:edition.panels.map(p=>({
    id:p.id,characterId:p.characterId,secondaryId:p.secondaryId,
    speaker:p.speaker,text:p.text,voiceText:p.voiceText,
    role:p.role,scenery:p.scenery,page:p.comicPage,cell:p.comicCell+1,
    references:[p.characterId,p.secondaryId].filter(Boolean)
     .map(id=>({id,name:cast.get(id)?.name,
      master:edition.stageId==='c01-s01'&&id==='lucia'
       ?'assets/story/characters/lucia/master.webp'
       :'assets/story-cinema/cast/'+id+'.webp',
      status:edition.stageId==='c01-s01'&&id==='lucia'?'dedicated-master':'reference-needs-verification'}))
   })),pages};
 });
 const file={schemaVersion:1,chapter:plan.chapter,chapterTitle:chapterSource.title,
  synopsis:chapterSource.synopsis,stageCount:plan.stageCount,stageIds:plan.stageIds,
  editionCount:work.length,panelCount:work.reduce((n,w)=>n+w.sceneCount,0),
  requiredPages:work.reduce((n,w)=>n+w.pages.length*2,0),
  status:'production-plan-only-not-illustrations',
  standards:{pageColumns:2,maxCellsPerPage:10,
   noFixedSceneCount:true,alwaysSeparateGender:true,
   neverReuseVictoryArtworkForDefeat:true,
   requireActualImageAndHumanApproval:true,
   noAutoPaidGeneration:true},
  variants:work};
 return file;
}
await fs.mkdir(path.join(root,'qa-reports','story-chapters'),{recursive:true});
for(const n of chosen){
 const plan=produceChapterPlan(n);
 const file=path.join(root,'qa-reports','story-chapters','c'+pad(n)+'-production.json');
 await fs.writeFile(file,JSON.stringify(plan,null,2)+'\n','utf8');
 console.log(JSON.stringify({chapter:n,stages:plan.stageCount,editions:plan.editionCount,
  scenes:plan.panelCount,requiredGenderSeparatedPages:plan.requiredPages,plan:file,
  status:plan.status}));
}
