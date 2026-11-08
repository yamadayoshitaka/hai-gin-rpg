/**
 * Battle ceremony: render-only cut-ins with a strict gameplay input gate.
 * All animation is CSS accelerated. No per-character particles or draw calls.
 */
export function createBattleCeremony({
  documentRef=globalThis.document,
  now=()=>performance.now(),
  onPhase=()=>{},
  onIntroFinished=()=>{},
  onOutroFinished=()=>{}
}={}){
 const doc=documentRef;
 const style=doc.createElement('style');
 style.textContent=`
 #battleCeremony{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;
  pointer-events:none;opacity:0;overflow:hidden;isolation:isolate;transition:opacity .16s ease}
 #battleCeremony.visible{opacity:1}
 #battleCeremony.locked{pointer-events:auto;touch-action:none;cursor:wait}
 #battleCeremony .ceremonyShade{position:absolute;inset:0;background:radial-gradient(ellipse at center,
  #193955b0,#030817ef 72%);opacity:.88}
 #battleCeremony .ceremonyBeam{position:absolute;top:0;left:-42%;width:45%;height:100%;
  transform:skewX(-24deg);background:linear-gradient(90deg,transparent,#fff4bd25,#f9d5807a,#fff4bd20,transparent);
  filter:blur(8px);animation:ceremonyBeam .95s ease-out both}
 #battleCeremony .ceremonyOrnament{position:absolute;inset:8% 4%;border:1px solid #debf74a6;
  box-shadow:inset 0 0 55px #d7a24e27,0 0 54px #e6bb703a;transform:scaleX(.3);
  animation:ceremonyOrnament .7s cubic-bezier(.2,.8,.2,1) forwards}
 #battleCeremony .ceremonyLines{position:absolute;inset:0;
  background:repeating-linear-gradient(166deg,transparent 0,transparent 18px,#ffd28512 19px,transparent 21px);
  animation:ceremonyLines 2s linear infinite}
 #battleCeremony .ceremonyContent{position:relative;display:grid;justify-items:center;text-align:center;
  gap:9px;max-width:92vw;padding:22px;filter:drop-shadow(0 4px 20px #03060b);
  animation:ceremonyRise .55s cubic-bezier(.18,.8,.26,1) both}
 #battleCeremony .ceremonyEmblem{font-size:clamp(45px,11vw,95px);line-height:1}
 #battleCeremony .ceremonyTitle{font:900 clamp(35px,9.5vw,90px)/1.15 serif;
  letter-spacing:.17em;color:#ffe7a0;text-shadow:0 0 15px #f6b957c9,0 3px 2px #21110a;
  -webkit-text-stroke:.6px #fff1ba}
 #battleCeremony .ceremonyStage{font:bold clamp(21px,5vw,43px)/1.3 serif;color:#f9e7c3;
  letter-spacing:.1em;max-width:92vw;text-shadow:0 0 15px #9ed5e377,0 2px 7px #020812}
 #battleCeremony .ceremonyStage[hidden]{display:none!important}
 #battleCeremony .ceremonySub{font:bold clamp(12px,3.3vw,22px)/1.5 system-ui;
  letter-spacing:.14em;color:#eaf4fa}
 #battleCeremony.victory .ceremonyTitle{color:#fff0af;text-shadow:0 0 22px #fdd176}
 #battleCeremony.defeat .ceremonyTitle{color:#d9e2f5;text-shadow:0 0 18px #7284b4}
 #battleCeremony.defeat .ceremonyShade{background:radial-gradient(ellipse,#242a40cb,#080b16f7 74%)}
 #battleCeremony.order .ceremonyShade{opacity:.45}
 #battleCeremony.order .ceremonyContent{margin-top:-25vh}
 #battleCeremony.order .ceremonyTitle{font-size:clamp(25px,7vw,54px)}
 #battleCeremony.order .ceremonyEmblem{font-size:clamp(32px,7vw,58px)}
 #battleCeremony.order .ceremonyOrnament{inset:24% 5%;border-width:2px}
 @keyframes ceremonyBeam{from{left:-50%;opacity:0}20%{opacity:1}to{left:120%;opacity:0}}
 @keyframes ceremonyOrnament{to{transform:scaleX(1)}}
 @keyframes ceremonyLines{to{transform:translateY(20px)}}
 @keyframes ceremonyRise{from{opacity:0;transform:scale(1.38)}to{opacity:1;transform:scale(1)}}
 @media(prefers-reduced-motion:reduce){#battleCeremony *{animation:none!important;transition:none!important}}
 `;
 doc.head.appendChild(style);
 const el=doc.createElement('div');el.id='battleCeremony';el.hidden=true;
 el.innerHTML='<div class="ceremonyShade"></div><div class="ceremonyLines"></div><div class="ceremonyBeam"></div><div class="ceremonyOrnament"></div><div class="ceremonyContent"><div class="ceremonyEmblem"></div><div class="ceremonyStage" hidden></div><div class="ceremonyTitle"></div><div class="ceremonySub"></div></div>';
 // CSS display on #battleCeremony overrides [hidden] unless explicitly set.
 style.textContent+='#battleCeremony[hidden]{display:none!important}';
 doc.body.appendChild(el);
 const emblem=el.querySelector('.ceremonyEmblem');
 const title=el.querySelector('.ceremonyTitle');
 const stageTitle=el.querySelector('.ceremonyStage');
 const subtitle=el.querySelector('.ceremonySub');
 let state='idle',until=0,locked=false;
 const formats={
  intro:['⚔','開戦','各軍、戦闘開始！'],
  victory:['🏆','勝利','戦場に勝鬨が響く'],
  defeat:['⚑','敗北','軍勢は退却を余儀なくされた'],
  order:['♟','号令','軍師の命令が全軍へ響く']
 };
 function begin(kind,detail='',duration=null,stageName=''){
  const content=formats[kind];if(!content)return;
  if(state==='outro'&&kind!=='victory'&&kind!=='defeat')return;
  const major=kind!=='order';state=kind==='intro'?'intro':kind==='order'?'order':'outro';
  locked=major;until=now()+(duration??(kind==='intro'?2400:kind==='order'?1250:3500));
  el.hidden=false;el.className=kind+' visible'+(locked?' locked':'');
  // Restart CSS transitions/entrance per command, without dynamic 3D work.
  for(const child of el.children){child.style.animation='none';void child.offsetWidth;child.style.animation='';}
  emblem.textContent=content[0];title.textContent=content[1];subtitle.textContent=detail||content[2];
  stageTitle.hidden=kind!=='intro'||!stageName;
  stageTitle.textContent=stageName?'ステージ：'+String(stageName).slice(0,66):'';
  if(major)onPhase(kind);
 }
 function update(){
  if(state==='idle'||now()<until)return;
  const finished=state;state='idle';locked=false;el.hidden=true;el.className='';
  if(finished==='intro')onIntroFinished();
  if(finished==='outro')onOutroFinished();
 }
 return {
  startIntro:({stageName='',stageFeature=''}={})=>begin('intro',stageFeature||'',null,stageName),
  showOrder:detail=>{if(!locked)begin('order',detail);},
  finish:(win,detail='')=>begin(win?'victory':'defeat',detail),
  update,
  get locked(){return locked},
  get state(){return state},
  get remainingMs(){return Math.max(0,until-now())}
 };
}
