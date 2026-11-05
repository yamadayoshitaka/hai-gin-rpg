import {createSpiralStairPlan} from './spiral-staircase.js';
import {resolveBuildingEntryDoor} from './building-entry-locks.js';
import {createCastleUpperRoomPlan} from './castle-upper-rooms.js?v=castle-interior-44';
// A town may contain hundreds of houses. Identical stairs share two baked meshes.
const SPIRAL_GEOMETRY_CACHE=new Map();

/** Physical floor/entrance/stair BOM shared by tactical catalogue and previews. */
export function createCatalogBuildingStructure(building,{cellSize=2.2}={}){
 const id=building.id;
 const isCastle=id==='castle_001';
 const isHut=id==='stone_hut_001';
 const isManor=id.startsWith('manor_');
 const floorCount=isCastle?3:2;
 const heightCells=isCastle?18:isHut?5:isManor?
  (id==='manor_merchant_001'?7:id==='manor_garden_001'?8:7.5):id==='church_001'?7:5.5;
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
  if(shared){const mesh=new THREE.Mesh(shared,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.sharedGeometry=true;group.add(mesh);return shared;}
  if(!geos.length)return null;
  const merged=mergeGeometries?.(geos,false);
  if(merged){geos.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.sharedGeometry=Boolean(cacheKey);group.add(mesh);return merged;}
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

/** Renderable architectural BOM for inhabited upper floors. Furniture is
 * deliberately located away from the spiral opening; the floor is walkable.
 * All box primitives are batched by surface rather than left as separate
 * hundreds of draw calls on a town of repeated houses.
 */
export function createUpperFloorDecorationPlan(structure){
 const id=structure.id,castle=id==='castle_001',church=id==='church_001';
 const inn=id==='inn_001',manor=id.startsWith('manor_');
 const hut=id==='stone_hut_001';
 const theme=castle?'royal':church?'sanctuary':inn?'guest':manor?'estate':hut?'loft':'home';
 const s=structure.stair.stair,plans=[];
 const castleUpperRooms=castle?createCastleUpperRoomPlan(structure):[];
 for(const floor of (castle?structure.floors:structure.floors.slice(1))){
  const {width:w,depth:d}=floor.footprint,y=floor.baseY;
  const parts=[];
  const add=(name,material,width,height,depth,x,cy,z)=>parts.push({name,material,width,height,depth,x,y:cy,z});
  const clear=(x,z,ww,dd)=>Math.abs(x)+ww/2<w/2-.5&&Math.abs(z)+dd/2<d/2-.5&&
   Math.hypot(x-s.x,z-s.z)>s.outerRadius+Math.hypot(ww,dd)*.5+1;
  const place=(name,material,ww,hh,dd,x,cy,z)=>{if(clear(x,z,ww,dd))add(name,material,ww,hh,dd,x,cy,z)};
  const scale=Math.max(.75,Math.min(1.45,Math.min(w,d)/23));
  const bench=(x,z)=>{
   const t=scale;
   place('bench_seat','wood',2.25*t,.19*t,.67*t,x,y+.65*t,z);
   for(const sx of [-.75,.75])place('bench_leg','timber',.18*t,.64*t,.18*t,x+sx*t,y+.30*t,z);
   place('bench_back','wood',2.24*t,.79*t,.16*t,x,y+1.0*t,z-.32*t);
  };
  const table=(x,z)=>{
   const t=scale;
   place('table_top','wood',2.8*t,.19*t,1.6*t,x,y+1.17*t,z);
   for(const sx of [-1,1])for(const sz of [-1,1])
    place('table_leg','timber',.2*t,1.14*t,.2*t,x+sx*1.06*t,y+.55*t,z+sz*.53*t);
   place('table_inlay','metal',1.85*t,.035*t,.9*t,x,y+1.29*t,z);
  };
  const shelf=(x,z)=>{
   const t=scale;
   for(const level of [0,.9,1.8])place('shelf','wood',2.35*t,.18*t,.62*t,x,y+(.38+level)*t,z);
   for(const side of [-1,1])place('shelf_post','timber',.16*t,2.45*t,.63*t,x+side*1.1*t,y+1.3*t,z);
   for(let n=0;n<7;n++)place('book','textile',.12*t,.46*t,.42*t,x+(n-3)*.28*t,y+1.15*t,z);
  };
  const bed=(x,z)=>{
   const t=scale;
   place('bed_frame','timber',2.4*t,.35*t,3.1*t,x,y+.39*t,z);
   place('mattress','linen',2.1*t,.22*t,2.85*t,x,y+.64*t,z);
   place('pillow','linen',1.65*t,.23*t,.47*t,x,y+.81*t,z-1.06*t);
   place('blanket','textile',2.18*t,.08*t,1.55*t,x,y+.80*t,z+.52*t);
   place('headboard','wood',2.5*t,1.48*t,.24*t,x,y+.97*t,z-1.57*t);
  };
  const lantern=(x,z)=>{
   const t=scale;
   place('lamp_pedestal','metal',.19*t,1.25*t,.19*t,x,y+.68*t,z);
   place('lamp_glass','glow',.34*t,.58*t,.34*t,x,y+1.62*t,z);
   place('lamp_cap','metal',.53*t,.13*t,.53*t,x,y+1.98*t,z);
  };
  // Stairwell rim receives masonry balustrades on three sides. Leave the
  // south landing free; characters can approach the next spiral flight.
  const r=s.outerRadius+1.7,railY=y+.85;
  // Only the outside of the opening is guarded. The west side contains the
  // spiral's arrival and departure landing; enclosing it would trap soldiers.
  add('stair_guardrail','metal',.15,.15,r*1.66,s.x+r,railY+.35,s.z-.4);
  for(let n=-3;n<=3;n++)add('stair_baluster','metal',.13,1.03,.13,s.x+r,y+.5,s.z+n*r*.25);
  add('stair_guardrail','metal',r*2.1,.15,.15,s.x,railY+.35,s.z-r);
  // Exposed beams and trim add depth to upper-floor ceilings without sealing
  // the actual stair opening or inventing a fourth floor.
  for(const off of [-2.8,2.8]){
   const xx=s.x-r-2.8+off;
   if(Math.abs(xx)<w/2-1)add('ceiling_beam','timber',.29,.32,Math.min(d*.56,13),xx,y+floor.height*.83,s.z);
  }
  const leftX=-w*.27,farZ=-d*.25,nearZ=d*.22;
  // Every floor gets a lived-in perimeter with repeatable furnishing motifs.
  table(leftX,farZ);bench(leftX,nearZ);shelf(-w*.30,-d*.36);
  lantern(s.x-r-3.2,s.z+r+3.2);
  lantern(-w*.32,d*.34);
  if(theme==='royal'){
   for(const n of [-1,0,1]){
    const x=s.x-r-8-n*4,z=s.z+(n+1)*4.3;
    table(x,z);bench(x,z+2.5);
    place('royal_carpet','textile',2.5*scale,.055,3.6*scale,x,y+.16,z);
   }
   for(const n of [-1,1]){
    const x=s.x-r-8+n*5,z=s.z-r-6;
    add('castle_banner','textile',2.2*scale,3.1*scale,.10,x,y+floor.height*.6,z);
    add('banner_trim','gold',2.3*scale,.20,.17,x,y+floor.height*.85,z);
   }
   // Third storey is a command/throne chamber; second storey a guard gallery.
   if(floor.index===3){
    place('throne','gold',2.6*scale,2.8*scale,.75*scale,s.x-r-8,y+1.55*scale,s.z-r-10);
    place('throne_cushion','textile',2.1*scale,.36*scale,1.4*scale,s.x-r-8,y+.78*scale,s.z-r-9.7);
   }else for(const n of [-1,1])
    place('weapon_rack','metal',.36*scale,2.6*scale,2.5*scale,s.x-r-8+n*5,y+1.4*scale,s.z+r+5);
  }else if(theme==='sanctuary'){
   place('choir_rail','gold',5*scale,.9*scale,.18*scale,leftX,y+.65*scale,nearZ);
   for(const n of [-1,0,1])bench(leftX+n*2.3*scale,nearZ-2.1*scale);
   place('altar','stone',3.1*scale,1.5*scale,1.35*scale,-w*.27,y+.87*scale,farZ+3);
  }else if(theme==='guest'||theme==='estate'){
   bed(leftX,nearZ-2.6*scale);bed(-w*.19,farZ+2.5*scale);
   place('rug','textile',3*scale,.06,2*scale,leftX,y+.17,nearZ);
  }else{
   bed(leftX,nearZ-2.3*scale);
   place('woven_rug','textile',3.4*scale,.055,2*scale,leftX,y+.18,farZ+3);
   shelf(-w*.23,d*.32);
  }
  const architecture=castleUpperRooms.find(item=>item.floor===floor.index);
  if(architecture)parts.push(...architecture.parts);
  const loot=createUpperFloorLootPlan(structure).find(item=>item.floor===floor.index);
  if(loot){
   const {x,z}=loot;
   // The chest is an actual visible world item. Collected chests can be
   // hidden independently without rebuilding the batched furniture geometry.
   parts.push({name:'loot_marker',material:'gold',width:.08,height:.08,depth:.08,x,y:y-.2,z});
  }
  plans.push({floor:floor.index,theme,parts,rooms:architecture?.rooms??[]});
 }
 return plans;
}

/** A physical pickup on each upper floor, placed beyond the spiral landing.
 * Local coordinates and IDs remain stable across scene reloads and LODs.
 */
export function createUpperFloorLootPlan(structure){
 const s=structure.stair.stair;
 const angle=s.startAngle+(s.clockwise?-1:1)*s.turns*2*Math.PI;
 const distance=s.outerRadius+2.65;
 return structure.floors.slice(1).map(floor=>({
  id:structure.id+':floor-'+floor.index,buildingId:structure.id,
  floor:floor.index,x:s.x+Math.cos(angle)*distance,
  y:floor.baseY,z:s.z+Math.sin(angle)*distance,
  item:floor.index===3?'王城の宝石':structure.id==='castle_001'?'守備兵の補給品':'回復薬',quantity:1
 }));
}

function renderUpperFloorDecorations(THREE,root,structure,{mergeGeometries=null}={}){
 const group=new THREE.Group();group.name='interior_upper_floor_furnishings';group.visible=false;root.add(group);
 const groundGroup=new THREE.Group();groundGroup.name='interior_ground_floor_furnishings';groundGroup.visible=false;root.add(groundGroup);
 const palette={
  timber:[0x4b3429,.89],wood:[0x946f4d,.84],stone:[0x938e83,.95],
  metal:[0x565c64,.48],gold:[0xc29c53,.44],textile:[0x743f4b,.98],
  linen:[0xe0c9a7,.95],glow:[0xffd597,.24],
  plaster:[0xb6a998,.90],marble:[0xf3e4c9,.38],royalVelvet:[0x6e1335,.80]
 };
 const materials=Object.fromEntries(Object.entries(palette).map(([key,[color,roughness]])=>
  [key,new THREE.MeshStandardMaterial({color,roughness,metalness:key==='metal'?.46:key==='gold'?.36:0,
   emissive:key==='glow'?0xffa740:0x000000,emissiveIntensity:key==='glow'?.7:0})]));
 const plans=createUpperFloorDecorationPlan(structure);
 for(const plan of plans){
  const floor=new THREE.Group();floor.name='floor_'+plan.floor+'_details';floor.userData.partCount=plan.parts.length;
  (plan.floor===1?groundGroup:group).add(floor);
  const batches=new Map();
  for(const part of plan.parts){
   let geo;
   if(part.shape==='cylinder')geo=new THREE.CylinderGeometry(part.width*.5,part.depth*.5,part.height,12);
   else if(part.shape==='cone')geo=new THREE.ConeGeometry(part.width*.5,part.height,12);
   else if(part.shape==='sphere'){
    geo=new THREE.SphereGeometry(part.width*.5,12,8);
    geo.scale(1,part.height/part.width,part.depth/part.width);
   }else geo=new THREE.BoxGeometry(part.width,part.height,part.depth);
   geo.translate(part.x,part.y,part.z);
   if(!batches.has(part.material))batches.set(part.material,[]);
   batches.get(part.material).push(geo);
  }
  for(const [material,geometries] of batches){
   const merged=mergeGeometries?.(geometries,false);
   if(merged){geometries.forEach(g=>g.dispose());const mesh=new THREE.Mesh(merged,materials[material]);mesh.name='floor_'+plan.floor+'_'+material+'_furnishings';mesh.castShadow=true;mesh.receiveShadow=true;floor.add(mesh);}
   else for(const geo of geometries){const mesh=new THREE.Mesh(geo,materials[material]);mesh.castShadow=true;mesh.receiveShadow=true;floor.add(mesh)}
  }
 }
 const lootGroup=new THREE.Group();lootGroup.name='upper_floor_loot';group.add(lootGroup);
 const chestWood=new THREE.MeshStandardMaterial({color:0x704b30,roughness:.82});
 const chestMetal=new THREE.MeshStandardMaterial({color:0xd1ad53,metalness:.56,roughness:.44});
 for(const loot of createUpperFloorLootPlan(structure)){
  const chest=new THREE.Group();chest.name='loot_floor_'+loot.floor;chest.userData.loot=loot;
  lootGroup.add(chest);chest.position.set(loot.x,loot.y,loot.z);
  for(const [w,h,d,x,y,z,mat] of [[1.4,.65,.95,0,.36,0,chestWood],
   [1.46,.2,1.02,0,.80,0,chestWood],[.16,.9,1.06,0,.43,0,chestMetal],
   [1.52,.12,.13,0,.78,.42,chestMetal]]){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);
   mesh.castShadow=true;mesh.receiveShadow=true;chest.add(mesh);
  }
 }
 root.userData.upperFloorDecorations=plans.map(p=>({floor:p.floor,theme:p.theme,partCount:p.parts.length}));
 root.userData.upperFloorRooms=plans.map(p=>({floor:p.floor,rooms:p.rooms.map(room=>({
  id:room.id,name:room.label,kind:room.kind,bounds:room.bounds,door:room.door
 }))}));
 root.userData.groundFloorRooms=plans.find(p=>p.floor===1)?.rooms??[];
 root.userData.upperFloorLoot=createUpperFloorLootPlan(structure);
 return group;
}

export function renderCatalogBuildingStructure(THREE,root,structure,{mergeGeometries=null,floorMaterials=null}={}){
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
   const geometry=new THREE.BoxGeometry(w,.20,d);
   const uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal'),position=geometry.getAttribute('position');
   const unit=floor.index===3?3.0:3.6;
   // World-aligned tile coordinates prevent a castle-sized roof from showing
   // one gigantic stretched stone slab. The same 1k PBR texture is repeated.
   for(let i=0;i<uv.count;i++)if(Math.abs(normal.getY(i))>.5)
    uv.setXY(i,(left+w/2+position.getX(i))/unit,(back+d/2+position.getZ(i))/unit);
   uv.needsUpdate=true;
   const floorMaterial=floorMaterials?.[floor.index]??stone;
   const slab=new THREE.Mesh(geometry,floorMaterial);
   slab.position.set(left+w/2,floor.baseY,back+d/2);
   slab.name='floor_'+floor.index+'_slab';slab.castShadow=true;slab.receiveShadow=true;
   slab.userData.surface={floor:floor.index,uvTileMetres:unit,pbr:Boolean(floorMaterial.map)};
   decks.add(slab);
  }
 }
 const furnishings=renderUpperFloorDecorations(THREE,root,structure,{mergeGeometries});
 root.userData.structure=structure;
 root.userData.entryDoor=structure.entrance.door;
 root.userData.floorCount=structure.floors.length;
 root.userData.upperFloorSurfaces=structure.floors.slice(1).map(f=>({
  floor:f.index,material:f.index===3?'royal-polished-stone':'sandstone-tiles',uvTileMetres:f.index===3?3:3.6
 }));
 return {stairs,decks,furnishings};
}
