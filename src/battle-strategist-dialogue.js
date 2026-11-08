import {createBattleStrategistAdvisor} from './battle-strategist-commentary.js';

/** Bottom-left/right portrait dialogue for tactical battlefield reports.
 * Uses the same 4x4 existing military face atlas as the campaign screen.
 * Nothing is synthesized or narrated unless it follows battlefield state.
 */
export function createBattleStrategistDialogue({
  nameSquad=id=>'第'+id+'隊',getCommander=()=>null,getTime=()=>0,onFocus=()=>{}
}={}){
 const css=document.createElement('style');
 css.textContent=`
 #battleDialogue{position:fixed;z-index:25;left:8px;right:8px;bottom:calc(var(--battleDockHeight,196px) + 8px);max-width:min(460px,calc(100% - 16px));display:flex;align-items:stretch;gap:8px;padding:7px 8px;min-height:69px;border:1px solid #bea570;border-radius:10px;background:#0d233bec;color:#f6f4eb;box-shadow:0 5px 25px #0009;pointer-events:auto}
 #battleDialogue[hidden],#battleReportHistory[hidden]{display:none!important}
 #battleDialogue.right{margin-left:auto;flex-direction:row-reverse}
 #battleDialogue.critical{border-color:#ff777e;background:#441c2aef}
 #battleDialogue.warning{border-color:#eed47b}
 #battleDialogue.success{border-color:#9fe6b6}
 #battleReportFace{width:60px;min-width:60px;min-height:59px;border:2px solid #bda46a;border-radius:7px;background:#18283b url('./assets/story-commander-portraits-v0.9.webp') no-repeat;background-size:400% 400%;background-position:0% 0%}
 #battleReportInfo{flex:1;min-width:0}
 #battleReportHeader{display:flex;align-items:center;gap:7px;color:#ffdea0;font:bold 11px system-ui}
 #battleReportTime{color:#b8ccdf;font-weight:normal}
 #battleReportText{font:12px/1.4 system-ui;margin-top:4px}
 #battleReportHistoryToggle{margin-left:auto;padding:2px 6px;color:#e9efff;background:#1d3a54;border:1px solid #7297b0;border-radius:5px;font:10px system-ui;cursor:pointer}
 #battleReportHistory{position:fixed;z-index:27;left:8px;right:8px;bottom:calc(var(--battleDockHeight,196px) + 91px);max-height:230px;overflow:auto;border:1px solid #7299b5;border-radius:9px;padding:9px;background:#0a1d32f6;color:#f3f6fb;font:11px/1.45 system-ui}
 #battleReportHistory p{margin:0;padding:5px 2px;border-bottom:1px solid #405e77}
 @media(max-width:390px){#battleDialogue{gap:5px;padding:5px 6px}#battleReportFace{min-width:51px;width:51px;min-height:55px}#battleReportText{font-size:11px}}
 `;
 document.head.append(css);
 const box=document.createElement('section');
 box.id='battleDialogue';box.hidden=true;box.setAttribute('aria-label','軍師と伝令からの戦況報告');
 box.innerHTML='<div id="battleReportFace" aria-hidden="true"></div><div id="battleReportInfo"><div id="battleReportHeader"><span id="battleReportName">軍師</span><span id="battleReportTime"></span><button id="battleReportHistoryToggle" type="button" aria-expanded="false">履歴</button></div><div id="battleReportText" aria-live="polite"></div></div>';
 const history=document.createElement('section');history.id='battleReportHistory';
 history.hidden=true;history.setAttribute('aria-label','戦況の報告履歴');
 document.body.append(box,history);
 const nameEl=box.querySelector('#battleReportName'),timeEl=box.querySelector('#battleReportTime');
 const textEl=box.querySelector('#battleReportText'),faceEl=box.querySelector('#battleReportFace');
 box.querySelector('#battleReportHistoryToggle').onclick=e=>{
  history.hidden=!history.hidden;e.currentTarget.setAttribute('aria-expanded',String(!history.hidden));
 };
 const advisor=createBattleStrategistAdvisor({nameSquad});
 const events=[],queue=[];let lastScan=-Infinity,lastShown=-Infinity,first=true,currentEvent=null;
 // The spoken report is also an interactive unit locator. The separate
 // history button still works and never accidentally moves the camera.
 box.tabIndex=0;
 box.title='報告元の隊の軍師をズーム';
 const followReport=()=>{if(currentEvent?.squadId!=null)
   onFocus({...currentEvent,fromMessageTap:true});};
 box.addEventListener('click',event=>{if(!event.target.closest('button'))followReport();});
 box.addEventListener('keydown',event=>{
  if(event.target!==box||!['Enter',' '].includes(event.key))return;
  event.preventDefault();followReport();
 });
 function display(event){
  currentEvent=event;
  box.hidden=false;box.className='';
  box.classList.add(event.speaker==='軍師'?'left':'right',event.kind||'info');
  const commander=event.speaker==='軍師'?getCommander(event.squadId):null;
  const name=commander?.name?commander.name+'・軍師':event.speaker;
  const face=Math.max(0,Math.min(7,Number(commander?.faceId)||
    (event.speaker==='斥候'?5:event.speaker==='伝令'?3:0)));
  const row=Math.floor(face/4)+(commander?.gender==='female'?2:0);
  faceEl.style.backgroundPosition=(face%4*100/3)+'% '+(row*100/3)+'%';
  nameEl.textContent=name;timeEl.textContent='戦闘 '+Math.floor(getTime())+'秒';
  textEl.textContent=event.text;
  lastShown=getTime();first=false;
  if(event.focus)onFocus(event);
 }
 function push(event){
  if(!event?.text)return;
  const time=getTime(),key=String(event.key||event.text);
  if(events.some(e=>e.key===key&&time-e.time<6))return;
  events.unshift({...event,key,time});
  if(events.length>40)events.length=40;
  const row=document.createElement('p');row.textContent=Math.floor(time)+'秒　'+event.speaker+'：'+event.text;
  history.prepend(row);while(history.childElementCount>40)history.lastChild.remove();
  if(first||event.priority>=95&&time-lastShown>1.2)display(event);
  else{queue.push(event);queue.sort((a,b)=>(b.priority||0)-(a.priority||0));queue.length=Math.min(queue.length,15);}
 }
 function update(units,paused=false,finished=false){
  const time=getTime();
  if(!paused&&!finished&&time-lastScan>=1.5){
    lastScan=time;
    for(const item of advisor.inspect(units,time)){
      if(item.key?.startsWith('leader:'))item.focus=true;
      push(item);
    }
  }
  if(queue.length&&time-lastShown>=4.6)display(queue.shift());
 }
 return {push,update,get status(){return {visible:!box.hidden,current:textEl.textContent,
   history:events.slice(0,20),queued:queue.length,
   currentSquadId:currentEvent?.squadId??null,tapTarget:currentEvent?.unitId??null};}};
}
