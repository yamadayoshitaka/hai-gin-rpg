/**
 * Data-driven area/building/actor definitions.
 * An area is a set of typed instances. Geometry and navigation read the same
 * instance parameters; no actor or building needs a bespoke constructor.
 */
export const BUILDING_ARCHETYPES=Object.freeze({
 home:{size:[42,39],wallHeight:5.85,ceilingHeight:5.85,floors:2,stair:{x:0,zRatio:-.25,width:3,run:5.6,rise:2.30,steps:11}},
 manor:{size:[54,48],wallHeight:5.85,ceilingHeight:5.85,floors:2,stair:{x:0,zRatio:-.25,width:3,run:5.6,rise:2.30,steps:11}},
 commercial:{size:[42,39],wallHeight:5.85,ceilingHeight:5.85,floors:2,stair:{x:0,zRatio:-.25,width:3,run:5.6,rise:2.30,steps:11}}
});
export const GRAND_KINDS=new Set(['manor','inn','merchant']);
export const COMMERCIAL_KINDS=new Set(['weapons','armor','items','inn','merchant','church']);
export function createBuildingBlueprint({id,kind='home',position=[0,0,0],width,depth,actors=[],objects=[]}={}){
 const grand=GRAND_KINDS.has(kind);
 const base=BUILDING_ARCHETYPES[kind==='manor'?'manor':kind==='home'?'home':'commercial'];
 const size=[width??(grand?54:base.size[0]),depth??(grand?48:base.size[1])];
 const [w,d]=size;
 const stair={...base.stair,x:base.stair.x,z:d*base.stair.zRatio};
 const layout={
  id:id??kind,kind,position:[...position],size,
  wallHeight:base.wallHeight,ceilingHeight:base.ceilingHeight,
  floors:Array.from({length:base.floors},(_,index)=>({index:index+1,objects:objects.filter(o=>(o.floor??1)===index+1),actors:actors.filter(a=>(a.floor??1)===index+1)})),
  stair:{...stair,bottomZ:stair.z+stair.run/2+1.4,topZ:stair.z-stair.run/2-1.4},
  zones:{corridorHalfWidth:4,dividerZ:d*.12,roomCenters:[-w*.285,w*.285].flatMap(x=>[-d*.275,d*.275].map(z=>[x,z]))}
 };
 return layout;
}
export function createAreaBlueprint({id,origin=[0,0,0],buildings=[],actors=[],objects=[]}={}){
 return {id,origin:[...origin],buildings:buildings.map((b,i)=>createBuildingBlueprint({id:b.id??i,...b})),actors:actors.map(a=>({...a})),objects:objects.map(o=>({...o}))};
}
export function validateBlueprint(blueprint){
 const problems=[];
 if(!blueprint||!Array.isArray(blueprint.buildings))return ['Missing buildings array'];
 for(const b of blueprint.buildings){
  if(!(b.size[0]>0&&b.size[1]>0))problems.push(b.id+': invalid footprint');
  if(b.ceilingHeight<b.wallHeight)problems.push(b.id+': walls exceed ceiling');
  if(b.stair.steps<2||b.stair.run<=0||b.stair.rise<=0)problems.push(b.id+': invalid stair geometry');
  if(b.stair.width>=b.size[0])problems.push(b.id+': staircase exceeds width');
 }
 return problems;
}
