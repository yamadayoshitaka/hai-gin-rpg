/**
 * Touch-first continuous manga viewer used at every world-map sortie.
 * Single illustration per frame with persistent 20-character designs,
 * accessible speech text, optional Japanese reading and matching fantasy BGM.
 * The UI never touches combat actors, town 3D models or player stats.
 */
import {mangaForStage} from './story-stage-manga.js';
import {stageMangaImage} from './story-manga-art.js';
import {fantasyCueForMangaPanel} from './fantasy-scene-score.js';
const CORE_SETTINGS='hai-gin-core-settings-v1';
const readVoice=storage=>{
 try{return JSON.parse(storage?.getItem(CORE_SETTINGS)||'{}')?.voice!==false;}catch{return true;}
};
const writeVoice=(storage,value)=>{
 try{
  const old=JSON.parse(storage?.getItem(CORE_SETTINGS)||'{}')||{};
  storage?.setItem(CORE_SETTINGS,JSON.stringify({...old,voice:!!value}));
 }catch{}
};
export function createMangaViewer({container=document.body,storage=globalThis.localStorage,
 onCue=()=>{},onClose=()=>{}}={}){
 const root=document.createElement('section');root.id='stageMangaViewer';
 root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');
 root.setAttribute('aria-label','連続漫画・物語');
 root.innerHTML='<div class="manga-board">'+
  '<div class="manga-top"><div class="manga-heading"><span class="manga-kicker">HAIGIN · ILLUSTRATED CHRONICLE</span><strong class="manga-stage"></strong></div>'+
  '<button class="manga-voice" aria-label="物語の音声オン・オフ" type="button">音声 ON</button></div>'+
  '<figure class="manga-figure"><img class="manga-art" alt="物語の人物が登場する漫画の絵"/><figcaption class="manga-shot"></figcaption></figure>'+
  '<div class="manga-dialogue" aria-live="polite"><div class="manga-speaker"></div><p class="manga-line"></p></div>'+
  '<div class="manga-bottom"><span class="manga-progress" aria-label="漫画のページ位置"></span>'+
  '<div class="manga-controls"><button type="button" class="manga-previous">◀ 前</button>'+
  '<button type="button" class="manga-next">次のコマ ▶</button>'+
  '<button type="button" class="manga-skip">スキップ</button></div></div></div>';
 const style=document.createElement('style');style.textContent=`
 #stageMangaViewer{position:fixed;inset:0;z-index:300;background:#080c16ee;color:#f4e7cf;
   font-family:Georgia,'Noto Serif JP',serif;overflow:auto;overscroll-behavior:contain;
   padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))}
 #stageMangaViewer[hidden]{display:none!important}
 #stageMangaViewer .manga-board{margin:0 auto;width:min(840px,100%);min-height:100%;display:flex;flex-direction:column;
   gap:10px;background:#172536;border:1px solid #9b815c;box-shadow:0 15px 40px #000c;padding:12px}
 #stageMangaViewer .manga-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
 #stageMangaViewer .manga-heading{min-width:0;display:grid;gap:5px}
 #stageMangaViewer .manga-heading strong{font-size:clamp(13px,3.5vw,18px);color:#f4dca6}
 #stageMangaViewer .manga-kicker{font:9px system-ui;letter-spacing:.15em;color:#b5bcc8}
 #stageMangaViewer button{font:inherit;cursor:pointer;touch-action:manipulation;min-height:41px;border-radius:6px}
 #stageMangaViewer .manga-voice{border:1px solid #586576;background:#253444;color:#c6d0d9;font:11px system-ui;
   min-height:32px;padding:4px 8px;flex-shrink:0}
 #stageMangaViewer .manga-figure{margin:0;display:grid;gap:5px;min-height:0}
 #stageMangaViewer .manga-art{display:block;width:100%;aspect-ratio:16/9;object-fit:contain;
   border:5px solid #dfd1bc;background:#262839;box-shadow:0 9px 23px #0008}
 #stageMangaViewer .manga-shot{font:10px system-ui;text-align:right;color:#bfc8c8}
 #stageMangaViewer .manga-dialogue{padding:12px 14px;background:#f0e6d3;color:#24242c;border:2px solid #2e2830;
   box-shadow:5px 5px 0 #0b1119;min-height:106px;border-radius:18px 18px 18px 4px}
 #stageMangaViewer .manga-speaker{font:bold 13px system-ui;color:#5e3841;border-bottom:1px solid #b9a798;padding-bottom:4px}
 #stageMangaViewer .manga-line{font:clamp(13px,3.4vw,18px)/1.6 Georgia,'Noto Serif JP',serif;
   margin:6px 0 0;white-space:pre-wrap;max-height:28dvh;overflow-y:auto}
 #stageMangaViewer .manga-bottom{display:grid;gap:10px;margin-top:auto}
 #stageMangaViewer .manga-progress{text-align:center;color:#d7c8a9;font:11px system-ui;letter-spacing:.2em}
 #stageMangaViewer .manga-controls{display:grid;grid-template-columns:1fr 1.65fr 1fr;gap:6px}
 #stageMangaViewer .manga-controls button{padding:9px 4px;background:#2b4053;color:#f6ead6;border:1px solid #718296}
 #stageMangaViewer .manga-controls .manga-next{background:#7e5b33;border-color:#d7bb83;font-weight:bold}
 #stageMangaViewer .manga-controls .manga-skip{background:transparent;border-color:#48586a;color:#bac3cd;font:11px system-ui}
 #stageMangaViewer button:disabled{opacity:.32}
 @media(max-height:660px){#stageMangaViewer{padding:5px}#stageMangaViewer .manga-board{gap:5px;padding:6px}
   #stageMangaViewer .manga-art{max-height:40dvh}#stageMangaViewer .manga-line{max-height:24dvh}}
 @media(prefers-reduced-motion:no-preference){#stageMangaViewer .manga-art{animation:mangaFade .24s ease}
   @keyframes mangaFade{from{opacity:.4;transform:scale(.985)}to{opacity:1;transform:scale(1)}}}
 `;
 container.append(root);document.head.append(style);
 const $=selector=>root.querySelector(selector);
 let story=null,index=0,finish=null,voiceOn=readVoice(storage),active=false;
 const sound=()=>voiceOn&&'speechSynthesis' in window;
 function stopVoice(){try{globalThis.speechSynthesis?.cancel();}catch{}}
 function narrate(){
  if(!active||!story||!sound())return;
  const shot=story.panels[index],utter=new SpeechSynthesisUtterance(shot.text.slice(0,380));
  const voices=speechSynthesis.getVoices().filter(v=>v.lang?.toLowerCase().startsWith('ja'));
  utter.lang='ja-JP';utter.rate=.90;utter.pitch=shot.characterId?.91:1;
  utter.volume=.96;
  if(voices.length)utter.voice=voices[(story.number+index)%voices.length];
  try{speechSynthesis.speak(utter);}catch{}
 }
 function frame(){
  if(!story||!active)return;
  stopVoice();
  const shot=story.panels[index];
  $('.manga-stage').textContent='第'+story.chapter+'章 · '+story.stageName;
  $('.manga-art').src=stageMangaImage(shot);
  $('.manga-art').alt=shot.speaker+'と'+(shot.secondaryId?'仲間':'物語の風景')+'の連続漫画 '+(index+1)+'コマ目';
  $('.manga-art').style.animation='none';void $('.manga-art').offsetWidth;$('.manga-art').style.animation='';
  $('.manga-speaker').textContent=shot.speaker+(shot.characterId?'　／　'+shot.faction+'・'+shot.role:'　／　ナレーション');
  $('.manga-line').textContent=shot.text;
  $('.manga-shot').textContent=story.id.toUpperCase()+' · '+(index+1)+'/'+story.panels.length;
  $('.manga-progress').textContent=story.panels.map((_,i)=>i===index?'●':'○').join(' ');
  $('.manga-previous').disabled=index===0;
  $('.manga-next').textContent=index===story.panels.length-1?'ステージへ進む ▶':'次のコマ ▶';
  $('.manga-voice').textContent=voiceOn?'音声 ON':'音声 OFF';
  const cue=fantasyCueForMangaPanel({id:story.id,number:story.number,kind:shot.scenery},index);
  onCue(cue,shot,story);
  narrate();
 }
 function close({completed=false}={}){
  if(!active)return;
  active=false;root.hidden=true;stopVoice();
  const done=finish;finish=null;
  onClose(story,completed);
  if(completed)done?.();
 }
 function open(id,{onFinish=null,at=0}={}){
  story=mangaForStage(id);index=Math.max(0,Math.min(story.panels.length-1,at|0));
  finish=onFinish;voiceOn=readVoice(storage);active=true;root.hidden=false;
  frame();return story;
 }
 $('.manga-previous').onclick=()=>{if(index>0){index--;frame();}};
 $('.manga-next').onclick=()=>{
  if(index>=story.panels.length-1)close({completed:true});
  else{index++;frame();}
 };
 $('.manga-skip').onclick=()=>close({completed:true});
 $('.manga-voice').onclick=()=>{
  voiceOn=!voiceOn;writeVoice(storage,voiceOn);stopVoice();frame();
 };
 document.addEventListener('keydown',event=>{
  if(!active)return;
  if(event.key==='ArrowRight'){event.preventDefault();$('.manga-next').click();}
  if(event.key==='ArrowLeft'){event.preventDefault();$('.manga-previous').click();}
 });
 return {open,close,get active(){return active},get stageId(){return story?.id||null},
  get panelIndex(){return index},get voiceEnabled(){return voiceOn}};
}
