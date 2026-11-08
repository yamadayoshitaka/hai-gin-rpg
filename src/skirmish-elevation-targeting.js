/**
 * Ground and elevated soldiers have different contact rules.
 * Do not mistake a roof-top opponent for a soldier on the ground, or allow a
 * ground melee unit to endlessly attack someone through the building ceiling.
 */
export function skirmishLevel(unit){
 const travel=unit?.floorTravel;
 if(travel?.phase==='climb'||travel?.phase==='landing')return {type:'transition',floor:null,building:null};
 const floor=Number(unit?.indoorFloor)||1;
 if(floor<=1)return {type:'ground',floor:1,building:null};
 const building=travel?.building?.model?.uuid??null;
 return {type:travel?.phase==='roof'?'roof':'upstairs',floor,building};
}
export function sameElevatedBattleSurface(a,b){
 const x=skirmishLevel(a),y=skirmishLevel(b);
 return x.floor>1&&x.floor===y.floor&&x.type===y.type&&
   x.building!=null&&x.building===y.building;
}
export function canDetectSkirmishEnemy(actor,target,{allowGroundRoof=false}={}){
 if(!actor||!target||actor===target||actor.team===target.team||
   actor.hp<=0||target.hp<=0||target.alive===false)return false;
 const a=skirmishLevel(actor),b=skirmishLevel(target);
 if(a.type==='transition'||b.type==='transition')return false;
 if(a.type==='ground'&&b.type==='ground')return true;
 if(sameElevatedBattleSurface(actor,target))return true;
 // Roof occupants are visible from outside only to ranged attackers; ground
 // melee units should not attempt to strike or chase through the ceiling.
 if(allowGroundRoof&&a.type==='ground'&&b.type==='roof')return true;
 return false;
}
export function nearestSkirmishEnemy(actor,roster,{
 maxDistance=Infinity,allowGroundRoof=false,canSee=()=>true
}={}){
 const origin=actor?.root?.position;
 if(!origin)return null;
 let result=null,best=maxDistance*maxDistance;
 for(const target of roster){
  if(!canDetectSkirmishEnemy(actor,target,{allowGroundRoof}))continue;
  const p=target.root?.position;if(!p)continue;
  const dx=p.x-origin.x,dz=p.z-origin.z,d=dx*dx+dz*dz;
  if(d>=best||!canSee(actor,target))continue;
  best=d;result=target;
 }
 return result;
}
