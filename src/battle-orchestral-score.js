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
 const MUSIC_URL='https://opengameart.org/sites/default/files/war%20theme%20ver%202_0.ogg';
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
     noise=null,timer=null,media=null,nextTime=0,index=0,mediaActive=false,error='';
 const duration={intro:.27,battle:.225,victory:.245,defeat:.42};
 const pitch=n=>440*Math.pow(2,(n-69)/12);
 function initialize(){
  if(ctx||!AudioContextClass)return Boolean(ctx);
  try{
   ctx=new AudioContextClass();
   const limiter=ctx.createDynamicsCompressor();
   limiter.threshold.value=-17;limiter.knee.value=17;limiter.ratio.value=3;
   limiter.attack.value=.004;limiter.release.value=.22;
   mix=ctx.createGain();mix.gain.value=.72;mix.connect(limiter);limiter.connect(ctx.destination);
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
  mediaActive=false;
 }
 function start(){
  if(!unlocked||!enabled)return;
  if(!initialize())return;
  Promise.resolve(ctx.resume()).then(()=>{
   if(!unlocked||!enabled)return;
   if(phase==='battle'&&AudioClass){
    if(!media){
     media=new AudioClass(MUSIC_URL);media.loop=true;media.volume=.46;media.preload='auto';
     media.onerror=()=>{mediaActive=false;error='録音済み戦闘BGMの読み込み失敗：内蔵オーケストラへ切替';schedule();};
    }
    Promise.resolve(media.play()).then(()=>{
     if(enabled&&phase==='battle'){mediaActive=true;if(timer!==null){clearIntervalFn(timer);timer=null;}}
     else media.pause();
    }).catch(()=>{mediaActive=false;});
   }
   if(timer===null){
    nextTime=ctx.currentTime+.08;timer=setIntervalFn(schedule,105);schedule();
   }
  }).catch(e=>{error=String(e)});
 }
 function setPhase(next){
  if(!melody[next]||phase===next)return;
  silence();phase=next;index=0;
  if(enabled&&unlocked)start();
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
  unlock(){unlocked=true;start();},
  setPhase,setEnabled,orderFanfare,
  get phase(){return phase},
  get enabled(){return enabled},
  get unlocked(){return unlocked},
  get status(){return {phase,enabled,unlocked,recordedBattle:mediaActive,
    engine:ctx?'WebAudio orchestral':'not unlocked',lastError:error}}
 };
}
