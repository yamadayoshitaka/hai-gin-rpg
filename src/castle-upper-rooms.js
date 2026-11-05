/** Pure, reusable architectural BOM for the two occupied upper castle floors.
 * Coordinates are local metres. A wall is made from ordinary solid modules;
 * each doorway is a genuine gap rather than a transparent decal.
 */
const ROOM_NAMES_2=['兵舎','武器庫','軍議室','書庫','医務室','食堂','備蓄室','訓練室','警備室','客室'];
const ROOM_NAMES_3=['王族の居室','貴賓室','宝物庫','衣装室','宮廷書庫','侍従室','礼拝室','貴族客室'];

export function createCastleUpperRoomPlan(structure){
 if(structure?.id!=='castle_001')return [];
 const {width,depth}=structure.floors[0].footprint;
 const sx=width/220,sz=depth/220;
 const xs=[[-102,-58],[-48,-8],[8,48],[58,102]].map(([a,b])=>[a*sx,b*sx]);
 const zs=[[-102,-58],[-48,-8],[8,48],[58,102]].map(([a,b])=>[a*sz,b*sz]);
 const stair=structure.stair.stair;
 const results=[];

 for(const floor of structure.floors.slice(1)){
  const y=floor.baseY,wallHeight=Math.min(7.3,floor.height*.65);
  const wallThickness=.38,doorHeight=3.5,doorWidth=3.8;
  const rooms=[],parts=[],uniqueWalls=new Set();
  const add=(name,material,w,h,d,x,cy,z,shape='box')=>{
   if(w<=0||h<=0||d<=0)return;
   parts.push({name,material,width:w,height:h,depth:d,x,y:cy,z,shape});
  };
  const column=(x,z,h=6.3,royal=false)=>{
   add('fluted_column',royal?'marble':'stone',1.5,h,1.5,x,y+h/2,z,'cylinder');
   add('column_base',royal?'gold':'stone',2.2,.38,2.2,x,y+.20,z);
   add('column_capital',royal?'gold':'stone',2.25,.45,2.25,x,y+h+.12,z);
  };
  const wall=(axis,min,max,fixed,door=false,gapWidth=doorWidth)=>{
   const key=[axis,min.toFixed(3),max.toFixed(3),fixed.toFixed(3)].join(':');
   if(uniqueWalls.has(key))return;
   uniqueWalls.add(key);
   const length=max-min,center=(max+min)/2;
   const solid=(a,b,cy,hh)=>{
    if(b-a<.08)return;
    if(axis==='x')add('room_stone_wall','plaster',b-a,hh,wallThickness,(a+b)/2,cy,fixed);
    else add('room_stone_wall','plaster',wallThickness,hh,b-a,fixed,cy,(a+b)/2);
   };
   if(!door){solid(min,max,y+wallHeight/2,wallHeight);return}
   const gap=Math.min(gapWidth,length*.30),left=center-gap/2,right=center+gap/2;
   solid(min,left,y+wallHeight/2,wallHeight);
   solid(right,max,y+wallHeight/2,wallHeight);
   solid(left,right,y+doorHeight+(wallHeight-doorHeight)/2,wallHeight-doorHeight);
   if(axis==='x'){
    for(const x of [left,right])add('door_jamb','timber',.24,doorHeight,.48,x,y+doorHeight/2,fixed);
    add('door_lintel','gold',gap+.6,.22,.6,center,y+doorHeight+.12,fixed);
   }else{
    for(const z of [left,right])add('door_jamb','timber',.48,doorHeight,.24,fixed,y+doorHeight/2,z);
    add('door_lintel','gold',.6,.22,gap+.6,fixed,y+doorHeight+.12,center);
   }
  };
  const furniture=(room)=>{
   const {minX,maxX,minZ,maxZ}=room.bounds;
   const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,
    halfW=(maxX-minX)/2,halfD=(maxZ-minZ)/2;
   const types=room.kind;
   const shelf=(x,z)=>{
    for(const level of [0,1,2])add('cabinet_shelf','timber',3.9,.19,.82,x,y+(.58+level*.92),z);
    for(const edge of [-1,1])add('cabinet_post','wood',.20,3.2,.82,x+edge*1.85,y+1.65,z);
    for(let k=0;k<13;k++)add('stored_book','textile',.12,.6,.42,x+(k-6)*.27,y+1.53,z);
   };
   const bed=(x,z)=>{
    add('regal_bed_frame','timber',3.4,.5,5.3,x,y+.45,z);
    add('regal_mattress','linen',3.08,.28,4.92,x,y+.82,z);
    add('bed_cover','royalVelvet',3.13,.11,2.5,x,y+1.03,z+.76);
    add('bed_headboard','gold',3.5,2.0,.30,x,y+1.25,z-2.55);
   };
   const table=(x,z)=>{
    add('carved_table_top','wood',4.2,.26,2.4,x,y+1.30,z);
    for(const dx of [-1.6,1.6])for(const dz of [-.85,.85])
     add('table_support','timber',.22,1.24,.22,x+dx,y+.63,z+dz);
    add('ceremonial_candles','glow',.25,.72,.25,x,y+1.80,z);
   };
   // Each chamber has an entrance aisle along its central axis, with its
   // usable furniture set back from the doorway.
   for(const side of [-1,1]){
    add('wall_tapestry',floor.index===3?'royalVelvet':'textile',2.8,3.1,.10,
     cx+side*halfW*.63,y+3.9,minZ+.32);
    add('wall_tapestry_hem','gold',2.9,.16,.12,cx+side*halfW*.63,y+5.5,minZ+.38);
   }
   for(const x of [cx-halfW*.64,cx+halfW*.64]){
    if(['兵舎','客室','王族の居室','貴賓室','貴族客室','医務室'].includes(types))bed(x,cz-halfD*.28);
    else if(['書庫','宮廷書庫','武器庫','備蓄室','衣装室','宝物庫'].includes(types))shelf(x,cz-halfD*.48);
    else table(x,cz-halfD*.30);
   }
   if(['軍議室','食堂','礼拝室','侍従室'].includes(types))table(cx,cz+halfD*.12);
   if(['武器庫','警備室','訓練室'].includes(types))for(const x of [cx-halfW*.58,cx+halfW*.58]){
    add('armory_rack','metal',.25,3.2,3.4,x,y+1.75,cz+halfD*.24);
    add('armory_spear','metal',.13,3.45,.13,x+.43,y+1.84,cz+halfD*.24,'cylinder');
   }
   if(['王族の居室','貴賓室','宝物庫'].includes(types)){
    add('chamber_rug','royalVelvet',Math.min(8,halfW*1.2),.065,Math.min(10,halfD*.95),cx,y+.16,cz);
    for(const side of [-1,1])add('rug_golden_border','gold',.13,.07,Math.min(10,halfD*.95),
     cx+side*Math.min(4,halfW*.6),y+.22,cz);
   }
   add('wall_candle_holder','gold',.28,.9,.25,cx,y+3,minZ+.54);
   add('wall_candle_flame','glow',.21,.40,.22,cx,y+3.68,minZ+.59);
  };

  let number=0;
  for(let zi=0;zi<zs.length;zi++)for(let xi=0;xi<xs.length;xi++){
   const [xMin,xMax]=xs[xi], [minZ,maxZ]=zs[zi];
   const midpoint=(xMin+xMax)/2;
   for(let half=0;half<2;half++){
    const minX=half===0?xMin:midpoint,maxX=half===0?midpoint:xMax;
    const nearestX=Math.max(minX,Math.min(maxX,stair.x));
    const nearestZ=Math.max(minZ,Math.min(maxZ,stair.z));
    const nearStair=Math.hypot(nearestX-stair.x,nearestZ-stair.z)<stair.outerRadius+5.3;
    const royalHall=floor.index===3&&minX<56*sx&&maxX>-56*sx&&minZ<56*sz&&maxZ>-56*sz;
    if(nearStair||royalHall)continue;
    const kind=(floor.index===2?ROOM_NAMES_2:ROOM_NAMES_3)[number%(floor.index===2?ROOM_NAMES_2.length:ROOM_NAMES_3.length)];
    const room={id:'castle-'+floor.index+'f-room-'+(++number),floor:floor.index,label:kind,kind,
     bounds:{minX,maxX,minZ,maxZ},door:{side:minZ<0?'south':'north',width:doorWidth}};
    rooms.push(room);
    const entranceNorth=room.door.side==='north';
    wall('x',minX,maxX,minZ,entranceNorth);
    wall('x',minX,maxX,maxZ,!entranceNorth);
    wall('z',minZ,maxZ,minX);
    wall('z',minZ,maxZ,maxX);
    furniture(room);
   }
  }

  if(floor.index===2){
   // The north/south and east/west open corridors join all wings to the
   // spiral atrium. Decorative floor strips visibly distinguish the route.
   for(const x of [-53,-3,53])add('hallway_runner','textile',2.0,.055,depth*.78,x*sx,y+.15,0);
   for(const z of [-53,-3,53])add('hallway_runner','textile',width*.78,.055,2.0,0,y+.15,z*sz);
   for(const [x,z] of [[-55,-55],[-55,55],[55,-55],[55,55]])column(x*sx,z*sz,6.8);
  }else{
   // A grand open audience hall, four working archways and a raised royal
   // dais. The throne faces the long carpeted approach from the south.
   const hallX=55*sx,hallZ=55*sz;
   const frontDoor=10;
   for(const z of [-hallZ,hallZ])wall('x',-hallX,hallX,z,true,frontDoor);
   for(const x of [-hallX,hallX])wall('z',-hallZ,hallZ,x,true,7);
   rooms.push({id:'castle-3f-royal-audience',floor:3,label:'王の謁見の間',kind:'royalAudience',
    bounds:{minX:-hallX,maxX:hallX,minZ:-hallZ,maxZ:hallZ},
    door:{side:'south',width:frontDoor}});
   const aisle=Math.min(10,hallX*.2),carpetLength=hallZ*1.75;
   add('royal_audience_carpet','royalVelvet',aisle,.075,carpetLength,0,y+.17,0);
   for(const x of [-aisle/2+.16,aisle/2-.16])add('royal_carpet_border','gold',.22,.080,carpetLength,x,y+.22,0);
   for(let step=-5;step<=5;step++)add('royal_carpet_crest','gold',4.2,.085,.30,0,y+.23,step*7.5*sz);
   const throneZ=-hallZ+12*sz;
   add('royal_dais_lower','marble',22,.55,13,0,y+.38,throneZ);
   add('royal_dais_upper','marble',15,.50,8.5,0,y+.88,throneZ-1.2);
   for(const z of [throneZ+6.6,throneZ+7.4])add('dais_approach_step','marble',15,.27,.74,0,y+.3,z);
   add('grand_throne_seat','gold',5.0,1.0,3.5,0,y+1.66,throneZ-1.5);
   add('grand_throne_back','gold',5.6,6.8,.55,0,y+4.3,throneZ-3.20);
   add('throne_back_velvet','royalVelvet',4.3,5.65,.22,0,y+4.0,throneZ-2.81);
   for(const x of [-2.5,2.5]){
    add('throne_armrest','gold',.70,1.65,3.7,x,y+2.36,throneZ-1.5);
    add('throne_lion_head','gold',.78,.82,.79,x,y+3.0,throneZ+.30,'sphere');
   }
   add('royal_crown_ornament','gold',3.4,1.35,1.2,0,y+8.0,throneZ-3.22,'cone');
   for(const x of [-41,-27,27,41])for(const z of [-37,-13,13,37]){
    if(Math.hypot(x*sx-stair.x,z*sz-stair.z)<stair.outerRadius+5)continue;
    column(x*sx,z*sz,7.25,true);
   }
   for(const z of [-29,0,29]){
    add('crystal_chandelier_stem','gold',.45,3.2,.45,0,y+floor.height-3.3,z*sz,'cylinder');
    add('crystal_chandelier_ring','gold',6.0,.30,6.0,0,y+floor.height-5.0,z*sz,'cylinder');
    for(let index=0;index<8;index++){
     const a=index*Math.PI/4;
     add('chandelier_crystal','glow',.55,1.20,.55,Math.cos(a)*3.2,
      y+floor.height-5.65,z*sz+Math.sin(a)*3.2,'sphere');
    }
   }
   for(const x of [-46,-34,-22,22,34,46]){
    add('royal_banner','royalVelvet',4.2,6.2,.12,x*sx,y+wallHeight-2.9,-hallZ+.52);
    add('royal_banner_filigree','gold',4.4,.21,.15,x*sx,y+wallHeight+.10,-hallZ+.59);
   }
   for(const x of [-20,20]){
    add('heraldic_shield','gold',3.1,4.4,.35,x*sx,y+4.3,hallZ-.30);
    add('heraldic_center','royalVelvet',2.3,3.3,.42,x*sx,y+4.2,hallZ-.25);
   }
  }
  results.push({floor:floor.index,rooms,parts,corridorWidth:6*Math.min(sx,sz),
   stairAtrium:{x:stair.x,z:stair.z,radius:stair.outerRadius+5.3}});
 }
 return results;
}
