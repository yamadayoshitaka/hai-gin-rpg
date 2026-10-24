import {compileWallModules} from './wall-plan-compiler.js';
/** Canonical floor plan: segments with shared geometry/collision dimensions. */
export function createFloorArchitecture({buildingId,width,depth,stair,floor,usage='home',wallHeight=5.85}){
 if(!Number.isFinite(wallHeight)||wallHeight<=0)throw Error('Invalid wall height');
 if(!(width>8&&depth>8))throw Error('Invalid floor footprint');
 const w=width,d=depth,t=.32,x=w/2-.35,z=d/2-.35;
 const segments=[];
 const line=(id,ax,az,bx,bz,openings=[])=>segments.push({id,from:[ax,az],to:[bx,bz],thickness:t,height:wallHeight,openings});
 const door={id:'entry',offset:0,width:4.4};
 line('north',-x,-z,x,-z);
 line('west',-x,-z,-x,z);
 line('east',x,-z,x,z);
 line('south',-x,z,x,z,floor===1?[door]:[]);
 const center=usage==='castle'?-d*.13:-d*.12;
 if(usage!=='castle'){
  const hall=3.8;
  line('rear-division',-x,center,x,center,[{id:'hallway',offset:0,width:hall*2}]);
  // Doorway gaps break each wing; they are never rendered as continuous crossing bars.
  for(const side of [-1,1]){
   const xx=side*w*.34;
   line('side-'+side,xx,-z+.4,xx,z-.4,[{id:'room-door-'+side,offset:d*.11,width:3.5}]);
  }
 }else{
  for(const side of [-1,1]){
   const xx=side*w*.36;
   line('royal-wing-'+side,xx,-z+.5,xx,z-.5,[{id:'royal-hall-'+side,offset:0,width:5.0}]);
  }
 }
 const walls=[];
 for(const segment of segments){
  const [ax,az]=segment.from,[bx,bz]=segment.to;
  const length=Math.hypot(bx-ax,bz-az);
  if(length<.1)throw Error('Zero-length wall: '+segment.id);
  const sorted=segment.openings.map(o=>({...o,start:length/2+o.offset-o.width/2,end:length/2+o.offset+o.width/2})).sort((a,b)=>a.start-b.start);
  let cursor=0,index=0;
  for(const gap of [...sorted,{start:length,end:length}]){
   if(gap.start<cursor-.001||gap.start<0||gap.end>length+.001)throw Error('Overlapping/invalid opening: '+segment.id);
   if(gap.start-cursor>.15){
    const a=cursor,b=gap.start,mid=(a+b)/2/length;
    const cx=ax+(bx-ax)*mid,cz=az+(bz-az)*mid;
    const horizontal=Math.abs(bx-ax)>=Math.abs(bz-az);
    const wall={id:segment.id+':'+index++,segmentId:segment.id,x:cx,z:cz,w:horizontal?b-a:t,d:horizontal?t:b-a,height:segment.height,baseY:0,collision:true};
    walls.push(wall);
   }
   cursor=gap.end;
  }
 }
 const wallModules=compileWallModules(segments,{areaId:buildingId+':floor:'+floor,wallHeight});
 return {id:buildingId+':floor:'+floor,floor,wallHeight,segments,walls:wallModules.map(m=>({...m.collision,id:m.id,segmentId:m.segmentId,height:m.size[1],baseY:0,collision:true})),wallModules,floorSurface:{size:[w-.45,d-.45],material:floor===1?'stone-tile':'timber'},stair:stair?{...stair,portalId:buildingId+':'+(floor===1?'upstairs':'downstairs')}:null};
}
