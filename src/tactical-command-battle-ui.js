import {
 squadPower,rankTacticalOrders,tacticalCooldownSeconds,COMMAND_LABELS,healthSituation
} from './tactical-command-evaluation.js';

const fragment=(tag,cls,text)=>{
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=String(text);
 return el;
};

/** Compact actionable tactical panel tied to the authoritative battle order handler. */
export function installBattleTacticalUI({
 getUnits,getSquadIds,getCommander,getSquadName,getCurrentStage,
 getCommanderReason,getCooldown,getSquadCenter,getMarkerLabel,issueOrder,openSquad,closeSquad,isReady
}){
 const preview=fragment('section','','');
 preview.id='tacticalCommandPreview';
 preview.hidden=true;
 document.getElementById('squadOrderStatus')?.insertAdjacentElement('afterend',preview);
 // Existing compact dock applies overflow:hidden!important; let the actionable
 // four-order cards scroll on narrow phones instead of being clipped.
 preview.closest('#squadTactics')?.style.setProperty('overflow','auto','important');
 const banner=fragment('aside','','');
 banner.id='battleTacticalSituation';
 banner.hidden=true;
 banner.setAttribute('role','status');
 banner.setAttribute('aria-live','polite');
 document.body.append(banner);
 const snapshots=new Map();
 let noticeTimer=null;
 const eligibleElements=new Set();
 function resetEligible(){
  for(const el of eligibleElements)el.classList.remove('tactical-eligible');
  eligibleElements.clear();
 }
 function renderFor(id){
  if(id==null||!isReady()){preview.hidden=true;return;}
  const roster=getUnits(),members=roster.filter(u=>u.team===0&&String(u.squadId)===String(id)&&
   !u.isStrategist&&(u.hp??1)>0&&u.alive!==false);
  const center=getSquadCenter(id),commander=getCommander(id),reason=getCommanderReason(id);
  const remaining=getCooldown(id);
  const nearby=roster.filter(u=>{
   if(u.team!==1||u.isStrategist||u.alive===false||!(u.hp>0)||!center)return false;
   const x=u.x??u.cell?.x,z=u.z??u.cell?.z;
   return Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x-center.x,z-center.z)<=18;
  });
  const options=rankTacticalOrders(null,{units:members,opponents:nearby,commander});
  preview.replaceChildren(fragment('div','tacticalPreviewHeading',''));
  const heading=preview.firstElementChild;
  heading.append(fragment('strong','','⚑ 戦術の効果と成功見込み'),
   fragment('span','','戦力 '+squadPower(members).toFixed(1)));
  const cards=fragment('div','tacticalPreviewCards','');
  options.forEach((option,index)=>{
   const button=fragment('button',index===0?'best':'','');
   button.type='button';button.disabled=Boolean(reason)||remaining>0||!option.eligible;
   button.append(fragment('strong','',(index===0?'★ ':'')+COMMAND_LABELS[option.mode]),
    fragment('small','','無抵抗効果 '+option.effect+'/100'),
    fragment('small','','成功見込み '+option.success+'%'+
     (option.commanderBonus?'・軍師+'+option.commanderBonus+'pt':'')));
   button.onclick=()=>{
    if(issueOrder(id,option.mode)){closeSquad();preview.hidden=true;}
   };
   cards.append(button);
  });
  preview.append(cards);
  preview.append(fragment('small','tacticalDisclaimer',reason||(
   remaining?'次の号令まで '+remaining+'秒':
   '参考値：現在の局所敵戦力とレアリティで推定。命令の実処理は既存の戦闘AIが担当します。')));
  preview.hidden=false;
 }
 function showSituation(id,event,sums){
  if(!isReady()||document.body.classList.contains('squad-closeup'))return;
  if(noticeTimer!==null)clearTimeout(noticeTimer);
  resetEligible();
  const candidates=getSquadIds().filter(sid=>{
   const row=sums.get('0:'+sid);
   return row?.n>0&&!getCommanderReason(sid)&&getCooldown(sid)<=0;
  });
  for(const sid of candidates){
   const key=String(sid);
   const ribbon=document.querySelector('#allySquadRibbonList .ribbonSquad[data-squad-id="'+key+'"]');
   const marker=getMarkerLabel(sid);
   for(const target of [ribbon,marker])if(target){
    target.classList.add('tactical-eligible');eligibleElements.add(target);
   }
  }
  banner.replaceChildren(fragment('strong','','⚠ 戦況変化：'+event.title),
   fragment('small','',getSquadName(id)+'が損耗。対応可能 '+candidates.length+'隊を強調表示'));
  if(candidates.length){
   const chosen=candidates.includes(String(id))?String(id):candidates[0];
   const button=fragment('button','','📯 対応策を確認：'+getSquadName(chosen));
   button.type='button';
   button.onclick=()=>{banner.hidden=true;resetEligible();openSquad(chosen);};
   banner.append(button);
  }
  banner.hidden=false;
  noticeTimer=setTimeout(()=>{banner.hidden=true;resetEligible();noticeTimer=null;},5200);
 }
 function onSquadSums(sums){
  if(!isReady())return;
  let mostImportant=null;
  for(const id of getSquadIds()){
   const key='0:'+id,now=sums.get(key);
   if(!now)continue;
   const previous=snapshots.get(key);
   snapshots.set(key,{n:now.n,total:now.total});
   const warning=healthSituation(previous,now);
   if(warning&&(!mostImportant||warning.ratio<mostImportant.warning.ratio))
    mostImportant={id,warning};
  }
  if(mostImportant)showSituation(mostImportant.id,mostImportant.warning,sums);
 }
 return {renderFor,onSquadSums};
}

/** Opening wizard, attached to the actual stage and current squad orders. */
export function createPreBattleTacticalSummary({getStageName,getUnits,getOrders,getCommander}){
 const element=fragment('section','','');element.id='openingTacticalSummary';
 function refresh(){
  const friendly=getUnits().filter(u=>u.team===0&&!u.isStrategist&&u.alive!==false&&(u.hp??1)>0);
  const leader=getCommander(),options=rankTacticalOrders(null,{units:friendly,commander:leader});
  const best=options[0];
  element.replaceChildren(fragment('strong','','⚑ 開戦前・戦術の最終確認'));
  for(const [name,value] of [
   ['戦場',getStageName()],
   ['出撃戦力',squadPower(friendly).toFixed(1)+'／'+friendly.length+'名'],
   ['無抵抗時の最大効果',COMMAND_LABELS[best.mode]+' '+best.effect+'/100'],
   ['統率による号令間隔',tacticalCooldownSeconds(leader?.level||1)+'秒'],
   ['初期号令',getOrders().join('／')||'自動']
  ]){
   const line=fragment('div','openingSummaryLine','');
   line.append(fragment('span','',name),fragment('b','',value));element.append(line);
  }
  element.append(fragment('small','',
   '出撃後は作戦と隊列編成を固定。戦況変化時には対応可能隊を強調し、号令を選択できます。'));
 }
 return {element,refresh};
}
