/**
 * Lightweight, read-only RPG party HUD for both armies.
 * Source rows are authored by the live battle roster, never simulated by the UI.
 * Only the selected page is rendered; no per-frame worker/GPU work.
 */
import {setBattleJobPortrait} from './battle-job-portraits.js';
export const RPG_HUD_JOB_ICON=Object.freeze({
 '剣士':'⚔','魔法使い':'✦','僧侶':'✚','弓使い':'🏹','弓兵':'🏹','盾騎士':'🛡',
 '騎士':'♞','忍者':'◆','シーフ':'◇','格闘家':'✊','召喚士':'◈'
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function rpgHudIcon(job=''){
 const found=Object.keys(RPG_HUD_JOB_ICON).find(k=>String(job).includes(k));
 return RPG_HUD_JOB_ICON[found]||'♟';
}
export function rpgHudHealth(hp,maxHp){
 return clamp(Math.round(100*Math.max(0,Number(hp)||0)/Math.max(1,Number(maxHp)||0)),0,100);
}
export function rpgHudStatus(row){
 if(!(Number(row.alive)>0))return '☠ 全滅';
 if(Number(row.alive)/Math.max(1,Number(row.total)||1)<=.25 ||
    rpgHudHealth(row.hp,row.maxHp)<=25)return '🆘 壊滅寸前';
 if(row.inContact)return '⚔ 交戦中';
 const mode=String(row.mode||'');
 if(mode==='retreat')return '↩ 後退中';
 if(mode==='move'||mode==='explore'||mode==='mission')return '➤ 移動中';
 if(mode==='heal'||mode==='support')return '✚ 支援中';
 if(mode==='defend')return '🛡 防御中';
 if(mode==='charge')return '⚔ 突撃中';
 return '◷ 待機中';
}
/** Effect badges keep their percentage and duration in the accessible tooltip. */
export function rpgHudEffectIcon(effect={}){
 const label=String(effect.label||'');
 const symbol=label.includes('攻')?'⚔':label.includes('防')?'🛡':
  label.includes('速')?'⚡':label.includes('魔')?'✦':
  label.includes('回')?'✚':label.includes('毒')?'☣':'✧';
 return symbol+(effect.kind==='debuff'?'↓':'↑');
}
export function rpgHudStateIcon(row){
 const state=rpgHudStatus(row);
 return state.startsWith('☠')?'☠':state.startsWith('🆘')?'🆘':
  state.startsWith('⚔')?'⚔':state.startsWith('🛡')?'🛡':
  state.startsWith('✚')?'✚':state.startsWith('➤')?'➤':
  state.startsWith('↩')?'↩':'◷';
}
export function rpgHudCompactText(row){
 const effects=(row.effects||[]).map(e=>e.label).slice(0,2).join(' ');
 return String(row.name||'部隊')+' HP '+Math.round(row.hp||0)+'/'+Math.round(row.maxHp||0)+
  ' '+(Number(row.alive)||0)+'/'+(Number(row.total)||0)+'人 '+rpgHudStatus(row)+
  (effects?' '+effects:'');
}
export function createBattleRpgSquadHud({documentRef=globalThis.document,onFocus=()=>{}}={}){
 const doc=documentRef;
 if(!doc?.body?.appendChild)return null;
 const root=doc.createElement('section');root.id='battleRpgSquadHud';
 root.setAttribute('aria-label','戦場の味方隊と敵隊のRPGステータス');
 root.hidden=true;
 const panels=[];
 let rows=[],selected='',expanded=[true,true],pages=[0,0],visible=false;
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
 function renderSide(team){
  const side=panels[team];
  const own=rows.filter(r=>Number(r.team)===team);
  const pageSize=expanded[team]?Math.max(1,own.length):5;
  const totalPages=Math.max(1,Math.ceil(own.length/pageSize));
  pages[team]=clamp(pages[team],0,totalPages-1);
  const start=pages[team]*pageSize;
  side.count.textContent=own.filter(x=>Number(x.alive)>0).length+'/'+own.length+'隊';
  side.pageLabel.textContent=(pages[team]+1)+'/'+totalPages;
  side.prev.disabled=pages[team]===0;
  side.next.disabled=pages[team]>=totalPages-1;
  side.nav.hidden=expanded[team]||totalPages===1;
  side.list.replaceChildren();
  const fragment=doc.createDocumentFragment();
  for(const row of own.slice(start,start+pageSize)){
   const button=doc.createElement('button');button.type='button';
   button.className='rpgSquadRow';
   button.dataset.squadKey=selectionKey(team,row.id);
   if(selected===button.dataset.squadKey)button.classList.add('selected');
   if(!(Number(row.alive)>0))button.classList.add('defeated');
   if(rpgHudHealth(row.hp,row.maxHp)<=25&&Number(row.alive)>0)button.classList.add('critical');
   button.setAttribute('aria-label',rpgHudCompactText(row)+'。タップで戦場の隊に移動');
   button.title=button.getAttribute('aria-label');
   button.onclick=()=>select(team,row.id,{focus:true});
   const heading=doc.createElement('div');heading.className='rpgSquadRowTitle';
   const job=doc.createElement('span');job.className='rpgSquadJobIcon';
   setBattleJobPortrait(job,row.job,row.id,team);
   const title=doc.createElement('strong');
   title.textContent=String(row.name||'部隊');
   const status=doc.createElement('span');status.className='rpgSquadState';
   status.textContent=rpgHudStateIcon(row);status.title=rpgHudStatus(row);
   heading.append(job,title,status);
   const metrics=doc.createElement('div');metrics.className='rpgSquadMetrics';
   const hp=doc.createElement('div');hp.className='rpgSquadHp';
   const hpBar=doc.createElement('i');hpBar.style.width=rpgHudHealth(row.hp,row.maxHp)+'%';
   hp.title='HP '+Math.ceil(Math.max(0,row.hp||0))+'/'+Math.ceil(Math.max(0,row.maxHp||0));
   hp.append(hpBar);
   const hpValue=doc.createElement('span');hpValue.className='rpgSquadHpValue';
   hpValue.textContent=Math.ceil(Math.max(0,row.hp||0))+'/'+Math.ceil(Math.max(0,row.maxHp||0));
   hpValue.title=hp.title;
   const count=doc.createElement('span');count.className='rpgSquadNumbers';
   count.textContent=Math.max(0,Number(row.alive)||0)+'/'+Math.max(0,Number(row.total)||0);
   count.title='残存 '+count.textContent+'人';
   const effects=doc.createElement('span');effects.className='rpgSquadEffects';
   effects.setAttribute('aria-label','強化・弱体');
   const valid=Array.isArray(row.effects)?row.effects:[];
   for(const fx of valid.slice(0,3)){
    const tag=doc.createElement('span');
    tag.className=fx.kind==='debuff'?'debuff':'buff';
    tag.textContent=rpgHudEffectIcon(fx);
    tag.title=String(fx.description||fx.label||'効果')+
     (Number.isFinite(fx.seconds)?' '+Math.max(0,Math.ceil(fx.seconds))+'秒':'');
    tag.setAttribute('aria-label',tag.title);
    effects.append(tag);
   }
   if(valid.length>3){
    const more=doc.createElement('span');more.className='more';
    more.textContent='+'+(valid.length-3);
    more.title=valid.slice(3).map(fx=>String(fx.label||'効果')).join(' / ');
    effects.append(more);
   }
   metrics.append(hp,hpValue,count,effects);
   button.append(heading,metrics);
   fragment.append(button);
  }
  if(!own.length){
   const empty=doc.createElement('small');empty.textContent='対象の隊はありません';fragment.append(empty);
  }
  side.list.append(fragment);
 }
 function update(nextRows,{show=true}={}){
  visible=Boolean(show);root.hidden=!visible;
  if(!visible)return;
  const next=Array.isArray(nextRows)?nextRows:[];
  const nextSig=JSON.stringify(next.map(r=>[r.team,r.id,r.alive,r.total,r.hp,r.maxHp,r.name,r.job,
   r.mode,r.inContact,r.effects]));
  if(nextSig===root.dataset.signature)return;
  root.dataset.signature=nextSig;
  rows=next;
  renderSide(0);renderSide(1);
 }
 return {root,update,select,
  get rows(){return rows},
  get selected(){return selected},
  get expanded(){return [...expanded]},
  get visible(){return visible},
  dispose(){root.remove();}
 };
}
