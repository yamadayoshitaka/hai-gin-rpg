/**
 * Original procedurally synthesized creature voices. No external downloads,
 * language voices, licensing uncertainty, or one AudioContext per entity.
 * Voices are baked once per species/event, then cheaply replayed as buffers.
 */
import {CREATURE_PERFORMANCE} from './combat-creature-performance.js';

const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function synthesizeCreatureVoice(type,{kind='attack',sampleRate=24000}={}){
  const spec=CREATURE_PERFORMANCE[type];
  if(!spec)throw Error('未登録の召喚獣の声: '+type);
  if(sampleRate<8000||sampleRate>96000)throw Error('音源のサンプル周波数が不正');
  const length=kind==='spawn'?spec.voiceLength*1.22:kind==='hit'?spec.voiceLength*.42:spec.voiceLength;
  const total=Math.max(1,Math.round(length*sampleRate)),pcm=new Float32Array(total);
  let phase=0,roughPhase=0,noiseLow=0,noiseMid=0;
  let rand=(type.length*3571+kind.length*1291+57)|0;
  const noise=()=>{rand^=rand<<13;rand^=rand>>>17;rand^=rand<<5;return (rand>>>0)/2147483648-1;};
  const base={
    wolf:kind==='spawn'?296:188,
    wyvern:kind==='spawn'?600:480,
    dragon:kind==='spawn'?105:83,
    elder_dragon:kind==='spawn'?93:68,
    dragon_lord:kind==='spawn'?78:57,
    horse:kind==='spawn'?475:408,
    forest_archer:kind==='spawn'?432:365,
    seraph_guardian:kind==='spawn'?360:300,
  }[type];
  for(let i=0;i<total;i++){
    const t=i/sampleRate,u=i/total;
    const attack=clamp(t/(kind==='hit'?.019:.062),0,1);
    const release=clamp((1-u)/(kind==='hit'?.21:.28),0,1);
    const env=attack*release*(.84+.16*Math.sin(Math.PI*u));
    let frequency=base;
    if(type==='wolf')frequency*=kind==='spawn'?.77+.52*Math.sin(Math.PI*u):1.28-.52*u;
    if(type==='wyvern')frequency*=1.12-.72*u;
    if(type==='dragon')frequency*=1.1-.44*u;
    if(type==='elder_dragon')frequency*=1.17-.36*u;
    if(type==='dragon_lord')frequency*=1.18-.40*u;
    if(type==='horse')frequency*=.72+.76*Math.sin(Math.PI*u);
    if(type==='forest_archer')frequency*=1.12-.24*u;
    if(type==='seraph_guardian')frequency*=1+.16*Math.sin(Math.PI*u);
    const vibrato=type==='horse'?15:type==='wyvern'?19:type==='wolf'?6:4;
    frequency*=1+(type==='horse'?.065:.026)*Math.sin(TAU*vibrato*t);
    phase+=TAU*frequency/sampleRate;
    roughPhase+=TAU*(frequency*.49+8*Math.sin(TAU*5*t))/sampleRate;
    const white=noise();
    noiseLow=.96*noiseLow+.04*white;
    noiseMid=.76*noiseMid+.24*white;
    const tonal=Math.sin(phase)+.43*Math.sin(phase*2.03+.2)+.2*Math.sin(phase*3.08);
    const guttural=Math.sin(roughPhase)*(.3+.5*Math.sin(TAU*(type==='wolf'?19:27)*t)**2);
    let value;
    if(type==='wolf')value=.68*tonal+.34*guttural+.22*noiseMid;
    else if(type==='wyvern')value=.45*tonal+.37*guttural+.49*noiseMid;
    else if(type==='dragon')value=.58*tonal+.57*guttural+.70*noiseLow+.26*white;
    else if(type==='elder_dragon')value=.50*tonal+.67*Math.sin(roughPhase*1.23)+.64*noiseLow+.36*noiseMid;
    else if(type==='dragon_lord')value=.65*tonal+.80*Math.sin(roughPhase*1.17)+.74*noiseLow+.36*white;
    else if(type==='forest_archer')value=.68*Math.sin(phase)+.26*Math.sin(phase*2)+.14*noiseMid;
    else if(type==='seraph_guardian')value=.48*tonal+.28*Math.sin(phase*1.5)+.20*Math.sin(phase*2.5);
    else value=.84*tonal+.25*Math.sin(phase*.38)+.15*noiseMid;
    const breath=(type==='dragon'||type==='elder_dragon'||type==='dragon_lord'||type==='wyvern')?
      .23*Math.pow(u,2)*Math.sqrt(Math.max(0,1-u))*(white-noiseLow):0;
    pcm[i]=Math.tanh((value+breath)*(kind==='hit'?1.4:1.9))*env*.62;
  }
  return pcm;
}

export function createCreatureSoundRuntime({enabled=()=>true,maxVoices=16}={}){
  let context=null,disposed=false;
  const buffers=new Map(),active=new Set(),lastByObject=new Map(),lastBySpecies=new Map();
  function unlock(){
    if(disposed||!enabled())return false;
    const AudioContextType=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!AudioContextType)return false;
    context??=new AudioContextType();
    if(context.state!=='running')context.resume().catch(()=>{});
    return true;
  }
  function play(type,kind='attack',{objectId=null,position=null,listener=null,volume=.65,force=false}={}){
    if(disposed||!enabled()||!CREATURE_PERFORMANCE[type])return false;
    if(!context||context.state!=='running')return false;
    const now=context.currentTime,key=String(objectId??type)+':'+kind;
    if(!force&&((now-(lastByObject.get(key)??-100))<.45||
      (now-(lastBySpecies.get(type+':'+kind)??-100))<.12))return false;
    if(active.size>=maxVoices)return false;
    const cacheKey=type+':'+kind;
    let buffer=buffers.get(cacheKey);
    if(!buffer){
      const pcm=synthesizeCreatureVoice(type,{kind,sampleRate:context.sampleRate});
      buffer=context.createBuffer(1,pcm.length,context.sampleRate);
      buffer.copyToChannel(pcm,0);
      buffers.set(cacheKey,buffer);
    }
    const source=context.createBufferSource();source.buffer=buffer;
    const lowpass=context.createBiquadFilter();lowpass.type='lowpass';
    lowpass.frequency.value=type==='wolf'?4200:type==='wyvern'?5600:type==='horse'?4700:2900;
    const gain=context.createGain();
    const distance=position&&listener?Math.hypot(position.x-listener.x,position.z-listener.z):0;
    gain.gain.value=clamp(volume/(1+distance*.065),.016,.75);
    source.connect(lowpass);lowpass.connect(gain);
    let stereo=null;
    if(context.createStereoPanner&&position&&listener){
      stereo=context.createStereoPanner();
      stereo.pan.value=clamp((position.x-listener.x)/Math.max(10,distance),-1,1);
      gain.connect(stereo);stereo.connect(context.destination);
    }else gain.connect(context.destination);
    active.add(source);
    source.onended=()=>{
      active.delete(source);
      try{source.disconnect();lowpass.disconnect();gain.disconnect();stereo?.disconnect();}catch{}
    };
    source.start();
    lastByObject.set(key,now);lastBySpecies.set(type+':'+kind,now);
    if(lastByObject.size>1024)lastByObject.clear();
    return true;
  }
  function dispose(){
    disposed=true;
    for(const source of active)try{source.stop();}catch{}
    active.clear();buffers.clear();lastByObject.clear();lastBySpecies.clear();
    context?.close().catch(()=>{});context=null;
  }
  return {unlock,play,dispose,get activeVoices(){return active.size},get voicesReady(){return buffers.size}};
}
