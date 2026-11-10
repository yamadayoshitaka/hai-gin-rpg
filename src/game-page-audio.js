/** Global non-combat page audio. Plays recorded CC0 music; no synthetic character speech.
 * Mobile browsers require the first trusted tap/key before sound can begin.
 */
export const GAME_PAGE_MUSIC=Object.freeze({
 title:'./assets/audio/battle/forest.ogg',
 opening:'./assets/audio/battle/siege.ogg',
 map:'./assets/audio/battle/coast.ogg',
 paper:'./assets/audio/battle/ruins.ogg'
});
const SETTINGS_KEY='hai-gin-core-settings-v1';
export function createGamePageAudio({storage=null,initialScene='title'}={}){
 let enabled=true,scene=initialScene,started=false,disposed=false,element=null,ctx=null,lastSelect=0;
 try{enabled=JSON.parse(storage?.getItem(SETTINGS_KEY)||'null')?.bgm!==false}catch{}
 const ensure=()=>{
  if(element)return element;
  element=new Audio();
  element.loop=true;element.preload='auto';
  element.volume=.29;return element;
 };
 const play=()=>{
  if(!started||!enabled||disposed)return;
  const audio=ensure(),next=GAME_PAGE_MUSIC[scene]||GAME_PAGE_MUSIC.title;
  if(!audio.src.endsWith(next.replace('./','')))audio.src=next;
  audio.volume=scene==='opening'?.38:scene==='paper'?.23:.28;
  void audio.play().catch(()=>{});
 };
 function unlock(){started=true;play();}
 function changeScene(next){if(!(next in GAME_PAGE_MUSIC))return;scene=next;play();}
 function setEnabled(value){
  enabled=Boolean(value);
  if(enabled)play();else element?.pause();
 }
 function effect(name='select'){
  if(!started||disposed)return;
  const now=Date.now();if(now-lastSelect<65)return;lastSelect=now;
  const Ctor=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Ctor)return;
  try{
   ctx??=new Ctor();if(ctx.state==='suspended')void ctx.resume();
   const start=ctx.currentTime;
   const frequencies=name==='confirm'?[523.25,783.99]:name==='cancel'?[392,293.66]:[659.25,987.77];
   frequencies.forEach((f,i)=>{
    const osc=ctx.createOscillator(),amp=ctx.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(f,start+i*.045);
    amp.gain.setValueAtTime(.0001,start+i*.045);
    amp.gain.exponentialRampToValueAtTime(.075,start+i*.045+.012);
    amp.gain.exponentialRampToValueAtTime(.0001,start+i*.045+.16);
    osc.connect(amp);amp.connect(ctx.destination);
    osc.start(start+i*.045);osc.stop(start+i*.045+.18);
   });
  }catch{}
 }
 function dispose(){disposed=true;element?.pause();if(element)element.src='';void ctx?.close().catch(()=>{});}
 return {unlock,changeScene,setEnabled,effect,dispose,
  get enabled(){return enabled},get scene(){return scene},get started(){return started}};
}
