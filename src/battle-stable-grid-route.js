/**
 * Stable grid routing for narrow rooms, doors and staircase approaches.
 * Retains the chosen path across AI ticks instead of oscillating between
 * opposite one-cell greedy moves as occupancy changes.
 * Three.js-independent so deterministic fixtures run in CI.
 */
const DIRS=[[1,0],[0,1],[-1,0],[0,-1]];
const key=(x,z)=>x+','+z;
const equals=(a,b)=>a&&b&&a.x===b.x&&a.z===b.z;
export function sameNavigationCell(a,b){return Boolean(equals(a,b));}
export function stableGridGoalCell(world,cellSize,offset=6){
 return {x:Math.round(world.x/cellSize+offset),z:Math.round(world.z/cellSize+offset)};
}
export function findStableGridPath(start,goal,{walkable,occupied=()=>false,maxExpanded=8000}={}){
 if(!start||!goal||typeof walkable!=='function')return null;
 if(!walkable(goal.x,goal.z))return null;
 if(equals(start,goal))return [];
 const heap=[],best=new Map(),parent=new Map(),points=new Map();
 let sequence=0;
 const heuristic=(x,z)=>Math.abs(x-goal.x)+Math.abs(z-goal.z);
 const push=node=>{
  heap.push(node);let i=heap.length-1;
  while(i>0){const p=(i-1)>>1;if(heap[p].f<=node.f)break;heap[i]=heap[p];i=p;}
  heap[i]=node;
 };
 const pop=()=>{
  const top=heap[0],last=heap.pop();if(!heap.length)return top;
  let i=0;
  while(i*2+1<heap.length){
   let j=i*2+1;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;
   if(last.f<=heap[j].f)break;heap[i]=heap[j];i=j;
  }
  heap[i]=last;return top;
 };
 const startKey=key(start.x,start.z);
 best.set(startKey,0);push({x:start.x,z:start.z,g:0,f:heuristic(start.x,start.z),order:sequence++});
 let expanded=0;
 while(heap.length&&expanded++<maxExpanded){
  const cur=pop(),curKey=key(cur.x,cur.z);
  if(cur.g!==best.get(curKey))continue;
  if(equals(cur,goal)){
   const path=[];let cursor=curKey;
   while(cursor!==startKey){
    path.push(points.get(cursor));cursor=parent.get(cursor);
    if(!cursor)return null;
   }
   return path.reverse();
  }
  for(const [dx,dz] of DIRS){
   const x=cur.x+dx,z=cur.z+dz;
   if(!walkable(x,z))continue;
   const k=key(x,z);
   // Consider other troops as a temporary cost rather than a wall.
   // Only the actual step reservation may reject a currently occupied tile.
   const g=cur.g+1+(occupied(x,z)?9:0);
   if(g>=(best.get(k)??Infinity))continue;
   best.set(k,g);parent.set(k,curKey);points.set(k,{x,z});
   push({x,z,g,f:g+heuristic(x,z),order:sequence++});
  }
 }
 return null;
}
/**
 * Plan once, then keep following that route even when another soldier
 * occupies the doorway. Wait briefly before replanning around congestion;
 * do not switch to a reverse step on every frame.
 */
export function stableGridNext(state,current,goal,{
 walkable,occupied=()=>false,now=0,waitSeconds=2,maxExpanded=8000
}={}){
 if(equals(current,goal))return {state:null,next:null,arrived:true,blocked:false};
 let route=state;
 const sameGoal=route?.goalX===goal.x&&route?.goalZ===goal.z;
 if(!sameGoal||(!equals(current,route.from)&&!equals(current,route.steps?.[0]))){
  route=null;
 }
 if(route&&equals(current,route.steps?.[0])){
  route.steps.shift();
  route.from={x:current.x,z:current.z};
  route.blockedAt=null;
 }
 const plan=()=>{
  const steps=findStableGridPath(current,goal,{walkable,occupied,maxExpanded});
  return steps?{goalX:goal.x,goalZ:goal.z,from:{x:current.x,z:current.z},
   steps,blockedAt:null,createdAt:now}:null;
 };
 if(!route)route=plan();
 if(!route){
  return {state:{goalX:goal.x,goalZ:goal.z,from:{x:current.x,z:current.z},
   steps:[],blockedAt:null,retryAt:now+1.5},next:null,arrived:false,blocked:true};
 }
 if(!route.steps.length){
  if(now<(route.retryAt??0))return {state:route,next:null,arrived:false,blocked:true};
  route=plan();
  if(!route)return {state:{goalX:goal.x,goalZ:goal.z,from:{x:current.x,z:current.z},
   steps:[],blockedAt:null,retryAt:now+1.5},next:null,arrived:false,blocked:true};
 }
 let next=route.steps[0];
 if(occupied(next.x,next.z)){
  route.blockedAt??=now;
  if(now-route.blockedAt>=waitSeconds){
   const replacement=plan();
   if(replacement){route=replacement;next=route.steps[0];}
   route.blockedAt=now;
  }
  if(occupied(next.x,next.z))return {state:route,next:null,arrived:false,blocked:true};
 }else route.blockedAt=null;
 return {state:route,next,arrived:false,blocked:false};
}
