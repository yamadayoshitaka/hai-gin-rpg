import {
 STAGE_WORLD_SIZE,STAGE_BIOME_LABELS,STAGE_BUILDING_LABELS,DEFAULT_STAGE_ID,
 allStages,activeStage,selectStage,upsertCustomStage,duplicateStage,
 deleteCustomStage,normalizeCustomStage,stageBounds,applyStageTerrain,stageIdentity,stageLandmarks,stageWaterway,stageBridgeRows,
} from './stage-library.js?v=4';

const $=id=>document.getElementById(id),storage=window.localStorage;
const fields=['name','description','biome','season','size','difficulty','waterway','bridgeCount','buildingMode','buildingLimit','treeRate','seed','huts','farmland'];
for(const [id,name] of Object.entries(STAGE_BIOME_LABELS))$('biome').add(new Option(name,id));
for(const [id,name] of Object.entries(STAGE_BUILDING_LABELS))if(id!=='capital')$('buildingMode').add(new Option(name,id));
let selectedId=activeStage(storage,new URLSearchParams(location.search).get('stage')).id;
let messageTimeout=null;
const escapeHtml=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function report(message){
 $('message').textContent=message;
 if(messageTimeout)clearTimeout(messageTimeout);
 messageTimeout=setTimeout(()=>{$('message').textContent=''},6500);
}
function current(){return allStages(storage).find(stage=>stage.id===selectedId)||activeStage(storage)}
function formValue(){
 const obj={id:selectedId,custom:true};
 for(const id of fields)obj[id]=['huts','farmland'].includes(id)?$(id).checked:$(id).value;
 return normalizeCustomStage(obj);
}
function fillForm(stage){
 for(const id of fields){
  const input=$(id);if(['huts','farmland'].includes(id))input.checked=Boolean(stage[id]);
  else input.value=id==='waterway'?stageWaterway(stage):id==='bridgeCount'?stageBridgeRows(stage).length:stage[id];
  input.disabled=!stage.custom;
 }
 $('bridgeCount').disabled=!stage.custom||stageWaterway(stage)!=='river';
 $('saveStage').disabled=!stage.custom;
 $('deleteStage').disabled=!stage.custom;
 $('size').max='216';
}
const colors={
 grass:[77,126,56],flower:[94,153,71],dirt:[138,103,67],mud:[89,81,64],
 moss:[74,105,62],leaf:[126,93,64],sand:[202,180,121],crack:[164,132,93],
 rock:[103,106,113],gravel:[116,115,109],stone:[142,139,134],
 cobble:[113,112,110],snow:[224,236,239],ice:[162,205,218],
 river:[47,119,158],water:[42,109,146],ash:[81,76,74],cliff:[67,62,55],
};
function preview(stage){
 const size=STAGE_WORLD_SIZE,data={width:size,height:size,season:'summer',tiles:Array(size*size).fill('grass'),heights:Array(size*size).fill(3)};
 for(let z=0;z<size;z++)for(let dx=-2;dx<=2;dx++){
  const x=116+Math.round(5*Math.sin(z*.055))+dx;
  data.tiles[z*size+x]='river';
 }
 applyStageTerrain(data,stage);
 const miniature=document.createElement('canvas');miniature.width=miniature.height=size;
 const mc=miniature.getContext('2d'),pixels=mc.createImageData(size,size);
 for(let i=0;i<data.tiles.length;i++){
  const c=colors[data.tiles[i]]||colors.grass,j=i*4;
  pixels.data[j]=c[0];pixels.data[j+1]=c[1];pixels.data[j+2]=c[2];pixels.data[j+3]=255;
 }
 mc.putImageData(pixels,0,0);
 const canvas=$('preview'),ctx=canvas.getContext('2d');
 ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(miniature,0,0,canvas.width,canvas.height);
 const scale=canvas.width/size;
 ctx.strokeStyle='#bfe5ffbb';ctx.lineWidth=2;
 for(const row of stageBridgeRows(stage)){
  ctx.beginPath();ctx.moveTo(109*scale,row*scale);ctx.lineTo(124*scale,row*scale);ctx.stroke();
 }
 if(stage.buildingMode==='capital'){
  ctx.fillStyle='#b5b1aa';ctx.fillRect(6*scale,6*scale,100*scale,100*scale);
  ctx.strokeStyle='#f7dc9a';ctx.lineWidth=3;ctx.strokeRect(6*scale,6*scale,100*scale,100*scale);
  ctx.fillStyle='#37495d';ctx.fillRect(39*scale,39*scale,34*scale,34*scale);
 }
 const amount=stage.buildingMode==='capital'?35:Math.min(28,stage.buildingLimit);
 for(let i=0;i<amount;i++){
  const x=24+(i*37+stage.seed*3)%185,z=30+(i*47+stage.seed)%176;
  if(x>stageBounds(stage).maxX-8||x<stageBounds(stage).minX+8||z>stageBounds(stage).maxZ-8||z<stageBounds(stage).minZ+8||(stageWaterway(stage)==='river'&&Math.abs(x-116)<12))continue;
  ctx.fillStyle='#c7a072';ctx.fillRect(x*scale,z*scale,5*scale,5*scale);
  ctx.fillStyle='#834d3c';ctx.fillRect((x+1)*scale,(z+1)*scale,3*scale,3*scale);
 }
 for(const [,x,z] of stageLandmarks(stage)){
  ctx.fillStyle='#ffe6a7';ctx.strokeStyle='#372819';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(x*scale,z*scale,4,0,Math.PI*2);ctx.fill();ctx.stroke();
 }
 ctx.fillStyle='#061626aa';ctx.fillRect(9,9,172,32);
 ctx.fillStyle='#fff1c9';ctx.font='bold 14px system-ui';ctx.fillText(stage.size+' × '+stage.size+'マス',17,30);
}
function render(){
 const stages=allStages(storage),stage=current(),selectedActive=activeStage(storage).id;
 selectedId=stage.id;
 $('stageCount').textContent=stages.length+'ステージ · 初期'+stages.filter(s=>!s.custom).length+' / カスタム'+stages.filter(s=>s.custom).length;
 $('stageList').innerHTML=stages.map(s=>'<button type="button" class="stage-card" data-stage="'+escapeHtml(s.id)+'" aria-pressed="'+String(s.id===stage.id)+'"><strong>'+escapeHtml(s.name)+'</strong><div class="meta"><span class="chip">'+escapeHtml(STAGE_BIOME_LABELS[s.biome])+'</span><span class="chip">'+s.size+'×'+s.size+'</span>'+(selectedActive===s.id?'<span class="chip active">現在のステージ</span>':'')+(s.custom?'<span class="chip">カスタム</span>':'')+'</div><p>'+escapeHtml(s.description)+'</p></button>').join('');
 $('detailTitle').textContent=stage.name;
 $('stageIdentity').textContent='景観：'+stageIdentity(stage).feature+' ／ 戦術：'+stageIdentity(stage).tactics+' ／ 川：'+(stageWaterway(stage)==='river'?'あり':'なし')+'・橋：'+stageBridgeRows(stage).length+'本';
 fillForm(stage);preview(stage);
 $('activate').textContent=selectedActive===stage.id?'✓ 適用中のステージ':'このステージをゲームに適用';
}
$('stageList').onclick=event=>{
 const target=event.target.closest('[data-stage]');if(!target)return;
 selectedId=target.dataset.stage;render();
};
$('createStage').onclick=()=>{try{selectedId=duplicateStage(storage,current().id).id;render();report('編集可能なステージを複製しました。')}catch(error){report(error.message)}};
$('waterway').onchange=()=>{
 const hasRiver=$('waterway').value==='river';
 $('bridgeCount').disabled=!hasRiver;
 $('bridgeCount').value=hasRiver?'1':'0';
};
$('activate').onclick=()=>{try{selectStage(storage,selectedId);render();report('ゲームに適用しました。')}catch(error){report(error.message)}};
$('launch').onclick=()=>{
 try{selectStage(storage,selectedId);location.href='./tactics-wireframe.html?stage='+encodeURIComponent(selectedId)+'&v=stage-4';}
 catch(error){report(error.message)}
};
$('stageForm').onsubmit=event=>{
 event.preventDefault();try{upsertCustomStage(storage,formValue());render();report('ステージ設定を保存しました。')}catch(error){report(error.message)}
};
$('deleteStage').onclick=()=>{
 const stage=current();if(!stage.custom)return;
 if(!confirm('「'+stage.name+'」を削除しますか？（元に戻せません）'))return;
 try{deleteCustomStage(storage,stage.id);selectedId=DEFAULT_STAGE_ID;render();report('カスタムステージを削除しました。')}catch(error){report(error.message)}
};
$('exportStage').onclick=()=>{
 const data=JSON.stringify({schema:'hai-gin.stage-template.v2',stage:current()},null,2);
 const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='hai-gin-stage-'+selectedId+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
};
$('importStage').onclick=()=>$('importFile').click();
$('importFile').onchange=async()=>{
 const file=$('importFile').files?.[0];if(!file)return;
 try{
  if(file.size>100000)throw Error('ステージ定義は100KB以下にしてください。');
  const payload=JSON.parse(await file.text()),source=payload?.stage||payload;
  const id=source?.id?.startsWith('custom-')?source.id:'custom-'+Date.now().toString(36);
  const imported=upsertCustomStage(storage,{...source,id});
  selectedId=imported.id;selectStage(storage,imported.id);render();report('ステージを読み込み、ゲームに適用しました。');
 }catch(error){report('JSON読み込み失敗：'+error.message)}
 $('importFile').value='';
};
render();
