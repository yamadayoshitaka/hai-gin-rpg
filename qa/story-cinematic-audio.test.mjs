import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SourceTextModule} from 'node:vm';
import {STORY_KEY_PEOPLE,STORY_KEY_PERSON_BY_NAME,cinematicScenesForChapter,
 storyCastForChapter,illustratedStorySvg,illustratedStoryDataUri} from '../src/story-cinematic.js';
import {GAME_PAGE_MUSIC} from '../src/game-page-audio.js';

assert.equal(STORY_KEY_PEOPLE.length,20,'the story must have exactly 20 individually written key characters');
assert.equal(new Set(STORY_KEY_PEOPLE.map(p=>p.id)).size,20);
assert.equal(new Set(STORY_KEY_PEOPLE.map(p=>p.name)).size,20);
for(const p of STORY_KEY_PEOPLE){
 assert.ok(p.role.length>1&&p.secret.length>8&&p.arc.length>8,
  p.name+' needs a role, a secret and a personal story arc');
}
for(const faction of ['灰銀','紅炎','翠嵐','鐘守','記録院'])
 assert.ok(STORY_KEY_PEOPLE.some(p=>p.faction===faction),faction+' must participate');
assert.equal(STORY_KEY_PERSON_BY_NAME.get('老騎士ガラン')?.id,'garan');
assert.equal(STORY_KEY_PERSON_BY_NAME.get('エルネの残響')?.id,'elne');
const pictures=new Set();
for(let chapter=1;chapter<=20;chapter++){
 const scenes=cinematicScenesForChapter(chapter);
 assert.equal(scenes.length,8,'each chapter must have eight cinematic panels');
 assert.ok(scenes.filter(x=>x.characterId).length>=4,'scene must have named characters talking, not only a narrator');
 assert.ok(new Set(scenes.map(x=>x.speaker)).size>=4);
 assert.ok(scenes.every(x=>x.text.length>=9));
 assert.ok(storyCastForChapter(chapter).length>=4);
 assert.ok(scenes.some(s=>s.type==='confrontation'&&s.faction==='紅炎'||s.faction==='翠嵐'||s.faction==='鐘守'||s.faction==='記録院'),
 'every chapter should have real cross-faction stakes');
 const art=illustratedStorySvg(chapter,0);
 assert.match(art,/<svg[^>]+viewBox="0 0 1100 625"/);
 assert.match(art,/城郭と進軍の絵/);
 assert.ok(illustratedStoryDataUri(chapter,0).startsWith('data:image/svg+xml;charset=utf-8,'));
 pictures.add(illustratedStorySvg(chapter,0));
}
assert.equal(pictures.size,20,'20 chapters cannot share one unchanging painted background');
for(const key of ['title','opening','map','paper'])assert.ok(/\.(ogg|mp3)$/.test(GAME_PAGE_MUSIC[key]));

const file=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const htmls=['game.html','town-hub.html','world-map.html','tactics-wireframe.html'];
for(const name of htmls){
 const html=file(name);
 const scripts=[...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length,name+' needs at least one module script');
 for(const script of scripts)new SourceTextModule(script[1],{identifier:name});
}
const title=file('game.html'),town=file('town-hub.html');
const map=file('world-map.html'),battle=file('tactics-wireframe.html');
assert.match(title,/id="introArt"/);
assert.match(title,/mangaForStage\('c01-s01'\)/);
assert.match(title,/pageAudio\.changeScene\('title'\)/);
assert.match(title,/pageAudio\.effect\('select'\)/);
assert.match(town,/mangaForStage\(game\.townStage\)/);
assert.match(town,/id="eventSceneImage"/);
assert.match(town,/id="eventSpeaker"/);
assert.match(town,/speakTownLine\(shot\.text,shot\.characterId\)/);
assert.match(town,/townAudio\.setScene\('paper',cue\.url\)/);
assert.match(map,/storyCastForChapter\(chapter\)/);
assert.match(map,/id="worldBgm"/);
assert.match(map,/mapAudio\.effect\('select'\)/);
assert.match(battle,/frontierLine\.visible=false;scene\.add\(frontierLine\)/,
 'unwanted overhead guide line is removed, without hiding squad command callouts');
assert.match(battle,/effectsOnly:true/,'battle selects use chime without duplicate page BGM');
assert.match(file('src/town-audio-director.js'),/paper:'\.\/assets\/audio\/battle\/ruins\.ogg'/);
console.log('PASS 20 key characters, 160 illustrated chapter scenes, music and selection FX');
