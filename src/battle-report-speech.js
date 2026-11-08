/**
 * Free Japanese TTS for on-screen commander/runner/scout dispatches.
 *
 * Recorded VOICEVOX combat shouts, music and WebAudio SFX are independent
 * HTMLAudio/WebAudio channels: a dispatch can speak above them.
 * Web Speech itself is a browser-global single speech queue. When a combat
 * shout also falls back to native TTS, DO NOT cancel, pause, or interrupt it;
 * wait until the shared synthesizer becomes idle.
 *
 * No network calls, paid TTS, timers or requestAnimationFrame loops.
 */
export function createBattleReportSpeech({
 synth=globalThis.speechSynthesis,
 Utterance=globalThis.SpeechSynthesisUtterance,
 storage=globalThis.localStorage,
 enabled=()=>true,
 now=()=>Date.now(),
 onError=()=>{}
}={}){
 const PREF='hai-gin-report-speech-v1';
 let optedIn=true;
 try{optedIn=storage?.getItem(PREF)!=='off'}catch{}
 let unlocked=false,current=null,lastStarted=0,spokenCount=0,lastError='';
 let queue=[];
 const trim=text=>String(text??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,170);
 const supported=()=>!!synth&&typeof synth.speak==='function'&&typeof Utterance==='function';
 function enqueue(report){
  const line=trim(report?.text);
  if(!line||!supported())return false;
  const key=String(report.key||line);
  // Avoid replaying stale overview lines after important battle events.
  if(current?.key===key||queue.some(x=>x.key===key))return false;
  const item={key,line,kind:report.kind||'info',
    speaker:report.speaker||'軍師',priority:Number(report.priority)||0,created:now()};
  if(item.priority>=80){
   queue=queue.filter(x=>x.priority>=80);
  }
  queue.push(item);
  queue.sort((a,b)=>b.priority-a.priority||a.created-b.created);
  if(queue.length>4)queue.length=4;
  return true;
 }
 function voices(){
  try{return (synth?.getVoices?.()||[]).filter(v=>
    typeof v.lang==='string'&&v.lang.toLowerCase().startsWith('ja'))}
  catch{return []}
 }
 function update(){
  if(!optedIn||!unlocked||!enabled()||!supported())return false;
  const stamp=now();
  // Web Speech cannot support multiple simultaneous synthesized voices on
  // mobile. Never steal/cancel a playing battle character's native TTS.
  if(current||synth.speaking||synth.pending)return false;
  // The speaker is a separate logical channel from prerecorded battle voice.
  if(stamp-lastStarted<800)return false;
  queue=queue.filter(x=>stamp-x.created<18000);
  if(!queue.length)return false;
  const event=queue.shift();
  try{
   const utterance=new Utterance(event.line);
   utterance.lang='ja-JP';utterance.rate=event.kind==='critical'?1.06:.98;
   utterance.pitch=event.speaker==='斥候'?1.08: event.speaker==='伝令'?1.02:.94;
   utterance.volume=.87;
   const japanese=voices();
   if(japanese.length){
    const ranked=japanese.slice().sort((a,b)=>{
     const score=v=>/neural|natural|premium|enhanced|高品質/i.test(v.name)?3:
       /google|日本語/i.test(v.name)?2:1;
     return score(b)-score(a);
    });
    utterance.voice=ranked[0];
   }
   current={...event,utterance};lastStarted=stamp;
   utterance.onend=()=>{if(current?.utterance===utterance){current=null;spokenCount++}};
   utterance.onerror=e=>{
    if(current?.utterance===utterance)current=null;
    lastError=String(e?.error||'voice error');onError(lastError);
   };
   synth.speak(utterance);
   return true;
  }catch(error){
   current=null;lastError=String(error?.message||error);
   onError(lastError);return false;
  }
 }
 function enable(value){
  optedIn=Boolean(value);
  try{storage?.setItem(PREF,optedIn?'on':'off')}catch{}
  if(!optedIn){
   queue=[];
   // Web Speech cancel() is GLOBAL and would stop an unrelated soldier's
   // Japanese battle voice. Silence only our own utterance if possible.
   if(current?.utterance)current.utterance.volume=0;
  }
 }
 return {
  enqueue,update,enable,unlock(){unlocked=true;},
  clear(){queue=[];},
  get enabled(){return optedIn},
  get status(){return {supported:supported(),enabled:optedIn,unlocked,
    active:current?.speaker||null,queued:queue.length,spokenCount,
    japaneseVoices:voices().length,lastError}}
 };
}
