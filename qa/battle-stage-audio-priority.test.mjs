import assert from 'node:assert/strict';
import {readFileSync,statSync,openSync,readSync,closeSync} from 'node:fs';
import {STAGE_PRESETS} from '../src/stage-library.js';
import {soundtrackForStage,BATTLE_SOUNDTRACK_THEMES} from '../src/battle-stage-soundtrack.js';
import {createBattleCeremony} from '../src/battle-ceremony.js';
import {createBattleOrchestralScore} from '../src/battle-orchestral-score.js';
import {createBattleReportSpeech} from '../src/battle-report-speech.js';
import {createBattleVoiceDirector} from '../src/battle-voice-library.js';

const game=readFileSync(new URL('../tactics-wireframe.html',import.meta.url),'utf8');
const menu=readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.match(game,/battleCeremony\.startIntro\(\{stageName:selectedStage\.name,stageFeature:stageCharacter\.feature\}\)/);
assert.match(game,/battleAudio\.setStage\(selectedStage\)/);
assert.match(game,/onPlaybackChange:active=>battleAudio\.setMessagePriority\(active\)/);
assert.match(game,/battleVoice\.setMessagePriority\(active\)/);
assert.match(game,/battleScore\.setNarrationActive\(active\)/);
assert.match(menu,/統合ゲーム（50対50）/);
const themes=new Set(STAGE_PRESETS.map(stage=>soundtrackForStage(stage).id));
assert.ok(themes.size>=6,'Stage selection must provide six or more distinct recorded music identities');
for(const theme of Object.values(BATTLE_SOUNDTRACK_THEMES)){
 const path=new URL('../assets/audio/battle/'+theme.file,import.meta.url);
 assert.ok(statSync(path).size>100000,'Stage music is packaged, not external: '+theme.file);
 const fd=openSync(path,'r'),magic=Buffer.alloc(4);
 try{readSync(fd,magic,0,4,0)}finally{closeSync(fd)}
 if(theme.file.endsWith('.ogg'))assert.equal(magic.toString(),'OggS');
 else assert.ok(magic.toString().startsWith('ID3')||(magic[0]===0xff&&magic[1]>=0xe0));
}
assert.equal(soundtrackForStage({id:'royal-castle',biome:'temperate'}).id,'castle');
assert.equal(soundtrackForStage({id:'deep-forest',biome:'forest'}).id,'forest');
assert.equal(soundtrackForStage({id:'sunscar-desert',biome:'desert'}).id,'desert');
assert.equal(soundtrackForStage({id:'white-pass',biome:'snow'}).id,'snow');
assert.equal(soundtrackForStage({id:'custom-test',biome:'ruins'}).id,'ruins');
assert.equal(soundtrackForStage({id:'river-port',biome:'coast'}).id,'coast');

function mockElement(){
 return {children:[],style:{},hidden:false,textContent:'',offsetWidth:32,
  appendChild(x){this.children.push(x);return x;},querySelector(q){return this.lookup?.[q]||(this.lookup??={})[q]=mockElement()}};
}
const doc={head:mockElement(),body:mockElement(),createElement:()=>mockElement()};
const ceremony=createBattleCeremony({documentRef:doc});
ceremony.startIntro({stageName:'木霊の深森',stageFeature:'樹海の獣道・巨木の群落'});
const el=doc.body.children[0];
assert.equal(el.querySelector('.ceremonyStage').textContent,'ステージ：木霊の深森');
assert.equal(el.querySelector('.ceremonyStage').hidden,false);
assert.equal(el.querySelector('.ceremonyTitle').textContent,'開戦');
assert.match(el.querySelector('.ceremonySub').textContent,/樹海/);
assert.equal(ceremony.locked,true);

const score=createBattleOrchestralScore({AudioContextClass:null,AudioClass:null});
score.setStage({id:'deep-forest',biome:'forest'});
assert.equal(score.status.stageThemeId,'forest');
score.setNarrationActive(true);
assert.equal(score.status.narrationActive,true);
score.setPhase('victory');
assert.equal(score.phase,'victory');
score.setPhase('battle');
assert.equal(score.status.stageThemeId,'forest');

const oldAudio=globalThis.Audio;
const generated=[];
let stamp=100000,playing=[];
globalThis.Audio=class {
 constructor(src){this.src=src;this.volume=0;generated.push(this)}
 play(){return Promise.resolve()}
 pause(){}
};
const stored={getItem:()=>null,setItem(){}};
try{
 const voice=createBattleVoiceDirector({storage:stored,now:()=>stamp,
  fetcher:async()=>({ok:true,json:async()=>({clips:{
   '剣士::attack::この一撃で決める！::male':'audio/voicevox/clips/0123456789abcdef.wav'
  }})})});
 await new Promise(resolve=>setImmediate(resolve));
 voice.unlock();
 assert.equal(voice.preview('剣士','attack','male'),true);
 assert.equal(generated[0].volume,.32,'Character voice default remains discreet');
 voice.setMessagePriority(true);
 assert.equal(generated[0].volume,.20,'Existing character clip is automatically ducked by message');
 let active=[];
 const spoken='前線が押されている！守備を固めろ！';
 const report=createBattleReportSpeech({storage:stored,now:()=>stamp,AudioCtor:globalThis.Audio,
  fetcher:async()=>({ok:true,json:async()=>({clips:{
   ['report::warning::'+spoken+'::麒ヶ島宗麟']:'audio/voicevox/clips/abcdefabcdefabcd.wav'
  }})}),onPlaybackChange:v=>active.push(v)});
 await new Promise(resolve=>setImmediate(resolve));
 report.unlock();
 assert.equal(report.enqueue({key:'warning:1',speaker:'軍師',text:'味方が劣勢です',priority:80}),true);
 assert.equal(report.update(),true);
 assert.equal(generated[1].volume,1,'Narrated military messages are the main loud audio');
 assert.deepEqual(active,[true]);
 assert.equal(voice.status.playing,1,'Characters and report must overlap without stopping each other');
 generated[1].onended();
 assert.deepEqual(active,[true,false]);
 voice.setMessagePriority(false);
 assert.equal(generated[0].volume,.32);
}finally{
 if(oldAudio===undefined)delete globalThis.Audio;else globalThis.Audio=oldAudio;
}
console.log('PASS opening battle stage, 7 CC0 stage themes, loud priority narration, soft simultaneous character voice');
