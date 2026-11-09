/**
 * Small pure tactical advisor.  It never grants items or issues orders;
 * buttons must still pass the normal command/cooldown/inventory checks.
 */
const usable=u=>u&&u.team===0&&u.alive!==false&&Number(u.hp)>0;
const itemChoice=(stock,id)=>stock.find(s=>s.itemId===id&&s.quantity>0);
const label=(itemId)=>({
 healing_potion:'回復薬',high_potion:'上級回復薬',elixir:'特級回復薬',
 war_banner:'勇猛の軍旗',aegis_seal:'守護の護符',wind_scroll:'疾風の巻物'
})[itemId]||itemId;

export function recommendBattleTactics(members,stocks=[],{activeBuffIds=[]}={}){
 const alive=(members||[]).filter(usable);
 if(!alive.length)return {order:'hold',orderReason:'生存兵なし',itemId:null,itemReason:'使用できる部隊がいません'};
 const total=(members||[]).filter(u=>u.team===0).length||alive.length;
 const aliveRatio=alive.length/total;
 const maxHp=alive.reduce((sum,u)=>sum+Math.max(0,Number(u.maxHp)||0),0);
 const hp=alive.reduce((sum,u)=>sum+Math.max(0,Number(u.hp)||0),0);
 const hpRatio=maxHp>0?hp/maxHp:1;
 const deficit=alive.reduce((sum,u)=>sum+Math.max(0,(Number(u.maxHp)||0)-(Number(u.hp)||0)),0);
 const jobs=new Set(alive.map(u=>u.jobId||u.job?.id||''));
 let order='charge',orderReason='前進して攻勢を維持';
 if(aliveRatio<=.35){order='retreat';orderReason='生存兵が35%以下'}
 else if(hpRatio<.45){order='defend';orderReason='部隊HPが45%未満'}
 else if(jobs.has('archer')||jobs.has('ninja')){order='defend';orderReason='遠距離・機動兵を守る'}
 const buffIds=new Set(activeBuffIds);
 let priority;
 if(deficit>=Math.max(45,maxHp*.22)){
  priority=['healing_potion','high_potion','elixir']
   .filter(id=>itemChoice(stocks,id)).sort((a,b)=>{
     const amounts={healing_potion:200,high_potion:600,elixir:1500};
     const wasteA=Math.abs(amounts[a]-deficit),wasteB=Math.abs(amounts[b]-deficit);
     return wasteA-wasteB;
   });
 }
 if(!priority?.length)priority=(order==='retreat'?['wind_scroll','aegis_seal','war_banner']:
  order==='defend'?['aegis_seal','war_banner','wind_scroll']:
  ['war_banner','wind_scroll','aegis_seal'])
  .filter(id=>!buffIds.has(id));
 const candidates=[...(priority||[]),'healing_potion','high_potion','elixir','war_banner','aegis_seal','wind_scroll'];
 const itemId=candidates.find((id,i)=>candidates.indexOf(id)===i&&itemChoice(stocks,id)&&
   (!id.endsWith('potion')&&id!=='elixir'||deficit>0)&&!buffIds.has(id))||null;
 return {order,orderReason,itemId,itemReason:itemId?
  (['healing_potion','high_potion','elixir'].includes(itemId)?'負傷部隊のHPを回復':
   '選択部隊の戦闘力を強化')+'：'+label(itemId):'使用できる所持アイテムがありません'};
}
