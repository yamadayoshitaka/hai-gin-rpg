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
