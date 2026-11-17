/**
 * Stable near-groom arbitration for detailed 50v50 skinned characters.
 *
 * The original 28m single cutoff swapped between 112-root and 168/360-root
 * hair every time the camera or a soldier crossed the same boundary. In a
 * moving tactical camera this could look like a transient bald/thin scalp.
 * Enter below 25m, retain the existing authentic groom until 32m; cap the
 * near cache without evicting the underlying full middle-distance hairstyle.
 * Rendering, AI, bones and particle budgets remain unchanged.
 */
export const BATTLE_GROOM_ENTER_METERS=25;
export const BATTLE_GROOM_EXIT_METERS=32;
export const BATTLE_GROOM_NEAR_LIMIT=8;

export function createStableBattleGroomSelector({
 enter=BATTLE_GROOM_ENTER_METERS,
 exit=BATTLE_GROOM_EXIT_METERS,
 limit=BATTLE_GROOM_NEAR_LIMIT
}={}){
 if(!(enter>0&&exit>enter&&Number.isInteger(limit)&&limit>0))
  throw Error('Studio hair near-groom thresholds must have positive hysteresis and limit');
 const selected=new Set();
 function update(distanceSorted=[]){
  const qualified=distanceSorted.filter(({a,d})=>
   a?.masterHead?.studioWig&&a?.studioPattern&&a?.outfit&&
   a.root?.visible!==false&&Number.isFinite(d));
  const byActor=new Map(qualified.map(item=>[item.a,item]));
  const keep=[...selected].filter(a=>{
   const item=byActor.get(a);
   return item&&item.d<exit*exit;
  });
  keep.sort((a,b)=>byActor.get(a).d-byActor.get(b).d);
  selected.clear();
  for(const a of keep.slice(0,limit))selected.add(a);
  // Only clearly nearer newcomers can displace an established hair variant.
  // This prevents priority "ping-pong" between the eighth and ninth soldier.
  for(const {a,d} of qualified){
   if(selected.has(a)||d>=enter*enter)continue;
   if(selected.size<limit){selected.add(a);continue;}
   const farthest=[...selected].sort((x,y)=>byActor.get(y).d-byActor.get(x).d)[0];
   const farDist=byActor.get(farthest).d;
   if(d<farDist*.64){selected.delete(farthest);selected.add(a);}
  }
  return new Set(selected);
 }
 function reset(){selected.clear();}
 return {update,reset,get size(){return selected.size}};
}
