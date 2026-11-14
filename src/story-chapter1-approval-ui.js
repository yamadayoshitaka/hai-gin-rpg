import {chapterOneReviewPages,EDITION_LABELS,REVIEW_BRANCH,REVIEW_REPO} from './story-chapter1-review-core.js';
import {buildChapter1ImagePrompt,CHATGPT_IMAGES_URL} from './story-chapter1-image-prompt.js';
const $=id=>document.getElementById(id);
const all=chapterOneReviewPages(),pages=new Map(all.map(p=>[p.number,p]));
const rawRoot='https://raw.githubusercontent.com/'+REVIEW_REPO+'/'+REVIEW_BRANCH+'/';
const STORE='hai-gin-ch1-review-drafts-v1';
const PROMPTS_STORE='hai-gin-ch1-chatgpt-image-prompts-v1';
let imageInstructions={};try{imageInstructions=JSON.parse(localStorage.getItem(PROMPTS_STORE)||'{}')||{};}catch{}
const persistInstructions=()=>{try{localStorage.setItem(PROMPTS_STORE,JSON.stringify(imageInstructions));}catch{}};
let saved={};try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch{}
const persist=()=>{try{localStorage.setItem(STORE,JSON.stringify(saved));}catch{}};
const urls=new Set(),states=new Map();
let current=all[0],ticket=0,activeShotIndex=0;
const uniq=a=>[...new Set(a)];
const stageOptions=uniq(all.map(p=>p.stageId));
for(const stage of stageOptions){
 const p=all.find(x=>x.stageId===stage),o=document.createElement('option');
 o.value=stage;o.textContent=stage.replace('c01-s','第')+'ステージ・'+p.stageName;
 $('stage').append(o);
}
function setEditionOptions(){
 const choices=uniq(all.filter(p=>p.stageId===$('stage').value&&p.gender===$('gender').value).map(p=>p.edition));
 const prev=$('edition').value;
 $('edition').replaceChildren(...choices.map(c=>{
  const o=document.createElement('option');o.value=c;o.textContent=EDITION_LABELS[c]||c;return o;
 }));
 if(choices.includes(prev))$('edition').value=prev;
}
function go(number,scroll=true){
 const next=pages.get(number);if(!next)return;
 for(const url of urls)URL.revokeObjectURL(url);
 urls.clear();states.clear();current=next;ticket++;activeShotIndex=0;
 $('stage').value=next.stageId;$('gender').value=next.gender;
 setEditionOptions();$('edition').value=next.edition;
 $('pageTitle').textContent='第'+number+' / 132ページ';
 $('pageSub').textContent=(EDITION_LABELS[next.edition]||next.edition)+'・'+
  (next.gender==='female'?'女性':'男性')+'主人公・'+next.shots.length+'コマ';
 $('prevPage').disabled=$('prevBottom').disabled=number===1;
 $('nextPage').disabled=$('nextBottom').disabled=number===all.length;
 $('visualConfirm').checked=false;
 const fragment=document.createDocumentFragment();
 const renderTicket=ticket;
 next.shots.forEach((shot,i)=>{
  const view=panel(shot,i);
  fragment.append(view.root);
  load(shot,view,renderTicket);
 });
 $('panels').replaceChildren(fragment);
 showCurrentShot();
 $('info').textContent='原画を確認中。生成済みの実画像だけをゲームに仮反映します。';
 update();
 // Vertical scrolling is intentionally disabled; one manga cut at a time.
}
function showCurrentShot(){
 const cards=[...document.querySelectorAll('#panels .panel')];
 cards.forEach((el,i)=>{
  el.classList.toggle('is-active',i===activeShotIndex);
  el.setAttribute('aria-hidden',i===activeShotIndex?'false':'true');
  if(i!==activeShotIndex){
   const generator=el.querySelector('details.generator');
   if(generator)generator.open=false;
  }
 });
 const shot=current.shots[activeShotIndex];
 $('pageTitle').textContent='第'+current.number+'ページ '+(activeShotIndex+1)+'/'+current.shots.length+'コマ';
 $('pageSub').textContent=(EDITION_LABELS[current.edition]||current.edition)+'・'+
  (current.gender==='female'?'女性':'男性')+'主人公　'+shot.shotId;
 const first=current.number===1&&activeShotIndex===0;
 const last=current.number===all.length&&activeShotIndex===current.shots.length-1;
 $('prevPage').disabled=$('prevBottom').disabled=first;
 $('nextPage').disabled=$('nextBottom').disabled=last;
 update();
}
function stepShot(direction){
 const i=activeShotIndex+direction;
 if(i>=0&&i<current.shots.length){
  activeShotIndex=i;showCurrentShot();return;
 }
 const adjacent=pages.get(current.number+(direction>0?1:-1));
 if(!adjacent)return;
 go(adjacent.number,false);
 if(direction<0){activeShotIndex=adjacent.shots.length-1;showCurrentShot();}
}
function variant(){
 const match=all.find(p=>p.stageId===$('stage').value&&
  p.gender===$('gender').value&&p.edition===$('edition').value);
 if(match)go(match.number);
}
function panel(shot,index){
 const root=document.createElement('article');root.className='panel';root.dataset.shotKey=shot.key;
 const top=document.createElement('div');top.className='panel-top';
 const label=document.createElement('strong');label.textContent='コマ '+(index+1)+' / '+current.shots.length;
 const id=document.createElement('small');id.textContent=shot.shotId;top.append(label,id);
 const art=document.createElement('div');art.className='art';
 const img=document.createElement('img');img.hidden=true;img.alt=shot.shotId+'の実原画';
 const empty=document.createElement('div');empty.className='empty';empty.textContent='画像を読み込んでいます';
 art.append(img,empty);
 const speaker=document.createElement('div');speaker.className='speaker';speaker.textContent=shot.speaker;
 const txt=document.createElement('div');txt.className='scene-text';txt.textContent=shot.displayText||shot.scriptText||'（セリフなし）';
 const caption=document.createElement('div');caption.className='source';caption.textContent='画像の同一性を確認しています';
 const actions=document.createElement('div');actions.className='actions';
 for(const [action,label] of [['approve','◎ 仮承認'],['revise','↶ 差し戻し'],['hold','― 保留']]){
  const b=document.createElement('button');b.type='button';b.dataset.choice=action;b.textContent=label;
  if(action!=='hold')b.disabled=true;
  b.addEventListener('click',()=>{
   const state=states.get(shot.key);
   if(action!=='hold'&&!state?.available)return;
   const old=saved[shot.key];
   saved[shot.key]={decision:action,kind:state?.kind||'pending',hash:state?.hash||null,
    feedback:old?.hash===state?.hash?old.feedback||'':''};
   persist();refreshCard(shot.key);update();
  });
  actions.append(b);
 }
 const reason=document.createElement('div');reason.className='feedback-wrap';
 const why=document.createElement('label');why.textContent='修正したいところ（例：髪・目・衣装・構図・文字）';
 const input=document.createElement('textarea');input.maxLength=500;
 input.placeholder='例：イリスの顔が違う。書類に不要な文字がある。';
 input.value=saved[shot.key]?.feedback||'';
 input.addEventListener('input',()=>{if(saved[shot.key]){saved[shot.key].feedback=input.value;persist();}});
 reason.append(why,input);
 root.append(top,art,speaker,txt,caption,actions,reason,buildGenerationControls(shot));
 return {root,img,empty,caption,actions};
}
const referencePromises=new Map();
async function referenceFor(shot){
 const target=shot.stageId==='c01-s01'?'c01-s02':shot.stageId;
 const file='./assets/story/characters/'+target+'-reference-bible.json';
 if(!referencePromises.has(file))referencePromises.set(file,
  fetch(file).then(r=>{if(!r.ok)throw Error('参照人物設定を取得できません');return r.json();})
   .catch(e=>{referencePromises.delete(file);throw e;}));
 return referencePromises.get(file);
}
let stage2Assignments=null;
async function stage2Assignment(shot){
 if(shot.stageId!=='c01-s02')return null;
 if(!stage2Assignments)stage2Assignments=fetch(
  './assets/story/stage-manifests/c01-s02-shot-assignments.json'
 ).then(r=>{if(!r.ok)throw Error('シーン構成を取得できません');return r.json();})
  .catch(e=>{stage2Assignments=null;throw e;});
 const json=await stage2Assignments;
 return json.entries?.[shot.edition+'|'+shot.gender+'|'+shot.shotId]||null;
}
function setGeneratorMessage(node,value){
 node.textContent=value;
}
async function generatePrompt(shot,notes){
 const bible=await referenceFor(shot);
 const assignment=await stage2Assignment(shot);
 return buildChapter1ImagePrompt({shot,page:current,bible,assignment,
  edit:notes||saved[shot.key]?.feedback||'',sourceKind:states.get(shot.key)?.kind});
}
async function copyPrompt(text,textarea){
 try{
  if(!navigator.clipboard?.writeText)throw Error('Browser clipboard unavailable');
  await navigator.clipboard.writeText(text);
  return true;
 }catch{
  textarea.hidden=false;textarea.value=text;
  textarea.focus();textarea.select();
  return false;
 }
}
function buildGenerationControls(shot){
 const box=document.createElement('details');box.className='generator';
 const summary=document.createElement('summary');summary.textContent='✦ ChatGPTでこのコマを修正・再生成';
 const heading=document.createElement('h3');
 heading.textContent='✦ このコマをChatGPTで画像生成';
 const label=document.createElement('label');label.textContent='ChatGPTに伝えたい修正・作画指示';
 const input=document.createElement('textarea');input.rows=3;
 input.placeholder='例：主人公の目を自然に、髪を長く、背景を夕焼けに。登場人物の服を参照画像に統一。';
 input.value=imageInstructions[shot.key]||saved[shot.key]?.feedback||'';
 input.addEventListener('input',()=>{
  imageInstructions[shot.key]=input.value;persistInstructions();
 });
 const buttons=document.createElement('div');buttons.className='generation-actions';
 const open=document.createElement('button');open.type='button';open.className='chatgpt-button';
 open.textContent='✦ ChatGPTでこの1コマを画像生成';
 const copy=document.createElement('button');copy.type='button';copy.textContent='プロンプトをコピー';
 const show=document.createElement('button');show.type='button';show.textContent='生成指示を確認';
 const share=document.createElement('button');share.type='button';share.textContent='Androidで共有';
 const message=document.createElement('p');message.className='handoff';
 message.textContent='ChatGPT Plusの画像生成を利用。追加のAPIキー不要。画像の自動取り込みは未対応。';
 const preview=document.createElement('textarea');preview.className='preview-prompt';
 preview.readOnly=true;preview.hidden=true;preview.setAttribute('aria-label','ChatGPTに渡す完成プロンプト');
 let prepared=null;
 const loadContract=Promise.all([referenceFor(shot),stage2Assignment(shot)])
  .then(([bible,assignment])=>{
   prepared={bible,assignment};
   setGeneratorMessage(message,'台本・登場人物を読込済み。ChatGPTに渡す指示を作成できます。');
  }).catch(e=>{
   setGeneratorMessage(message,'参照情報の読込エラー：'+e.message);
  });
 function prepare(){
  if(!prepared)throw Error('参照データを読み込み中です。もう一度押してください。');
  const prompt=buildChapter1ImagePrompt({
   shot,page:current,bible:prepared.bible,assignment:prepared.assignment,
   edit:input.value.trim()||saved[shot.key]?.feedback||'',
   sourceKind:states.get(shot.key)?.kind
  });
  preview.value=prompt;
  return prompt;
 }
 open.addEventListener('click',async()=>{
  open.disabled=true;
  try{
   const prompt=prepare();
   const success=await copyPrompt(prompt,preview);
   if(!success){
    setGeneratorMessage(message,'自動コピーできませんでした。表示したプロンプトを長押しでコピーし、「ChatGPTを開く」を利用してください。');
    show.textContent='ChatGPTを開く';
    show.onclick=()=>window.location.assign(CHATGPT_IMAGES_URL);
    return;
   }
   setGeneratorMessage(message,'プロンプトをコピーしました。ChatGPTの入力欄に貼り付けて送信してください。');
   // Do not use unsupported ?q= query parameters or claim that an
   // external web page can invoke the in-app image generation tool.
   window.location.assign(CHATGPT_IMAGES_URL);
  }catch(error){setGeneratorMessage(message,'準備に失敗：'+error.message);}
  finally{open.disabled=false;}
 });
 copy.addEventListener('click',async()=>{
  try{
   const prompt=prepare();
   const success=await copyPrompt(prompt,preview);
   setGeneratorMessage(message,success?'コピーしました。ChatGPTで貼り付けて画像生成を依頼してください。':'表示した文章を選択してコピーしてください。');
  }catch(e){setGeneratorMessage(message,'準備に失敗：'+e.message);}
 });
 show.addEventListener('click',async()=>{
  if(show.textContent==='ChatGPTを開く'){window.location.assign(CHATGPT_IMAGES_URL);return;}
  if(!preview.hidden){preview.hidden=true;return;}
  try{await loadContract;prepare();preview.hidden=false;setGeneratorMessage(message,'この内容をChatGPTへ渡します。台本の文字は画像に描きません。');}
  catch(e){setGeneratorMessage(message,'準備に失敗：'+e.message);}
 });
 share.addEventListener('click',async()=>{
  try{
   if(!navigator.share)throw Error('このブラウザに共有機能がありません。コピーを利用してください');
   const prompt=prepare();
   const data={title:'灰銀のレゾナンス '+shot.shotId+'の画像を生成',text:prompt};
   const state=states.get(shot.key);
   if(state?.bytes&&typeof File!=='undefined'&&navigator.canShare){
    const source=new File([state.bytes],shot.shotId+'-reference.webp',{type:'image/webp'});
    if(navigator.canShare({files:[source]}))data.files=[source];
   }
   await navigator.share(data);
   setGeneratorMessage(message,'共有メニューでChatGPTを選び、生成指示を確認して送信してください。');
  }catch(e){
   if(e.name!=='AbortError')setGeneratorMessage(message,
    '共有できませんでした：'+e.message+'。プロンプトのコピーをご利用ください。');
  }
 });
 buttons.append(open,copy,show,share);
 box.append(summary,heading,label,input,buttons,message,preview);
 return box;
}

