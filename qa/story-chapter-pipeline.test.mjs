import assert from 'node:assert/strict';
import {CAMPAIGN_STAGES} from '../src/campaign-stage-plan.js';
import {comicForStage,comicEditionsForStage,comicChapterPlan,
 comicPageAsset,comicEditionKey,STORY_MAX_CELLS_PER_SHEET} from '../src/story-chapter-comic.js';

assert.equal(STORY_MAX_CELLS_PER_SHEET,10,'Ten is an upper page capacity, not a story length');
for(let chapter=1;chapter<=20;chapter++){
 const plan=comicChapterPlan(chapter);
 assert.equal(plan.stageCount,10);
 assert.equal(plan.stageIds.length,10);
 assert.deepEqual(plan.stageIds,CAMPAIGN_STAGES.filter(s=>s.chapter===chapter).map(s=>s.id));
 const ids=new Set();
 for(const s of CAMPAIGN_STAGES.filter(s=>s.chapter===chapter)){
  const editions=comicEditionsForStage(s.id);
  assert.ok(editions.length>=2);
  const keys=new Set(editions.map(e=>e.edition));
  assert.equal(keys.size,editions.length,'Duplicate branch key');
  if(s.kind!=='town'){
   assert.ok(keys.has('post-victory'+(chapter>=13?'-route-silver':'')));
   assert.ok(keys.has('post-defeat'+(chapter>=13?'-route-silver':'')));
   assert.notEqual(comicEditionKey(s.id,'post',{battleOutcome:{victory:true}}),
    comicEditionKey(s.id,'post',{battleOutcome:{victory:false}}));
  }
  for(const edition of editions){
   assert.ok(edition.panels.length>0,'Empty panels');
   const panelIds=new Set(edition.panels.map(x=>x.id));
   assert.equal(panelIds.size,edition.panels.length);
   assert.equal(edition.pages.reduce((n,p)=>n+p.cellCount,0),edition.panels.length);
   for(const page of edition.pages){
    assert.ok(page.cellCount>0&&page.cellCount<=STORY_MAX_CELLS_PER_SHEET);
    assert.equal(page.rows,Math.ceil(page.cellCount/2));
    assert.equal(page.columns,2);
    for(const sex of ['male','female']){
     const context={decision:edition.edition.match(/choice-([a-z]+)/)?.[1]||null,
       route:edition.edition.match(/route-([a-z]+)/)?.[1]||null,
       battleOutcome:edition.edition.includes('victory')?{victory:true}:
        edition.edition.includes('defeat')?{victory:false}:null,
       storyEnding:edition.edition.match(/ending-([a-z]+)/)?.[1]||null};
     const name=comicPageAsset(s.id,edition.phase,context,page.number,sex);
     assert.match(name,/\.webp$/);
     assert.ok(!ids.has(name),'Same gender/branch asset was reused '+name);
     ids.add(name);
    }
   }
  }
 }
}
const first=comicChapterPlan(1);
assert.equal(first.editions.filter(e=>e.phase==='pre').length,10);
assert.equal(first.editions.filter(e=>e.phase==='post'&&e.edition==='post-victory').length,9);
assert.equal(first.editions.filter(e=>e.phase==='post'&&e.edition==='post-defeat').length,9);
assert.equal(first.editions.filter(e=>e.phase==='post'&&e.edition==='post-town').length,1);
assert.equal(first.editions.length,29);
const defeated=comicForStage('c01-s02','post',{battleOutcome:{victory:false},protagonistGender:'female'});
const won=comicForStage('c01-s02','post',{battleOutcome:{victory:true},protagonistGender:'female'});
assert.notEqual(defeated.edition,won.edition);
assert.notEqual(defeated.panels[0].text,won.panels[0].text);
assert.ok(defeated.panels.every(p=>p.protagonistGender==='female'));
assert.match(defeated.panels.at(-1).text,/町へ/);
const decision='c02-s05';
const neutral=comicForStage(decision,'pre',{});
const chosen=comicForStage(decision,'pre',{decision:'rescue'});
assert.equal(chosen.panels.length,neutral.panels.length+1);
assert.match(chosen.panels.at(-2).text,/避難民の保護を優先/);
assert.throws(()=>comicForStage(decision,'pre',{decision:'nonexistent'}));
const routing=comicForStage('c13-s02','pre',{route:'verdant'});
assert.ok(routing.edition.includes('route-verdant'));
assert.ok(routing.panels.some(p=>p.text.includes('翠嵐協力')));
const ending=comicForStage('c20-s10','post',{route:'silver',storyEnding:'release',
 battleOutcome:{victory:true}});
assert.ok(ending.edition.includes('ending-release'));
assert.match(ending.panels.at(-1).text,/解放の朝/);
const beforeOutcome=comicForStage('c01-s02','pre',{battleOutcome:{victory:false}});
assert.ok(beforeOutcome.panels.every((p,i)=>p.text===comicForStage('c01-s02','pre',{}).panels[i].text));
assert.equal(comicPageAsset('c01-s01','pre',{},1,'unspecified'),null);
console.log('PASS all 20 chapter plans: ten stages each, dynamic counts, separate victory/defeat/choice/route/ending variants and male/female page paths');
