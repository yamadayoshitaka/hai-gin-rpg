/**
 * Stable grid routing for narrow rooms, doors and staircase approaches.
 * Retains the chosen path across AI ticks instead of oscillating between
 * opposite one-cell greedy moves as occupancy changes.
 * Three.js-independent so deterministic fixtures run in CI.
 */
const DIRS=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
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
 // Admissible octile metric: diagonal costs √2 times a cardinal step.
 const heuristic=(x,z)=>{const dx=Math.abs(x-goal.x),dz=Math.abs(z-goal.z);
  return dx+dz+(Math.SQRT2-2)*Math.min(dx,dz);};
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
   // Both neighboring orthogonal footprints must be free, even if the
   // diagonal destination is open; a rigid body cannot cut a wall corner.
   if(dx&&dz&&(!walkable(cur.x+dx,cur.z)||!walkable(cur.x,cur.z+dz)||
     occupied(cur.x+dx,cur.z)||occupied(cur.x,cur.z+dz)))continue;
   const k=key(x,z);
   // Consider other troops as a temporary cost rather than a wall.
   // Only the actual step reservation may reject a currently occupied tile.
   const g=cur.g+Math.hypot(dx,dz)+(occupied(x,z)?9:0);
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
 const diagonalBlocked=cell=>cell&&Math.abs(cell.x-current.x)===1&&
  Math.abs(cell.z-current.z)===1&&(!walkable(cell.x,current.z)||
   !walkable(current.x,cell.z)||occupied(cell.x,current.z)||occupied(current.x,cell.z));
 if(occupied(next.x,next.z)||diagonalBlocked(next)){
  route.blockedAt??=now;
  if(now-route.blockedAt>=waitSeconds){
   const replacement=plan();
   if(replacement){route=replacement;next=route.steps[0];}
   route.blockedAt=now;
  }
  if(occupied(next.x,next.z)||diagonalBlocked(next))return {state:route,next:null,arrived:false,blocked:true};
 }else route.blockedAt=null;
 return {state:route,next,arrived:false,blocked:false};
}


/**
 * Incremental A* for the 50v50 main-thread simulation. Planning consumes a
 * shared, explicit expansion budget instead of doing up to 8,000 nodes for
 * every soldier in a single rendered frame.
 *
 * Only the route PLANNING is spread over AI ticks. Combat, existing motion,
 * real collision checks and completed route playback remain unchanged.
 * A* frontier and parent links are retained rather than restarted each tick.
 */