function refreshCard(key){
 const el=document.querySelector('[data-shot-key="'+CSS.escape(key)+'"]');
 if(!el)return;
 const state=states.get(key),vote=saved[key];
 const active=vote?.hash===state?.hash?vote?.decision:null;
 for(const button of el.querySelectorAll('[data-choice]'))
  button.classList.toggle('selected',button.dataset.choice===active);
 el.querySelector('.feedback-wrap').classList.toggle('show',active==='revise');
}
async function sha256(buffer){
 const sum=await crypto.subtle.digest('SHA-256',buffer);
 return Array.from(new Uint8Array(sum),b=>b.toString(16).padStart(2,'0')).join('');
}
async function readBytes(url){
 const response=await fetch(url,{cache:'no-store'});
 if(!response.ok)throw Error('HTTP '+response.status);
 return response.arrayBuffer();
}
function dimensionsOK(w,h,stage){
 const [a,b]=stage==='c01-s02'?[768,320]:[1536,864];
 return w>=a&&h>=b&&w*9===h*16;
}
async function load(shot,view,v){
 let kind='candidate',imageUrl=rawRoot+shot.draftPath,expected=null;
 try{
  const response=await fetch(imageUrl+'.generation.json',{cache:'no-store'});
  if(!response.ok)throw Error('draft missing');
  const meta=await response.json();
  if(meta.shotKey!==shot.key||meta.visuallyApproved!==false||
   meta.formallyRegistered!==false||!(/^[a-f0-9]{64}$/i.test(meta.imageSha256)))
   throw Error('invalid draft provenance');
  expected=meta.imageSha256;
 }catch{
  if(shot.legacyPath?.startsWith('./')){
   kind='legacy';imageUrl=shot.legacyPath;
  }else{
   kind='missing';
   try{
    const test=await fetch(rawRoot+shot.draftPath+'.provider-blocked.json',{cache:'no-store'});
    if(test.ok)kind='blocked';
   }catch{}
  }
 }
 if(v!==ticket)return;
 if(kind==='missing'||kind==='blocked'){
  view.empty.textContent=kind==='blocked'?'生成モデルが拒否しました。修正方針の確認が必要です。':
   'このコマの画像はまだ生成されていません';
  view.caption.textContent=kind==='blocked'?'生成拒否・審査待ち':'未生成・制作待ち';
  states.set(shot.key,{available:false,hash:null,kind});update();return;
 }
 try{
  const bytes=await readBytes(imageUrl),hash=await sha256(bytes);
  if(expected&&hash!==expected)throw Error('生成画像とハッシュが一致しません');
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
  const probe=new Image();
  await new Promise((resolve,reject)=>{
   probe.onload=resolve;probe.onerror=()=>reject(Error('画像を表示できません'));
   probe.src=url;
  });
  if(v!==ticket){URL.revokeObjectURL(url);return;}
  const ok=dimensionsOK(probe.naturalWidth,probe.naturalHeight,shot.stageId);
  urls.add(url);
  view.img.src=url;view.img.hidden=false;view.empty.hidden=true;
  view.caption.textContent=(ok?(kind==='legacy'?'既存ゲーム原画':'新規候補・ハッシュ確認済み'):
   '解像度不足・再生成対象')+'　'+probe.naturalWidth+'×'+probe.naturalHeight;
  states.set(shot.key,{kind,hash,available:ok,bytes});
  for(const button of view.actions.querySelectorAll('button:not([data-choice="hold"])'))
   button.disabled=!ok;
  if(saved[shot.key]?.hash!==hash){delete saved[shot.key];persist();}
  refreshCard(shot.key);update();
 }catch(e){
  if(v!==ticket)return;
  view.empty.textContent='画像の照合に失敗しました。'+e.message;
  view.caption.textContent='ハッシュ・原画を要確認';
  states.set(shot.key,{available:false,hash:null,kind:'invalid'});
  update();
 }
}
function update(){
 const ready=current.shots.filter(s=>saved[s.key]?.decision&&
  saved[s.key].hash===states.get(s.key)?.hash);
 const approved=ready.filter(s=>saved[s.key].decision==='approve');
 const pc=Math.round(ready.length/current.shots.length*100);
 $('progressBar').style.width=pc+'%';
 document.querySelector('.progress').setAttribute('aria-valuenow',pc);
 $('progressLabel').textContent='このページ '+ready.length+'/'+current.shots.length+'コマを判定';
 $('draftCount').textContent='現在のコマ '+(activeShotIndex+1)+' / '+current.shots.length+'（仮反映は自動）';
 const sendable=ready.some(s=>['approve','revise'].includes(saved[s.key].decision)&&states.get(s.key)?.available);
 $('submit').disabled=!sendable||(approved.length>0&&!$('visualConfirm').checked);
}
function send(){
 const votes=current.shots.map(s=>{
  const state=states.get(s.key),d=saved[s.key];
  if(!state?.available||!d||d.hash!==state.hash||!['approve','revise'].includes(d.decision))return null;
  return {key:s.key,kind:state.kind,decision:d.decision,
   imageSha256:state.hash,feedback:String(d.feedback||'').trim()};
 }).filter(Boolean);
 if(!votes.length){$('info').textContent='送信する判定はありません';return;}
 if(votes.some(v=>v.decision==='revise'&&!v.feedback)){
  $('info').textContent='修正コマには直したい点を入力してください';return;
 }
 if(votes.some(v=>v.decision==='approve')&&!$('visualConfirm').checked){
  $('info').textContent='承認したコマの目視確認チェックが必要です';return;
 }
 const payload={type:'HAI_GIN_CHAPTER1_MANGA_REVIEW_V1',chapter:1,
  pageTask:current.number,confirmVisualReview:$('visualConfirm').checked,votes};
 const title='[漫画承認] 第一章 p'+current.number+' '+current.stageId+' '+current.gender;
 const body='灰銀のレゾナンス 漫画承認室の目視審査記録。\n'+
  'このIssueを送信すると画像の同一性をGitHub Actionsが照合します。\n\n'+
  'HAI_GIN_CHAPTER1_REVIEW_JSON_START\n'+JSON.stringify(payload)+'\nHAI_GIN_CHAPTER1_REVIEW_JSON_END\n';
 const href='https://github.com/'+REVIEW_REPO+'/issues/new?'+new URLSearchParams({title,body});
 $('info').textContent='GitHubへ移動します。「Submit new issue」を押すと記録が確定します。';
 location.assign(href);
}
$('stage').addEventListener('change',()=>{setEditionOptions();variant();});
$('gender').addEventListener('change',()=>{setEditionOptions();variant();});
$('edition').addEventListener('change',variant);
$('prevPage').addEventListener('click',()=>stepShot(-1));
$('nextPage').addEventListener('click',()=>stepShot(1));
$('prevBottom').addEventListener('click',()=>stepShot(-1));
$('nextBottom').addEventListener('click',()=>stepShot(1));
$('visualConfirm').addEventListener('change',update);
$('submit').addEventListener('click',send);
const query=new URLSearchParams(location.search),start=Number(query.get('page')||1);
go(pages.has(start)?start:1,false);
