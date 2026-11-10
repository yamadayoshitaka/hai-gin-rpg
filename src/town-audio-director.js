// Town music and original UI effects. No electronic dialogue or generated speech.
// A browser gesture is required to resume AudioContext on Android/iOS.
const PREF_KEY='hai-gin-town-bgm-enabled-v1';
const MUSIC={
 town:'./assets/audio/town.mp3',
 shop:'./assets/audio/town.mp3',
 tavern:'./assets/audio/town.mp3',
 inn:'./assets/audio/town.mp3',
 church:'./assets/audio/battle/forest.ogg',
 castle:'./assets/audio/battle/forest.ogg',
 paper:'./assets/audio/battle/ruins.ogg'
};
const LEVEL={town:.32,shop:.21,tavern:.34,inn:.24,church:.26,castle:.30,paper:.29};
const TONES={
 select:[[640,.07,0],[920,.09,.045]],
 cancel:[[420,.10,0],[330,.12,.065]],
 enter:[[360,.09,0],[510,.13,.09]],
 buy:[[760,.11,0],[980,.18,.08],[1240,.16,.20]],
 save:[[420,.16,0],[630,.20,.14],[840,.31,.28]],
 quest:[[550,.10,0],[750,.17,.12]],
 open:[[510,.07,0],[690,.15,.08]],
 paper:[[500,.08,0],[410,.14,.09]]
};
export function createTownAudioDirector({storage=null,onChange=()=>{}}={}){
 let enabled=true;
 try{enabled=storage?.getItem(PREF_KEY)!=='false'}catch{}
 let scene='town',audio=null,context=null,unlocked=false,narration=false,disposed=false;
 let lastToneAt=0;
 const notify=()=>onChange({enabled,scene,unlocked,playing:Boolean(audio&&!audio.paused)});
 function audioContext(){
  const Ctor=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Ctor)return null;
  context??=new Ctor();
  return context;
 }
 function adjust(){
  if(audio)audio.volume=enabled?(LEVEL[scene]||.28)*(narration?.32:1):0;
 }
 function tryPlay(){
  if(disposed||!enabled||!audio)return;
  adjust();
  Promise.resolve(audio.play()).then(notify).catch(()=>notify());
 }
 function setScene(next){
  if(!MUSIC[next])next='town';
  const previous=MUSIC[scene],url=MUSIC[next];scene=next;
  if(!audio||previous!==url){
   const old=audio;
   audio=new Audio(url);audio.loop=true;audio.preload='auto';
   audio.addEventListener('error',notify);
   if(old){old.pause();old.src='';}
  }
  adjust();tryPlay();notify();
 }
 function unlock(){
  if(disposed)return;
  unlocked=true;
  const ctx=audioContext();
  if(ctx?.state==='suspended')void ctx.resume().catch(()=>{});
  tryPlay();
 }
 function effect(kind='select'){
  if(disposed||!enabled)return;
  const now=Date.now();
  if(now-lastToneAt<35)return;
  lastToneAt=now;
  const ctx=audioContext();
  if(!ctx)return;
  if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
  const notes=TONES[kind]||TONES.select;
  const start=ctx.currentTime+.005;
  for(const [frequency,duration,delay] of notes){
   const oscillator=ctx.createOscillator(),gain=ctx.createGain();
   oscillator.type=kind==='save'||kind==='buy'?'sine':'triangle';
   oscillator.frequency.setValueAtTime(frequency,start+delay);
   oscillator.frequency.exponentialRampToValueAtTime(frequency*.89,start+delay+duration);
   gain.gain.setValueAtTime(.0001,start+delay);
   gain.gain.exponentialRampToValueAtTime(kind==='save'?.074:.052,start+delay+.015);
   gain.gain.exponentialRampToValueAtTime(.0001,start+delay+duration);
   oscillator.connect(gain);gain.connect(ctx.destination);
   oscillator.start(start+delay);oscillator.stop(start+delay+duration+.015);
   oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
  }
 }
 function setEnabled(value){
  enabled=Boolean(value);
  try{storage?.setItem(PREF_KEY,enabled?'true':'false')}catch{}
  if(!enabled)audio?.pause();
  else tryPlay();
  notify();
 }
 function setNarrationActive(value){narration=Boolean(value);adjust();}
 function dispose(){disposed=true;audio?.pause();audio=null;void context?.close();context=null;}
 setScene('town');
 return {unlock,effect,setScene,setEnabled,setNarrationActive,dispose,get enabled(){return enabled;},get scene(){return scene;}};
}
