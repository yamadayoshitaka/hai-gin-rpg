/**
 * Independent, reusable hair asset registry and head-fit / motion math.
 * The neutral face (including v121 skinhead) is never changed by this module.
 * Source GLBs are separate CC BY 4.0 models; see ATTRIBUTION.md.
 */
const ROOT='./assets/characters/hair-fitted-v1/';
const freeze=x=>Object.freeze(x);
export const HAIR_ASSET_ATTRIBUTION=freeze({
 author:'Vincent Freelance',
 license:'CC BY 4.0',
 notice:'assets/characters/hair-fitted-v1/ATTRIBUTION.md'
});
const build=(sex,count)=>freeze(Array.from({length:count},(_,i)=>{
 const number=String(i+1).padStart(2,'0');
 return freeze({
  id:sex+'-hair-'+number,sex,number,
  name:(sex==='female'?'女性':'男性')+'ヘア '+number,
  path:ROOT+sex+'_hair_'+number+'_lod0.glb',
  lod1:ROOT+sex+'_hair_'+number+'_lod1.glb',
  lod2:ROOT+sex+'_hair_'+number+'_lod2.glb',
  source:'Vincent Freelance / CC BY 4.0',
  separateFromFace:true
 });
}));
export const INDEPENDENT_HAIR_CATALOG=freeze({
 female:build('female',12),male:build('male',14)
});
export const ALL_INDEPENDENT_HAIR=freeze([
 ...INDEPENDENT_HAIR_CATALOG.female,...INDEPENDENT_HAIR_CATALOG.male
]);
export const HAIR_SECTIONS=freeze([
 freeze({id:'crown',name:'頭頂・根元',color:0xc3a4ee}),
 freeze({id:'fringe',name:'前髪',color:0xa9e6bc}),
 freeze({id:'left',name:'左横髪',color:0xf1b5b5}),
 freeze({id:'right',name:'右横髪',color:0xf1b5b5}),
 freeze({id:'back',name:'後ろ髪',color:0x9ab8ec})
]);
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
export function normalizeHeadSize({width=.205,height=.235,depth=.205}={}){
 return freeze({
  width:clamp(Number(width)||.205,.14,.34),
  height:clamp(Number(height)||.235,.17,.35),
  depth:clamp(Number(depth)||.205,.14,.32)
 });
}
export function independentHairFit(assetBox,headSize={}){
 const h=normalizeHeadSize(headSize),min=assetBox.min,max=assetBox.max;
 if(![min.x,min.y,min.z,max.x,max.y,max.z].every(Number.isFinite)||
   max.x<=min.x||max.y<=min.y||max.z<=min.z)throw Error('無効な髪GLBの境界');
 // Uniform-ish scaling around the actual cranium, never the entire long-hair Y extent.
 const sx=clamp(h.width*1.085/(max.x-min.x),.55,2.15);
 const sz=clamp(h.depth*1.04/(max.z-min.z),.55,2.15);
 const sy=clamp(Math.sqrt(sx*sz),.55,2.15);
 // A positive Z is the forehead in the existing character-head convention.
 const crownY=h.height*.5+.0035;
 const frontZ=h.depth*.5*.76;
 const tx=-(min.x+max.x)*.5*sx;
 const ty=crownY-max.y*sy;
 const tz=frontZ-max.z*sz;
 return freeze({
  scale:freeze([sx,sy,sz]),position:freeze([tx,ty,tz]),headSize:h,
  scalpGap:.0035,crownY,foreheadZ:frontZ
 });
}
/**
 * Align the hair ROOTS to the real head's scalp measurements.
 * The full length of long hair is deliberately not used to infer head size.
 * All coordinates are metres, in one local head space (front = +Z).
 */
