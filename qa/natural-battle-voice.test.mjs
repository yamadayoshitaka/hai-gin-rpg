import assert from 'node:assert/strict';
import {createBattleVoiceDirector,bundledBattleVoiceLines,VOICE_MAX_VARIANTS} from '../src/battle-voice-library.js';
const fixtures=bundledBattleVoiceLines();
assert.equal(VOICE_MAX_VARIANTS,10);
assert.ok(Object.keys(fixtures).length>=10);
assert.deepEqual(fixtures['剣士'].attack,['この一撃で決める！','切り込むぞ！']);
const memory=new Map();
const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const voices=[],audio=[];
let requests=0;
const oldSpeech=globalThis.SpeechSynthesisUtterance,oldAudio=globalThis.Audio;
globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
globalThis.Audio=class{
 constructor(url){this.url=url;this.paused=true;audio.push(url)}
 play(){this.paused=false;return Promise.resolve()}
 pause(){this.paused=true}
};
const synth={speaking:false,getVoices:()=>[{lang:'ja-JP',name:'Google Japanese'}],speak:x=>voices.push(x.text),cancel:()=>{}};
try{
 const fetcher=async (url)=>{
  requests++;
  if(String(url).includes('manifest.json'))return{ok:true,json:async()=>({
   format:1,clips:{'剣士::attack::この一撃で決める！::male':'audio/voicevox/clips/0123456789abcdef.mp3',
                '剣士::attack::切り込むぞ！::male':'audio/voicevox/clips/fedcba9876543210.mp3'}
  })};
  return {ok:false,status:429};
 };
 const director=createBattleVoiceDirector({storage,synth,fetcher});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(director.status.recordedClips,2);
 assert.ok(director.preview('剣士','attack','male'));
 assert.equal(audio.length,1);
 assert.match(audio[0],/^\.\/audio\/voicevox\/clips\//);
 assert.equal(voices.length,0,'Do not synthesize twice when recorded clip works');
 assert.equal(director.preview('剣士','attack','female'),false);
 assert.equal(voices.length,0,'Female clip missing: remain silent rather than use electronic speech');
 assert.match(director.status.lastError,/未収録/);
 assert.equal(requests,1,'No Gemini calls by default');
 // Input phrase never leaves the client unless AI learning was explicitly enabled.
 assert.equal(director.learning,false);
 const fallbackDirector=createBattleVoiceDirector({storage,synth,fetcher});
 await new Promise(resolve=>setImmediate(resolve));
 globalThis.Audio=class{constructor(){}play(){return Promise.reject(new Error('audio load failed'))}pause(){}};
 const before=voices.length;
 assert.equal(fallbackDirector.preview('剣士','attack','male'),true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(voices.length,before,'Playback failure must never trigger electronic native TTS');
 assert.match(fallbackDirector.status.lastError,/電子音は再生しません/);
 console.log('Free battle voice: recorded-only, captions on unavailable clip, zero native TTS, no paid API PASS');
}finally{
 if(oldSpeech===undefined)delete globalThis.SpeechSynthesisUtterance;else globalThis.SpeechSynthesisUtterance=oldSpeech;
 if(oldAudio===undefined)delete globalThis.Audio;else globalThis.Audio=oldAudio;
}
