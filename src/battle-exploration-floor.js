/** Stable building/floor selection shared by map pins, exploration and tests. */
export function parseExplorationDestination(value){
 const text=String(value??'');
 const match=/^(.+)@(\d+)$/.exec(text);
 return {buildingId:match?match[1]:text,floor:match?Math.max(1,Math.min(20,Number(match[2]))):1};
}
export function explorationDestination(buildingId,floor=1){
 const id=String(buildingId??'');
 const level=Math.max(1,Math.min(20,Math.floor(Number(floor)||1)));
 return id+'@'+level;
}
export function buildingFloorChoices(building,{enableUpperFloors=true}={}){
 const count=Math.max(1,Math.min(10,building?.structure?.floors?.length||1));
 return Array.from({length:enableUpperFloors?count:1},(_,i)=>i+1);
}