function createIncrementalGridSearch(start,goal,walkable,occupied,maxExpanded){
 const heap=[],best=new Map(),parents=new Map(),points=new Map();
 const startKey=key(start.x,start.z);
 const heuristic=(x,z)=>{
  const dx=Math.abs(x-goal.x),dz=Math.abs(z-goal.z);
  return dx+dz+(Math.SQRT2-2)*Math.min(dx,dz);
 };
 const push=node=>{
  let i=heap.length;heap.push(node);
  while(i>0){const p=(i-1)>>1;if(heap[p].f<=node.f)break;heap[i]=heap[p];i=p;}
  heap[i]=node;
 };
 const pop=()=>{
  const top=heap[0],last=heap.pop();
  if(!heap.length)return top;
  let i=0;
  while(i*2+1<heap.length){
   let j=i*2+1;
   if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;
   if(last.f<=heap[j].f)break;
   heap[i]=heap[j];i=j;
  }
  heap[i]=last;return top;
 };
 best.set(startKey,0);
 push({x:start.x,z:start.z,g:0,f:heuristic(start.x,start.z)});
 let expanded=0,done=false,steps=null;
 return {
  advance(maxNodes){
   if(done)return {done,steps,expanded:0};
   let used=0;
   while(heap.length&&expanded<maxExpanded&&used<maxNodes){
    used++;expanded++;
    const cur=pop(),curKey=key(cur.x,cur.z);
    if(cur.g!==best.get(curKey))continue;
    if(equals(cur,goal)){
     steps=[];let cursor=curKey;
     while(cursor!==startKey){
      const point=points.get(cursor),from=parents.get(cursor);
      if(!point||!from){steps=null;break;}
      steps.push(point);cursor=from;
     }
     if(steps)steps.reverse();
     done=true;break;
    }
    for(const [dx,dz] of DIRS){
     const x=cur.x+dx,z=cur.z+dz;
     if(!walkable(x,z))continue;
     if(dx&&dz&&(!walkable(cur.x+dx,cur.z)||!walkable(cur.x,cur.z+dz)||
       occupied(cur.x+dx,cur.z)||occupied(cur.x,cur.z+dz)))continue;
     const k=key(x,z);
     const g=cur.g+Math.hypot(dx,dz)+(occupied(x,z)?9:0);
     if(g>=(best.get(k)??Infinity))continue;
     best.set(k,g);parents.set(k,curKey);points.set(k,{x,z});
     push({x,z,g,f:g+heuristic(x,z)});
    }
   }
   if(!heap.length||expanded>=maxExpanded)done=true;
   return {done,steps,expanded:used};
  }
 };
}
/** Budget is shared by ALL route requests in an AI tick. */
export function createGridRoutingBudget(limit=320){
 return {remaining:Math.max(0,Math.floor(limit)),expanded:0,plans:0,deferred:0};
}
export function incrementalStableGridNext(state,current,goal,{
 walkable,occupied=()=>false,now=0,waitSeconds=2,maxExpanded=8000,
 budget=createGridRoutingBudget()
}={}){
 if(!current||!goal||typeof walkable!=='function')
  return {state:null,next:null,arrived:false,blocked:true};
 if(equals(current,goal))
  return {state:null,next:null,arrived:true,blocked:false};
 let route=state;
 if(route&&(route.goalX!==goal.x||route.goalZ!==goal.z||
   (!equals(current,route.from)&&!equals(current,route.steps?.[0]))))
   route=null;
 if(route&&route.steps?.length&&equals(current,route.steps[0])){
  route.steps.shift();route.from={x:current.x,z:current.z};route.blockedAt=null;
 }
 if(!route)route={goalX:goal.x,goalZ:goal.z,from:{x:current.x,z:current.z},
  steps:[],search:null,blockedAt:null,retryAt:0};
 const plan=()=>{
  route.steps=[];route.search=createIncrementalGridSearch(
   current,goal,walkable,occupied,maxExpanded);
  route.from={x:current.x,z:current.z};route.blockedAt=null;
  budget.plans++;
 };
 if(route.search===null&&!route.steps.length&&now>=route.retryAt)plan();
 if(route.search){
  if(budget.remaining>0){
   const {done,steps,expanded}=route.search.advance(Math.min(96,budget.remaining));
   budget.remaining-=expanded;budget.expanded+=expanded;
   if(done){
    route.search=null;
    route.steps=steps??[];
    if(!steps)route.retryAt=now+1.5;
   }
  }else budget.deferred++;
  if(route.search||!route.steps.length)
   return {state:route,next:null,arrived:false,blocked:true};
 }
 if(!route.steps.length)
  return {state:route,next:null,arrived:false,blocked:true};
 const next=route.steps[0];
 const isBlocked=()=>{
  if(!walkable(next.x,next.z)||occupied(next.x,next.z))return true;
  const dx=next.x-current.x,dz=next.z-current.z;
  return Math.abs(dx)===1&&Math.abs(dz)===1&&
   (!walkable(current.x+dx,current.z)||!walkable(current.x,current.z+dz)||
    occupied(current.x+dx,current.z)||occupied(current.x,current.z+dz));
 };
 if(isBlocked()){
  route.blockedAt??=now;
  if(now-route.blockedAt>=waitSeconds&&budget.remaining>0){
   plan();
   const {done,steps,expanded}=route.search.advance(Math.min(96,budget.remaining));
   budget.remaining-=expanded;budget.expanded+=expanded;
   if(done){
    route.search=null;route.steps=steps??[];
    route.retryAt=steps?0:now+1.5;
   }
  }
  return {state:route,next:null,arrived:false,blocked:true};
 }
 route.blockedAt=null;
 return {state:route,next,arrived:false,blocked:false};
}
