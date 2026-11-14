/**
 * Data-driven, bone-anchored full-body outfits derived from the approved
 * six-character gothic-fantasy costume direction. These actually cover the
 * canonical source's swimsuit/underwear; ornaments alone do not.
 *
 * All cloth, armour and seams are optional ADDITIVE geometry owned by each
 * monster/creature actor; the hero's SkinnedMesh, rig and source GLB remain
 * unchanged. Separate LOD topology for inexpensive mobile preview.
 */
import * as THREE from 'three';

export const REGAL_HUMANOID_WARDROBE=Object.freeze({
 seraph_female:Object.freeze({style:'celestial-vestment',bodice:'ivoryCloth',
  hem:'ivoryCloth',trim:'gold',skirt:.99,flare:.49,sleeve:'ivoryCloth',
  sleeveLength:.42,leggings:null,head:'none'}),
 forest_spirit_female:Object.freeze({style:'living-leaf-robe',bodice:'leaf',
  hem:'leaf',trim:'gold',skirt:.82,flare:.40,sleeve:'leaf',
  sleeveLength:.36,leggings:'leaf',head:'none'}),
 dragonkin_female:Object.freeze({style:'scaled-regalia',bodice:'metal',
  hem:'velvet',trim:'gold',skirt:.72,flare:.30,sleeve:'metal',
  sleeveLength:.39,leggings:'metal',head:'draconic-mask'}),
 succubus:Object.freeze({style:'violet-gothic-gown',bodice:'velvet',
  hem:'velvet',trim:'edge',skirt:.77,flare:.37,sleeve:'velvet',
  sleeveLength:.30,leggings:'velvet',head:'none'}),
 vampire:Object.freeze({style:'aristocratic-frockcoat',bodice:'velvet',
  hem:'lining',trim:'edge',skirt:.82,flare:.30,sleeve:'velvet',
  sleeveLength:.47,leggings:'cloth',head:'none'}),
 gargoyle:Object.freeze({style:'stone-demon-carapace',bodice:'skin',
  hem:'metal',trim:'edge',skirt:.54,flare:.29,sleeve:'skin',
  sleeveLength:.32,leggings:'skin',head:'none'}),
 demon:Object.freeze({style:'infernal-war-regalia',bodice:'metal',
  hem:'velvet',trim:'gold',skirt:.61,flare:.31,sleeve:'metal',
  sleeveLength:.38,leggings:'metal',head:'none'}),
 imp:Object.freeze({style:'imp-leather-tunic',bodice:'cloth',
  hem:'cloth',trim:'edge',skirt:.53,flare:.28,sleeve:'cloth',
  sleeveLength:.30,leggings:'cloth',head:'none'}),
 tengu:Object.freeze({style:'tengu-ceremonial-coat',bodice:'cloth',
  hem:'cloth',trim:'edge',skirt:.66,flare:.32,sleeve:'cloth',
  sleeveLength:.33,leggings:'cloth',head:'none'}),
 lich:Object.freeze({style:'lich-ritual-robes',bodice:'velvet',
  hem:'velvet',trim:'metal',skirt:.91,flare:.36,sleeve:'velvet',
  sleeveLength:.48,leggings:'cloth',head:'none'}),
 death_knight:Object.freeze({style:'death-knight-plate',bodice:'metal',
  hem:'velvet',trim:'edge',skirt:.66,flare:.30,sleeve:'metal',
  sleeveLength:.38,leggings:'metal',head:'none'}),
 dark_knight:Object.freeze({style:'dark-knight-armour',bodice:'metal',
  hem:'velvet',trim:'edge',skirt:.68,flare:.31,sleeve:'metal',
  sleeveLength:.42,leggings:'metal',head:'none'}),
 skeleton:Object.freeze({style:'skeletal-knight-surcoat',bodice:'cloth',
  hem:'cloth',trim:'metal',skirt:.61,flare:.26,sleeve:'cloth',
  sleeveLength:.33,leggings:'cloth',head:'none'}),
});
export const wardrobeFor=profile=>REGAL_HUMANOID_WARDROBE[profile?.costume]??null;

