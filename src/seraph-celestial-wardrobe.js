/**
 * Real skinned-rig-following celestial wardrobe for the Seraph's female form.
 *
 * This replaces the old one-piece tan photographic sack and round foot-ball
 * primitive. Shapes are separate tailored cloth / gold / leather parts, not
 * textures painted over anatomy. Parent frames are the existing native bones;
 * the approved face, feather wings, halo and combat animations stay untouched.
 */
import * as THREE from 'three';

export const SERAPH_VESTMENT_REVISION='seraph-tailored-vestment-v3-20261122';
const PI=Math.PI;
const detailCount=detail=>detail==='low'?12:32;

/** Capped, smooth, UV-mapped garment with real folds rather than a cone. */
function loft(rings,{detail='high',pleat=0,kind='tailored-cloth'}={}){
 const n=detailCount(detail),p=[],uv=[],indices=[];
 for(let k=0;k<rings.length;k++){
  const r=rings[k],t=k/(rings.length-1);
  for(let j=0;j<=n;j++){
   const a=j/n*2*PI;
   const wrinkle=1+pleat*Math.cos(a*10+t*1.4)*Math.sin(t*PI*.85);
   const rX=r.rx*wrinkle,rZ=r.rz*wrinkle;
   p.push(Math.cos(a)*rX,r.y,Math.sin(a)*rZ+(r.z||0));
   uv.push(j/n,t);
   if(k<rings.length-1&&j<n){
    const m=k*(n+1)+j,below=m+n+1;
    indices.push(m,below,m+1,m+1,below,below+1);
   }
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(indices);geo.computeVertexNormals();
 geo.userData={seraphVestment:kind,detail};
 return geo;
}
/** Two-dimensional tapered silk applique conforms to the front skirt curve.
 * Front of supplied attach API is -Z; the cosplay adapter rotates once. */
export function createSeraphTabardGeometry({detail='high',side=0}={}){
 const n=detail==='low'?6:18,cols=detail==='low'?4:12;
 const p=[],uv=[],idx=[];
 for(let i=0;i<=n;i++){
  const t=i/n,rad=.205+.29*t*t;
  const width=(side===0?.18:.14)*(.95+.10*Math.sin(t*PI));
  const center=side===0?0:side*(.27+.13*t*t);
  const front=side===0?-(rad+.014):-(.10+.10*t);
  for(let j=0;j<=cols;j++){
   const s=j/cols*2-1;
   p.push(center+width*s,
    .08-t*(side===0?.91:.83)+.018*Math.sin(j/cols*PI*4)*t,
    front-(side===0?.012:.08)*Math.sin(PI*(j/cols))-
      .01*(1-s*s)*Math.sin(PI*t*4));
   uv.push(j/cols,t);
   if(i<n&&j<cols){
    const a=i*(cols+1)+j,b=a+cols+1;
    idx.push(a,b,a+1,a+1,b,b+1);
   }
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(idx);g.computeVertexNormals();
 g.userData={seraphVestment:side===0?'embroidered-tabard':'side-silk-drape',detail};
 return g;
}
export function createSeraphShoeGeometry({detail='high'}={}){
 // Five rounded cross sections along the actual foot; no ellipsoid toes.
 const sections=[
  {z:-.425,rx:.016,cy:-.079,ry:.035},
  {z:-.385,rx:.075,cy:-.065,ry:.067},
  {z:-.29,rx:.114,cy:-.061,ry:.099},
  {z:-.125,rx:.123,cy:-.046,ry:.115},
  {z:.045,rx:.116,cy:-.050,ry:.111},
  {z:.159,rx:.092,cy:-.045,ry:.105},
  {z:.201,rx:.041,cy:-.048,ry:.064},
 ];
 const n=detail==='low'?12:32,p=[],uv=[],idx=[];
 for(let k=0;k<sections.length;k++){
  const s=sections[k];
  for(let j=0;j<=n;j++){
   const a=j/n*2*PI,x=Math.cos(a)*s.rx;
   const sin=Math.sin(a);
   const y=s.cy+sin*s.ry*(sin<0?.64:1);
   p.push(x,y,s.z);
   uv.push(j/n,k/(sections.length-1));
   if(k<sections.length-1&&j<n){
    const v=k*(n+1)+j,w=v+n+1;
    idx.push(v,w,v+1,v+1,w,w+1);
   }
  }
 }
 // End caps hold the toe and heel solid when turned in an attack pose.
 const toe=p.length/3;
 p.push(0,-.079,-.425);uv.push(.5,0);
 const heel=p.length/3;
 p.push(0,-.048,.201);uv.push(.5,1);
 for(let j=0;j<n;j++){
  idx.push(toe,j+1,j);
  const v=(sections.length-1)*(n+1)+j;
  idx.push(heel,v,v+1);
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(idx);g.computeVertexNormals();
 g.userData={seraphVestment:'last-shaped-boot',detail};
 return g;
}
function shoeSole(detail){
 const g=new THREE.BoxGeometry(.238,.032,.493,
  detail==='low'?1:3,1,detail==='low'?1:5);
 g.translate(0,-.164,-.118);
 g.userData={seraphVestment:'distinct-boot-outsole',detail};
 return g;
}
function ring(radius,tube=0.008,detail='high'){
 const g=new THREE.TorusGeometry(radius,tube,detail==='low'?5:8,detail==='low'?16:36);
 g.rotateX(PI/2);
 return g;
}
export function addSeraphCelestialVestment({frames,detail='high',attach,tube}={}){
 if(!frames?.chest||!frames?.pelvis||frames.legs?.length!==2||
    frames.calves?.length!==2||frames.feet?.length!==2)
  throw Error('Seraph tailored wardrobe requires native spine/pelvis/limb frames');
 const hi=detail!=='low';
 const add=(parent,g,role,name,p=[0,0,0],r=[0,0,0])=>
  attach(parent,g,role,'regal-seraph-'+name,p,r);
 const seam=(parent,role,name,points,thickness=.005)=>{
  if(!tube)return;
  tube(parent,role,'regal-seraph-'+name,points,thickness);
 };
 // Full body, not a torso ornament glued over exposed donor underwear.
 add(frames.chest,loft([
  {y:.335,rx:.164,rz:.129},{y:.24,rx:.213,rz:.160},
  {y:.09,rx:.226,rz:.169},{y:-.13,rx:.213,rz:.164},
  {y:-.35,rx:.184,rz:.150},{y:-.43,rx:.193,rz:.154}
 ],{detail,pleat:.014,kind:'fitted-ivory-satin-bodice'}),
 'seraphSatin','waist-fitted-bodice');
 add(frames.chest,loft([
  {y:.23,rx:.143,rz:.111},{y:.255,rx:.177,rz:.131},
  {y:.31,rx:.142,rz:.107},{y:.355,rx:.112,rz:.09}
 ],{detail,kind:'narrow-high-neckline'}),'seraphBrocade','tailored-collar');
 // Layered robe with independent slightly-open lower silhouette.
 add(frames.pelvis,loft([
  {y:.14,rx:.218,rz:.185},{y:.04,rx:.235,rz:.198},
  {y:-.20,rx:.305,rz:.245},{y:-.43,rx:.375,rz:.315},
  {y:-.68,rx:.442,rz:.385},{y:-.79,rx:.472,rz:.412},
  {y:-.86,rx:.486,rz:.422}
 ],{detail,pleat:.025,kind:'closed-under-robe'}),
 'seraphSatin','ivory-underskirt');
 add(frames.pelvis,loft([
  {y:-.826,rx:.484,rz:.418},{y:-.857,rx:.490,rz:.427},
  {y:-.873,rx:.492,rz:.429}
 ],{detail,kind:'soft-piped-hem'}),'seraphGold','delicate-gold-lower-piping');
 // A narrower brocade tabard (plus two contrasting layered silk drapes)
 // avoids the screenshot's huge flat photographic-linen curtain.
 add(frames.pelvis,createSeraphTabardGeometry({detail}),
  'seraphBrocade','front-embroidered-tabard');
 for(const side of [-1,1]){
  add(frames.pelvis,createSeraphTabardGeometry({detail,side}),
   'seraphOrganza','draped-side-panel-'+side);
  seam(frames.pelvis,'seraphGold','front-tabard-edge-'+side,[
   [side*.157,.058,-.228],[side*.166,-.20,-.278],
   [side*.186,-.50,-.397],[side*.192,-.80,-.52]],.006);
  // Embroidered vine follows the tabard; no flat dark rectangle drawn over it.
  seam(frames.pelvis,'seraphEmbroidery','gold-vine-'+side,[
   [side*.095,-.02,-.235],[side*.086,-.18,-.284],
   [side*.125,-.36,-.348],[side*.076,-.56,-.43],
   [side*.11,-.73,-.51]],hi?.0045:.006);
  // Tailored side cape anchors at waist, no extra floating cloth slab.
  add(frames.pelvis,loft([
   {y:.12,rx:.217,rz:.186},{y:.084,rx:.227,rz:.190},
   {y:.046,rx:.226,rz:.189}
  ],{detail,kind:'hip-belt-gold-seam'}),
  'seraphGold','gold-hip-belt-'+side);
 }
 // Real shaped shoulder cloth and hanging sleeves, not black exposed armpits.
 for(const side of [-1,1]){
  const i=side<0?0:1;
  add(frames.arms[i],loft([
   {y:.07,rx:.134,rz:.119},{y:-.12,rx:.126,rz:.112},
   {y:-.30,rx:.115,rz:.105},{y:-.44,rx:.129,rz:.115}
  ],{detail,pleat:.024,kind:'gathered-angel-sleeve'}),
  'seraphOrganza','soft-hanging-sleeve-'+side);
  add(frames.forearms[i],loft([
   {y:.02,rx:.091,rz:.09},{y:-.045,rx:.102,rz:.096},
   {y:-.080,rx:.09,rz:.091}
  ],{detail,kind:'wrist-cuff'}),'seraphGold','gold-wrist-cuff-'+side);
  add(frames.legs[i],loft([
   {y:.08,rx:.175,rz:.148},{y:-.27,rx:.151,rz:.135},
   {y:-.52,rx:.134,rz:.112}
  ],{detail,kind:'opaque-upper-leg-layer'}),
  'seraphLining','ivory-legging-'+side);
  // Boots: actual calf tapered shaft, separate leather upper and contact sole.
  add(frames.calves[i],loft([
   {y:.07,rx:.145,rz:.135},{y:-.045,rx:.151,rz:.135},
   {y:-.21,rx:.129,rz:.116},{y:-.35,rx:.109,rz:.11},
   {y:-.49,rx:.112,rz:.115}
  ],{detail,kind:'tapered-knee-high-leather'}),
  'summonBootLeather','knee-high-boot-shaft-'+side);
  add(frames.calves[i],ring(.142,.012,detail),'seraphGold',
   'shin-buckle-band-'+side,[0,-.09,-.012]);
  if(hi){
   seam(frames.calves[i],'seraphEmbroidery',
    'subtle-leather-side-seam-'+side,[
     [side*.118,.015,-.09],[side*.12,-.16,-.083],
     [side*.106,-.29,-.085],[side*.107,-.40,-.086]],.0032);
  }
  const foot=frames.feet[i]||frames.calves[i];
  const offset=frames.feet[i]?[0,0,0]:[0,-.49,0];
  add(foot,createSeraphShoeGeometry({detail}),
   'summonBootLeather','real-stitched-toe-boot-'+side,offset);
  add(foot,shoeSole(detail),'summonBootSole',
   'hard-leather-outsole-'+side,offset);
  // Reinforced cap crosses the boot at a realistic shoe-top location.
  if(hi){
   seam(foot,'seraphEmbroidery','rounded-toecap-stitch-'+side,[
    [-.091,-.002,-.30],[-.047,.021,-.32],[0,.024,-.33],
    [.047,.021,-.32],[.091,-.002,-.30]],.003);
  }
 }
 return true;
}
