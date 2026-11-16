/**
 * Lightweight battle objective checkpoints. Reads snapshots at most once per second.
 * Never changes combat AI, models, animation cadence, VFX or render resolution.
 */
const alive=u=>Number(u?.hp)>0&&u.alive!==false&&u.defeated!==true;
const clamp=n=>Math.max(0,Math.min(100,Math.floor(n)));
const names={charge:'敵部隊撃破',defend:'指定地点の守備',hold:'指定地点で待機',
 retreat:'指定地点へ退却',support:'指定地点の支援',destroy:'対象破壊',
 explore:'指定対象の探索',weaken:'敵戦力の弱体化',item:'アイテム使用'};
export function createBattleObjectiveCheckpoints({
 getUnits=()=>[],getObjects=()=>[],getSquadCenter=()=>null,onReport=()=>{},onChange=()=>{}
}={}){
 let seq=0,rows=[],lastText='';
 const livingCount=id=>getUnits().filter(u=>u.team===1&&String(u.squadId)===String(id)&&alive(u)).length;
 const describe=row=>'第'+row.groupId+'班 / '+row.label+' / '+row.status+
  (row.status==='進行中'?' '+row.progress+'%':'');
 function publish(row){
  const summary=rows.slice(-4).map(describe).join(' ｜ ');
  if(summary!==lastText){lastText=summary;onChange(summary,rows.map(x=>({...x})));}
 }
 function report(row,label){
  onReport('📍 CP'+row.id+' '+describe(row)+'：'+label);
  publish(row);
 }
 function register({groupId,mode,squadIds=[],targetIds=[],point=null,itemId=null}={}){
  const chosen=[...new Set(squadIds.map(String))],targets=[...new Set(targetIds.map(String))];
  const row={id:++seq,groupId:String(groupId||'1'),mode,
   label:names[mode]||'目的遂行',squadIds:chosen,targetIds:targets,
   point:point&&Number.isFinite(point.x)&&Number.isFinite(point.z)?{x:point.x,z:point.z}:null,
   itemId,progress:0,status:'進行中',reported:0,
   baseline:mode==='charge'?Object.fromEntries(targets.map(id=>[id,Math.max(1,livingCount(id))])):null};
  rows.push(row);if(rows.length>8)rows.shift();
  if(mode==='item'||mode==='weaken'){
   row.progress=100;row.status='達成';row.reported=100;
   report(row,'作戦実行を確認');
  }else report(row,'作戦受付（達成状況の監視を開始）');
  return row.id;
 }
 function update(){
  const objects=getObjects(),objectById=new Map(objects.map(o=>[String(o.id),o]));
  for(const row of rows){
   if(row.status!=='進行中')continue;
   let value=row.progress;
   if(row.mode==='charge'&&row.targetIds.length){
    const total=row.targetIds.reduce((n,id)=>n+(row.baseline[id]||1),0);
    const left=row.targetIds.reduce((n,id)=>n+livingCount(id),0);
    value=clamp((total-left)/Math.max(1,total)*100);
   }else if(row.mode==='destroy'&&row.targetIds.length){
    // No "missing means destroyed" assumption: the object must explicitly be dead.
    const destroyed=row.targetIds.filter(id=>objectById.has(id)&&objectById.get(id).alive===false).length;
    value=clamp(destroyed/row.targetIds.length*100);
   }else if(row.point&&row.squadIds.length&&
     ['defend','hold','retreat','support'].includes(row.mode)){
    const arrived=row.squadIds.filter(id=>{
     const center=getSquadCenter(id);
     return center&&Math.hypot(center.x-row.point.x,center.z-row.point.z)<=6;
    }).length;
    value=clamp(arrived/row.squadIds.length*100);
   }
   const threshold=value>=100?100:value>=75?75:value>=50?50:value>=25?25:0;
   if(threshold<=row.reported)continue;
   row.progress=threshold;row.reported=threshold;
   if(threshold===100)row.status=row.mode==='support'?'地点到着':'達成';
   report(row,threshold===100?'チェックポイント到達':'進行率を更新');
  }
 }
 return {register,update,snapshot:()=>rows.map(x=>({...x})),text:()=>lastText};
}