const detailSegments=(detail)=>detail==='low'?10:28;
function loftRings(rings,{detail='high',pleat=0,name='layered-cloth'}={}){
 const n=detailSegments(detail),pos=[],uv=[],indices=[];
 const out=Array.isArray(rings)&&rings.length>=2?rings:[];
 if(!out.length)throw Error('Invalid outfit rings');
 for(let k=0;k<out.length;k++){
  const r=out[k];
  if(![r.y,r.rx,r.rz].every(Number.isFinite)||r.rx<=0||r.rz<=0)
   throw Error('Invalid outfit ring');
  for(let j=0;j<=n;j++){
   const a=j/n*Math.PI*2;
   const fold=1+pleat*Math.cos(12*a+k*.43);
   pos.push(Math.cos(a)*r.rx*fold,r.y,Math.sin(a)*r.rz*fold+(r.z??0));
   uv.push(j/n,k/(out.length-1));
   if(k<out.length-1&&j<n){
    const x=k*(n+1)+j,y=x+n+1;
    indices.push(x,y,x+1,x+1,y,y+1);
   }
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 g.setIndex(indices);
 g.computeVertexNormals();
 g.userData={kind:name,detail};
 return g;
}
/** Sized for the canonical Spine_02 joint. Covers chest, waist and back
 * without converting the underlying heroine into a second static mannequin. */
export function createRegalBodiceGeometry({detail='high',armoured=false}={}){
 const rings=[
  {y:.34,rx:.205,rz:.135},
  {y:.18,rx:.235,rz:.166},
  {y:.00,rx:.235,rz:.169},
  {y:-.18,rx:.200,rz:.150},
  {y:-.40,rx:.206,rz:.153}
 ];
 if(armoured)for(const r of rings){r.rx*=1.055;r.rz*=1.065;}
 return loftRings(rings,{detail,pleat:armoured?.018:.014,
  name:armoured?'articulated-full-torso-plate':'full-torso-fitted-garment'});
}
/** A genuine 360-degree gown/coat panel attached to PELVIS. The top overlaps
 * the chest hem; the bottom hides the swimsuit without detaching on walking.
 * This is a structural skirt, not only a cape behind the actor. */
export function createRegalSkirtGeometry({
 detail='high',length=.9,flare=.37,style='celestial'
}={}){
 if(!Number.isFinite(length)||length<=0||length>1.5)
  throw Error('Invalid regal skirt length');
 const rings=[];
 const rows=detail==='low'?6:14;
 for(let i=0;i<=rows;i++){
  const t=i/rows,hem=Math.sin(Math.PI*t)*.013;
  rings.push({
   y:.13-length*t,
   rx:.216+flare*t*t+.018*Math.sin(t*3.5),
   rz:.178+flare*.63*t*t+hem,
   z:-.012+t*.013
  });
 }
 return loftRings(rings,{detail,pleat:style==='celestial'?.042:.038,
  name:'fully-enclosed-'+style+'-robe'});
}
/** Round seam is wider than fabric at the end, ensuring no floating line. */
export function createRegalHemGeometry({detail='high',rx=.23,rz=.18}={}){
 return loftRings([
  {y:.015,rx:rx*.99,rz:rz*.99},
  {y:0,rx,rz},
  {y:-.028,rx:rx*1.02,rz:rz*1.02}
 ],{detail,name:'rolled-tailored-hem'});
}
/** Arms and legs are joint-specific. Each smooth sleeve is on the corresponding
 * upper arm and each boot on the corresponding calf, following native clips. */
export function createRegalLimbGeometry({
 detail='high',length=.42,top=.135,bottom=.093,
 kind='sleeve'
}={}){
 return loftRings([
  {y:.055,rx:top*.92,rz:top*.91},
  {y:.018,rx:top,rz:top*.98},
  {y:-length*.54,rx:(top+bottom)*.55,rz:(top+bottom)*.51},
  {y:-length+.017,rx:bottom,rz:bottom*.99},
  {y:-length-.022,rx:bottom*1.06,rz:bottom*1.04}
 ],{detail,pleat:kind==='sleeve'?.025:.009,
  name:kind==='sleeve'?'full-arm-costume-sleeve':'armoured-leg-or-boot'});
}
/**
 * Chest-bone yoke sits underneath the movable upper-arm sleeves. Its rim
 * overlaps the collar and torso (rather than leaving a square shoulder hole
 * between an independent shoulder pad and a nearly naked source character).
 * One mesh is used for both shoulders to avoid detached floating pad pieces.
 */
export function createRegalShoulderYokeGeometry({
 detail='high',armoured=false
}={}){
 const scale=armoured?1.035:1;
 return loftRings([
  {y:.335,rx:.166,rz:.126},
  {y:.285,rx:.235*scale,rz:.169*scale},
  {y:.235,rx:.288*scale,rz:.194*scale},
  {y:.145,rx:.302*scale,rz:.207*scale},
  {y:.075,rx:.241*scale,rz:.177*scale},
  {y:-.035,rx:.232*scale,rz:.172*scale}
 ],{detail,pleat:armoured?.009:.020,
  name:armoured?'shoulder-yoke-articulated-plate':'shoulder-yoke-tailored-cloth'});
}
/**
 * Neckline tapers TOWARD the neck. The older collar widened at the top,
 * forming a floating hollow ring above the shoulder gap. The lower ring
 * overlaps the underlying yoke; no detached trim is constructed.
 */
export function createRegalCollarGeometry({detail='high'}={}){
 return loftRings([
  {y:.265,rx:.179,rz:.136},
  {y:.313,rx:.158,rz:.120},
  {y:.375,rx:.130,rz:.100},
  {y:.427,rx:.108,rz:.088}
 ],{detail,pleat:.012,name:'wrapped-ceremonial-collar'});
}
const needsLeggings=p=>p?.leggings!==null;
export function addRegalHumanoidOutfit({profile,frames,detail='high',attach,tube}={}){
 const plan=wardrobeFor(profile);
 if(!plan)return false;
 if(!frames?.chest||!frames?.pelvis||frames.arms?.length!==2||
    frames.calves?.length!==2)
  throw Error('Regal outfit requires full torso, pelvic and articulated arm/leg frames');
 const add=(parent,g,role,name,p=[0,0,0],r=[0,0,0])=>
  attach(parent,g,role,'regal-'+name,p,r);
 const decorated=['dragonkin_female','demon','gargoyle','death_knight','dark_knight'].includes(profile.costume);
 add(frames.chest,createRegalBodiceGeometry({detail,armoured:decorated}),
  plan.bodice,plan.style+'-fitted-bodice');
 // One continuous shoulder closure overlaps both torso and arm sleeve roots
 // while remaining parented to the animated chest bone.
 add(frames.chest,createRegalShoulderYokeGeometry({
  detail,armoured:decorated
 }),plan.bodice,plan.style+'-shoulder-yoke');
 add(frames.chest,createRegalCollarGeometry({detail}),
  plan.trim,plan.style+'-collar');
 add(frames.pelvis,createRegalSkirtGeometry({
   detail,length:plan.skirt,flare:plan.flare,style:plan.style
 }),plan.hem,plan.style+'-full-skirt');
 add(frames.pelvis,createRegalHemGeometry({detail,
  rx:.216+plan.flare,rz:.178+plan.flare*.63}),
  plan.trim,plan.style+'-floor-hem',[0,.13-plan.skirt,0]);
 for(const side of [-1,1]){
  const i=side<0?0:1;
  add(frames.arms[i],createRegalLimbGeometry({
   detail,length:plan.sleeveLength,kind:'sleeve',
   top:.137,bottom:.104
  }),plan.sleeve,plan.style+'-sleeve-'+i);
  add(frames.forearms[i],createRegalLimbGeometry({
   detail,length:.31,kind:'sleeve',top:.097,bottom:.071
  }),plan.trim,plan.style+'-bracelet-'+i);
  if(needsLeggings(plan)){
   add(frames.calves[i],createRegalLimbGeometry({
    detail,length:.46,kind:'boot',top:.126,bottom:.105
   }),plan.leggings,plan.style+'-boot-'+i);
  }
 }
 // Gold/leaf embroidery is welded to the SAME torso bone and embedded over
 // the front of its bodice. The actor adapter reflects old -Z front to +Z.
 if(tube){
  for(const side of [-1,1]){
   tube(frames.chest,plan.trim,'regal-'+plan.style+'-embroidered-lapel-'+side,[
    [side*.18,.25,-.132],[side*.20,.09,-.190],
    [side*.11,-.20,-.17],[side*.06,-.35,-.15]
   ],detail==='low'?.010:.006);
  }
 }
 return true;
}
