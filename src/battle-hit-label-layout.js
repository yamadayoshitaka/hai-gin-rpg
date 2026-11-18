/**
 * Lightweight screen-space deconfliction for confirmed combat labels.
 * Presentation only: simulation HP, event stream and target identity stay intact.
 * Screen coordinates are CSS pixels, not device pixels.
 */
export function selectReadableHitLabels(markers,{
 width=0,height=0,maxDamage=10,maxHp=4
}={}){
 const safeWidth=Number(width)||0,safeHeight=Number(height)||0;
 const topInset=Math.min(84,safeHeight*.12);
 const bottomInset=Math.min(160,safeHeight*.20);
 const valid=(markers||[]).filter(entry=>{
  const p=entry?.point;
  return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
   p.x>=9&&p.x<=safeWidth-9&&
   p.y>=topInset&&p.y<=safeHeight-bottomInset&&
   Number(entry.hit?.damage)>0;
 });
 valid.sort((a,b)=>{
  const score=entry=>(entry.hit.remainingHp===0?-1.5:0)+
   (Number(entry.point.centerDistance)||0)-
   Math.min(100,Number(entry.hit.damage)||0)*.0015;
  return score(a)-score(b);
 });
 const damage=[],hp=[];
 for(const entry of valid){
  if(damage.length>=maxDamage)break;
  const close=(list,dx,dy)=>list.some(other=>
   Math.abs(other.point.x-entry.point.x)<dx&&
   Math.abs(other.point.y-entry.point.y)<dy);
  if(close(damage,33,35))continue;
  damage.push(entry);
  if(entry.hit.remainingHp!=null&&hp.length<maxHp&&!close(hp,104,65))
   hp.push(entry);
 }
 return {damage,hp};
}
