/**
 * Compact touch-first option grids. The original select elements remain a data source,
 * but are visually hidden so Android never opens its full-screen native picker.
 * Rebuild only on option changes; update aria-pressed without replacing the grid.
 */
export function createBattleTapChoices(root,{pageSize=5}={}){
 const ids=['realtimeTargetKind','realtimeTargetChoice','realtimeRallyTarget',
  'realtimeRallyKind','realtimeSharedItemChoice','realtimeSharedItemTarget'];
 const entries=new Map();
 for(const id of ids){
  const select=root.querySelector('#'+id);
  if(!select||typeof select.after!=='function')continue;
  select.classList.add('realtimeSourceSelect');
  select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const list=select.ownerDocument.createElement('div');
  list.className='realtimeTapChoices';
  list.setAttribute('role','group');
  list.setAttribute('aria-label',select.getAttribute('aria-label')||id);
  select.after(list);
  entries.set(id,{select,list,page:0,signature:''});
 }
 function render(id){
  const state=entries.get(id);
  if(!state)return;
  const {select,list}=state;
  list.hidden=select.hidden;
  if(list.hidden)return;
  const options=Array.from(select.options||[]).filter(o=>o.value!==''&&!o.hidden);
  const selected=String(select.value);
  const signature=options.map(o=>[o.value,o.textContent,o.disabled].join(':')).join('|');
  const totalPages=Math.max(1,Math.ceil(options.length/pageSize));
  state.page=Math.min(state.page,totalPages-1);
  if(signature!==state.signature){
   const selectedIndex=options.findIndex(o=>o.value===selected);
   if(selectedIndex>=0&&state.signature==='')state.page=Math.floor(selectedIndex/pageSize);
  }
  const pageKey=signature+'#'+state.page;
  if(list.dataset.pageKey!==pageKey){
   list.replaceChildren();
   const visible=options.slice(state.page*pageSize,(state.page+1)*pageSize);
   if(!options.length){
    const status=select.ownerDocument.createElement('small');
    status.textContent='選択できる対象がありません';list.append(status);
   }
   for(const option of visible){
    const button=select.ownerDocument.createElement('button');
    button.type='button';button.className='realtimeTapChoice';
    button.dataset.value=option.value;button.textContent=option.textContent;
    button.disabled=option.disabled;
    button.addEventListener('click',()=>{
     if(button.disabled)return;
     select.value=option.value;
     select.onchange?.();
     renderAll();
    });
    list.append(button);
   }
   if(totalPages>1){
    const pager=select.ownerDocument.createElement('div');
    pager.className='realtimeTapPager';
    const prev=select.ownerDocument.createElement('button'),next=select.ownerDocument.createElement('button');
    prev.type=next.type='button';prev.textContent='◀ 前';next.textContent='次 ▶';
    prev.disabled=state.page===0;next.disabled=state.page===totalPages-1;
    const count=select.ownerDocument.createElement('span');
    count.textContent=(state.page+1)+' / '+totalPages;
    prev.addEventListener('click',()=>{state.page--;render(id);});
    next.addEventListener('click',()=>{state.page++;render(id);});
    pager.append(prev,count,next);list.append(pager);
   }
   list.dataset.pageKey=pageKey;
  }
  state.signature=signature;
  for(const button of list.querySelectorAll('button.realtimeTapChoice')){
   const active=button.dataset.value===selected;
   button.classList.toggle('selected',active);
   button.setAttribute('aria-pressed',String(active));
  }
 }
 function renderAll(){for(const id of ids)render(id);}
 return {render,renderAll};
}
