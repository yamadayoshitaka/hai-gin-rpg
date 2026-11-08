/** Recent damage-based tactical heatmap, independent of the 3D render path. */
export class BattleHotspotMap{
 constructor({cellSize=12,decayMs=8500,maxCells=240,now=()=>performance.now()}={}){
  this.cellSize=cellSize;this.decayMs=decayMs;this.maxCells=maxCells;
  this.now=now;this.cells=new Map();
 }
 add({x,z,damage=10,kind='hit'}={}){
  if(!Number.isFinite(x)||!Number.isFinite(z))return;
  const cx=Math.floor(x/this.cellSize),cz=Math.floor(z/this.cellSize),key=cx+','+cz;
  const stamp=this.now(),old=this.cells.get(key);
  const previous=old?old.score*Math.exp(-(stamp-old.at)/this.decayMs):0;
  const amount=Math.min(120,Math.max(2,Number(damage)||10));
  const score=Math.min(500,previous+amount*(kind==='kill'?2.2:kind==='magic'?1.25:1));
  this.cells.set(key,{x:(cx+.5)*this.cellSize,z:(cz+.5)*this.cellSize,score,at:stamp});
  if(this.cells.size>this.maxCells)this.prune(stamp,true);
 }
 prune(stamp=this.now(),force=false){
  for(const [key,item] of this.cells){
   if(item.score*Math.exp(-(stamp-item.at)/this.decayMs)<3)this.cells.delete(key);
  }
  if(!force||this.cells.size<=this.maxCells)return;
  const all=[...this.cells].sort((a,b)=>b[1].score-a[1].score);
  this.cells=new Map(all.slice(0,this.maxCells));
 }
 hottest(limit=12,stamp=this.now()){
  const list=[];
  for(const item of this.cells.values()){
   const score=item.score*Math.exp(-(stamp-item.at)/this.decayMs);
   if(score>8)list.push({x:item.x,z:item.z,score});
  }
  return list.sort((a,b)=>b.score-a.score).slice(0,limit);
 }
 draw(ctx,{limit=28}={}){
  const hotspots=this.hottest(limit);
  if(!hotspots.length)return [];
  ctx.save();
  for(const hit of hotspots){
   const radius=8+Math.min(18,Math.sqrt(hit.score)*1.18);
   const gradient=ctx.createRadialGradient(hit.x,hit.z,0,hit.x,hit.z,radius);
   const alpha=Math.min(.72,.10+hit.score/280);
   gradient.addColorStop(0,'rgba(255,63,31,'+alpha.toFixed(3)+')');
   gradient.addColorStop(.55,'rgba(255,141,30,'+(alpha*.57).toFixed(3)+')');
   gradient.addColorStop(1,'rgba(255,175,32,0)');
   ctx.fillStyle=gradient;ctx.beginPath();
   ctx.arc(hit.x,hit.z,radius,0,Math.PI*2);ctx.fill();
  }
  ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff2c1';
  for(const hit of hotspots.slice(0,3)){
   if(hit.score>28)ctx.fillText('⚔',hit.x,hit.z+3);
  }
  ctx.restore();
  return hotspots;
 }
}
