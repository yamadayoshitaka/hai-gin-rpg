/** A finite-inventory squad item advisor, shared by auto and QA. */
export function chooseAutoSquadItem(members=[],stocks=[],types={},activeBuffIds=[]){
 const living=members.filter(u=>u&&u.alive!==false&&Number(u.hp)>0&&!u.isStrategist);
 if(!living.length)return null;
 const hpMax=living.reduce((n,u)=>n+Math.max(0,Number(u.maxHp)||0),0);
 const missing=living.reduce((n,u)=>n+Math.max(0,(Number(u.maxHp)||0)-(Number(u.hp)||0)),0);
 const hpRatio=hpMax>0?1-missing/hpMax:1;
 const available=stocks.filter(s=>s&&Number(s.quantity)>0&&types[s.itemId]);
 // Avoid consuming healing stock for scratches. Save a potion until the
 // squad loses at least a quarter of its total remaining HP.
 if(hpMax>0&&missing>=Math.max(45,hpMax*.25)&&hpRatio<.77){
  const heals=available.filter(s=>types[s.itemId]?.kind==='heal');
  if(heals.length){
   heals.sort((a,b)=>Math.abs((types[a.itemId].squadHealHp||0)-missing)-
     Math.abs((types[b.itemId].squadHealHp||0)-missing));
   return heals[0].itemId;
  }
 }
 const active=new Set(activeBuffIds);
 const buff=available.find(s=>types[s.itemId]?.kind==='squad_buff'&&!active.has(s.itemId));
 return buff?.itemId||null;
}
