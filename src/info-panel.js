/** Mobile information drawer. Moves live UI nodes, preserving all existing event listeners. */
export const HUD_PANEL_ITEMS=['.brand','.objective','.location','#ai-status','#audio-controls','#story-button','#rpg-progress-hud','#hero-job-select','#hero-skill-select','#input-status'];
export function installInfoPanel(doc=document){
 if(doc.getElementById('game-info-toggle'))return;
 const btn=doc.createElement('button');btn.type='button';btn.id='game-info-toggle';
 btn.setAttribute('aria-label','ゲーム情報を表示');btn.setAttribute('aria-expanded','false');
 btn.textContent='☰ 情報';
 const panel=doc.createElement('section');panel.id='game-info-panel';
 panel.setAttribute('role','region');panel.setAttribute('aria-label','ゲーム情報');
 panel.hidden=true;
 const title=doc.createElement('div');title.className='game-info-heading';title.textContent='冒険情報';
 const close=doc.createElement('button');close.type='button';close.textContent='✕ 閉じる';close.id='game-info-close';
 title.appendChild(close);panel.appendChild(title);
 doc.body.append(btn,panel);
 const original=new Map();
 // The game title is a persistent HUD element; never relocate it to the drawer.
 const panelItems=HUD_PANEL_ITEMS.filter(selector=>selector!=='.brand');
 const open=(expanded)=>{
  if(expanded){
   for(const selector of panelItems){
    const node=doc.querySelector(selector);
    if(!node||original.has(node))continue;
    original.set(node,{parent:node.parentNode,next:node.nextSibling});
    panel.appendChild(node);
   }
  }else{
   for(const [node,place] of original){
    if(place.next?.parentNode===place.parent)place.parent.insertBefore(node,place.next);
    else place.parent.appendChild(node);
   }
   original.clear();
  }
  panel.hidden=!expanded;
  doc.body.classList.toggle('info-open',expanded);
  btn.setAttribute('aria-expanded',String(expanded));
  btn.textContent=expanded?'✕ 情報':'☰ 情報';
 };
 btn.addEventListener('click',()=>open(panel.hidden));
 close.addEventListener('click',()=>open(false));
 doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)open(false);});
 return {open};
}
