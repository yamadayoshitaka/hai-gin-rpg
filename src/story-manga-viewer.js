/**
 * Touch-first continuous manga viewer used at every world-map sortie.
 * Individually registered cuts or exactly matched chapter/branch/gender sheets,
 * accessible speech text, optional Japanese reading and matching fantasy BGM.
 * The UI never touches combat actors, town 3D models or player stats.
 */
import {mangaForStage} from './story-stage-manga.js';
import {registeredStoryPanelAsset,storySheetCrop,storyArtDisplayUrl} from './story-panel-registered-art.js';
import {provisionalRegisteredStoryPanel} from './story-provisional-registered-art.js';
import {restoredStoryArchivePanel} from './story-archive-restored-art.js';
import {chapter1ProvisionalLivePanel} from './story-chapter1-provisional-live.js';
import {comicPageAsset} from './story-chapter-comic.js';
import {compactComicForStage} from './story-compact-comic.js?v=story-20261117-reader1';
import {STORY_KEY_PEOPLE} from './story-cinematic.js';
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
  '<figure class="manga-figure"><div class="manga-page-area"><img class="manga-art" alt="物語の現在の1コマ" hidden/><div class="manga-missing" role="status">この場面の原画は未登録です。</div></div><figcaption class="manga-shot"></figcaption><a class="manga-preview-link" href="./story-chapter1-approval.html" target="_blank" rel="noopener">この場面の本編原画を確認</a></figure>'+
  '<div class="manga-dialogue" aria-live="polite"><img class="manga-speaker-face" hidden alt="話者の顔"/><div class="manga-speech"><div class="manga-speaker"></div><p class="manga-line"></p></div></div>'+
  '<div class="manga-bottom"><span class="manga-progress" aria-label="漫画のページ位置"></span>'+
  '<div class="manga-controls"><button type="button" class="manga-previous">◀ 前</button>'+
  '<button type="button" class="manga-next">次のコマ ▶</button>'+
  '<button type="button" class="manga-skip">スキップ</button></div></div></div>';
 const style=document.createElement('style');style.textContent=`
 #stageMangaViewer{position:fixed;inset:0;z-index:300;background:#080c16ee;color:#f4e7cf;
   font-family:Georgia,'Noto Serif JP',serif;overflow:auto;overscroll-behavior:contain;
   padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom))}
 #stageMangaViewer[hidden]{display:none!important}
 #stageMangaViewer .manga-board{margin:0 auto;width:min(840px,100%);min-height:0;display:flex;flex-direction:column;
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
 #stageMangaViewer .manga-board.recap-scene .manga-page-area{border-color:#d8bc87}
 #stageMangaViewer .manga-board.recap-scene .manga-art{filter:none;transform:none}
 #stageMangaViewer .manga-board.recap-scene .manga-speaker{color:#d7c8a9}
 #stageMangaViewer .manga-missing{display:grid;place-items:center;text-align:center;height:100%;padding:24px;
   font:13px/1.7 system-ui;color:#d9c79e;background:#13273b}
 #stageMangaViewer .manga-shot{font:10px system-ui;text-align:right;color:#bfc8c8}
 #stageMangaViewer .manga-preview-link{font:12px system-ui;color:#eecb97;text-decoration:underline;text-underline-offset:3px}
 #stageMangaViewer .manga-dialogue{padding:12px 14px;background:linear-gradient(120deg,#0b1629f5,#172c3de9);color:#f4e9d7;border:1px solid #a88d62;
   box-shadow:0 10px 25px #0008;min-height:95px;border-radius:4px}
 #stageMangaViewer .manga-dialogue{display:flex;align-items:flex-start;gap:10px}
 #stageMangaViewer .manga-speaker-face{width:64px;height:64px;flex:none;object-fit:cover;object-position:center 20%;border:1px solid #a68d69;border-radius:5px;background:#091522}
 #stageMangaViewer .manga-speaker-face[hidden]{display:none}
 #stageMangaViewer .manga-speech{min-width:0;flex:1}
 #stageMangaViewer .manga-speaker{font:bold 13px system-ui;color:#f0d7a6;border-bottom:1px solid #56647a;padding-bottom:4px}
 #stageMangaViewer .manga-line{font:clamp(13px,3.4vw,17px)/1.7 Georgia,'Noto Serif JP',serif;
   margin:6px 0 0;white-space:pre-wrap;max-height:28dvh;overflow-y:auto}
 #stageMangaViewer .manga-line ruby{ruby-position:over;text-decoration:none}
 #stageMangaViewer .manga-line rt{font:600 0.57em/1.3 system-ui;color:#e9c997}
 #stageMangaViewer .manga-bottom{display:grid;gap:10px;margin-top:0}
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
 let story=null,visiblePanels=[],phase='pre',index=0,turnIndex=0,finish=null,voiceOn=readVoice(storage),active=false,storyContext={},recap=null,showRecap=false;
 const castIds=new Set(STORY_KEY_PEOPLE.map(p=>p.id));
 function activeTurn(){const shot=visiblePanels[index];return shot?.dialogueTurns?.[turnIndex]||shot;}
 function portraitFor(turn){
  const id=turn?.characterId;
  if(typeof id==='string'&&castIds.has(id))return './assets/story-cinema/cast/'+id+'.webp';
  if(turn?.speaker==='軍師'&&storyContext.protagonistGender==='female')return './assets/story/characters/commander/female-master.webp';
  return null;
 }
 function renderPortrait(turn,shot=null){
  const img=$('.manga-speaker-face');
  // P0 screenshot regression: the original cast atlas showed a different
  // person's face than the physically registered S03/S05 first CG.
  const exact=shot&&['c01-s03-m1','c01-s05-m1'].includes(shot.id)
   ?(shot.sharedArtAsset||registeredStoryPanelAsset(shot)):null;
  const src=exact?storyArtDisplayUrl(exact):portraitFor(turn);
  img.hidden=!src;
  if(!src){img.removeAttribute('src');return}
  img.style.objectFit='cover';
  img.style.objectPosition=exact?'30% 22%':'center 20%';
  img.onerror=()=>{if(img.getAttribute('src')===src)img.hidden=true};
  if(img.getAttribute('src')!==src)img.src=src;
  img.alt=(turn.speaker||'話者')+'の顔';
 }
 let currentArtKey=null,pageRequest=0;
 function loadPanelArt(shot,pagePanels){
  // Only the exact scene/gender/outcome; prefer existing individually cut WebPs.
  const cut=shot.sharedArtAsset||registeredStoryPanelAsset(shot);
  const draftRegistration=restoredStoryArchivePanel(shot)||provisionalRegisteredStoryPanel(shot);
  const sheet=comicPageAsset(story.id,shot.phase,storyContext,shot.comicPage,shot.protagonistGender);
  const key=[cut||'',sheet||'',shot.comicCell,shot.sourceSheetCount||pagePanels.length,draftRegistration?.status||''].join('|');
  if(key===currentArtKey)return;
  currentArtKey=key;
  const request=++pageRequest,img=$('.manga-art'),missing=$('.manga-missing');
  img.hidden=true;missing.hidden=false;
  missing.textContent='原画未登録の場合は、別の絵で代用しません。画像を確認しています…';
  const unavailable=()=>{if(request!==pageRequest)return;
   img.hidden=true;missing.hidden=false;
   missing.textContent=cut?.includes('/chapter1-provisional-live/')?
    '最新の仮登録原画を取得できません。古い原画には戻しません。再読込してください。':
    'このコマの'+(shot.phase==='pre'?'イベント前':'イベント後')+
     'の'+(shot.protagonistGender==='female'?'女性':'男性')+'版原画は未登録です。';};
  const attempt=(url,kind)=>{
   if(!url){unavailable();return;}
   img.onload=()=>{
    if(request!==pageRequest)return;
    if(kind==='cut'){
     img.style.width='100%';img.style.height='100%';img.style.left='0%';img.style.top='0%';
     img.style.objectFit='contain';img.dataset.renderMode='single-cut';
    }else{
     const crop=storySheetCrop(shot,shot.sourceSheetCount||pagePanels.length);
     img.style.width=crop.widthPercent+'%';img.style.height=crop.heightPercent+'%';
     img.style.left=crop.leftPercent+'%';img.style.top=crop.topPercent+'%';
     img.style.objectFit='fill';img.dataset.renderMode='cropped-sheet';
    }
    img.hidden=false;missing.hidden=true;
   };
   img.onerror=()=>{if(request!==pageRequest)return;
     if(kind==='cut'&&!cut?.includes('/chapter1-provisional-live/'))attempt(sheet,'sheet');else unavailable();};
   img.src=storyArtDisplayUrl(url);
   if(img.complete&&img.naturalWidth>0)img.onload();
  };
  attempt(cut||sheet,cut?'cut':'sheet');
 }

 const voiceDirector=createStoryVoiceDirector();
 function stopVoice(){voiceDirector.stop();}
 function narrate(){if(active&&story&&voiceOn)void voiceDirector.speak(showRecap?recap:{...visiblePanels[index],...activeTurn()});}
 function frame(){
  if(!story||!active)return;
  stopVoice();
  if(showRecap&&recap){
   $('.manga-board').classList.add('recap-scene');
   $('.manga-stage').textContent='第'+story.chapter+'章 · '+story.stageName+' · ここまでのあらすじ';
   const img=$('.manga-art'),missing=$('.manga-missing'),req=++pageRequest;
   currentArtKey=null;img.hidden=true;missing.hidden=false;
   missing.textContent='専用あらすじ画像を読み込み中…';
   img.style.width='100%';img.style.height='100%';img.style.left='0%';img.style.top='0%';img.style.objectFit='contain';
   img.alt='ここまでのあらすじ専用イラスト';
   img.onload=()=>{if(req!==pageRequest||!showRecap)return;img.hidden=false;missing.hidden=true};
   img.onerror=()=>{if(req!==pageRequest||!showRecap)return;img.hidden=true;missing.hidden=false;missing.textContent='あらすじ専用画像を読み込めません。'};
   img.src=storyArtDisplayUrl('./'+recap.artAsset.replace(/^\.\//,''));
   if(img.complete&&img.naturalWidth>0)img.onload();
   $('.manga-preview-link').hidden=true;
   $('.manga-shot').textContent='ここまでのあらすじ · 専用原画';
   $('.manga-speaker').textContent='語り手　／　ナレーション';
   renderPortrait(recap);renderStoryRubyText($('.manga-line'),recap);
   $('.manga-progress').textContent='あらすじ　→　イベントCG '+visiblePanels.length+'枚';
   $('.manga-previous').disabled=true;
   $('.manga-next').textContent='人物の会話へ ▶';
   $('.manga-voice').textContent=voiceOn?'音声 ON':'音声 OFF';
   narrate();return;
  }
  $('.manga-board').classList.remove('recap-scene');
  const shot=visiblePanels[index],talk=activeTurn();
  // Keep the introductory narration visually separate from the characters.
  // Reveal the unblurred CG and speaker face as soon as dialogue starts.
  // Narration is displayed only on the special recap art, not on a character CG.
  const pagePanels=visiblePanels.filter(p=>p.comicEdition===shot.comicEdition&&p.comicPage===shot.comicPage);
  const reviewLink=$('.manga-preview-link');
  reviewLink.hidden=story.chapter!==1;
  if(story.chapter===1)reviewLink.href='./story-chapter1-approval.html?'+
   new URLSearchParams({stage:shot.stageId,gender:shot.protagonistGender,edition:shot.comicEdition});
  $('.manga-stage').textContent='第'+story.chapter+'章 · '+story.stageName+' · '+(phase==='post'?(story.stageKind==='town'?'町の後日談':'戦闘後'):phase==='pre'?'開戦前':'全場面');
  loadPanelArt(shot,pagePanels);
  $('.manga-art').alt=story.stageName+'の'+(shot.phase==='pre'?'イベント前':'イベント後')+
   '（'+shot.comicEdition+'）'+(shot.protagonistGender==='female'?'女性版':'男性版');
  $('.manga-speaker').textContent=talk.speaker+(talk.characterId?'　／　'+talk.faction+'・'+talk.role:'　／　ナレーション');
  renderPortrait(talk,shot);
  renderStoryRubyText($('.manga-line'),talk);
  const draftArt=chapter1ProvisionalLivePanel(shot)||restoredStoryArchivePanel(shot)||provisionalRegisteredStoryPanel(shot);
  $('.manga-shot').textContent=story.id.toUpperCase()+' · '+shot.comicEdition+' · ページ'+shot.comicPage+
   (draftArt?' · 仮承認・ゲーム反映中（正式品質審査前／差し戻し可能）':'');
  $('.manga-progress').textContent='イベントCG '+(index+1)+' / '+visiblePanels.length+'　・　セリフ '+(turnIndex+1)+' / '+(shot.dialogueTurns?.length||1);
  $('.manga-previous').disabled=index===0&&turnIndex===0&&!recap;
  $('.manga-next').textContent=index===visiblePanels.length-1&&turnIndex===(shot.dialogueTurns?.length||1)-1?
   (phase==='pre'?'ステージへ進む ▶':phase==='post'?'結果を閉じる ▶':'確認を終える ▶'):'次のセリフ ▶';
  $('.manga-voice').textContent=voiceOn?'音声 ON':'音声 OFF';
  const cue=fantasyCueForMangaPanel({id:story.id,number:story.number,kind:shot.scenery},shot.index);
  onCue(cue,talk,story);
  narrate();
 }
 function close({completed=false}={}){
  if(!active)return;
  active=false;root.hidden=true;stopVoice();
  $('.manga-board').classList.remove('recap-scene');
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
  const preComic=which==='post'?null:compactComicForStage(id,'pre',storyContext);
  const postComic=which==='pre'?null:compactComicForStage(id,'post',storyContext);
  visiblePanels=which==='all'?[...preComic.panels,...postComic.panels]:
   which==='pre'?preComic.panels:postComic.panels;
  if(!visiblePanels.length)throw Error('No manga panels for '+id+' '+which);
  recap=preComic?.recap||null;
  index=Math.max(0,Math.min(visiblePanels.length-1,at|0));turnIndex=0;
  showRecap=Boolean(recap&&at===0);
  currentArtKey=null;finish=onFinish;voiceOn=readVoice(storage);active=true;root.hidden=false;
  frame();return story;
 }
 $('.manga-previous').onclick=()=>{
  if(showRecap)return;
  if(index===0&&turnIndex===0&&recap){showRecap=true;frame();return}
  if(turnIndex>0){turnIndex--;frame();return}
  if(index>0){index--;turnIndex=(visiblePanels[index].dialogueTurns?.length||1)-1;frame()}
 };
 $('.manga-next').onclick=()=>{
  if(showRecap){showRecap=false;frame();return}
  if(turnIndex<(visiblePanels[index].dialogueTurns?.length||1)-1){turnIndex++;frame();return}
  if(index>=visiblePanels.length-1)close({completed:true});
  else{index++;turnIndex=0;frame()}
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
