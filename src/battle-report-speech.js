/**
 * Natural prerecorded military dispatches. No electronic Web Speech fallback.
 *
 * Exact live quantities, squad names, and positions remain in the message box.
 * A brief semantically matching, professionally synthesized prerecorded line
 * plays when available. No runtime TTS APIs, Gemini calls, or paid services.
 */
import {BATTLE_REPORT_VOICES,reportAudioCategory,reportAudioKey} from './battle-report-voice-lines.js';

export function createBattleReportSpeech({
 storage=globalThis.localStorage,
 fetcher=globalThis.fetch,
 AudioCtor=globalThis.Audio,
 enabled=()=>true,
 now=()=>Date.now(),
 onError=()=>{},
 onPlaybackChange=()=>{}
}={}){
 const PREF='hai-gin-report-speech-v1';
 let optedIn=true;
 try{optedIn=storage?.getItem(PREF)!=='off'}catch{}
 let unlocked=false,current=null,lastStarted=0,spokenCount=0,lastError='';
 let queue=[],manifestReady=false,recordedClips={},availableCount=0;
 const notifyPlayback=active=>{try{onPlaybackChange(Boolean(active))}catch{}};
 const stopCurrent=audio=>{
  if(current?.audio!==audio)return;
  current=null;notifyPlayback(false);
 };
 const clean=text=>String(text??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,170);
 const supported=()=>typeof AudioCtor==='function';
 const validPath=value=>typeof value==='string'&&/^audio\/voicevox\/clips\/[a-f0-9]{16}\.(wav|mp3)$/.test(value);
 if(typeof fetcher==='function'){
  Promise.resolve().then(()=>fetcher('./audio/voicevox/manifest.json?v=reports-1',{cache:'no-store'}))
   .then(response=>response?.ok?response.json():null)
   .then(data=>{
    if(data&&typeof data.clips==='object'&&data.clips){
     recordedClips=Object.fromEntries(Object.entries(data.clips)
      .filter(([key,value])=>key.startsWith('report::')&&validPath(value)));
     availableCount=Object.keys(recordedClips).length;
    }
   }).catch(()=>{}).finally(()=>{manifestReady=true});
 }else manifestReady=true;

 function enqueue(report){
  const line=clean(report?.text),category=reportAudioCategory(report);
  // Unsupported messages are visual only; never substitute an unrelated voice.
  if(!line||!category)return false;
  const key=String(report?.key||line);
  if(current?.key===key||queue.some(x=>x.key===key))return false;
  const item={key,line,category,speaker:report.speaker||BATTLE_REPORT_VOICES[category].speaker,
   priority:Number(report.priority)||0,created:now()};
  if(item.priority>=80)queue=queue.filter(x=>x.priority>=80);
  queue.push(item);
  queue.sort((a,b)=>b.priority-a.priority||a.created-b.created);
  if(queue.length>4)queue.length=4;
  return true;
 }
 function findRecording(item){
  const profile=BATTLE_REPORT_VOICES[item.category];
  if(!profile||profile.speaker!==item.speaker)return null;
  // Limit replay to actual selected report categories, not arbitrary messages.
  const choices=[];
  for(const line of profile.lines)for(const speaker of profile.voices){
   const path=recordedClips[reportAudioKey(item.category,line,speaker)];
   if(path)choices.push({path,line});
  }
  return choices.length?choices[Math.floor(Math.random()*choices.length)]:null;
 }
 function update(){
  if(!optedIn||!unlocked||!enabled()||!supported()||current||!manifestReady)return false;
  const stamp=now();
  if(stamp-lastStarted<800)return false;
  queue=queue.filter(item=>stamp-item.created<18000);
  while(queue.length){
   const item=queue.shift(),recording=findRecording(item);
   if(!recording)continue; // Text persists on screen; no synthetic fallback.
   try{
    const audio=new AudioCtor('./'+recording.path);
    audio.preload='auto';audio.volume=1;
    current={...item,audio,spokenSummary:recording.line};
    lastStarted=stamp;notifyPlayback(true);
    audio.onended=()=>{
     if(current?.audio===audio){spokenCount++;stopCurrent(audio)}
    };
    audio.onerror=()=>{
     stopCurrent(audio);
     lastError='収録された戦況報告の再生に失敗しました（電子音は使用しません）';
     onError(lastError);
    };
    Promise.resolve(audio.play()).catch(error=>{
     stopCurrent(audio);
     lastError='収録された戦況報告の再生に失敗しました（電子音は使用しません）';
     onError(lastError);
    });
    return true;
   }catch(error){
    current=null;notifyPlayback(false);lastError=String(error?.message||error);onError(lastError);
   }
  }
  return false;
 }
 function enable(value){
  optedIn=Boolean(value);
  try{storage?.setItem(PREF,optedIn?'on':'off')}catch{}
  if(!optedIn){
   queue=[];
   try{current?.audio?.pause()}catch{}
   current=null;notifyPlayback(false);
  }
 }
 return {
  enqueue,update,enable,unlock(){unlocked=true},
  clear(){queue=[]},
  get enabled(){return optedIn},
  get status(){return {supported:supported(),enabled:optedIn,unlocked,
   active:current?.speaker||null,spokenSummary:current?.spokenSummary||null,
   queued:queue.length,spokenCount,recordedClips:availableCount,
   defaultVolume:1,narrationPriority:true,
   electronicTts:false,japaneseVoices:0,lastError}}
 };
}
