/**
 * Lightweight, read-only RPG party HUD for both armies.
 * Source rows are authored by the live battle roster, never simulated by the UI.
 * Only the selected page is rendered; no per-frame worker/GPU work.
 */
import {setBattleJobPortrait} from './battle-job-portraits.js';
import {battleSquadPortraitChoice} from './battle-portrait-identity.js';
export const RPG_HUD_JOB_ICON=Object.freeze({
 '剣士':'⚔','魔法使い':'✦','僧侶':'✚','弓使い':'🏹','弓兵':'🏹','盾騎士':'🛡',
 '騎士':'♞','忍者':'◆','シーフ':'◇','格闘家':'✊','召喚士':'◈'
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/** The icon is selected by character/species identity, not by a synthetic group job. */
export function setBattleSquadHudPortrait(element,row,team=0){
 const choice=battleSquadPortraitChoice(row,team);
 const signature=JSON.stringify(choice);
 if(element.dataset.portraitSignature===signature)return choice;
 element.dataset.portraitSignature=signature;
 element.classList.toggle('rpgMonsterPortrait',choice.kind==='monster');
 element.classList.toggle('rpgCaptainPortrait',choice.kind==='captain');
 if(choice.kind==='monster'){
  element.style.backgroundImage='none';element.style.backgroundPosition='';
  element.textContent=choice.glyph;
  element.title=choice.name+'（モンスター）';
 }else{
  element.textContent='';
  setBattleJobPortrait(element,choice.job,choice.id,team);
  element.title=(choice.kind==='captain'?'宿屋の隊長：':'')+choice.name;
 }
 element.setAttribute('aria-label',element.title);
 return choice;
}
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function rpgHudIcon(job=''){
 const found=Object.keys(RPG_HUD_JOB_ICON).find(k=>String(job).includes(k));
 return RPG_HUD_JOB_ICON[found]||'♟';
}
export function rpgHudHealth(hp,maxHp){
 return clamp(Math.round(100*Math.max(0,Number(hp)||0)/Math.max(1,Number(maxHp)||0)),0,100);
}
/** Actual live members / original squad capacity, never fabricated UI data. */
export const rpgHudTroopPercent=(alive,total)=>rpgHudHealth(alive,total);
export function rpgHudStatus(row){
 if(!(Number(row.alive)>0))return '☠ 全滅';
 if(Number(row.alive)/Math.max(1,Number(row.total)||1)<=.25 ||
    rpgHudHealth(row.hp,row.maxHp)<=25)return '🆘 壊滅寸前';
 const mode=String(row.mode||'');
 if(mode==='defend')return row.inContact?'🛡 守備中・交戦':'🛡 守備中';
 if(mode==='hold')return row.inContact?'⏸ 待機中・敵接触':'⏸ 待機中';
 if(row.inContact)return '⚔ 交戦中';
 if(mode==='retreat')return '↩ 後退中';
 if(mode==='move'||mode==='explore'||mode==='mission')return '➤ 移動中';
 if(mode==='heal'||mode==='support')return '✚ 支援中';
 if(mode==='defend')return '🛡 防御中';
 if(mode==='charge')return '⚔ 突撃中';
 return '⏸ 待機中';
}
/** Effect badges keep their percentage and duration in the accessible tooltip. */
export function rpgHudEffectIcon(effect={}){
 const label=String(effect.label||'');
 const symbol=label.includes('攻')?'⚔':label.includes('防')?'🛡':
  label.includes('速')?'⚡':label.includes('魔')?'✦':
  label.includes('回')?'✚':label.includes('毒')?'☣':
  label.includes('火')||label.includes('燃')?'🔥':label.includes('凍')?'❄':
  label.includes('軍')||label.includes('号令')?'📯':'✧';
 return symbol+(effect.kind==='debuff'?'↓':'↑');
}
export function rpgHudStateIcon(row){
 const state=rpgHudStatus(row);
 return state.startsWith('☠')?'☠':state.startsWith('🆘')?'🆘':
  state.startsWith('⚔')?'⚔':state.startsWith('🛡')?'🛡':
  state.startsWith('✚')?'✚':state.startsWith('➤')?'➤':
  state.startsWith('↩')?'↩':'⏸';
}
export function rpgHudCompactText(row){
 const effects=(row.effects||[]).map(e=>e.label).slice(0,2).join(' ');
 return String(row.name||'部隊')+' HP '+Math.round(row.hp||0)+'/'+Math.round(row.maxHp||0)+
  ' '+(Number(row.alive)||0)+'/'+(Number(row.total)||0)+'人 '+rpgHudStatus(row)+
  ' 攻'+Math.round(Number(row.attackPercent)||0)+'% MP'+Math.round(Number(row.mp)||0)+'/'+Math.round(Number(row.maxMp)||0)+
  (effects?' '+effects:'');
}
export function createBattleRpgSquadHud({documentRef=globalThis.document,onFocus=()=>{},onCommand=()=>{}}={}){
 const doc=documentRef;
 if(!doc?.body?.appendChild)return null;
 const root=doc.createElement('section');root.id='battleRpgSquadHud';
 root.setAttribute('aria-label','戦場の味方隊と敵隊のRPGステータス');
 root.hidden=true;
 const panels=[];
 let rows=[],selected='',expanded=[true,true],pages=[0,0],visible=false,expandedTeamId=[null,null];
 let pendingTapTimer=null,lastTap=null;
 // Roster refreshes replace DOM elements: distinguish taps using stable squad keys.
 for(let team=0;team<=1;team++){
  const panel=doc.createElement('div');
  panel.className='rpgSquadSide expanded '+(team===0?'ally':'enemy');
  panel.dataset.team=String(team);
  const header=doc.createElement('div');header.className='rpgSquadHead';
  const name=doc.createElement('b');name.textContent=team===0?'🔵 味方隊':'🔴 敵隊';
  const count=doc.createElement('small');count.textContent='0隊';
  const toggle=doc.createElement('button');toggle.type='button';
  toggle.className='rpgSquadExpand';toggle.textContent='縮小 ▴';
  toggle.setAttribute('aria-label',(team===0?'味方':'敵')+'隊一覧を展開');
  toggle.onclick=()=>{expanded[team]=!expanded[team];panel.classList.toggle('expanded',expanded[team]);toggle.textContent=expanded[team]?'縮小 ▴':'全隊 ▾';renderSide(team);};
  header.append(name,count,toggle);
  const list=doc.createElement('div');list.className='rpgSquadList';
  const nav=doc.createElement('div');nav.className='rpgSquadPager';
  const prev=doc.createElement('button');prev.type='button';prev.textContent='◀';
  const pageLabel=doc.createElement('small');
  const next=doc.createElement('button');next.type='button';next.textContent='▶';
  prev.onclick=()=>{pages[team]--;renderSide(team);};
  next.onclick=()=>{pages[team]++;renderSide(team);};
  nav.append(prev,pageLabel,next);
  panel.append(header,list,nav);
  root.append(panel);
  panels.push({panel,list,nav,prev,next,pageLabel,count});
 }
 doc.body.append(root);
 const selectionKey=(team,id)=>Number(team)+':'+String(id);
 function select(team,id,{focus=false}={}){
  selected=selectionKey(team,id);
  const sideRows=rows.filter(r=>Number(r.team)===Number(team));
  const index=sideRows.findIndex(r=>String(r.id)===String(id));
  if(index>=0){
   const pageSize=expanded[team]?Math.max(1,sideRows.length):5;
   pages[team]=Math.floor(index/pageSize);
  }
  renderSide(0);renderSide(1);
  if(focus)onFocus(Number(team),String(id));
 }
 function handleSquadTap(team,id){
  const key=selectionKey(team,id),now=Date.now();
  if(lastTap?.key===key&&now-lastTap.at<=380){
   if(pendingTapTimer!==null)clearTimeout(pendingTapTimer);
   pendingTapTimer=null;lastTap=null;
   select(team,id);
   if(team===0)onCommand(team,String(id));
   else onFocus(team,String(id));
   return;
  }
  if(pendingTapTimer!==null)clearTimeout(pendingTapTimer);
  lastTap={key,at:now};
  const parent=rows.find(row=>Number(row.team)===team&&row.id===String(id)&&Array.isArray(row.members));
  if(parent)expandedTeamId[team]=expandedTeamId[team]===String(id)?null:String(id);
  select(team,id);
  pendingTapTimer=setTimeout(()=>{
   if(lastTap?.key!==key)return;
   pendingTapTimer=null;lastTap=null;
   onFocus(team,String(id));
  },380);
 }
 function renderSide(team){
  const side=panels[team];
  const base=rows.filter(r=>Number(r.team)===team);
  const own=base.flatMap(row=>
   Array.isArray(row.members)&&expandedTeamId[team]===String(row.id)?
    [row,...row.members.map(member=>({...member,isJobDivision:true,parentTeamId:row.id}))]:[row]);
  const pageSize=expanded[team]?Math.max(1,own.length):5;
  const totalPages=Math.max(1,Math.ceil(own.length/pageSize));
  pages[team]=clamp(pages[team],0,totalPages-1);
  const start=pages[team]*pageSize;
  side.count.textContent=base.filter(x=>Number(x.alive)>0).length+'/'+base.length+'隊';
  side.pageLabel.textContent=(pages[team]+1)+'/'+totalPages;
  side.prev.disabled=pages[team]===0;
  side.next.disabled=pages[team]>=totalPages-1;
  side.nav.hidden=expanded[team]||totalPages===1;
  // Reuse portraits and row nodes instead of recreating them on every HP tick.
  const oldRows=new Map([...side.list.querySelectorAll('button.rpgSquadRow')]
   .map(node=>[node.dataset.squadKey,node]));
  const fragment=doc.createDocumentFragment();
  for(const row of own.slice(start,start+pageSize)){
   const key=selectionKey(team,row.id),previous=oldRows.get(key);
   if(previous){
    previous.classList.toggle('selected',selected===key);
    previous.classList.toggle('defeated',!(Number(row.alive)>0));
    previous.classList.toggle('critical',rpgHudHealth(row.hp,row.maxHp)<=25&&Number(row.alive)>0);
    const summary=rpgHudCompactText(row)+'。1回タップでカメラ移動、2回タップで'+
     (team===0?'作戦':'隊を確認');
    if(previous.getAttribute('aria-label')!==summary){
     previous.setAttribute('aria-label',summary);previous.title=summary;
    }
    const portrait=previous.querySelector('.rpgSquadJobIcon');
    if(portrait)setBattleSquadHudPortrait(portrait,row,team);
    const state=previous.querySelector('.rpgSquadState');
    const value=rpgHudStateIcon(row);
    if(state.textContent!==value)state.textContent=value;
    state.title=rpgHudStatus(row);
    const engaged=previous.querySelector('.rpgSquadEngaged');
    if(engaged)engaged.hidden=!row.inContact;
    for(const [type,current,max] of [['hp',row.hp,row.maxHp],['mp',row.mp,row.maxMp]]){
     const meter=previous.querySelector('.rpgSquadMeter-'+type);
     if(!meter)continue;
     const pct=String(rpgHudHealth(current,max));
     if(meter.getAttribute('aria-valuenow')!==pct){
      meter.setAttribute('aria-valuenow',pct);meter.querySelector('i').style.width=pct+'%';
     }
     const title=type.toUpperCase()+' '+Math.max(0,Math.ceil(Number(current)||0))+
      '/'+Math.max(0,Math.ceil(Number(max)||0));
     if(meter.title!==title){meter.title=title;meter.setAttribute('aria-label',title);}
    }
    const effects=previous.querySelector('.rpgSquadEffects');
    const signature=JSON.stringify(row.effects||[]);
    if(effects&&effects.dataset.signature!==signature){
     effects.replaceChildren();effects.dataset.signature=signature;
     const valid=Array.isArray(row.effects)?row.effects:[];
     for(const fx of valid.slice(0,7)){
      const tag=doc.createElement('span');
      tag.className=fx.kind==='debuff'?'debuff':'buff';
      tag.textContent=rpgHudEffectIcon(fx);
      const remain=Number.isFinite(fx.seconds)?' · 残り'+Math.max(0,Math.ceil(fx.seconds))+'秒':'';
      tag.title=String(fx.description||fx.label||'効果')+remain;
      tag.setAttribute('aria-label',tag.title);effects.append(tag);
     }
     if(valid.length>7){
      const more=doc.createElement('span');more.className='more';
      more.textContent='+'+(valid.length-7);
      more.title=valid.slice(7).map(fx=>String(fx.label||'効果')).join(' / ');
      effects.append(more);
     }
    }
    fragment.append(previous);continue;
   }
   const button=doc.createElement('button');button.type='button';
   button.className='rpgSquadRow'+(row.isJobDivision?' rpgJobDivision':'')+(Array.isArray(row.members)?' rpgTeamSummary':'');
   button.dataset.squadKey=selectionKey(team,row.id);
   if(selected===button.dataset.squadKey)button.classList.add('selected');
   if(!(Number(row.alive)>0))button.classList.add('defeated');
   if(rpgHudHealth(row.hp,row.maxHp)<=25&&Number(row.alive)>0)button.classList.add('critical');
   button.setAttribute('aria-label',rpgHudCompactText(row)+'。1回タップでカメラ移動、2回タップで'+(team===0?'作戦':'隊を確認'));
   button.title=button.getAttribute('aria-label');
   button.onclick=()=>handleSquadTap(team,row.id);
   const heading=doc.createElement('div');heading.className='rpgSquadRowTitle';
   const job=doc.createElement('span');job.className='rpgSquadJobIcon';
   setBattleSquadHudPortrait(job,row,team);
   job.setAttribute('role','button');
   job.setAttribute('tabindex','0');
   job.setAttribute('aria-label',team===0?
    String(row.name)+'の作戦を開く':String(row.name)+'を確認');
   const openByIcon=event=>{
     event.stopPropagation();
     handleSquadTap(team,row.id);
    };
   job.addEventListener('click',openByIcon);
   job.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();openByIcon(event);}
   });
   const title=doc.createElement('strong');
   // Three campaign team labels are distinct from their nested job divisions.
   title.textContent=String(row.name||'部隊').replace(/^第(\d+)隊.*$/,'$1隊');
   if(row.isJobDivision)title.textContent='└'+String(row.job||'分隊');
   title.title=String(row.name||'部隊');
   // Keep the actual job visible even in the half-width side rails.
   // The number remains beside the portrait; the job owns its own full-width row.
   const jobName=doc.createElement('span');jobName.className='rpgSquadJobName';
   jobName.textContent=String(row.job||'部隊');
   if(row.isJobDivision)jobName.textContent='ジョブ';
   jobName.title=String(row.name||'部隊')+'｜'+String(row.job||'部隊');
   const status=doc.createElement('span');status.className='rpgSquadState';
   status.textContent=rpgHudStateIcon(row);status.title=rpgHudStatus(row);
   const engaged=doc.createElement('span');engaged.className='rpgSquadEngaged';
   engaged.textContent='⚔';engaged.title='現在交戦中';
   engaged.setAttribute('aria-label','交戦中');engaged.hidden=!row.inContact;
   heading.append(job,title,jobName,status,engaged);
   const metrics=doc.createElement('div');metrics.className='rpgSquadMetrics';
   const effects=doc.createElement('span');effects.className='rpgSquadEffects';
   effects.setAttribute('aria-label','現在の強化・弱体効果');
   effects.dataset.signature=JSON.stringify(row.effects||[]);
   const valid=Array.isArray(row.effects)?row.effects:[];
   for(const fx of valid.slice(0,7)){
    const tag=doc.createElement('span');
    tag.className=fx.kind==='debuff'?'debuff':'buff';
    tag.textContent=rpgHudEffectIcon(fx);
    const remain=Number.isFinite(fx.seconds)?' · 残り'+Math.max(0,Math.ceil(fx.seconds))+'秒':'';
    tag.title=String(fx.description||fx.label||'効果')+remain;
    tag.setAttribute('aria-label',tag.title);
    effects.append(tag);
   }
   if(valid.length>7){
    const more=doc.createElement('span');more.className='more';
    more.textContent='+'+(valid.length-7);
    more.title=valid.slice(7).map(fx=>String(fx.label||'効果')).join(' / ');
    effects.append(more);
   }
   // Read-only visual meters: HP and MP are drawn from the same actual
   // combat row. Exact values remain accessible on the card/ARIA tooltip.
   const addMeter=(kind,glyph,label,current,max,percentage)=>{
    const value=clamp(Math.round(Number(percentage)||0),0,100);
    const line=doc.createElement('div');line.className='rpgSquadMeterLine rpgSquadMeter-'+kind;
    line.dataset.metric=kind;
    line.setAttribute('role','meter');line.setAttribute('aria-valuemin','0');
    line.setAttribute('aria-valuemax','100');line.setAttribute('aria-valuenow',String(value));
    const actual=Math.max(0,Math.ceil(Number(current)||0));
    const capacity=Math.max(0,Math.ceil(Number(max)||0));
    line.title=label+' '+actual+'/'+capacity;
    line.setAttribute('aria-label',line.title);
    const symbol=doc.createElement('span');symbol.className='rpgSquadMeterGlyph';
    symbol.textContent=glyph;symbol.setAttribute('aria-hidden','true');
    const track=doc.createElement('span');track.className='rpgSquadMeterTrack';
    const fill=doc.createElement('i');fill.style.width=value+'%';
    track.append(fill);line.append(symbol,track);metrics.append(line);
   };
   metrics.append(effects);
   addMeter('hp','HP','HP',row.hp,row.maxHp,rpgHudHealth(row.hp,row.maxHp));
   addMeter('mp','MP','MP',row.mp,row.maxMp,rpgHudHealth(row.mp,row.maxMp));
   button.append(heading,metrics);
   fragment.append(button);
  }
  if(!own.length){
   const empty=doc.createElement('small');empty.textContent='対象の隊はありません';fragment.append(empty);
  }
  side.list.replaceChildren(fragment);
 }
 function update(nextRows,{show=true}={}){
  visible=Boolean(show);root.hidden=!visible;
  if(!visible)return;
  const next=Array.isArray(nextRows)?nextRows:[];
  const nextSig=JSON.stringify(next.map(r=>[r.team,r.id,r.alive,r.total,r.hp,r.maxHp,r.name,r.job,
   r.mode,r.inContact,r.effects,r.attackPercent,r.mp,r.maxMp,r.monster,r.captain,
   r.members?.map(member=>[member.id,member.alive,member.hp,member.mp,member.effects])]));
  if(nextSig===root.dataset.signature)return;
  root.dataset.signature=nextSig;
  rows=next;
  for(const team of [0,1])if(expandedTeamId[team]&&
   !rows.some(r=>Number(r.team)===team&&String(r.id)===expandedTeamId[team]))expandedTeamId[team]=null;
  const firstAlly=rows.find(r=>Number(r.team)===0);
  const firstRender=!selected&&firstAlly;
  if(firstRender){selected=selectionKey(0,firstAlly.id);pages=[0,0];}
  renderSide(0);renderSide(1);
  if(firstRender)for(const side of panels)side.panel.scrollTop=0;
 }
 return {root,update,select,
  get rows(){return rows},
  get selected(){return selected},
  get expanded(){return [...expanded]},
  get visible(){return visible},
  dispose(){if(pendingTapTimer!==null)clearTimeout(pendingTapTimer);root.remove();}
 };
}
