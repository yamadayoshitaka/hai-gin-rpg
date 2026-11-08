import assert from 'node:assert/strict';
import {readFileSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {createBattleCeremony} from '../src/battle-ceremony.js';
import {createBattleOrchestralScore} from '../src/battle-orchestral-score.js';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const music=readFileSync(new URL('../src/battle-orchestral-score.js',import.meta.url),'utf8');
for(const name of ['battle','victory','defeat']){
 const uri=new URL('../assets/audio/battle/'+name+'.ogg',import.meta.url);
 assert.ok(statSync(uri).size>100000,'Packaged CC0 '+name+' recording must exist');
 const fd=openSync(uri,'r'),header=Buffer.alloc(4);
 try{readSync(fd,header,0,4,0)}finally{closeSync(fd)}
 assert.equal(header.toString(),'OggS','Only a real OGG recording may be published: '+name);
 assert.ok(music.includes("assets/audio/battle/"+name+".ogg"),name+' playback must be wired');
}
const musicLicenses=readFileSync(new URL('../assets/audio/battle/LICENSES.md',import.meta.url),'utf8');
assert.match(musicLicenses,/CC0/);

assert.match(game,/battleCeremony\.startIntro\(\)/,'Intro is shown at the actual battle start');
assert.match(game,/battleCeremony\.update\(\)/,'Intro/ending uses the animation loop clock');
assert.match(game,/battleCeremony\.locked\|\|paused\|\|finished/,'AI must not run during start or ending');
assert.match(game,/if\(!battleCeremony\.locked\)return/,'Touch/key/click capture is gated');
assert.match(game,/event\.stopImmediatePropagation\(\)/,'Locked input cannot reach battlefield handlers');
assert.match(game,/completeBattle\(false,\{title:'降参・敗北'/);
assert.match(game,/battleCeremony\.showOrder\(message\)/);
assert.match(game,/battleAudio\.orderFanfare\(\)/);
assert.match(game,/軍師戦死：命令不可（自動行動）/);
assert.match(game,/label\.userDataStrength\.textContent='残存 '/);
assert.match(game,/squadCommanderUnavailableReason\(selectedSquadId\)/);
assert.match(game,/setBattleCamera\(new THREE\.Vector3\(x,terrainY\(x,z\),z\),\s*new THREE\.Vector3\(\.02,Math\.ceil\(WORLD_SIZE\*CELL\*1\.36\),\.02\)\)/);
assert.match(game,/createBattleOrchestralScore\(\)/);

const elements={};
function mockElement(){
 const el={hidden:false,children:[],style:{},className:'',textContent:'',offsetWidth:40,
  appendChild(v){this.children.push(v);return v;},
  querySelector(sel){return elements[sel]||(elements[sel]=mockElement());}};
 return el;
}
const doc={head:mockElement(),body:mockElement(),createElement:()=>mockElement()};
let time=100,phase='',introDone=0,outroDone=0;
const cinematic=createBattleCeremony({documentRef:doc,now:()=>time,
 onPhase:p=>{phase=p},onIntroFinished:()=>{introDone++},
 onOutroFinished:()=>{outroDone++}});
cinematic.startIntro();
assert.equal(cinematic.locked,true);
assert.equal(phase,'intro');
time+=2300;cinematic.update();
assert.equal(cinematic.locked,true,'Intro remains locked until the full reveal');
time+=101;cinematic.update();
assert.equal(cinematic.locked,false);
assert.equal(introDone,1);
cinematic.showOrder('第一隊、突撃！');
assert.equal(cinematic.locked,false,'Orders may play while battle controls remain available');
time+=1300;cinematic.update();
cinematic.finish(true);
assert.equal(phase,'victory');
assert.equal(cinematic.locked,true);
time+=3501;cinematic.update();
assert.equal(outroDone,1);
assert.equal(cinematic.locked,false);
cinematic.finish(false);
assert.equal(phase,'defeat');
assert.equal(cinematic.locked,true);

const score=createBattleOrchestralScore({AudioContextClass:null,AudioClass:null});
assert.equal(score.phase,'battle');
score.setPhase('intro');assert.equal(score.phase,'intro');
score.setPhase('victory');assert.equal(score.phase,'victory');
score.setPhase('defeat');assert.equal(score.phase,'defeat');
score.setEnabled(false);assert.equal(score.enabled,false);
console.log('Battle start/end input lock, cut-in order, fallen-command text and 4 music phases PASS');
