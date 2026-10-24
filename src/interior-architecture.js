/** Data-only floor architecture, independently addressable by area ID.
 * Each wall is a segment with an explicit opening; the renderer never invents rooms.
 */
export function createFloorArchitecture({buildingId,width,depth,stair,floor,usage='home'}){
 const w=width,d=depth,ex=w/2-.35,ez=d/2-.35,t=.32;
 const walls=[];
 const add=(id,x,z,sw,sd)=>{if(sw>.15&&sd>.15)walls.push({id,x,z,w:sw,d:sd,collision:true});};
 const opening=(id,z,gap=4.4)=>{let side=(w-.7-gap)/2;for(const dir of [-1,1])add(id+'-'+dir,dir*(gap/2+side/2),z,side,t);};
 add('north',0,-ez,w-.7,t);add('west',-ex,0,t,d-.7);add('east',ex,0,t,d-.7);
 if(floor===1)opening('front',ez);else add('south',0,ez,w-.7,t);
 const corridor=Math.min(3.6,w*.16);
 const crossZ=usage==='castle'?-d*.15:usage==='inn'?-d*.08:-d*.12;
 // Partitions are explicitly segmented around door openings.
 if(usage!=='castle'){
  for(const dir of [-1,1]){
   const sideX=dir*(corridor+((w/2-corridor)/2));
   const length=Math.max(0,w/2-corridor-2.4);
   add('cross-'+dir,sideX,crossZ,length,t);
  }
  // Open center aisle to staircase, and doors to side rooms.
  const backSpan=d*.34;
  for(const dir of [-1,1]){
   const x=dir*(w*.34);
   add('wing-'+dir+'-north',x,-d*.31,t,backSpan*.38);
   add('wing-'+dir+'-south',x,d*.19,t,backSpan*.38);
  }
 }else{
  // Castle: open central ceremonial hall, flanking chambers with open thresholds.
  for(const dir of [-1,1]){
   const x=dir*w*.36;
   add('castle-wing-'+dir+'-north',x,-d*.35,t,d*.20);
   add('castle-wing-'+dir+'-south',x,d*.26,t,d*.20);
  }
 }
 return {id:buildingId+':floor:'+floor,floor,walls,floorSurface:{size:[w-.45,d-.45],material:floor===1?'stone-tile':'timber'},stair:stair?{...stair,portalId:buildingId+':'+(floor===1?'upstairs':'downstairs')}:null};
}
