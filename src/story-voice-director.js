/**
 * Dialogue voice for story panels. Prefer existing FREE VOICEVOX clips, then
 * stable device Japanese synthesis. This module NEVER calls a paid AI API.
 */
import {STORY_KEY_PEOPLE} from './story-cinematic.js';
const characters={
 lucia:['四国めたん',.95,1.1],garan:['ちび式じい',.82,.77],iris:['雨晴はう',.92,1.16],
 shion:['玄野武宏',.94,.88],kai:['白上虎太郎',1.07,1.03],leon:['剣崎雌雄',.87,.80],
 fio:['九州そら',.96,1.09],edo:['栗田まろん',.89,.91],mina:['春歌ナナ',1.04,1.30],
 noel:['中国うさぎ',.93,1.12],raizen:['玄野武宏',.86,.80],vald:['麒ヶ島宗麟',.78,.74],
 selika:['四国めたん',.92,1.12],zahar:['栗田まろん',.90,.84],grad:['剣崎雌雄',.85,.74],
 altea:['九州そら',.89,1.02],orphe:['雀松朱司',.94,.83],meve:['冥鳴ひまり',.95,1.06],
 elne:['波音リツ',.90,1.06],vess:['麒ヶ島宗麟',.82,.73]
};
export const STORY_VOICE_PROFILES=Object.freeze(Object.fromEntries(
 STORY_KEY_PEOPLE.map(person=>[person.id,Object.freeze({
  characterId:person.id,name:person.name,
  voicevoxSpeaker:characters[person.id]?.[0]||'玄野武宏',
  rate:characters[person.id]?.[1]||.9,pitch:characters[person.id]?.[2]||1
 })])
));
export const STORY_NARRATOR_PROFILE=Object.freeze({voicevoxSpeaker:'玄野武宏',rate:.88,pitch:.94});
const manifestPath='./audio/voicevox/manifest.json';
let manifestPromise;
const manifest=()=>manifestPromise??=(typeof fetch==='function'?
 fetch(manifestPath).then(r=>r.ok?r.json():null).catch(()=>null):Promise.resolve(null));
const safeClip=clip=>typeof clip==='string'&&/^audio\/voicevox\/clips\/[a-f\d]{16}\.(wav|mp3)$/.test(clip);
const clipUrl=clip=>{
 // This repo already uses the raw GitHub asset origin for prerecorded VOICEVOX
 // clips on GitHub Pages, keeping the deploy archive small.
 return location.hostname.endsWith('.github.io')
  ?'https://raw.githubusercontent.com/yamadayoshitaka/hai-gin-rpg/main/'+clip:'./'+clip;
};
export function createStoryVoiceDirector({onPlaying=()=>{}}={}){
 let token=0,audio=null,loadedManifest=null;
 // Preload once so first-touch speech is not blocked by an asynchronous fetch.
 void manifest().then(data=>{loadedManifest=data;});
 function stop(){
  ++token;
  if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}
  try{globalThis.speechSynthesis?.cancel()}catch{}
  onPlaying(false);
 }
 function useDeviceVoice(line,profile,id){
  if(!('speechSynthesis' in globalThis)||!('SpeechSynthesisUtterance' in globalThis))return false;
  const utter=new SpeechSynthesisUtterance(line);
  const voices=speechSynthesis.getVoices().filter(v=>v.lang?.toLowerCase().startsWith('ja'));
  const preferred=voices.find(v=>v.localService)||voices[0];
  if(preferred){
   // Sort by name for deterministic character-to-voice assignment instead of
   // changing voices on every page. Never pretend these are VOICEVOX clips.
   const sorted=[...voices].sort((a,b)=>a.name.localeCompare(b.name,'ja'));
   const personIndex=STORY_KEY_PEOPLE.findIndex(x=>x.id===id);
   utter.voice=sorted[Math.max(0,personIndex)%sorted.length]||preferred;
  }
  utter.lang='ja-JP';utter.rate=profile.rate;utter.pitch=profile.pitch;utter.volume=.94;
  utter.onend=()=>onPlaying(false);utter.onerror=()=>onPlaying(false);
  try{speechSynthesis.speak(utter);onPlaying(true);return true}catch{return false;}
 }
 async function speak(panel){
  stop();
  const seq=token;
  if(!panel?.text)return false;
  const id=panel.characterId;
  const profile=STORY_VOICE_PROFILES[id]||STORY_NARRATOR_PROFILE;
  const text=String(panel.text).slice(0,380);
  const key='story::panel::'+panel.id+'::'+text+'::'+profile.voicevoxSpeaker;
  const clip=loadedManifest?.clips?.[key];
  if(safeClip(clip)&&'Audio' in globalThis){
   try{
    const sound=new Audio(clipUrl(clip));audio=sound;sound.volume=.88;
    sound.onended=()=>{if(seq===token){audio=null;onPlaying(false);}};
    sound.onerror=()=>{if(seq===token){audio=null;useDeviceVoice(text,profile,id);}};
    await sound.play();if(seq===token)onPlaying(true);return true;
   }catch{
    if(seq!==token)return false;
    audio=null;
   }
  }
  if(seq!==token)return false;
  return useDeviceVoice(text,profile,id);
 }
 return {speak,stop,get playingRecorded(){return Boolean(audio&&!audio.paused);}};
}
