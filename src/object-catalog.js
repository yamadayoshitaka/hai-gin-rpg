import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const _cottageTextureCache=new Map();
function cottageSurface(type){
 if(_cottageTextureCache.has(type))return _cottageTextureCache.get(type);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d');let seed=type==='stone'?19:type==='roof'?71:113;
 const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
 ctx.fillStyle=type==='stone'?'#77766c':type==='roof'?'#4a555a':'#805d40';ctx.fillRect(0,0,512,512);
 if(type==='wood'){
  for(let i=0;i<900;i++){const y=rand()*512;ctx.strokeStyle=rand()>.5?'rgba(28,15,8,.18)':'rgba(255,217,150,.14)';ctx.lineWidth=.3+rand()*2.2;ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(140,y+(rand()-.5)*10,330,y+(rand()-.5)*12,512,y+(rand()-.5)*8);ctx.stroke()}
  for(let i=0;i<24;i++){const x=rand()*512,y=rand()*512;ctx.strokeStyle='rgba(42,25,15,.4)';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y,3+rand()*7,1.5+rand()*3,0,0,Math.PI*2);ctx.stroke()}
 }else{
  const rows=type==='roof'?17:10,cols=type==='roof'?13:9,w=512/cols,h=512/rows;
  for(let y=0;y<rows;y++)for(let x=-1;x<cols;x++){
   const ox=(x+(y%2)*.5)*w,oy=y*h,j=(rand()-.5)*35;
   const base=type==='roof'?[70,84,91]:[144,140,129];
   ctx.fillStyle='rgb('+base.map(v=>Math.max(0,Math.min(255,Math.round(v+j)))).join(',')+')';
   ctx.fillRect(ox+1.5,oy+1.5,w-3,h-3);
   ctx.strokeStyle='rgba(22,26,26,.48)';ctx.lineWidth=2;ctx.strokeRect(ox+1,oy+1,w-2,h-2);
   for(let k=0;k<26;k++){const px=ox+rand()*w,py=oy+rand()*h;ctx.fillStyle=rand()>.45?'rgba(245,232,199,.16)':'rgba(18,25,22,.17)';ctx.fillRect(px,py,1+rand()*3,1+rand()*3)}
   if(rand()>.72){ctx.fillStyle='rgba(51,82,34,.36)';ctx.fillRect(ox+rand()*w,oy+rand()*h,w*.3,h*.15)}
  }
 }
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
 const bump=new THREE.CanvasTexture(canvas);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.anisotropy=8;
 const result={map,bump};_cottageTextureCache.set(type,result);return result;
}
function cottageMaterial(type,color=0xffffff){
 const tex=cottageSurface(type);
 return new THREE.MeshStandardMaterial({color,map:tex.map,bumpMap:tex.bump,bumpScale:type==='stone'?.075:type==='roof'?.055:.025,roughness:type==='wood'?.83:.96});
}
export const OBJECT_CATALOG=Object.freeze({
 cottage_table_001:{id:'cottage_table_001',name:'木製食卓',category:'室内家具',kind:'furniture',widthCells:2,depthCells:2,passable:false},
 cottage_chair_001:{id:'cottage_chair_001',name:'木製椅子',category:'室内家具',kind:'furniture',widthCells:1,depthCells:1,passable:false},
 cottage_bed_001:{id:'cottage_bed_001',name:'寝台',category:'室内家具',kind:'furniture',widthCells:2,depthCells:3,passable:false},
 cottage_shelf_001:{id:'cottage_shelf_001',name:'本棚',category:'室内家具',kind:'furniture',widthCells:2,depthCells:1,passable:false},
 cottage_fireplace_001:{id:'cottage_fireplace_001',name:'石造暖炉',category:'室内家具',kind:'furniture',widthCells:2,depthCells:1,passable:false},
 cottage_barrel_001:{id:'cottage_barrel_001',name:'木樽',category:'室内家具',kind:'furniture',widthCells:1,depthCells:1,passable:false},
 cottage_stairs_001:{id:'cottage_stairs_001',name:'木製階段',category:'室内家具',kind:'furniture',widthCells:2,depthCells:4,passable:false},
 fountain_001:{id:'fountain_001',name:'石造噴水',category:'街の設備',kind:'town_prop',widthCells:7,depthCells:7,passable:false},
 market_stall_001:{id:'market_stall_001',name:'市場の露店',category:'街の設備',kind:'town_prop',widthCells:5,depthCells:4,passable:false},
 street_lamp_001:{id:'street_lamp_001',name:'街灯',category:'街の設備',kind:'town_prop',widthCells:1,depthCells:1,passable:false},

 castle_001:{id:'castle_001',name:'城',category:'建造物',kind:'town_building',enterable:true,widthCells:100,depthCells:100,passable:false},
 church_001:{id:'church_001',name:'教会',category:'建造物',kind:'town_building',enterable:true,widthCells:11,depthCells:13,passable:false},
 weapon_shop_001:{id:'weapon_shop_001',name:'武器屋',category:'建造物',kind:'town_building',enterable:true,widthCells:10,depthCells:10,passable:false},
 inn_001:{id:'inn_001',name:'宿屋',category:'建造物',kind:'town_building',enterable:true,widthCells:12,depthCells:11,passable:false},
 item_shop_001:{id:'item_shop_001',name:'道具屋',category:'建造物',kind:'town_building',enterable:true,widthCells:11,depthCells:10,passable:false},
 town_house_001:{id:'town_house_001',name:'民家',category:'建造物',kind:'town_building',enterable:true,widthCells:10,depthCells:10,passable:false},
 small_hill_001:{id:'small_hill_001',name:'小山',category:'地形',kind:'hill',widthCells:20,depthCells:20,passable:true},
 stone_hut_001:{id:'stone_hut_001',name:'石小屋',category:'建造物',kind:'building',widthCells:20,depthCells:20,passable:true,enterable:true,entrance:{side:'south',widthCells:2},rangedAttackFromInside:true,openings:[{side:'south',kind:'door',widthCells:2},{side:'west',kind:'window',widthCells:2},{side:'east',kind:'window',widthCells:2}]},
 swamp_001:{id:'swamp_001',name:'沼地',category:'地形',kind:'swamp',widthCells:9,depthCells:9,passable:true,moveSpeedMultiplier:0.55},
 rocky_mountain_001:{id:'rocky_mountain_001',name:'岩山',category:'地形',kind:'mountain',widthCells:9,depthCells:9,passable:false},
 timber_bridge_001:{id:'timber_bridge_001',name:'木製の橋',category:'建造物',kind:'bridge',widthCells:15,depthCells:1,passable:true},
 stone_bridge_001:{id:'stone_bridge_001',name:'石橋',category:'建造物',kind:'bridge',widthCells:15,depthCells:3,passable:true},
 timber_bridge_broken_001:{id:'timber_bridge_broken_001',name:'壊れた木橋',category:'建造物',kind:'bridge',widthCells:15,depthCells:1,passable:false},
 stone_bridge_broken_001:{id:'stone_bridge_broken_001',name:'崩れた石橋',category:'建造物',kind:'bridge',widthCells:15,depthCells:3,passable:false},
});
export function createObjectById(id,{cellSize=2.2}={}){
 if(!OBJECT_CATALOG[id])throw Error('Unknown object: '+id);

 if(OBJECT_CATALOG[id].kind==='furniture'){
  const root=new THREE.Group();root.name=id;
  const timber=cottageMaterial('wood',0xffffff);
  const dark=cottageMaterial('wood',0x8a7664);
  const stone=cottageMaterial('stone');
  const linen=new THREE.MeshStandardMaterial({color:0xc7b7a0,roughness:1});
  const fire=new THREE.MeshStandardMaterial({color:0xff9e31,emissive:0xe65a0c,emissiveIntensity:2});
  const b=(w,h,d,x,y,z,m=timber)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;root.add(o);return o};
  const c=cellSize;
  if(id==='cottage_table_001'){b(2*c,.13*c,1.25*c,0,.85*c,0);for(const x of [-.82,.82])for(const z of [-.46,.46])b(.14*c,.78*c,.14*c,x*c,.4*c,z*c,dark);for(let i=0;i<6;i++)b(.018*c,.015*c,1.23*c,(i-2.5)*.3*c,.92*c,0,dark)}
  if(id==='cottage_chair_001'){b(.7*c,.11*c,.65*c,0,.48*c,0);b(.7*c,.83*c,.11*c,0,.88*c,-.29*c);for(const x of [-.27,.27])for(const z of [-.23,.23])b(.1*c,.47*c,.1*c,x*c,.23*c,z*c,dark)}
  if(id==='cottage_bed_001'){b(1.6*c,.28*c,2.5*c,0,.38*c,0,dark);b(1.5*c,.22*c,2.25*c,0,.6*c,0,linen);b(1.6*c,1.1*c,.16*c,0,.65*c,-1.2*c);b(1.1*c,.14*c,.5*c,0,.76*c,-.78*c,linen)}
  if(id==='cottage_shelf_001'){for(const x of [-.8,.8])b(.14*c,2.8*c,.7*c,x*c,1.4*c,0);for(let y=.3;y<2.8;y+=.62){b(1.8*c,.12*c,.8*c,0,y*c,0);for(let i=0;i<5;i++)b(.17*c,.36*c,.36*c,(i-2)*.31*c,(y+.23)*c,0,i%2?dark:linen)}}
  if(id==='cottage_fireplace_001'){b(2.6*c,.3*c,1*c,0,.15*c,0,stone);for(const x of [-1.1,1.1])b(.42*c,2.5*c,.9*c,x*c,1.25*c,0,stone);b(2.65*c,.4*c,1.05*c,0,2.5*c,0,stone);b(1.2*c,.45*c,.4*c,0,.48*c,.1*c,fire)}
  if(id==='cottage_barrel_001'){const o=new THREE.Mesh(new THREE.CylinderGeometry(.48*c,.52*c,1.15*c,24,3),timber);o.position.y=.58*c;o.castShadow=true;root.add(o);for(const y of [.2,.94]){const ring=new THREE.Mesh(new THREE.TorusGeometry(.49*c,.045*c,7,28),dark);ring.rotation.x=Math.PI/2;ring.position.y=y*c;root.add(ring)}}
  if(id==='cottage_stairs_001'){for(let i=0;i<9;i++)b(1.8*c,.16*c,.48*c,0,(i+.5)*.34*c,(i-4)*.43*c);for(const x of [-.85,.85])b(.12*c,3.2*c,.12*c,x*c,1.6*c,0,dark)}
  root.userData.catalogId=id;root.userData.passable=false;return root;
 }
 if(OBJECT_CATALOG[id].kind==='town_prop'){
  const root=new THREE.Group();root.name=id;
  const stone=new THREE.MeshStandardMaterial({color:0x9d9f98,roughness:.95});
  const iron=new THREE.MeshStandardMaterial({color:0x383b42,metalness:.55,roughness:.5});
  const wood=new THREE.MeshStandardMaterial({color:0x765238,roughness:1});
  const cloth=new THREE.MeshStandardMaterial({color:0x9b4d41,roughness:1,side:THREE.DoubleSide});
  const water=new THREE.MeshStandardMaterial({color:0x5baac4,metalness:.15,roughness:.24,transparent:true,opacity:.85});
  const light=new THREE.MeshStandardMaterial({color:0xffc877,emissive:0xf6a43c,emissiveIntensity:1.2});
  const box=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m};
  if(id==='fountain_001'){
   for(const [radius,height,y,mat] of [[3.3,.5,.25,stone],[2.8,.14,.58,water],[1.35,.8,.95,stone],[.7,1.6,2.1,stone]]){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(radius*cellSize,radius*cellSize,height*cellSize,24),mat);
    m.position.y=y*cellSize;m.castShadow=true;root.add(m);
   }
   for(let i=0;i<8;i++){const a=i*Math.PI/4;box(.42*cellSize,.9*cellSize,.42*cellSize,Math.sin(a)*2.9*cellSize,.85*cellSize,Math.cos(a)*2.9*cellSize,stone)}
  }else if(id==='market_stall_001'){
   for(const x of [-2,2])for(const z of [-1.4,1.4])box(.18*cellSize,3*cellSize,.18*cellSize,x*cellSize,1.5*cellSize,z*cellSize,wood);
   box(4.4*cellSize,.2*cellSize,2.7*cellSize,0,1.45*cellSize,0,wood);
   for(let i=0;i<8;i++)box(.54*cellSize,.12*cellSize,3.6*cellSize,(i-3.5)*.56*cellSize,3.1*cellSize,0,i%2?cloth:stone);
   for(let i=0;i<9;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.22*cellSize,6,4),new THREE.MeshStandardMaterial({color:i%2?0xb78a46:0x65944a}));m.position.set(((i%3)-1)*.8*cellSize,1.8*cellSize,(Math.floor(i/3)-1)*.6*cellSize);root.add(m)}
  }else{
   box(.24*cellSize,4.2*cellSize,.24*cellSize,0,2.1*cellSize,0,iron);
   box(1.1*cellSize,.18*cellSize,1.1*cellSize,0,4.3*cellSize,0,iron);
   const lantern=new THREE.Mesh(new THREE.SphereGeometry(.43*cellSize,12,8),light);lantern.position.y=4.65*cellSize;root.add(lantern);
   box(.95*cellSize,.17*cellSize,.95*cellSize,0,5.13*cellSize,0,iron);
  }
  root.userData.catalogId=id;root.userData.footprint={lengthCells:OBJECT_CATALOG[id].widthCells,widthCells:OBJECT_CATALOG[id].depthCells};
  root.userData.passable=false;
  return root;
 }
 if(OBJECT_CATALOG[id].kind==='town_building'){
  const info=OBJECT_CATALOG[id],root=new THREE.Group();root.name=id;
  const w=info.widthCells*cellSize,d=info.depthCells*cellSize;
  const castle=id==='castle_001',church=id==='church_001',inn=id==='inn_001';
  const h=(castle?18:church?7:5.5)*cellSize,thick=.38*cellSize;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#9a9a92';ctx.fillRect(0,0,256,256);
  for(let row=0;row<8;row++)for(let col=-1;col<8;col++){
   const x=col*32+(row%2)*16,y=row*32,v=(row*71+col*43+4096)%29;
   ctx.fillStyle='rgb('+(133+v)+','+(132+v)+','+(124+v)+')';
   ctx.fillRect(x+1,y+1,30,30);
   ctx.strokeStyle='rgba(51,49,44,.55)';ctx.strokeRect(x+.5,y+.5,31,31);
   ctx.fillStyle='rgba(235,226,202,.13)';
   for(let k=0;k<9;k++)ctx.fillRect(x+(k*19+row*7+col*11+2048)%29,y+(k*13+row*17+col*3+2048)%29,2,2);
  }
  const stoneTexture=new THREE.CanvasTexture(canvas);
  stoneTexture.wrapS=stoneTexture.wrapT=THREE.RepeatWrapping;
  stoneTexture.colorSpace=THREE.SRGBColorSpace;stoneTexture.anisotropy=4;
  const mats={
   stone:[0xeeeeea,0xffffff,0xd7ddd9,0xf1eae2].map(color=>new THREE.MeshStandardMaterial({color,map:stoneTexture,roughness:.94})),
   wood:new THREE.MeshStandardMaterial({color:0x74513a,roughness:1}),
   dark:new THREE.MeshStandardMaterial({color:0x453a32,roughness:1}),
   glass:new THREE.MeshStandardMaterial({color:0x87bfd2,roughness:.2,metalness:.1,transparent:true,opacity:.68}),
   gold:new THREE.MeshStandardMaterial({color:0xc9a65b,roughness:.65}),
   roof:[0x814a3e,0x9b604b,0x6d4442,0x775b71].map(color=>new THREE.MeshStandardMaterial({color,roughness:1})),
   blue:[0x4e688a,0x617ca0,0x425a80].map(color=>new THREE.MeshStandardMaterial({color,roughness:1}))
  };
  const mesh=(parent,ww,hh,dd,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(ww,hh,dd),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
  const walls=new THREE.Group();walls.name='walls';root.add(walls);
  const roof=new THREE.Group();roof.name='removable_roof';root.add(roof);
  mesh(root,w-.3*cellSize,.18*cellSize,d-.3*cellSize,0,0,0,mats.stone[1]).name='walkable_floor';
  const doorWidth=2.4*cellSize,doorHeight=3.5*cellSize;
  const tile=(castle?5:1.5)*cellSize,rows=Math.ceil(h/tile),colsX=Math.ceil(w/tile),colsZ=Math.ceil(d/tile);
  // Each wall consists of individual masonry blocks; leave real voids for doors and windows.
  for(let row=0;row<rows;row++){
   const yy=(row+.5)*h/rows;
   for(let c=0;c<colsX;c++){
    const xx=-w/2+(c+.5)*w/colsX;
    const door=Math.abs(xx)<doorWidth/2&&yy<doorHeight;
    const window=Math.abs(Math.abs(xx)-w*.3)<cellSize*.8&&yy>2.4*cellSize&&yy<4.3*cellSize;
    const mat=mats.stone[(row*3+c)%4];
    if(!door&&!window)mesh(walls,w/colsX*.97,h/rows*.96,thick,xx,yy,d/2-thick/2,mat);
    mesh(walls,w/colsX*.97,h/rows*.96,thick,xx,yy,-d/2+thick/2,mat);
    if(window)mesh(walls,w/colsX*.8,h/rows*.82,.07*cellSize,xx,yy,d/2+.03*cellSize,mats.glass);
   }
   for(let c=0;c<colsZ;c++){
    const zz=-d/2+(c+.5)*d/colsZ;
    const window=Math.abs(zz)<cellSize*1.2&&yy>2.4*cellSize&&yy<4.3*cellSize;
    const mat=mats.stone[(row*7+c)%4];
    if(!window)for(const side of [-1,1])mesh(walls,thick,h/rows*.96,d/colsZ*.97,side*(w/2-thick/2),yy,zz,mat);
   }
  }
  for(const side of [-1,1])mesh(root,.18*cellSize,doorHeight,.35*cellSize,side*doorWidth/2,doorHeight/2,d/2,mats.wood);
  mesh(root,doorWidth+.3*cellSize,.25*cellSize,.4*cellSize,0,doorHeight,d/2,mats.wood);
  // Interior furniture is independent from the collision shell.
  const interior=new THREE.Group();interior.name='interior_furniture';root.add(interior);
  for(let n=0;n<(castle?5:3);n++){
   const xx=(n-(castle?2:1))*w*.17;
   mesh(interior,1.8*cellSize,.16*cellSize,1.2*cellSize,xx,.9*cellSize,-d*.19,mats.wood);
   for(const side of [-1,1])mesh(interior,.15*cellSize,.85*cellSize,.15*cellSize,xx+side*.65*cellSize,.43*cellSize,-d*.19,mats.dark);
  }
  if(church){for(let n=0;n<4;n++)mesh(interior,w*.6,.35*cellSize,.85*cellSize,0,.85*cellSize,-d*.28+n*1.6*cellSize,mats.wood);
   mesh(interior,2.4*cellSize,2.2*cellSize,1.5*cellSize,0,1.1*cellSize,-d*.43,mats.gold);
  }
  if(castle){
   for(const sx of [-1,1])for(const sz of [-1,1]){
    const tower=new THREE.Group();tower.position.set(sx*(w/2-1.5*cellSize),0,sz*(d/2-1.5*cellSize));root.add(tower);
    const tHeight=h+3*cellSize;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(1.6*cellSize,1.8*cellSize,tHeight,12),mats.stone[1]);shaft.position.y=tHeight/2;shaft.castShadow=true;tower.add(shaft);
    for(let k=0;k<12;k++){const theta=k*Math.PI/6;mesh(tower,.65*cellSize,.9*cellSize,.65*cellSize,Math.sin(theta)*1.6*cellSize,tHeight+.3*cellSize,Math.cos(theta)*1.6*cellSize,mats.stone[k%4])}
   }
   for(let i=-5;i<=5;i++)mesh(roof,1.1*cellSize,.8*cellSize,1.1*cellSize,i*w/12,h+.4*cellSize,d/2-.7*cellSize,mats.stone[i+8&3]);
  }else{
   const rise=(church?3.4:2.5)*cellSize,half=w/2+.5*cellSize,rowsRoof=7,colsRoof=Math.max(7,Math.round(info.depthCells*.65));
   const sloped=Math.hypot(half,rise),angle=Math.atan2(rise,half),palette=church||inn?mats.blue:mats.roof;
   for(const side of [-1,1])for(let rr=0;rr<rowsRoof;rr++)for(let cc=0;cc<colsRoof;cc++){
    const t=(rr+.5)/rowsRoof;
    const tile=mesh(roof,sloped/rowsRoof*1.09,.11*cellSize,(d+cellSize)/colsRoof*1.05,side*half*(1-t),h+rise*t,-d/2-.5*cellSize+(cc+.5)*(d+cellSize)/colsRoof,palette[(rr+cc*3)%palette.length]);
    tile.rotation.z=-side*angle;
   }
   mesh(roof,.3*cellSize,.28*cellSize,d+cellSize,0,h+rise,0,palette[0]);
  }
  if(church){
   mesh(roof,.5*cellSize,2.7*cellSize,.5*cellSize,0,h+4.5*cellSize,0,mats.gold);
   mesh(roof,2.2*cellSize,.45*cellSize,.5*cellSize,0,h+5.4*cellSize,0,mats.gold);
  }

  // Modular architectural detailing informed by CC0 medieval building kits.
  // Keep decorative elements separate from collision walls and the walkable floor.
  const trim=new THREE.Group();trim.name='architectural_details';root.add(trim);
  const metal=new THREE.MeshStandardMaterial({color:0x4a4d52,roughness:.52,metalness:.45});
  const plaster=new THREE.MeshStandardMaterial({color:0xc4b7a1,roughness:.96});
  const foliage=new THREE.MeshStandardMaterial({color:0x3e6546,roughness:1});
  const accent=church?mats.blue[1]:castle?mats.blue[0]:mats.roof[1];
  // Stone quoins, timber beams, windowsills and lintels.
  for(const side of [-1,1]){
   for(let y=1;y<Math.ceil(h/cellSize);y+=2){
    mesh(trim,.62*cellSize,.8*cellSize,.65*cellSize,side*(w/2-.25*cellSize),y*cellSize,d/2-.2*cellSize,mats.stone[y%4]);
   }
   mesh(trim,.23*cellSize,h,.26*cellSize,side*(w/2-.15*cellSize),h/2,d/2+.05*cellSize,mats.wood);
   for(const x of [side*w*.30]){
    mesh(trim,2.2*cellSize,.16*cellSize,.48*cellSize,x,2.3*cellSize,d/2+.35*cellSize,mats.stone[2]);
    mesh(trim,2.2*cellSize,.16*cellSize,.48*cellSize,x,4.4*cellSize,d/2+.35*cellSize,mats.stone[1]);
    mesh(trim,.1*cellSize,2*cellSize,.17*cellSize,x,3.35*cellSize,d/2+.22*cellSize,mats.wood);
   }
  }
  if(castle){
   // Turrets, pitched spires, fortified gate, banners and arched colonnade.
   for(const sx of [-1,1])for(const sz of [-1,1]){
    const tx=sx*(w/2-3*cellSize),tz=sz*(d/2-3*cellSize);
    const towerHeight=h+9*cellSize;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(3.1*cellSize,3.7*cellSize,towerHeight,12),mats.stone[2]);
    shaft.position.set(tx,towerHeight/2,tz);shaft.castShadow=true;trim.add(shaft);
    const spire=new THREE.Mesh(new THREE.ConeGeometry(4.3*cellSize,8*cellSize,12),mats.blue[0]);
    spire.position.set(tx,towerHeight+4*cellSize,tz);spire.castShadow=true;roof.add(spire);
    mesh(roof,.15*cellSize,3.4*cellSize,.15*cellSize,tx,towerHeight+9.2*cellSize,tz,metal);
    mesh(roof,1.8*cellSize,1.1*cellSize,.12*cellSize,tx+1.0*cellSize,towerHeight+10*cellSize,tz,accent);
   }
   const gateZ=d/2+.3*cellSize;
   for(const side of [-1,1]){
    mesh(trim,1.4*cellSize,8*cellSize,2*cellSize,side*4.1*cellSize,4*cellSize,gateZ,mats.stone[1]);
    mesh(trim,1.2*cellSize,7*cellSize,.15*cellSize,side*2.9*cellSize,3.5*cellSize,gateZ+.35*cellSize,metal);
    mesh(trim,2*cellSize,4.4*cellSize,.14*cellSize,side*8*cellSize,h-4*cellSize,gateZ,accent);
   }
   mesh(trim,8*cellSize,1.6*cellSize,2*cellSize,0,8*cellSize,gateZ,mats.stone[0]);
   for(let i=-4;i<=4;i++)mesh(trim,.12*cellSize,7.5*cellSize,.13*cellSize,i*.65*cellSize,3.8*cellSize,gateZ+.6*cellSize,metal);

  }else{
   // Timber framing, eaves, gutters, shop sign and a small chimney.
   for(const side of [-1,1]){
    mesh(trim,.22*cellSize,h,.25*cellSize,side*(w/2-.35*cellSize),h/2,d/2+.16*cellSize,mats.wood);
    mesh(trim,.3*cellSize,.3*cellSize,d+.7*cellSize,side*w*.48,h+.14*cellSize,0,mats.wood);
   }
   if(!church){
    mesh(trim,2.6*cellSize,.95*cellSize,.24*cellSize,w*.2,4.5*cellSize,d/2+.8*cellSize,accent);
    mesh(trim,.15*cellSize,1.1*cellSize,.16*cellSize,w*.2,5.1*cellSize,d/2+.6*cellSize,metal);
    mesh(roof,1.2*cellSize,2.2*cellSize,1.2*cellSize,-w*.29,h+2.2*cellSize,-d*.16,mats.stone[2]);
   }else{
    for(const side of [-1,1]){
     mesh(trim,.8*cellSize,4.4*cellSize,1.1*cellSize,side*(w/2+.18*cellSize),h*.48,0,mats.stone[1]);
    }
    const apse=new THREE.Mesh(new THREE.CylinderGeometry(2.1*cellSize,2.1*cellSize,5*cellSize,10),mats.stone[0]);
    apse.position.set(0,2.5*cellSize,-d/2);trim.add(apse);
   }
  }
  const bake=(layer)=>{
   const batches=new Map(),old=[];
   root.updateMatrixWorld(true);
   layer.traverse(m=>{
    if(!m.isMesh||!m.geometry||Array.isArray(m.material))return;
    const g=m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().copy(root.matrixWorld).invert().multiply(m.matrixWorld));
    if(!batches.has(m.material))batches.set(m.material,[]);
    batches.get(m.material).push(g);old.push(m);
   });
   const geos=[],mats=[];
   for(const [mat,list] of batches){const g=mergeGeometries(list,false);list.forEach(v=>v.dispose());if(g){geos.push(g);mats.push(mat)}}
   const combined=geos.length?mergeGeometries(geos,true):null;
   geos.forEach(g=>g.dispose());
   if(!combined)return;
   old.forEach(m=>m.parent.remove(m));
   const m=new THREE.Mesh(combined,mats);m.castShadow=true;m.receiveShadow=true;layer.add(m);
  };
  for(const layer of [walls,interior,trim,roof])bake(layer);
  root.userData.catalogId=id;
  root.userData.footprint={lengthCells:info.widthCells,widthCells:info.depthCells};
  root.userData.passable=true;root.userData.enterable=true;
  root.userData.entrance={side:'south',widthCells:2.4,clearHeight:doorHeight};
  root.userData.interior={width:w-2*thick,depth:d-2*thick,height:h,roofGroup:'removable_roof'};
  root.userData.openings=[{side:'south',kind:'door',widthCells:2.4},{side:'south',kind:'window',widthCells:1.6},{side:'east',kind:'window',widthCells:2},{side:'west',kind:'window',widthCells:2}];
  return root;
 }
 const broken=id.includes('_broken_'),stoneBridge=id.startsWith('stone_');
 if(id==='small_hill_001'){
  const root=new THREE.Group();root.name=id;
  const material=new THREE.MeshStandardMaterial({color:0x71815a,roughness:1,flatShading:true,side:THREE.DoubleSide});
  const rock=new THREE.MeshStandardMaterial({color:0x77766e,roughness:1,flatShading:true});
  const size=20*cellSize,segments=40,vertices=[],indices=[];
  const height=(x,z)=>{const d=Math.hypot(x/(size*.51),z/(size*.51));return Math.max(0,1-d*d)*cellSize*4.4*(1+.13*Math.sin(x*.51)*Math.cos(z*.47))};
  for(let z=0;z<=segments;z++)for(let x=0;x<=segments;x++){const xx=(x/segments-.5)*size,zz=(z/segments-.5)*size;vertices.push(xx,height(xx,zz),zz)}
  for(let z=0;z<segments;z++)for(let x=0;x<segments;x++){const a=z*(segments+1)+x,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const hill=new THREE.Mesh(geometry,material);hill.castShadow=true;hill.receiveShadow=true;root.add(hill);
  for(let i=0;i<22;i++){const angle=i*2.4,r=size*(.13+(i%9)*.035),x=Math.cos(angle)*r,z=Math.sin(angle)*r;
   const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(cellSize*(.14+(i%4)*.07),0),rock);stone.position.set(x,height(x,z),z);stone.rotation.y=i;root.add(stone)}
  root.userData.catalogId=id;root.userData.footprint={lengthCells:20,widthCells:20};root.userData.passable=true;root.userData.heightAt=(x,z)=>height(x,z);return root;
 }
 if(id==='stone_hut_001'){
  const root=new THREE.Group();root.name=id;
  const W=20*cellSize,D=20*cellSize,H=5*cellSize,wall=.44*cellSize;
  const stoneColors=[0x97978d,0x898c85,0xa4a397,0x7c817e,0xb0aea1];
  const stones=stoneColors.map(color=>{const m=cottageMaterial('stone',color);m.polygonOffset=true;m.polygonOffsetFactor=1;m.polygonOffsetUnits=1;return m});
  const mortar=new THREE.MeshStandardMaterial({color:0x555b58,roughness:1});
  const roofColors=[0x5c6265,0x626c70,0x4c5559,0x747b79];
  const roofMats=roofColors.map(color=>{const m=cottageMaterial('roof',color);m.polygonOffset=true;m.polygonOffsetFactor=1;m.polygonOffsetUnits=1;return m});
  const wood=cottageMaterial('wood',0xd2b99a);
  const add=(parent,w,h,d,x,y,z,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh};
  // A 20x20 cell footprint with a true walkable interior and a two-cell south entrance.
  add(root,W,.16,D,0,-.20,0,mortar).name='foundation';
  const doorWidth=2*cellSize,doorHeight=3.3*cellSize;
  const windowWidth=2*cellSize,windowBottom=1.7*cellSize,windowTop=3.3*cellSize;
  const rows=10,cols=40,tileH=H/rows,tileW=W/cols,tileD=D/cols;
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
   const y=(row+.5)*tileH,shift=(row%2)*tileW*.45;
   const x=-W/2+(col+.5)*tileW+shift,z=-D/2+(col+.5)*tileD+shift;
   const mat=stones[(row*7+col*3)%stones.length];
   if(x<W/2-tileW*.5){
    const entrance=Math.abs(x)<doorWidth/2&&y<doorHeight;
    if(!entrance)add(root,tileW*.98,tileH*.98,wall,x,y,D/2-wall/2,mat);
    add(root,tileW*.96,tileH*.94,wall,x,y,-D/2+wall/2,mat);
   }
   if(z<D/2-tileD*.5){
    const window=(Math.abs(z)<windowWidth/2&&y>windowBottom&&y<windowTop);
    if(!window)add(root,wall,tileH*.98,tileD*.98,-W/2+wall/2,y,z,mat);
    if(!window)add(root,wall,tileH*.94,tileD*.96,W/2-wall/2,y,z,mat);
   }
  }
  // Timber doorway frame without a blocking door panel.
  for(const side of [-1,1])add(root,.16*cellSize,doorHeight,.22*cellSize,side*(doorWidth/2+.06*cellSize),doorHeight/2,D/2+.04*cellSize,wood);
  add(root,doorWidth+.3*cellSize,.18*cellSize,.26*cellSize,0,doorHeight,D/2+.04*cellSize,wood);
  const floor=add(root,W-wall*2,.08,D-wall*2,0,.065*cellSize,0,stones[1]);floor.name='interior_floor';floor.material=stones[1].clone();floor.material.polygonOffset=true;floor.material.polygonOffsetFactor=-2;floor.material.polygonOffsetUnits=-2;

  // Modular furnishing: each piece is a standalone catalog object, assembled
  // into the building master. Keep the south doorway and central aisle clear.
  const furnishings=new THREE.Group();furnishings.name='modular_furnishings';root.add(furnishings);
  const placements=[
   ['cottage_table_001',-4,0],['cottage_chair_001',-7,0],['cottage_chair_001',-1,0],
   ['cottage_bed_001',-7,-7],['cottage_shelf_001',7,-8],
   ['cottage_fireplace_001',0,-8],['cottage_barrel_001',8,7],
   ['cottage_barrel_001',7,7],['cottage_stairs_001',7,-2]
  ];
  for(const [part,x,z] of placements){
   const item=createObjectById(part,{cellSize});
   item.position.set(x*cellSize,.13*cellSize,z*cellSize);
   furnishings.add(item);
  }
  root.userData.componentIds=placements.map(p=>p[0]);
  // Individual overlapping roof tiles follow a continuous gable profile.
  const roof=new THREE.Group();roof.name='stone_hut_roof';root.add(roof);
  const eave=H+.35*cellSize,rise=3.2*cellSize,half=W/2+.7*cellSize;
  const tileRows=8,tileCols=15,slopeLength=Math.hypot(half,rise);
  const slopeAngle=Math.atan2(rise,half);
  for(const side of [-1,1])for(let row=0;row<tileRows;row++)for(let col=0;col<tileCols;col++){
   const t=(row+.5)/tileRows;
   const x=side*(half*(1-t)),y=eave+rise*t;
   const z=-D/2-.6*cellSize+(col+.5)*(D+1.2*cellSize)/tileCols;
   const tile=add(roof,slopeLength/tileRows*1.015,.12*cellSize,(D+1.2*cellSize)/tileCols*1.015,x,y,z,roofMats[(row+col*3)%roofMats.length]);
   tile.rotation.z=-side*slopeAngle;
  }
  add(roof,.35*cellSize,.3*cellSize,D+1.3*cellSize,0,eave+rise+.06*cellSize,0,roofMats[2]);

  // Catalog-owned cottage architecture and decoration. All decorative pieces
  // remain children of the master object; the tactical doorway stays open.
  const architecture=new THREE.Group();architecture.name='cottage_architectural_details';root.add(architecture);
  const iron=new THREE.MeshStandardMaterial({color:0x30363a,metalness:.65,roughness:.42});
  const ivy=new THREE.MeshStandardMaterial({color:0x385c36,roughness:1,side:THREE.DoubleSide});
  const glass=new THREE.MeshStandardMaterial({color:0xe5aa54,emissive:0xff9c39,emissiveIntensity:.45,roughness:.24,transparent:true,opacity:.72});
  const plank=cottageMaterial('wood');
  const lanternGlow=new THREE.MeshStandardMaterial({color:0xffcc76,emissive:0xffa43b,emissiveIntensity:1.8});
  // Raised timber beams, roof ridge and ornamental window frames.
  for(const side of [-1,1]){
   const sx=side*(W/2+.09*cellSize);
   for(const z of [-D*.35,D*.35]){
    add(architecture,.17*cellSize,H,.22*cellSize,sx,H/2,z,wood);
    for(const y of [1.6,3.5])add(architecture,.2*cellSize,.15*cellSize,2.3*cellSize,sx,y*cellSize,z,wood);
   }
   for(const z of [-D*.29,D*.29]){
    add(architecture,.09*cellSize,1.5*cellSize,1.6*cellSize,sx,2.5*cellSize,z,glass);
    add(architecture,.14*cellSize,1.7*cellSize,.13*cellSize,sx,2.5*cellSize,z,wood);
    for(const y of [1.7,3.3])add(architecture,.14*cellSize,.13*cellSize,1.8*cellSize,sx,y*cellSize,z,wood);
   }
  }
  // Stone arch around the actual south doorway, with a clear central opening.
  for(const side of [-1,1]){
   for(let i=0;i<9;i++){
    const theta=(side<0?Math.PI:0)+(i/8)*(Math.PI/2);
    const x=side*(doorWidth*.5+.27*cellSize)+Math.sin(theta)*.05*cellSize;
    const y=(.35+i*.35)*cellSize;
    if(y<doorHeight)add(architecture,.42*cellSize,.36*cellSize,.54*cellSize,x,y,D/2+.17*cellSize,stones[i%stones.length]);
   }
   add(architecture,.28*cellSize,.42*cellSize,.42*cellSize,side*(doorWidth/2+.25*cellSize),doorHeight+.18*cellSize,D/2+.19*cellSize,stones[2]);
  }
  for(let i=0;i<7;i++)add(architecture,(doorWidth+.5*cellSize)/7,.23*cellSize,.52*cellSize,
   (i-3)*(doorWidth+.5*cellSize)/7,doorHeight+.26*cellSize,D/2+.17*cellSize,stones[i%5]);
  // Interior plank floor: offset from stone foundation to prevent z-fighting.
  for(let i=0;i<34;i++)add(architecture,W-wall*2,.025*cellSize,.39*cellSize,0,.14*cellSize,
   -D/2+wall+(i+.5)*(D-wall*2)/34,plank);
  // Two warm exterior lanterns, without blocking the doorway.
  for(const side of [-1,1]){
   const x=side*(doorWidth/2+1.2*cellSize),z=D/2+.4*cellSize;
   add(architecture,.12*cellSize,.85*cellSize,.12*cellSize,x,3.6*cellSize,z,iron);
   add(architecture,.44*cellSize,.57*cellSize,.44*cellSize,x,3.2*cellSize,z,lanternGlow);
   add(architecture,.6*cellSize,.1*cellSize,.6*cellSize,x,3.55*cellSize,z,iron);
  }
  // Stone chimney and projecting courses, placed on the rear roof.
  const chimneyX=-W*.29,chimneyZ=-D*.26;
  add(roof,1.4*cellSize,3.4*cellSize,1.35*cellSize,chimneyX,H+2.2*cellSize,chimneyZ,stones[1]);
  for(let i=0;i<5;i++)add(roof,1.55*cellSize,.14*cellSize,1.5*cellSize,
   chimneyX,H+(3.25+i*.16)*cellSize,chimneyZ,stones[i%5]);
  // Seeded ivy clusters on the outside walls; each is catalog geometry.
  for(let i=0;i<85;i++){
   const t=i*2.399963,side=i%3===0?-1:1;
   const x=side*(W/2+.15*cellSize),z=Math.sin(t)*D*.46;
   const y=(.25+((i*37)%89)/89*4.5)*cellSize;
   const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry((.08+(i%4)*.025)*cellSize,1),ivy);
   leaf.position.set(x,y,z);leaf.scale.set(.32,.9,1.25);leaf.rotation.set(i*.13,t,i*.19);
   leaf.castShadow=true;architecture.add(leaf);
  }
  // Roof is a separately named group for hiding it when viewing the interior.
  root.userData.catalogId=id;root.userData.footprint={lengthCells:20,widthCells:20};
  root.userData.passable=true;root.userData.enterable=true;
  root.userData.entrance={side:'south',widthCells:2,clearHeight:doorHeight};
  root.userData.openings=[{side:'south',kind:'door',widthCells:2,bottom:0,top:doorHeight},{side:'west',kind:'window',widthCells:2,bottom:windowBottom,top:windowTop},{side:'east',kind:'window',widthCells:2,bottom:windowBottom,top:windowTop}];
  root.userData.rangedAttackFromInside=true;
  root.userData.rangedJobs=['弓使い','魔法使い','召喚士'];
  root.userData.occupancy={interiorCells:18*18,entranceSide:'south'};
  root.userData.interior={width:W-wall*2,depth:D-wall*2,height:H};
  return root;
 }
 if(id==='swamp_001'){
  const root=new THREE.Group();root.name=id;
  const soil=new THREE.MeshStandardMaterial({color:0x454b34,roughness:1});
  const water=new THREE.MeshStandardMaterial({color:0x3c5946,roughness:.38,metalness:.08,transparent:true,opacity:.83,side:THREE.DoubleSide});
  const mud=new THREE.MeshStandardMaterial({color:0x38382c,roughness:1});
  const reed=new THREE.MeshStandardMaterial({color:0x879067,roughness:1,side:THREE.DoubleSide});
  const size=cellSize*9;
  const base=new THREE.Mesh(new THREE.PlaneGeometry(size,size,12,12),soil);base.rotation.x=-Math.PI/2;base.position.y=-.12;base.receiveShadow=true;root.add(base);
  const pond=new THREE.Mesh(new THREE.CircleGeometry(size*.46,44),water);pond.rotation.x=-Math.PI/2;pond.scale.y=.87;pond.position.y=.025;pond.name='swamp_water';root.add(pond);
  for(let i=0;i<26;i++){
   const angle=i*2.399963,r=(.25+.72*Math.sqrt((i+.5)/26))*size*.5;
   const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
   const mound=new THREE.Mesh(new THREE.DodecahedronGeometry(.2+(i%5)*.13,0),mud);
   mound.scale.set(1.6,.28,1.1);mound.position.set(x,-.01,z);root.add(mound);
  }
  for(let i=0;i<65;i++){
   const angle=i*2.399963,r=(.65+.35*((i*13)%17)/17)*size*.48;
   const x=Math.cos(angle)*r,z=Math.sin(angle)*r,h=.45+(i%7)*.12;
   const stem=new THREE.Mesh(new THREE.CylinderGeometry(.015,.028,h,4),reed);
   stem.position.set(x,h/2,z);stem.rotation.z=Math.sin(i*4)*.16;root.add(stem);
  }
  for(let i=0;i<14;i++){
   const a=i*1.91,r=(.2+(i%6)*.1)*size*.43;
   const bubble=new THREE.Mesh(new THREE.SphereGeometry(.07+(i%3)*.025,8,5),water);
   bubble.scale.y=.22;bubble.position.set(Math.cos(a)*r,.07,Math.sin(a)*r);root.add(bubble);
  }
  root.userData.catalogId=id;root.userData.footprint={lengthCells:9,widthCells:9};
  root.userData.passable=true;root.userData.moveSpeedMultiplier=.55;root.userData.terrainType='swamp';return root;
 }
 if(id==='rocky_mountain_001'){
  const root=new THREE.Group();root.name=id;
  const rockMaterials=[0x777b79,0x666d70,0x8a8880,0x515c61].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));
  // Interlocking low-poly ridges form a single solid, steep mountain mass.
  const peaks=[[-2.2,-1.6,5.6,2.8],[-.3,.4,8.5,3.4],[2.5,-.7,6.4,2.7],[-1.5,2.1,4.4,2.3],[1.8,2.4,5.1,2.4]];
  for(let i=0;i<peaks.length;i++){
   const [x,z,h,r]=peaks[i],geometry=new THREE.ConeGeometry(r*cellSize,h,6,3);
   const pos=geometry.attributes.position;
   for(let j=0;j<pos.count;j++){const yy=pos.getY(j);if(yy>0)pos.setY(j,yy*(.88+.13*Math.sin(j*7+i)));else pos.setX(j,pos.getX(j)*(1+.1*Math.sin(j*3+i)))}
   geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,rockMaterials[i%rockMaterials.length]);mesh.position.set(x*cellSize,h/2,z*cellSize);mesh.rotation.y=i*.61;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  const scree=new THREE.MeshStandardMaterial({color:0x77736c,roughness:1,flatShading:true});
  for(let i=0;i<48;i++){const a=i*2.399963,r=Math.sqrt((i+.5)/48)*4.4*cellSize;const size=.22+(i%6)*.13;
   const stone=new THREE.Mesh(new THREE.DodecahedronGeometry(size*cellSize,0),scree);stone.position.set(Math.cos(a)*r,size*cellSize*.35,Math.sin(a)*r);stone.rotation.set(i*.17,i*.71,i*.24);stone.castShadow=true;root.add(stone)}
  root.userData.catalogId=id;root.userData.footprint={lengthCells:9,widthCells:9};root.userData.passable=false;return root;
 }
 const root=new THREE.Group();root.name=id;
 if(stoneBridge){
  const stone=new THREE.MeshStandardMaterial({color:0x9a9b98,roughness:1}),mortar=new THREE.MeshStandardMaterial({color:0x656866,roughness:1}),coping=new THREE.MeshStandardMaterial({color:0xb5b4aa,roughness:.95});
  const add=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m)};
  const L=15*cellSize,W=3*cellSize;
  // Three walkable tile lanes, fifteen tiles along the bridge.
  for(let x=0;x<15;x++)for(let z=0;z<3;z++){
   const px=(x-7)*cellSize,pz=(z-1)*cellSize;
   if(!broken||x<6||x>9){add(cellSize*.985,.24,cellSize*.985,px,0,pz,stone)}
   if(!broken||x<6||x>9)for(let k=0;k<3;k++)add(cellSize*.3,.018,.025,px+(k-1)*cellSize*.3,.13,pz+cellSize*.2,mortar);
  }
  for(const side of [-1,1]){
   const z=side*(W/2+.13);
   if(!broken){add(L,.6,.48,0,-.4,z,mortar);add(L,.2,.65,0,1.08,z,coping)}
   for(let x=0;x<15;x++)if(!broken||x<6||x>9){add(cellSize*.94,.72,.38,(x-7)*cellSize,.55,z,stone);if(broken)add(cellSize*.94,.2,.65,(x-7)*cellSize,1.08,z,coping)}
   for(let x=0;x<15;x+=3)if(!broken||x<6||x>9)add(.52,1.25,.52,(x-7)*cellSize,.53,z,coping);
  }
  // Visible masonry arch spandrels with three openings under the deck.
  for(const side of [-1,1])for(let x=0;x<15;x++){
   const px=(x-7)*cellSize,z=side*(W/2-.3),phase=(x%5-2)/2;
   const arch=Math.sqrt(Math.max(0,1-phase*phase));
   if(!broken||x<6||x>9)add(cellSize*.98,.65+1.1*(1-arch),.4,px,-.54-.55*(1-arch),z,stone);
  }
  for(const x of [-5,0,5])for(const side of [-1,1])add(.85,2.3,.85,x*cellSize,-1.4,side*(W/2-.45),mortar);
  if(broken)for(let i=0;i<13;i++){const x=((i*7)%17-8)*cellSize*.35,z=((i*5)%7-3)*cellSize*.4;const rubble=new THREE.Mesh(new THREE.DodecahedronGeometry(.2+(i%4)*.12,0),i%3?stone:mortar);rubble.position.set(x,-1.4-(i%3)*.2,z);rubble.rotation.set(i*.4,i*.7,i*.2);root.add(rubble)}
  root.userData.catalogId=id;root.userData.footprint={lengthCells:15,widthCells:3};root.userData.passable=!broken;return root;
 }

 const deck=new THREE.MeshStandardMaterial({color:0x8b6540,roughness:.92}),wood=new THREE.MeshStandardMaterial({color:0x4f3828,roughness:.95});
 const box=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;root.add(m)};
 const length=15*cellSize;
 for(let i=0;i<15;i++)if(!broken||i<6||i>9)box(cellSize*.97,.16,cellSize*1.25,(i-7)*cellSize,0,0,deck);
 for(const side of [-1,1]){const z=side*cellSize*.58;
 if(!broken){box(length,.25,.23,0,-.3,side*cellSize*.42,wood);box(length,.16,.16,0,1.1,z,wood);box(length,.1,.13,0,.57,z,wood)}
 for(let i=0;i<15;i++)if(broken&&(i<6||i>9)){box(cellSize*.96,.25,.23,(i-7)*cellSize,-.3,side*cellSize*.42,wood);box(cellSize*.96,.16,.16,(i-7)*cellSize,1.1,z,wood);box(cellSize*.96,.1,.13,(i-7)*cellSize,.57,z,wood)}
 for(let i=0;i<15;i+=2)if(!broken||i<6||i>9)box(.18,1.2,.18,(i-7)*cellSize,.57,z,wood);
 for(const i of [-5,0,5])box(.34,2.7,.34,i*cellSize,-1.4,side*cellSize*.4,wood);
 }
 if(broken)for(let i=0;i<9;i++){const plank=new THREE.Mesh(new THREE.BoxGeometry(cellSize*.6,.13,.28),deck);plank.position.set(((i*7)%11-5)*cellSize*.35,-1.1-(i%3)*.14,((i*3)%5-2)*cellSize*.4);plank.rotation.y=i*.41;root.add(plank)}
 root.userData.catalogId=id;root.userData.passable=!broken;return root;
}

/**
 * Shared runtime/preview instantiation entry point.
 * The catalog owns geometry, materials and shadow flags; placement and
 * gameplay-specific collision/pathfinding remain the caller's responsibility.
 */
export function createCatalogObject(id,options={}){
 const object=createObjectById(id,options);
 const definition=OBJECT_CATALOG[id];
 object.userData.catalogId=id;
 object.userData.catalogDefinition=definition;
 object.traverse(node=>{
  if(!node.isMesh)return;
  node.castShadow=true;
  node.receiveShadow=true;
 });
 return object;
}
