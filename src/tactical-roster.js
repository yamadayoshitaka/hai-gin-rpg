/** Data-only job assignment for the opening tactical battle. */
export function randomJobRoster(jobs,count,random=Math.random){
 if(!Array.isArray(jobs)||!jobs.length)throw Error('職業一覧がありません');
 if(!Number.isInteger(count)||count<1)throw Error('人数が不正です');
 const shuffle=items=>{
  for(let i=items.length-1;i>0;i--){
   const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));
   [items[i],items[j]]=[items[j],items[i]];
  }
  return items;
 };
 const roster=[];
 while(roster.length<count){
  const candidates=shuffle([...jobs]);
  roster.push(...candidates.slice(0,count-roster.length));
 }
 return shuffle(roster);
}
