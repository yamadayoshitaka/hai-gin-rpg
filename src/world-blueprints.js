/**
 * Data-driven area/building/actor definitions.
 * An area is a set of typed instances. Geometry and navigation read the same
 * instance parameters; no actor or building needs a bespoke constructor.
 */
import {resolveSpiralStair,spiralStairLanding} from './spiral-staircase.js';
import {resolveBuildingEntryDoor} from './building-entry-locks.js';
const SPIRAL_STAIR={type:'spiral',x:0,zRatio:-.25,innerRadius:.65,outerRadius:3,turns:.75,steps:20,rise:2.30};
export const BUILDING_ARCHETYPES=Object.freeze({
 home:{size:[42,39],wallHeight:5.85,ceilingHeight:5.85,floors:2,stair:{...SPIRAL_STAIR}},
 manor:{size:[54,48],wallHeight:5.85,ceilingHeight:5.85,floors:2,stair:{...SPIRAL_STAIR}},
 commercial:{size:[42,39],wallHeight:5.85,ceilingHeight:5.85,floors:2,stair:{...SPIRAL_STAIR}}
});
// A building's function is data, not a separate class. Multiple capabilities
// may coexist (e.g. an inn with an item counter).
export const BUILDING_PROFILES=Object.freeze({
 home:{archetype:'home',usage:'residential',capabilities:[],interior:'residence'},
 manor:{archetype:'manor',usage:'residential',capabilities:['dialogue'],interior:'manor'},
 old:{archetype:'home',usage:'residential',capabilities:['dialogue'],interior:'residence'},
 scholar:{archetype:'home',usage:'residential',capabilities:['dialogue'],interior:'residence'},
 artisan:{archetype:'home',usage:'workshop',capabilities:['dialogue'],interior:'workshop'},
 weapons:{archetype:'commercial',usage:'retail',capabilities:['shop'],shopCategory:'weapons',interior:'weapon-shop'},
 armor:{archetype:'commercial',usage:'retail',capabilities:['shop'],shopCategory:'armor',interior:'armor-shop'},
 items:{archetype:'commercial',usage:'retail',capabilities:['shop'],shopCategory:'items',interior:'item-shop'},
 merchant:{archetype:'commercial',usage:'retail',capabilities:['shop'],shopCategory:'items',interior:'market'},
 inn:{archetype:'commercial',usage:'hospitality',capabilities:['inn'],interior:'inn'},
 church:{archetype:'commercial',usage:'community',capabilities:['dialogue'],interior:'church'}
});
export function resolveBuildingProfile(kind,overrides={}){
 const source=BUILDING_PROFILES[kind]??BUILDING_PROFILES.home;
 return {...source,...overrides,capabilities:[...(overrides.capabilities??source.capabilities)]};
}
export const GRAND_KINDS=new Set(['manor','inn','merchant']);
export const COMMERCIAL_KINDS=new Set(['weapons','armor','items','inn','merchant','church']);
export function createBuildingBlueprint({id,kind='home',position=[0,0,0],width,depth,actors=[],objects=[],attributes={},stair={},floors,floorHeight,layouts=[]}={}){
 const grand=GRAND_KINDS.has(kind);
 const profile=resolveBuildingProfile(kind,attributes);
 const base=BUILDING_ARCHETYPES[profile.archetype]??BUILDING_ARCHETYPES.home;
 const size=[width??(grand?54:base.size[0]),depth??(grand?48:base.size[1])];
 const [w,d]=size;
 const stairSpec=resolveSpiralStair({...base.stair,...stair,x:stair.x??base.stair.x,z:stair.z??d*base.stair.zRatio});
 const floorCount=floors??attributes.floors??base.floors;
 if(!Number.isInteger(floorCount)||floorCount<1||floorCount>10)throw Error('Invalid number of building floors');
 const bottom=spiralStairLanding(stairSpec,'bottom'),top=spiralStairLanding(stairSpec,'top');
 const layout={
  id:id??kind,kind,attributes:profile,position:[...position],size,layouts:structuredClone(layouts),
  entrance:{floor:1,side:'south',door:resolveBuildingEntryDoor({id:attributes.id??id??kind,kind,grade:attributes.grade,entryDoor:attributes.entryDoor})},
  wallHeight:attributes.wallHeight??base.wallHeight,ceilingHeight:attributes.ceilingHeight??base.ceilingHeight,floorHeight:floorHeight??base.ceilingHeight,
  floors:Array.from({length:floorCount},(_,index)=>({index:index+1,objects:objects.filter(o=>(o.floor??1)===index+1),actors:actors.filter(a=>(a.floor??1)===index+1)})),
  stair:{...stairSpec,bottomX:bottom.x,bottomZ:bottom.z,topX:top.x,topZ:top.z},
  zones:{corridorHalfWidth:4,dividerZ:d*.12,roomCenters:[-w*.285,w*.285].flatMap(x=>[-d*.275,d*.275].map(z=>[x,z]))}
 };
 return layout;
}
export function createAreaBlueprint({id,origin=[0,0,0],buildings=[],actors=[],objects=[]}={}){
 const linkedBuildings=buildings.map((b,i)=>{const buildingId=b.id??i;return createBuildingBlueprint({id:buildingId,...b,actors:[...(b.actors??[]),...actors.filter(a=>a.buildingId===buildingId)],objects:[...(b.objects??[]),...objects.filter(o=>o.buildingId===buildingId)]});});
 return {id,origin:[...origin],buildings:linkedBuildings,actors:actors.filter(a=>a.buildingId==null).map(a=>({...a})),objects:objects.filter(o=>o.buildingId==null).map(o=>({...o}))};
}
export function validateBlueprint(blueprint){
 const problems=[];
 if(!blueprint||!Array.isArray(blueprint.buildings))return ['Missing buildings array'];
 for(const b of blueprint.buildings){
  if(!(b.size[0]>0&&b.size[1]>0))problems.push(b.id+': invalid footprint');
  if(b.ceilingHeight<b.wallHeight)problems.push(b.id+': walls exceed ceiling');
  if(b.stair.steps<2||b.stair.run<=0||b.stair.rise<=0)problems.push(b.id+': invalid stair geometry');
  if(b.stair.type==='spiral'&&b.stair.outerRadius*2>=Math.min(...b.size)-2)problems.push(b.id+': spiral staircase exceeds footprint');
  if(b.stair.type!=='spiral'&&b.stair.width>=b.size[0])problems.push(b.id+': staircase exceeds width');
 }
 return problems;
}
