import {soundtrackForStage} from './battle-stage-soundtrack.js';

/**
 * Original, offline-capable orchestral score for mass battle transitions.
 * Low-CPU WebAudio layering (brass, strings, bass and percussion), with
 * a licensed legacy recorded war-theme URL used as the battle theme if online.
 * No AI calls, paid endpoints or GPU compute required.
 */
export function createBattleOrchestralScore({
  AudioContextClass=globalThis.AudioContext||globalThis.webkitAudioContext,
  AudioClass=globalThis.Audio,
  setIntervalFn=globalThis.setInterval,
  clearIntervalFn=globalThis.clearInterval
}={}){
 const LEGACY_BATTLE_URL='https://opengameart.org/sites/default/files/war%20theme%20ver%202_0.ogg';
 // Full-recorded, commercially reusable CC0 music copied into the repository
 // by import-cc0-battle-soundtrack.yml (attributions in LICENSES.md).
 const RECORDED_TRACKS={
  battle:'./assets/audio/battle/battle.ogg',
  victory:'./assets/audio/battle/victory.ogg',
  defeat:'./assets/audio/battle/defeat.ogg'
 };
 const melody={
  intro:[62,65,69,74,72,69,65,67,69,72,74,77,74,72,69,74],
  battle:[62,62,65,69,67,65,64,62,60,62,65,67,69,67,65,64,
    62,65,69,74,72,69,67,65,64,65,67,69,65,64,62,57],
  victory:[74,74,74,70,77,74,70,65,67,69,70,72,74,77,79,81,
    81,79,77,74,77,81,86,86,86,81,79,77,74,77,81,86],
  defeat:[57,55,53,52,50,48,47,45,50,48,45,43,41,40,38,38]
 };
 const bass={
  intro:[38,41,38,36],battle:[38,36,34,33,38,41,34,33],
  victory:[43,43,41,43,46,46,43,43],defeat:[38,36,33,31,29,28,26,26]
 };
 let phase='battle',enabled=true,unlocked=false,ctx=null,mix=null,
     noise=null,timer=null,media=null,nextTime=0,index=0,mediaActive=false,
     currentSource='',error='',stageTheme=soundtrackForStage(null),narrationActive=false;
 let preparedMedia=null,preparedSource='',prepared=false;
 const duration={intro:.27,battle:.225,victory:.245,defeat:.42};
 const battleRecording=()=> './assets/audio/battle/'+stageTheme.file;
 const recordedVolume=track=>track==='battle'?(narrationActive?.20:.64):track==='victory'?.78:.70;
 const fallbackMixGain=()=>narrationActive&&phase==='battle'?.27:.78;
 const pitch=n=>440*Math.pow(2,(n-69)/12);
 function initialize(){
  if(ctx||!AudioContextClass)return Boolean(ctx);
  try{
   ctx=new AudioContextClass();
   const limiter=ctx.createDynamicsCompressor();
   limiter.threshold.value=-17;limiter.knee.value=17;limiter.ratio.value=3;
   limiter.attack.value=.004;limiter.release.value=.22;
   mix=ctx.createGain();mix.gain.value=fallbackMixGain();mix.connect(limiter);limiter.connect(ctx.destination);
   noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.5),ctx.sampleRate);
   const buf=noise.getChannelData(0);let random=0x12345678;
   for(let i=0;i<buf.length;i++){random^=random<<13;random^=random>>>17;random^=random<<5;buf[i]=((random>>>0)/2147483648-1)*Math.exp(-i/buf.length*3);}
   return true;
  }catch(e){error=String(e);return false;}
 }
 function instrument(midi,at,seconds,loudness,type='brass'){
  if(!ctx||ctx.state!=='running'||!Number.isFinite(midi))return;
  const tones=type==='brass'?[[0,'sawtooth',.67],[-.06,'sawtooth',.33]]:
    type==='strings'?[[0,'sawtooth',.55],[.1,'triangle',.45]]:
    [[0,'triangle',1]];
  const bus=ctx.createGain(),filter=ctx.createBiquadFilter();
  filter.type='lowpass';filter.frequency.value=type==='brass'?1800:type==='strings'?1100:570;
  const attack=type==='brass'?.028:type==='strings'?.09:.008;
  const release=type==='strings'?.22:.09;
  bus.gain.setValueAtTime(.0001,at);
  bus.gain.linearRampToValueAtTime(Math.max(.0002,loudness),at+attack);
  bus.gain.setTargetAtTime(.0001,at+Math.max(attack+.015,seconds-release),Math.max(.02,release*.24));
  bus.connect(filter);filter.connect(mix);
  for(const [offset,wave,level] of tones){
   const osc=ctx.createOscillator(),oscGain=ctx.createGain();
   osc.type=wave;osc.frequency.setValueAtTime(pitch(midi+offset),at);
   oscGain.gain.value=level;osc.connect(oscGain);oscGain.connect(bus);
   osc.start(at);osc.stop(at+seconds+.12);
   osc.onended=()=>{osc.disconnect();oscGain.disconnect();};
  }
 }
 function drum(at,snare=false){
  if(!ctx||ctx.state!=='running')return;
  const env=ctx.createGain(),source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();
  source.buffer=noise;filter.type=snare?'highpass':'lowpass';filter.frequency.value=snare?2100:280;
  env.gain.setValueAtTime(snare?.09:.18,at);env.gain.exponentialRampToValueAtTime(.0001,at+(snare?.13:.21));
  source.connect(filter);filter.connect(env);env.connect(mix);
  source.start(at);source.stop(at+.25);
  source.onended=()=>{source.disconnect();filter.disconnect();env.disconnect()};
 }
 function schedule(){
  if(!enabled||!unlocked||!ctx||ctx.state!=='running'||mediaActive)return;
  const tune=melody[phase]||melody.battle,beat=duration[phase]||.225;
  if(nextTime<ctx.currentTime-.5)nextTime=ctx.currentTime+.07;
  let steps=0;
  while(nextTime<ctx.currentTime+.35&&steps++<5){
   const i=index++,note=tune[i%tune.length];
   const low=bass[phase][Math.floor(i/4)%bass[phase].length];
   instrument(note,nextTime,beat*.88,phase==='defeat'?.045:.075,phase==='defeat'?'strings':'brass');
   if(i%2===0)instrument(low,nextTime,beat*2.3,.068,'strings');
   if(i%4===0){
    instrument(low+12,nextTime,beat*3.5,.027,'strings');
    if(phase!=='defeat')drum(nextTime,false);
   }
   if(i%4===2&&phase!=='defeat')drum(nextTime,true);
   if(phase==='victory'&&i%8===7){
    instrument(note-12,nextTime,beat*3,.045,'brass');
    instrument(low+19,nextTime,beat*3,.045,'strings');
   }
   nextTime+=beat;
  }
 }
 function silence(){
  if(timer!==null){clearIntervalFn(timer);timer=null;}
  if(media){media.pause();try{media.currentTime=0}catch{}}
  media=null;mediaActive=false;currentSource='';
  if(mix&&ctx)mix.gain.setTargetAtTime(fallbackMixGain(),ctx.currentTime,.08);
 }
 async function prepare(){
  if(!enabled||typeof AudioClass!=='function')return false;
  const source=battleRecording();
  if(preparedMedia&&preparedSource===source&&prepared)return true;
  if(preparedMedia){try{preparedMedia.pause()}catch{}}
  const element=new AudioClass(source);
  preparedMedia=element;preparedSource=source;prepared=false;
  element.preload='auto';
  // Preparing data without playing is allowed before a user gesture.
  const ready=await new Promise(resolve=>{
   if(element.readyState>=2){resolve(true);return}
   let settled=false;
   const done=value=>{if(settled)return;settled=true;clearTimeout(timerId);
    element.removeEventListener?.('canplay',can);element.removeEventListener?.('error',fail);
    resolve(value);
   };
   const can=()=>done(true),fail=()=>done(false);
   const timerId=setTimeout(()=>done(element.readyState>=2),6500);
   element.addEventListener?.('canplay',can,{once:true});
   element.addEventListener?.('error',fail,{once:true});
   try{element.load?.()}catch{done(false)}
  });
  if(preparedMedia===element)prepared=ready;
  return ready;
 }
 function waitUntilAudible(maxWaitMs=4500){
  if(!enabled)return Promise.resolve(true);
  return new Promise(resolve=>{
   const startAt=Date.now();
   const poll=()=>{
    const synth=Boolean(ctx&&ctx.state==='running'&&timer!==null);
    if(mediaActive||synth){resolve(true);return}
    if(Date.now()-startAt>=maxWaitMs){resolve(false);return}
    setTimeout(poll,70);
   };
   poll();
  });
 }
 function playRecording(track,source,attempt=0){
  if(!AudioClass||!source||track!==phase||!enabled)return;
  const player=preparedMedia&&preparedSource===source?
   preparedMedia:new AudioClass(source);
  if(player===preparedMedia){preparedMedia=null;preparedSource='';prepared=false;}
  media=player;player.loop=track!=='victory';
  player.preload='auto';player.volume=recordedVolume(track);
  let settled=false;
  const failed=()=>{
   if(settled)return;settled=true;
   if(media!==player||phase!==track)return;
   mediaActive=false;
   if(track==='battle'&&attempt===0&&source!==RECORDED_TRACKS.battle){
    playRecording(track,RECORDED_TRACKS.battle,1);
   }else if(track==='battle'&&attempt<=1){
    playRecording(track,LEGACY_BATTLE_URL,2);
   }else{
    error='録音済み'+track+'曲の再生失敗。内蔵オーケストラを使用';
    if(mix&&ctx)mix.gain.setTargetAtTime(fallbackMixGain(),ctx.currentTime,.08);
    if(timer===null&&ctx){nextTime=ctx.currentTime+.08;timer=setIntervalFn(schedule,105);schedule();}
   }
  };
  player.onerror=failed;
  Promise.resolve(player.play()).then(()=>{
   settled=true;
   if(!enabled||phase!==track||media!==player){player.pause();return;}
   mediaActive=true;currentSource=source;
   if(mix&&ctx)mix.gain.setTargetAtTime(.0001,ctx.currentTime,.07);
   if(timer!==null){clearIntervalFn(timer);timer=null;}
  }).catch(failed);
 }
 function start(){
  if(!unlocked||!enabled)return Promise.resolve(false);
  const playable=()=>{if(RECORDED_TRACKS[phase]&&!media)
    playRecording(phase,phase==='battle'?battleRecording():RECORDED_TRACKS[phase]);};
  if(!initialize()){playable();return waitUntilAudible()}
  return Promise.resolve(ctx.resume()).then(()=>{
   if(!unlocked||!enabled)return false;
   if(timer===null&&!mediaActive){
    nextTime=ctx.currentTime+.08;timer=setIntervalFn(schedule,105);schedule();
   }
   playable();
   return waitUntilAudible();
  }).catch(e=>{error=String(e);playable();return waitUntilAudible()});
 }
 function setPhase(next){
  if(!melody[next]||phase===next)return;
  silence();phase=next;index=0;
  if(enabled&&unlocked)start();
 }
 function setStage(stage){
  const next=soundtrackForStage(stage);
  if(stageTheme.id===next.id)return stageTheme;
  stageTheme=next;
  if(phase==='battle'&&enabled&&unlocked){silence();index=0;start();}
  return stageTheme;
 }
 function setNarrationActive(active){
  narrationActive=Boolean(active);
  if(media)media.volume=recordedVolume(phase);
  if(mix&&ctx)mix.gain.setTargetAtTime(mediaActive?.0001:fallbackMixGain(),ctx.currentTime,.08);
 }
 function setEnabled(value){
  enabled=Boolean(value);
  if(!enabled){silence();ctx?.suspend?.().catch(()=>{});}
  else if(unlocked)start();
 }
 function orderFanfare(){
  if(!enabled||!unlocked||!ctx||ctx.state!=='running')return;
  const at=ctx.currentTime+.03;
  for(const [i,n] of [74,77,81,86].entries())instrument(n,at+i*.095,.42,.14,'brass');
  drum(at,false);
 }
 return {
  unlock(){unlocked=true;return start();},
  prepare,waitUntilAudible,
  setPhase,setStage,setNarrationActive,setEnabled,orderFanfare,
  get phase(){return phase},
  get enabled(){return enabled},
  get unlocked(){return unlocked},
  get status(){return {phase,enabled,unlocked,stageTheme:stageTheme.name,stageThemeId:stageTheme.id,
    narrationActive,preparedBgm:prepared,audioActive:mediaActive||Boolean(ctx&&ctx.state==='running'&&timer!==null),
    recordedBattle:mediaActive,
    recordedTrack:mediaActive?currentSource:null,
    engine:ctx?'Recorded CC0 / WebAudio fallback':'not unlocked',lastError:error}}
 };
}
