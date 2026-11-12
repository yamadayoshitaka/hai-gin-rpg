import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {comicForStage} from '../src/story-chapter-comic.js';
import {registeredStoryPanelAsset,storySheetCrop} from '../src/story-panel-registered-art.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const title=read('game.html'),town=read('town-hub.html'),map=read('world-map.html');

for(const [name,source] of [['title',title],['town',town]]){
 assert.match(source,/registeredStoryPanelAsset\(shot\)/,name+' must prioritize single-cut WebP');
 assert.match(source,/storySheetCrop\(shot,cells\)/,name+' must crop correct cell as fallback');
 assert.match(source,/style\.aspectRatio='16 \/ 9'/,name+' must show 16:9 panel only');
 assert.match(source,/import \{registeredStoryPanelAsset,storySheetCrop\} from '\.\/src\/story-panel-registered-art\.js'/);
 assert.doesNotMatch(source,/10コマを1ページにした漫画|2列5行の10コマ漫画/);
 const script=source.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
 assert(script,name+' must contain module script');
 const parsed=spawnSync(process.execPath,['--input-type=module','--check'],{input:script,encoding:'utf8'});
 assert.equal(parsed.status,0,name+' module syntax: '+parsed.stderr);
}
assert.match(title,/introFrames=comicForStage\('c01-s01','pre',introContext\)\.panels/);
assert.match(title,/id="introPanelImage"/);
assert.match(title,/introContext=\{protagonistGender:introGender\(\)\}/);
assert.match(town,/startPaperStory\('post'\)/,'Town exit must display event after');
assert.match(town,/eventIndex\+\+;eventRender\(\)/,'Every next-line changes the image too');
assert.match(town,/renderedTownFrame!==frameKey/,'Image cache must be panel-specific');
assert.match(map,/createMangaViewer/,'Map combat story viewer retained');

let n=0;
const all=new Set();
for(const gender of ['male','female']){
 for(const phase of ['pre','post']){
  const story=comicForStage('c01-s01',phase,{protagonistGender:gender});
  assert.equal(story.edition,phase==='post'?'post-town':'pre');
  assert.equal(story.panels.length,phase==='pre'?10:5);
  for(const scene of story.panels){
   const path=registeredStoryPanelAsset(scene);
   assert(path,'No exact artwork registered for '+scene.id+' '+gender+' '+phase);
   const rel=path.slice(2);
   assert(!all.has(rel),'Duplicate gender/outcome image path');
   all.add(rel);
   assert(existsSync(new URL('../'+rel,import.meta.url)),'Missing real game image '+rel);
   const crop=storySheetCrop(scene,story.pages.find(p=>p.number===scene.comicPage).cellCount);
   assert.equal(crop.column,scene.comicCell%2);
   assert.equal(crop.row,Math.floor(scene.comicCell/2));
   n++;
  }
 }
}
assert.equal(n,30);
console.log('PASS game title & town: 30 exact Stage 1 male/female pre/post images; single-panel display; event-after trigger; module syntax');
