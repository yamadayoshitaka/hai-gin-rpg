/**
 * Battle command wizard. One visible step at a time:
 * squad -> action/item -> type -> target -> (arrival action) -> confirmation.
 * Validity is evaluated from the same engine callbacks used for issuing orders.
 */
import {battleAttackCommand} from './battle-attack-choices.js';
import {battleJobSpecialActions} from './battle-job-special-actions.js';
import {COMMAND_RALLY_TYPES} from './battle-command-doctrine.js';
const esc=v=>String(v??'');
export function mountBattleCommandWizard({
 documentRef=globalThis.document,dock,worldSize=232,
 getSquads=()=>[],getEnemies=()=>[],getSelected=()=>null,selectSquad=()=>false,
 getMapBackground=()=>null,getLegalPoint=()=>null,getMoveTargets=()=>[],
 getSpecialTargets=()=>[],getSharedItems=()=>[],getRallyInfo=()=>({}),
 onMove=()=>false,onOrder=()=>false,onTargetOrder=()=>false,onSpecial=()=>false,
 onSharedItem=()=>false,onRally=()=>false,queueArrival=()=>{},setPreferred=()=>{},
 onCommandCommitted=()=>{},
 onClose=()=>{}
}={}){
 const doc=documentRef,root=doc.createElement('section');
 root.id='battleCommandWizard';root.className='battleCommandWizard';
 root.setAttribute('role','dialog');root.setAttribute('aria-label','部隊の行動と対象を順番に設定');
 root.hidden=true;dock.append(root);
 const state={stage:'squad',squad:null,category:null,kind:null,target:null,point:null,arrival:'hold',item:null,notice:''};
 const history=[];
 const actions=[
  ['move','➤ 移動'],['attack','⚔ 攻撃'],['defend','🛡 守備'],['hold','⏸ 待機'],
  ['special','✨ 固有技'],['support','✚ 支援'],['rally','📣 号令（バフ）']];
 function copy(){return {...state,point:state.point?{...state.point}:null};}
 function advance(stage,values={}){history.push(copy());Object.assign(state,values,{stage,notice:''});render();}
 function back(){if(!history.length){close();return;}Object.assign(state,history.pop());render();}
 function element(tag,text='',className=''){
  const n=doc.createElement(tag);n.textContent=text;
  if(className)n.className=className;return n;
 }
 function button(label,fn,{disabled=false,reason='',chosen=false}={}){
  const b=element('button',label,'battleWizardChoice'+(chosen?' selected':''));
  b.type='button';b.disabled=disabled;b.onclick=fn;
  if(reason){const small=element('small',reason,'battleWizardReason');b.append(small);}
  root.querySelector('.battleWizardBody').append(b);
  return b;
 }
 function note(message,bad=false){
  const n=element('p',message,'battleWizardNotice'+(bad?' error':''));n.setAttribute('role','status');
  root.querySelector('.battleWizardBody').append(n);return n;
 }
 function currentSquad(){return getSquads().find(s=>String(s.id)===String(state.squad))||getSelected();}
 function pickSquad(id){if(selectSquad(id)!==false){advance('main',{squad:String(id),category:null,kind:null,target:null,point:null,item:null,arrival:'hold'});}}
 function actionOptions(){
  const job=currentSquad()?.job||'';
  const specials=battleJobSpecialActions(job);
  return actions.map(([id,label])=>{
   const avail=id==='special'?specials.length>0:
    id==='support'?specials.some(a=>['heal_ally','revive_ally','frontline_guard'].includes(a.id)):
    id==='rally'?getRallyInfo(String(state.squad))?.phase==='ready':true;
   const reason=avail?'':id==='special'?'このジョブには固有技がありません。':
    id==='support'?'この隊に使用可能な支援技がありません。':
    '号令は効果終了・インターバル後に使用できます。';
   return {id,label,avail,reason};
  });
 }
 function pickAction(id){
  if(id==='hold'){advance('confirm',{category:id,kind:'hold'});return;}
  if(id==='defend'){advance('types',{category:id});return;}
  if(id==='move'){advance('types',{category:id});return;}
  if(id==='attack'){advance('types',{category:id});return;}
  if(id==='special'||id==='support'){advance('types',{category:id});return;}
  if(id==='rally'){advance('types',{category:id});return;}
 }
 function specials(){
  const all=battleJobSpecialActions(currentSquad()?.job);
  return state.category==='support'?
   all.filter(a=>['heal_ally','revive_ally','frontline_guard'].includes(a.id)):
   all;
 }
 function pickSpecial(action){
  const targets=getSpecialTargets(String(state.squad),action.id)||[];
  if(!targets.length){state.notice='対象がありません。必要MP・対象の状態・到達経路を確認してください。';render();return;}
  advance('targets',{kind:'special',specialId:action.id,specialName:action.label,target:null});
 }
 function selectType(kind,extra={}){
  if(kind==='move_ground'){advance('map',{kind,point:null});return;}
  if(kind==='move_high'){
   const routes=getSpecialTargets(String(state.squad),'high_ground')||[];
   if(!routes.length){state.notice='現在の戦場に移動できる高所がありません。';render();return;}
   advance('targets',{kind,target:null});return;
  }
  if(kind.startsWith('attack_')){
   const attack=kind.slice(7),command=battleAttackCommand(attack,currentSquad()?.job);
   if(!command){state.notice='この隊は指定した攻撃方法を使用できません。';render();return;}
   if(attack==='near'||attack==='far'){advance('targets',{kind,command,target:null});return;}
   advance('confirm',{kind,command,target:null});return;
  }
  if(kind==='defend'||kind==='hold'){advance('confirm',{kind,command:kind});return;}
  if(kind==='rally'){advance('targets',{kind,command:extra.command,target:null});return;}
 }
 function chooseTarget(target){
  if(state.kind==='move_high'){
   advance('arrival',{target,point:{x:Math.round(Number(target.x)),z:Math.round(Number(target.z))},arrival:'hold'});
   return;
  }
  advance('confirm',{target});
 }
 let mapZoom=1,mapCenterX=worldSize/2,mapCenterZ=worldSize/2;
 function drawMap(canvas){
  const ctx=canvas.getContext?.('2d');if(!ctx)return;
  const width=canvas.width,height=canvas.height,span=worldSize/mapZoom;
  const minX=Math.max(0,Math.min(worldSize-span,mapCenterX-span/2));
  const minZ=Math.max(0,Math.min(worldSize-span,mapCenterZ-span/2));
  ctx.fillStyle='#1d3e4c';ctx.fillRect(0,0,width,height);
  const background=getMapBackground();
  if(background)try{ctx.drawImage(background,minX,minZ,span,span,0,0,width,height);}catch{}
  for(const [team,list] of [[0,getSquads()],[1,getEnemies()]]){
   for(const s of list){
    if(!Number.isFinite(s.x)||!Number.isFinite(s.z))continue;
    const x=(s.x-minX)/span*width,y=(s.z-minZ)/span*height;
    if(x<0||y<0||x>width||y>height)continue;
    ctx.fillStyle=team===0?'#58cfff':'#ff747d';
    ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
   }
  }
  if(state.point){
   const x=(state.point.x-minX)/span*width,y=(state.point.z-minZ)/span*height;
   ctx.lineWidth=3;ctx.strokeStyle='#ffe29c';ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();
  }
  canvas.onclick=event=>{
   const rect=canvas.getBoundingClientRect();
   if(!rect.width||!rect.height)return;
   const x=Math.round(minX+(event.clientX-rect.left)/rect.width*span);
   const z=Math.round(minZ+(event.clientY-rect.top)/rect.height*span);
   const legal=getLegalPoint(x,z);
   if(!legal||!Number.isFinite(legal.x)||!Number.isFinite(legal.z)){
    state.notice='通行できない地点です。別の場所を選択してください。';render();return;
   }
   state.point={x:Math.round(legal.x),z:Math.round(legal.z)};
   state.notice='移動先を選択しました：X'+state.point.x+' Z'+state.point.z;
   render();
  };
 }
 function issue(){
  const id=String(state.squad),point=state.point,kind=state.kind,target=state.target;
  let accepted=false;
  if(state.category==='item'){
   const current=(getSharedItems(id)||[]).find(t=>String(t.id)===String(state.item?.id));
   if(!current||current.usable===false||Number(current.quantity)<=0)accepted=false;
   else accepted=onSharedItem(String(current.id),String(target?.id));
  }else if(state.category==='move'){
   if(kind==='move_high'){
    const current=(getSpecialTargets(id,'high_ground')||[]).find(t=>String(t.id)===String(target?.id));
    if(current&&current.available!==false){
     accepted=onSpecial(id,'high_ground',String(current.id));
     if(accepted&&state.arrival!=='hold'&&point)
      queueArrival(id,{command:state.arrival,point:{...point}});
    }
   }else if(point){
    const legal=getLegalPoint(point.x,point.z);
    if(legal){
     accepted=onMove(id,{x:legal.x,z:legal.z});
     if(accepted)queueArrival(id,{command:state.arrival||'hold',point:{x:legal.x,z:legal.z}});
    }
   }
  }else if(state.category==='rally'){
   accepted=onRally(id,state.command,[String(target?.id)]);
  }else if(kind==='special'){
   const current=(getSpecialTargets(id,state.specialId)||[]).find(t=>String(t.id)===String(target?.id));
   if(current&&current.available!==false)accepted=onSpecial(id,state.specialId,String(current.id));
  }else if(kind?.startsWith('attack_')&&target&&Number(target.team)===1&&target.squadId!=null){
   accepted=onTargetOrder(id,state.command,target);
  }else if(state.command)accepted=onOrder(id,state.command);
  if(accepted?.openMove){close();return;} // Already executed: never spend MP twice.
  if(accepted){
   onCommandCommitted({squadId:id,category:state.category,kind:state.kind,command:state.command,
    target:state.target,point:state.point,arrival:state.arrival,itemId:state.item?.id,specialId:state.specialId});
   setPreferred(id,state.category==='move'?'move_'+(state.arrival||'hold'):kind==='special'?'special_'+state.specialId:state.command||kind||'item');
   close();
  }else{state.notice='発令できませんでした。対象の状態、隊の生存、MP、軍師・経路の条件を確認してください。';render();}
 }
 function render(){
  if(root.hidden)return;
  root.replaceChildren();
  const head=element('header','','battleWizardHead');
  const names={squad:'① 味方隊を選択',main:'② 指示の種類',actions:'③ 行動を選択',types:'④ 行動の種類',targets:'⑤ 対象を選択',map:'⑤ マップで移動先を選択',arrival:'⑥ 到着後の自動行動',confirm:'⑦ 最終確認',items:'③ アイテムを選択'};
  head.append(element('strong',names[state.stage]||'作戦'));
  const buttons=element('div','','battleWizardHeadButtons');
  const prev=element('button','◀ 戻る');prev.onclick=back;prev.type='button';prev.disabled=!history.length;
  const quit=element('button','✕ 閉じる');quit.onclick=close;quit.type='button';
  buttons.append(prev,quit);head.append(buttons);root.append(head);
  if(state.squad!=null)root.append(element('div',esc(currentSquad()?.label||'第'+state.squad+'隊')+'｜'+esc(currentSquad()?.job||'')+'｜'+Math.round(Number(currentSquad()?.hp)||0)+' HP','battleWizardSquadCaption'));
  const body=element('div','','battleWizardBody');root.append(body);
  if(state.stage==='squad'){
   body.classList.add('battleWizardGrid');
   for(const [index,s] of getSquads().entries())
    button('第'+(index+1)+'隊｜'+esc(s.job||'隊')+'　'+esc(s.alive)+'/'+esc(s.total),()=>pickSquad(s.id),{
     disabled:!(Number(s.alive)>0),reason:Number(s.alive)>0?'':'全滅した隊は発令できません',chosen:String(s.id)===String(state.squad)});
  }else if(state.stage==='main'){
   button('⚔ 行動を選択する',()=>advance('actions'));
   button('🎒 アイテムを使用する',()=>advance('items',{category:'item',item:null,target:null}));
  }else if(state.stage==='actions'){
   for(const a of actionOptions())button(a.label,()=>pickAction(a.id),{disabled:!a.avail,reason:a.reason});
  }else if(state.stage==='types'){
   if(state.category==='move'){
    button('➤ 通常移動',()=>selectType('move_ground'));
    const heights=getSpecialTargets(String(state.squad),'high_ground')||[];
    button('🏰 高所へ移動',()=>selectType('move_high'),{
     disabled:!heights.some(t=>t.available!==false),
     reason:heights.some(t=>t.available!==false)?'到着後は待機します':'到達できる高所がありません'});
   }else if(state.category==='attack'){
    for(const [id,label] of [['near','近距離'],['far','遠距離'],['intercept','迎撃'],['delay','延期']]){
     const enabled=Boolean(battleAttackCommand(id,currentSquad()?.job));
     button('⚔ '+label,()=>selectType('attack_'+id),{disabled:!enabled,reason:enabled?'':'このジョブでは使えません'});
    }
   }else if(state.category==='defend'){
    button('🛡 通常守備',()=>selectType('defend'));
    const skill=specials().find(a=>a.id==='frontline_guard');
    if(skill)button(skill.label,()=>pickSpecial(skill));
   }else if(state.category==='special'||state.category==='support'){
    const list=specials();
    if(!list.length)note('このジョブに選択できる技はありません。',true);
    for(const a of list){
     const targets=getSpecialTargets(String(state.squad),a.id)||[];
     const enabled=targets.some(t=>t.available!==false);
     button(a.label,()=>pickSpecial(a),{disabled:!enabled,
      reason:enabled?'':'対象なし・MP不足・条件未達のため実行できません'});
    }
   }else if(state.category==='rally'){
    const info=getRallyInfo(String(state.squad));
    if(info.phase!=='ready')note('号令は効果終了・インターバル後に使用できます。',true);
    for(const a of COMMAND_RALLY_TYPES)
     button(a.name,()=>selectType('rally',{command:a.id.replace('command_','')}),{disabled:info.phase!=='ready'});
   }
  }else if(state.stage==='items'){
   const items=getSharedItems(String(state.squad))||[];
   if(!items.length)note('共有アイテムがありません。',true);
   for(const item of items){
    const usable=item.usable!==false&&Number(item.quantity)>0;
    button('🎒 '+esc(item.label||item.name||item.id)+' ×'+esc(item.quantity),
     ()=>advance('targets',{item,target:null}),{
      disabled:!usable,reason:usable?'':'所持数0または戦闘中に使用できないアイテムです'});
   }
  }else if(state.stage==='targets'){
   let targets=[];
   if(state.category==='item')targets=getSquads().filter(s=>Number(s.alive)>0).map(s=>({...s,label:esc(s.label||s.id)+'｜HP '+Math.round(Number(s.hp)||0)}));
   else if(state.kind==='move_high')targets=getSpecialTargets(String(state.squad),'high_ground')||[];
   else if(state.kind==='rally')targets=(getRallyInfo(String(state.squad)).targets||[]).filter(s=>s.alive!==false);
   else if(state.kind==='special')targets=getSpecialTargets(String(state.squad),state.specialId)||[];
   else if(state.kind?.startsWith('attack_'))targets=(getMoveTargets('enemies',String(state.squad))||[]).filter(s=>Number(s.team)===1);
   if(!targets.length)note('指定できる対象がありません。1つ前の画面に戻って選び直してください。',true);
   for(const target of targets.slice(0,70))
    button(esc(target.label||target.name||target.id),()=>chooseTarget(target),{
     disabled:target.available===false,reason:target.available===false?esc(target.reason||'現在は選べません'):''});
  }else if(state.stage==='map'){
   note('マップをタップして移動先を選択。＋・－で拡大縮小できます。');
   const controls=element('div','','battleWizardMapControls');
   for(const [label,multiplier] of [['＋ 拡大',1.6],['－ 縮小',1/1.6],['全域',0]]){
    const b=element('button',label);b.type='button';b.onclick=()=>{
     mapZoom=multiplier?Math.max(1,Math.min(6,mapZoom*multiplier)):1;
     render();};controls.append(b);
   }
   body.append(controls);
   const canvas=doc.createElement('canvas');canvas.className='battleWizardMap';canvas.width=440;canvas.height=235;canvas.setAttribute('aria-label','移動先を選択するマップ');body.append(canvas);drawMap(canvas);
   if(state.point)button('✅ この地点に移動',()=>advance('arrival',{arrival:'hold'}));
  }else if(state.stage==='arrival'){
   note('移動後の行動を指定できます。指定がなければ自動で待機します。');
   for(const [id,label] of [['hold','⏸ 待機'],['defend','🛡 守備'],['charge','⚔ 交戦']])
    button(label,()=>{state.arrival=id;advance('confirm');},{chosen:state.arrival===id});
   if(state.kind==='move_high')note('高所では到着後に待機。登攀可能な経路が優先されます。');
  }else if(state.stage==='confirm'){
   const description=state.category==='item'?'アイテム：'+esc(state.item?.label||state.item?.name):
    state.category==='move'?'移動：'+(state.kind==='move_high'?'高所':'地面')+' → 到着後 '+({hold:'待機',defend:'守備',charge:'交戦'}[state.arrival]||'待機'):
    state.category==='rally'?'号令：'+esc(state.command):
    state.kind==='special'?esc(state.specialName):
    esc(state.kind||state.command);
   note(description);
   if(state.target)note('対象：'+esc(state.target.label||state.target.name||state.target.id));
   if(state.point)note('地点：X '+state.point.x+' / Z '+state.point.z);
   button('✅ この内容で確定',issue);
  }
  if(state.notice)note(state.notice,true);
 }
 function open(id){
  history.length=0;
  Object.assign(state,{stage:'squad',squad:id==null?null:String(id),category:null,kind:null,
   target:null,point:null,arrival:'hold',item:null,notice:''});
  dock.classList.add('wizard-active');root.hidden=false;render();
 }
 function hide(){
  root.hidden=true;dock.classList.remove('wizard-active');history.length=0;
 }
 function close(){hide();onClose();}
 return {root,open,close,hide,render,get stage(){return state.stage;},dispose(){root.remove();}};
}
