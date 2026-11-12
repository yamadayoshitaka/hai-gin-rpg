/**
 * Touch-first continuous manga viewer used at every world-map sortie.
 * Individually registered cuts or exactly matched chapter/branch/gender sheets,
 * accessible speech text, optional Japanese reading and matching fantasy BGM.
 * The UI never touches combat actors, town 3D models or player stats.
 */
import {mangaForStage} from './story-stage-manga.js';
import {registeredStoryPanelAsset,storySheetCrop} from './story-panel-registered-art.js';
import {comicForStage,comicPageAsset} from './story-chapter-comic.js';
import {renderStoryRubyText} from './story-ruby-display.js';
import {fantasyCueForMangaPanel} from './fantasy-scene-score.js';
import {createStoryVoiceDirector} from './story-voice-director.js';
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
  '<figure class="manga-figure"><div class="manga-page-area"><img class="manga-art" alt="物語の現在の1コマ" hidden/><div class="manga-missing" role="status">この場面の原画は未登録です。</div></div><figcaption class="manga-shot"></figcaption></figure>'+
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
   gap:10px;background:linear-gradient(160deg,#111d2c,#050b15);border:1px solid #836f54;box-shadow:0 15px 40px #000c;padding:12px}
 #stageMangaViewer .manga-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
 #stageMangaViewer .manga-heading{min-width:0;display:grid;gap:5px}
 #stageMangaViewer .manga-heading strong{font-size:clamp(13px,3.5vw,18px);color:#f4dca6}
 #stageMangaViewer .manga-kicker{font:9px system-ui;letter-spacing:.15em;color:#b5bcc8}
 #stageMangaViewer button{font:inherit;cursor:pointer;touch-action:manipulation;min-height:41px;border-radius:6px}
 #stageMangaViewer .manga-voice{border:1px solid #586576;background:#253444;color:#c6d0d9;font:11px system-ui;
   min-height:32px;padding:4px 8px;flex-shrink:0}
 #stageMangaViewer .manga-figure{margin:0;display:grid;gap:5px;min-height:0;justify-items:center}
 #stageMangaViewer .manga-page-area{position:relative;width:min(100%,740px);aspect-ratio:16/9;
   border:1px solid #bd9d70;background:#111825;box-shadow:0 9px 30px #000b;overflow:hidden}
 #stageMangaViewer .manga-art{display:block;position:absolute;max-width:none;object-fit:fill}
 #stageMangaViewer .manga-art[hidden],#stageMangaViewer .manga-missing[hidden]{display:none!important}
 #stageMangaViewer .manga-missing{display:grid;place-items:center;text-align:center;height:100%;padding:24px;
   font:13px/1.7 system-ui;color:#d9c79e;background:#13273b}
 #stageMangaViewer .manga-shot{font:10px system-ui;text-align:right;color:#bfc8c8}
 #stageMangaViewer .manga-dialogue{padding:12px 14px;background:linear-gradient(120deg,#0b1629f5,#172c3de9);color:#f4e9d7;border:1px solid #a88d62;
   box-shadow:0 10px 25px #0008;min-height:95px;border-radius:4px}
 #stageMangaViewer .manga-speaker{font:bold 13px system-ui;color:#f0d7a6;border-bottom:1px solid #56647a;padding-bottom:4px}
 #stageMangaViewer .manga-line{font:clamp(13px,3.4vw,17px)/1.7 Georgia,'Noto Serif JP',serif;
   margin:6px 0 0;white-space:pre-wrap;max-height:28dvh;overflow-y:auto}
 #stageMangaViewer .manga-line ruby{ruby-position:over;text-decoration:none}
 #stageMangaViewer .manga-line rt{font:600 0.57em/1.3 system-ui;color:#e9c997}
 #stageMangaViewer .manga-bottom{display:grid;gap:10px;margin-top:auto}
 #stageMangaViewer .manga-progress{text-align:center;color:#d7c8a9;font:11px system-ui;letter-spacing:.2em}
 #stageMangaViewer .manga-controls{display:grid;grid-template-columns:1fr 1.65fr 1fr;gap:6px}
 #stageMangaViewer .manga-controls button{padding:9px 4px;background:#2b4053;color:#f6ead6;border:1px solid #718296}
 #stageMangaViewer .manga-controls .manga-next{background:#7e5b33;border-color:#d7bb83;font-weight:bold}
 #stageMangaViewer .manga-controls .manga-skip{background:transparent;border-color:#48586a;color:#bac3cd;font:11px system-ui}
 #stageMangaViewer button:disabled{opacity:.32}
 @media(max-height:660px){#stageMangaViewer{padding:5px}#stageMangaViewer .manga-board{gap:5px;padding:6px}
   #stageMangaViewer .manga-line{max-height:24dvh}}
 @media(prefers-reduced-motion:no-preference){#stageMangaViewer .manga-art{animation:mangaFade .24s ease}
   @keyframes mangaFade{from{opacity:.4;transform:scale(.985)}to{opacity:1;transform:scale(1)}}}
 `;
 container.append(root);document.head.append(style);
 const $=selector=>root.querySelector(selector);
 let story=null,visiblePanels=[],phase='pre',index=0,finish=null,voiceOn=readVoice(storage),active=false,storyContext={};
 let currentArtKey=null,pageRequest=0;
 function loadPanelArt(shot,pagePanels){
  // Only the exact scene/gender/outcome; prefer existing individually cut WebPs.
  const cut=registeredStoryPanelAsset(shot);
  const sheet=comicPageAsset(story.id,shot.phase,storyContext,shot.comicPage,shot.protagonistGender);
  const key=[cut||'',sheet||'',shot.comicCell,pagePanels.length].join('|');
  if(key===currentArtKey)return;
  currentArtKey=key;
  const request=++pageRequest,img=$('.manga-art'),missing=$('.manga-missing');
  img.hidden=true;missing.hidden=false;
  missing.textContent='原画未登録の場合は、別の絵で代用しません。画像を確認しています…';
  const unavailable=()=>{if(request!==pageRequest)return;
   img.hidden=true;missing.hidden=false;
   missing.textContent='このコマの'+(shot.phase==='pre'?'イベント前':'イベント後')+
    'の'+(shot.protagonistGender==='female'?'女性':'男性')+'版原画は未登録です。';};
  const attempt=(url,kind)=>{
   if(!url){unavailable();return;}
   img.onload=()=>{
    if(request!==pageRequest)return;
    if(kind==='cut'){
     img.style.width='100%';img.style.height='100%';img.style.left='0%';img.style.top='0%';
     img.style.objectFit='contain';img.dataset.renderMode='single-cut';
    }else{
     const crop=storySheetCrop(shot,pagePanels.length);
     img.style.width=crop.widthPercent+'%';img.style.height=crop.heightPercent+'%';
     img.style.left=crop.leftPercent+'%';img.style.top=crop.topPercent+'%';
     img.style.objectFit='fill';img.dataset.renderMode='cropped-sheet';
    }
    img.hidden=false;missing.hidden=true;
   };
   img.onerror=()=>{if(request!==pageRequest)return;
     if(kind==='cut')attempt(sheet,'sheet');else unavailable();};
   img.src=url;
   if(img.complete&&img.naturalWidth>0)img.onload();
  };
  attempt(cut||sheet,cut?'cut':'sheet');
 }

 const voiceDirector=createStoryVoiceDirector();
 function stopVoice(){voiceDirector.stop();}
 function narrate(){if(active&&story&&voiceOn)void voiceDirector.speak(visiblePanels[index]);}
 function frame(){
  if(!story||!active)return;
  stopVoice();
  const shot=visiblePanels[index];
  const pagePanels=visiblePanels.filter(p=>p.comicEdition===shot.comicEdition&&p.comicPage===shot.comicPage);
  $('.manga-stage').textContent='第'+story.chapter+'章 · '+story.stageName+' · '+(phase==='post'?(story.stageKind==='town'?'町の後日談':'戦闘後'):phase==='pre'?'開戦前':'全場面');
  loadPanelArt(shot,pagePanels);
  $('.manga-art').alt=story.stageName+'の'+(shot.phase==='pre'?'イベント前':'イベント後')+
   '（'+shot.comicEdition+'）'+(shot.protagonistGender==='female'?'女性版':'男性版');
  $('.manga-speaker').textContent=shot.speaker+(shot.characterId?'　／　'+shot.faction+'・'+shot.role:'　／　ナレーション');
  renderStoryRubyText($('.manga-line'),shot);
  $('.manga-shot').textContent=story.id.toUpperCase()+' · '+shot.comicEdition+' · ページ'+shot.comicPage;
  $('.manga-progress').textContent='セリフ '+(index+1)+' / '+visiblePanels.length+'　（このページ '+(shot.comicCell+1)+' / '+pagePanels.length+'コマ）';
  $('.manga-previous').disabled=index===0;
  $('.manga-next').textContent=index===visiblePanels.length-1?
   (phase==='pre'?'ステージへ進む ▶':phase==='post'?'結果を閉じる ▶':'確認を終える ▶'):'次のセリフ ▶';
  $('.manga-voice').textContent=voiceOn?'音声 ON':'音声 OFF';
  const cue=fantasyCueForMangaPanel({id:story.id,number:story.number,kind:shot.scenery},shot.index);
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
 function open(id,{onFinish=null,at=0,context=null,phase:which='pre'}={}){
  if(!['pre','post','all'].includes(which))throw Error('Unknown manga phase: '+which);
  if(active)close({completed:false});
  story=mangaForStage(id,context||{});
  phase=which;
  storyContext=context||{};
  visiblePanels=which==='all'
   ?[...comicForStage(id,'pre',storyContext).panels,...comicForStage(id,'post',storyContext).panels]
   :comicForStage(id,which,storyContext).panels;
  if(!visiblePanels.length)throw Error('No manga panels for '+id+' '+which);
  index=Math.max(0,Math.min(visiblePanels.length-1,at|0));
  currentArtKey=null;finish=onFinish;voiceOn=readVoice(storage);active=true;root.hidden=false;
  frame();return story;
 }
 $('.manga-previous').onclick=()=>{if(index>0){index--;frame();}};
 $('.manga-next').onclick=()=>{
  if(index>=visiblePanels.length-1)close({completed:true});
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
  get panelIndex(){return index},get phase(){return phase},get voiceEnabled(){return voiceOn}};
}