export function independentHairFitFromRoot(rootBox,hairBox,headSize={},scalp=null){
 const h=normalizeHeadSize(headSize);
 const b=rootBox?.min,e=rootBox?.max;
 const hb=hairBox?.min,he=hairBox?.max;
 if(!b||!e||!hb||!he||
    ![b.x,b.y,b.z,e.x,e.y,e.z,hb.x,hb.y,hb.z,he.x,he.y,he.z]
      .every(Number.isFinite)||
    !(e.x>b.x&&e.y>b.y&&e.z>b.z&&he.y>hb.y)){
  throw Error('髪の根元帯の境界が無効です');
 }
 const scalpWidth=Number.isFinite(scalp?.width)?scalp.width:h.width;
 const scalpDepth=Number.isFinite(scalp?.depth)?scalp.depth:h.depth;
 const scalpTop=Number.isFinite(scalp?.top)?scalp.top:h.height*.5;
 const scalpFront=Number.isFinite(scalp?.frontZ)?scalp.frontZ:h.depth*.39;
 const scalpCenterX=Number.isFinite(scalp?.centerX)?scalp.centerX:0;
 const scalpCenterZ=Number.isFinite(scalp?.centerZ)?scalp.centerZ:0;
 // Scalp clearance is several millimetres, not a wide helmet-like gap.
 const margin=.0035;
 const sx=clamp((scalpWidth+margin*2)/Math.max(.035,e.x-b.x),.58,2.05);
 const sz=clamp((scalpDepth+margin*2)/Math.max(.035,e.z-b.z),.58,2.05);
 const sy=clamp(Math.sqrt(sx*sz),.6,1.85);
 const rootCenterX=(b.x+e.x)*.5;
 const rootCenterZ=(b.z+e.z)*.5;
 const crownY=scalpTop+margin;
 const position=freeze([
  scalpCenterX-rootCenterX*sx,
  crownY-e.y*sy,
  scalpCenterZ-rootCenterZ*sz+clamp(
   scalpFront-(e.z*sz+(scalpCenterZ-rootCenterZ*sz)),-.025,.025)
 ]);
 return freeze({scale:freeze([sx,sy,sz]),position,headSize:h,
  scalpGap:margin,crownY,foreheadZ:scalpFront,fitMethod:'root-band-real-scalp',
  scalpWidth,scalpDepth});
}
/**
 * Local-body collider proxy definition. 3D garment cloth and huge surfaces
 * are NOT intersected triangle-by-triangle in the mobile render loop.
 */
export function bodyCollisionProxies({width=.205,height=.235,depth=.205}={}){
 const h=normalizeHeadSize({width,height,depth});
 const w=h.width/.205,sy=h.height/.235,d=h.depth/.205;
 const item=(name,x,y,z,rx,ry,rz)=>freeze({
  name,center:freeze([x*w,y*sy,z*d]),
  radius:freeze([rx*w,ry*sy,rz*d])
 });
 return freeze([
  item('neck',0,-.122,-.004,.064,.10,.067),
  item('left-shoulder',-.144,-.235,-.008,.105,.076,.105),
  item('right-shoulder',.144,-.235,-.008,.105,.076,.105),
  item('chest',0,-.258,.06,.173,.126,.108),
  item('upper-back',0,-.26,-.078,.172,.148,.101)
 ]);
}
export function resolveHairBodyContact(point,colliders=[],clearance=.005){
 // Pure, bounded ellipsoid projection. Call for free ends only, never roots.
 let [x,y,z]=point;
 let hits=0;
 for(const collider of colliders){
  const [cx,cy,cz]=collider.center,[rx,ry,rz]=collider.radius;
  if(rx<=0||ry<=0||rz<=0)continue;
  let dx=x-cx,dy=y-cy,dz=z-cz;
  let q=Math.sqrt((dx/rx)**2+(dy/ry)**2+(dz/rz)**2);
  if(q>=1+clearance/Math.min(rx,ry,rz))continue;
  if(q<1e-5){dz=z<0?-1:1;dx=0;dy=0;q=Math.abs(dz/rz);}
  const target=1+clearance/Math.max(.025,Math.min(rx,ry,rz));
  const amount=Math.min(.06,Math.max(0,(target/q-1)*Math.hypot(dx,dy,dz)));
  const len=Math.hypot(dx,dy,dz)||1;
  x+=dx/len*amount;y+=dy/len*amount;z+=dz/len*amount;hits++;
 }
 return freeze({position:freeze([x,y,z]),hits});
}
export function classifyHairTriangle(x,y,z,box,headHeight){
 const scalpDepth=Math.max(.12,headHeight);
 const cZ=(box.min.z+box.max.z)/2;
 const halfW=Math.max(.02,(box.max.x-box.min.x)*.5);
 const crownFloor=box.max.y-scalpDepth*.28;
 if(y>=crownFloor)return 'crown';
 if(z>cZ+scalpDepth*.18 && y>box.max.y-scalpDepth*.94 &&
   Math.abs(x-(box.min.x+box.max.x)*.5)<halfW*.66)return 'fringe';
 if(x<box.min.x+halfW*.59)return 'left';
 if(x>box.max.x-halfW*.59)return 'right';
 return 'back';
}
export function createHairSpring({stiffness=35,damping=11}={}){
 let x=0,z=0,vx=0,vz=0;
 return {
  step({dt=1/60,velocityX=0,velocityZ=0,turnSpeed=0,wind=0}={}){
   const t=clamp(Number(dt)||1/60,1/240,.05);
   const targetX=clamp(-velocityX*.018-turnSpeed*.025+wind*.008,-.065,.065);
   const targetZ=clamp(-velocityZ*.014+Math.sin(wind)*.004,-.045,.045);
   vx+=(targetX-x)*stiffness*t;vz+=(targetZ-z)*stiffness*t;
   const attenuation=Math.exp(-damping*t);
   vx*=attenuation;vz*=attenuation;
   x=clamp(x+vx*t,-.075,.075);z=clamp(z+vz*t,-.055,.055);
   return freeze({x,z});
  },
  reset(){x=0;z=0;vx=0;vz=0}
 };
}
