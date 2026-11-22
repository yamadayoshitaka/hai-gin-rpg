/** Consistent team palette for the field radar and three-team HUD. */
export const BATTLE_TEAM_COLORS=Object.freeze({
 ally:'#5aceff',enemy:'#ff7884',engaged:'#ffe091'
});
/** A group is engaged once any live member makes actual combat contact.
 * Only a command team's defeat (not a job subdivision's) earns a wipeout cut-in.
 * This is presentation-only: job squads continue to exist in the simulation. */
export function createBattleThreeTeamEventTracker(){
 const previousAlive=new Map(),announcedContact=new Set();
 return {
  observe(rows=[]){
   const engagements=[],annihilations=[];
   for(const row of rows){
    const team=Number(row.team),groupId=Number(row.groupId);
    if((team!==0&&team!==1)||!Number.isInteger(groupId)||groupId<1||groupId>3)continue;
    const key=team+':'+groupId,alive=Math.max(0,Number(row.alive)||0);
    const previous=previousAlive.get(key);
    if(previous>0&&alive===0)annihilations.push({
     team,groupId,total:Math.max(0,Number(row.total)||0),
     squadId:String(row.members?.find(member=>member.id!=null)?.id??'')
    });
    previousAlive.set(key,alive);
    if(team===0&&alive>0&&row.inContact&&!announcedContact.has(key)){
     announcedContact.add(key);
     engagements.push({team,groupId});
    }
   }
   return {engagements,annihilations};
  }
 };
}

/** One position per squad, sourced from the currently alive commander/leader. */
export function squadRadarPins(allies=[],enemies=[],worldSize=232,rows=[]){
 const sideCount=new Map();
 for(const row of rows)sideCount.set(Number(row.team)+':'+String(row.id),Number(row.alive)||0);
 const result=[];
 for(const [team,group] of [[0,allies],[1,enemies]]){
  for(let i=0;i<group.length;i++){
   const squad=group[i];if(!squad)continue;
   if(!Number.isFinite(squad.x)||!Number.isFinite(squad.z))continue;
   if(!(Number(squad.alive)>0)&&sideCount.has(team+':'+String(squad.id))&&sideCount.get(team+':'+String(squad.id))<=0)continue;
   result.push({team,id:String(squad.id),number:i+1,
    inContact:Boolean(squad.inContact),
    x:Math.max(0,Math.min(1,squad.x/Math.max(1,worldSize-1))),
    y:Math.max(0,Math.min(1,squad.z/Math.max(1,worldSize-1)))});
  }
 }
 return result;
}
export function radarHitPin(pins=[],px=0,py=0,radius=.072){
 let best=null,dist=radius*radius;
 for(const pin of pins){
  const d=(pin.x-px)**2+(pin.y-py)**2;
  if(d<=dist){dist=d;best=pin;}
 }
 return best;
}


/** Visual radar only: group physical job squads into 1-3 command-team pins. */
export function battleThreeTeamRadarSquads(squads=[],groupBySquad={},engagementByGroup=null){
 const groups=new Map();
 for(const squad of squads){
  if(!squad||!(Number(squad.alive)>0)||
   !Number.isFinite(squad.x)||!Number.isFinite(squad.z))continue;
  const groupId=Number(groupBySquad[String(squad.id)]);
  if(!Number.isInteger(groupId)||groupId<1||groupId>3)continue;
  let group=groups.get(groupId);
  if(!group){
   group={id:String(squad.id),groupId,alive:0,total:0,x:0,z:0,weight:0};
   groups.set(groupId,group);
  }
  const weight=Math.max(1,Number(squad.alive)||0);
  group.x+=squad.x*weight;group.z+=squad.z*weight;group.weight+=weight;
  group.alive+=Number(squad.alive)||0;
  group.total+=Number(squad.total)||0;
  if(squad.inContact&&squad.engagementPoint&&!group.engagementPoint)
   group.engagementPoint=squad.engagementPoint;
 }
 return [...groups.values()].sort((a,b)=>a.groupId-b.groupId).map(group=>{
  // During contact use the living frontline shared by the HUD, not the
  // rear strategist or an averaged officer position.
  const live=engagementByGroup instanceof Map?
   (engagementByGroup.get(String(group.groupId))??engagementByGroup.get(group.groupId)):
   engagementByGroup?.[String(group.groupId)];
  const point=live||group.engagementPoint;
  const contact=Number.isFinite(point?.x)&&Number.isFinite(point?.z);
  return {
   id:group.id,groupId:group.groupId,alive:group.alive,total:group.total,
   x:contact?point.x:group.x/group.weight,
   z:contact?point.z:group.z/group.weight,
   inContact:contact
  };
 });
}
