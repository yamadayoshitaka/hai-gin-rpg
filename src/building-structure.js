import {createSpiralStairPlan} from './spiral-staircase.js';
import {resolveBuildingEntryDoor} from './building-entry-locks.js';
// A town may contain hundreds of houses. Identical stairs share two baked meshes.
const SPIRAL_GEOMETRY_CACHE=new Map();

/** Physical floor/entrance/stair BOM shared by tactical catalogue and previews. */
export function createCatalogBuildingStructure(building,{cellSize=2.2}={}){
 const id=building.id;
 const isCastle=id==='castle_001';
 const isHut=id==='stone_hut_001';
 const isManor=id.startsWith('manor_');
 const floorCount=isCastle?3:2;
 const heightCells=isCastle?18:isHut?5:isManor?7.5:id==='church_001'?7:5.5;
 const floorHeight=heightCells/floorCount*cellSize;
 const width=building.widthCells*cellSize,depth=building.depthCells*cellSize;
 const outerRadius=Math.min((isCastle?5:isHut?2.2:isManor?2:1.6)*cellSize,(Math.min(width,depth)-2*cellSize)/3);
 const innerRadius=outerRadius*.24;
 const stair={type:'spiral',x:(isCastle?0.19:isHut?0.20:0.25)*width,z:-depth*.16,
  innerRadius,outerRadius,steps:Math.ceil(floorHeight/.24),turns:.75,rise:floorHeight,startAngle:Math.PI/2,clockwise:true};
 const stairs=createSpiralStairPlan(stair,{floors:floorCount,floorY:0});
 const floors=Array.from({length:floorCount},(_,i)=>({
  index:i+1,baseY:i*floorHeight,height:floorHeight,
  footprint:{width,depth},stairOpening:i>0?{...stairs.opening}:null
 }));
 return {id,kind:'building',floors,stair:stairs,
  entrance:{side:'south',floor:1,door:resolveBuildingEntryDoor(building)},
  collision:{walls:true,stairs:true,door:true},
  material:isCastle||isHut||isManor?'stone':'wood'};
}

/** Turn reusable step data into 3D wedges, centre post and outer handrail. */
export function renderSpiralStairBOM(THREE,parent,structure,{mergeGeometries=null,material=null}={}){
 const plan=structure?.stair??structure;
 if(plan?.type!=='spiral')throw Error('A spiral stair BOM is required');
 const group=new THREE.Group();group.name='spiral_staircase';parent.add(group);
 const s=plan.stair;
 const treadMaterial=material??new THREE.MeshStandardMaterial({color:0x8b7966,roughness:.8});
 const metal=new THREE.MeshStandardMaterial({color:0x4b4340,metalness:.55,roughness:.46});
 const geometries=[];
 const rails=[];
 const cacheKey=mergeGeometries?JSON.stringify([s.x,s.z,s.innerRadius,s.outerRadius,s.steps,s.turns,s.rise,s.startAngle,s.clockwise,plan.floors]):null;
 const cached=cacheKey?SPIRAL_GEOMETRY_CACHE.get(cacheKey):null;
 const treadThickness=Math.min(.24,s.rise/s.steps*.65);
 if(!cached)for(const flight of plan.flights)for(const step of flight.steps){
  const sweep=step.endAngle-step.startAngle;
  const shape=new THREE.Shape();
  const point=(r,t)=>[r*Math.cos(t),r*Math.sin(t)];
  shape.moveTo(...point(s.outerRadius,step.startAngle));
  for(let j=1;j<=5;j++)shape.lineTo(...point(s.outerRadius,step.startAngle+sweep*j/5));
  shape.lineTo(...point(s.innerRadius,step.endAngle));
  for(let j=4;j>=0;j--)shape.lineTo(...point(s.innerRadius,step.startAngle+sweep*j/5));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:treadThickness,bevelEnabled:false,curveSegments:5});
  geometry.rotateX(Math.PI/2);
  geometry.translate(s.x,step.top+(flight.fromFloor-1)*s.rise,s.z);
  geometries.push(geometry);
  if(step.index%2===0){
   const a=step.middleAngle;
   const x=s.x+s.outerRadius*Math.cos(a),z=s.z+s.outerRadius*Math.sin(a);
   const post=new THREE.CylinderGeometry(.05,.06,.85,6);
   post.translate(x,step.top+(flight.fromFloor-1)*s.rise+.38,z);rails.push(post);
  }
 }
 const attach=(geos,mat,name,shared)=>{
  if(shared){const mesh=new THREE.Mesh(shared,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return shared;}
  if(!geos.length)return null;
  const merged=mergeGeometries?.(geos,false);
  if(merged){geos.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return merged;}
  geos.forEach((geo,i)=>{const mesh=new THREE.Mesh(geo,mat);mesh.name=name+':'+i;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);});
  return null;
 };
 const treads=attach(geometries,treadMaterial,'spiral_treads',cached?.treads);
 const balusters=attach(rails,metal,'spiral_balusters',cached?.balusters);
 if(cacheKey&&!cached&&treads&&balusters)SPIRAL_GEOMETRY_CACHE.set(cacheKey,{treads,balusters});
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(s.innerRadius*.85,s.innerRadius*.85,s.rise*(plan.floors-1)+.8,12),metal);
 pole.name='spiral_center_post';pole.position.set(s.x,s.rise*(plan.floors-1)/2,s.z);pole.castShadow=true;group.add(pole);
 group.userData.stairBOM=plan;
 return group;
}

export function renderCatalogBuildingStructure(THREE,root,structure,{mergeGeometries=null}={}){
 const stairs=renderSpiralStairBOM(THREE,root,structure,{mergeGeometries});
 // Upper decks are retained in the BOM, but hidden in the tactical camera:
 // otherwise the castle would conceal every soldier fighting downstairs.
 const decks=new THREE.Group();decks.name='interior_upper_floor_decks';decks.visible=false;root.add(decks);
 const stone=new THREE.MeshStandardMaterial({color:0xb3aa9b,roughness:.9});
 for(const floor of structure.floors.slice(1)){
  const {width,depth}=floor.footprint,{x,z}=floor.stairOpening;
  const halfHole=floor.stairOpening.width/2;
  const west=x-halfHole,east=x+halfHole,north=z-halfHole,south=z+halfHole;
  const rectangles=[
   [-width/2,-depth/2,Math.max(.1,west+width/2),depth],
   [east,-depth/2,Math.max(.1,width/2-east),depth],
   [west,-depth/2,Math.max(.1,east-west),Math.max(.1,north+depth/2)],
   [west,south,Math.max(.1,east-west),Math.max(.1,depth/2-south)]
  ];
  for(const [left,back,w,d] of rectangles){
   if(w<=.1||d<=.1)continue;
   const slab=new THREE.Mesh(new THREE.BoxGeometry(w,.20,d),stone);
   slab.position.set(left+w/2,floor.baseY,back+d/2);
   slab.name='floor_'+floor.index+'_slab';slab.castShadow=true;slab.receiveShadow=true;decks.add(slab);
  }
 }
 root.userData.structure=structure;
 root.userData.entryDoor=structure.entrance.door;
 root.userData.floorCount=structure.floors.length;
 return {stairs,decks};
}
